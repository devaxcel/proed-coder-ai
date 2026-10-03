/**
 * Parses CMS's HCPCS Level II quarterly/annual update file
 * ("HCPC<year>_<MON>_ANWEB_<date>.txt") into HcpcsLevelIIEntry rows.
 *
 * Source: https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update
 *
 * FORMAT — verified against a real CMS file (October 2026 release) plus its
 * accompanying "*_recordlayout.txt" doc that ships in the same zip. It's a
 * fixed-width ASCII file, NOT CSV. Confirmed column positions (1-indexed, as
 * CMS documents them):
 *
 *   Code                 cols 1-5
 *   Record ID (RIC)      col  11   — "3"/"7" = first line of a record (has
 *                                     all fields); "4"/"8" = a continuation
 *                                     line that only carries more of the
 *                                     long description, nothing else
 *   Long Description     cols 12-91  (80 chars)
 *   Short Description    cols 92-119 (28 chars)
 *   Coverage Code        col  230
 *   Action Effective Date cols 277-284 (YYYYMMDD)
 *   Termination Date     cols 285-292 (YYYYMMDD)
 *   Action Code          col  293
 *
 * Long descriptions over 80 characters continue on one or more extra lines
 * (RIC "4"/"8") with the SAME code repeated and every other field blank —
 * those lines are appended onto the prior record's long description rather
 * than treated as separate rows.
 *
 * RIC "3"/"4" = an actual HCPCS Level II procedure code record. RIC "7"/"8"
 * = a MODIFIER record (e.g. "AB", "AC") — this file bundles modifiers in
 * alongside procedure codes, but this app already has a dedicated Modifier
 * Search feature with curated, real modifier descriptions
 * (lib/modifier-data.ts), so this parser deliberately SKIPS RIC 7/8 rows to
 * avoid dumping a second, less-curated copy of modifiers into the HCPCS
 * procedure-code table. Tested against the real Oct 2026 file: 16,900 raw
 * lines are 8,770 procedure records + their continuations (plus 384
 * modifier records + continuations, skipped here) — collapsing to 8,770
 * actual HcpcsLevelIIEntry rows once multi-line descriptions are merged.
 *
 * If CMS changes this layout in a future release (they have changed column
 * positions across years before), re-check the current "*_recordlayout.txt"
 * that ships in the same zip and update COLUMNS below to match — don't
 * guess from this comment alone once a year or two has passed.
 *
 * ALWAYS run with --dry-run first.
 *
 * USAGE:
 *   npx tsx scripts/cms-data/parse-hcpcs-quarterly.ts --file ./cms-raw/HCPC2026_OCT_ANWEB_09232026.txt --quarter 2026Q4 --dry-run
 *   npx tsx scripts/cms-data/parse-hcpcs-quarterly.ts --file ./cms-raw/HCPC2026_OCT_ANWEB_09232026.txt --quarter 2026Q4
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

// ---------- resume / retry support ----------
// Neon's serverless Postgres can close an idle or long-running connection
// mid-import (P1017 "Server has closed the connection") — routine for a
// bulk load like this, not a sign anything is wrong. Progress is
// checkpointed to a local file after every successful batch, and a dropped
// connection is retried with a fresh PrismaClient a few times before giving
// up, so re-running after an interruption resumes instead of starting over.

function checkpointPath(quarter: string): string {
  return `.hcpcs-import-checkpoint-${quarter}.json`;
}

function readCheckpoint(quarter: string): number {
  const p = checkpointPath(quarter);
  if (!existsSync(p)) return 0;
  try {
    return JSON.parse(readFileSync(p, "utf8")).completed ?? 0;
  } catch {
    return 0;
  }
}

function writeCheckpoint(quarter: string, completed: number): void {
  writeFileSync(checkpointPath(quarter), JSON.stringify({ completed }));
}

function clearCheckpoint(quarter: string): void {
  const p = checkpointPath(quarter);
  if (existsSync(p)) unlinkSync(p);
}

function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("P1017") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("ECONNRESET") ||
    msg.includes("Connection terminated") ||
    msg.includes("Closed")
  );
}

// 0-indexed [start, end) slices, converted from CMS's 1-indexed column doc.
const COLUMNS = {
  code: [0, 5],
  ric: [10, 11],
  longDesc: [11, 91],
  shortDesc: [91, 119],
  coverage: [229, 230],
  effectiveDate: [276, 284],
  terminationDate: [284, 292],
  actionCode: [292, 293],
} as const;

interface ParsedRow {
  code: string;
  shortDesc: string;
  longDesc?: string;
  coverageCode?: string;
  actionCode?: string;
  effectiveDate?: Date;
  terminationDate?: Date;
}

function slice(line: string, [start, end]: readonly [number, number]): string {
  return line.slice(start, end).trim();
}

// CMS dates in this file are plain YYYYMMDD with no separators.
function parseYyyymmdd(s: string): Date | undefined {
  if (!s || !/^\d{8}$/.test(s)) return undefined;
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseFixedWidth(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: ParsedRow[] = [];
  let last: ParsedRow | null = null;
  let lastCode: string | null = null;

  for (const line of lines) {
    if (line.length < 11) continue; // too short to even have a RIC — skip stray/footer lines
    const code = slice(line, COLUMNS.code);
    const ric = slice(line, COLUMNS.ric);
    const longDescPart = slice(line, COLUMNS.longDesc);

    if (ric === "7" || ric === "8") {
      // Modifier record/continuation — deliberately skipped, see the note
      // at the top of this file. Reset `last`/`lastCode` so a stray
      // procedure continuation line can't accidentally merge into a
      // modifier row or vice versa.
      last = null;
      lastCode = null;
      continue;
    }

    if (ric === "3") {
      // First line of a procedure record — carries every field.
      const shortDesc = slice(line, COLUMNS.shortDesc);
      const row: ParsedRow = {
        code,
        shortDesc: shortDesc || longDescPart || "(no description in source file)",
        longDesc: longDescPart || undefined,
        coverageCode: slice(line, COLUMNS.coverage) || undefined,
        actionCode: slice(line, COLUMNS.actionCode) || undefined,
        effectiveDate: parseYyyymmdd(slice(line, COLUMNS.effectiveDate)),
        terminationDate: parseYyyymmdd(slice(line, COLUMNS.terminationDate)),
      };
      rows.push(row);
      last = row;
      lastCode = code;
    } else if (ric === "4") {
      // Continuation line — only extends the long description of the
      // immediately preceding record for the same code.
      if (last && lastCode === code && longDescPart) {
        last.longDesc = last.longDesc ? `${last.longDesc} ${longDescPart}` : longDescPart;
      }
      // else: an orphaned continuation line with no matching first line —
      // silently skip rather than guess which record it belongs to.
    }
    // Any other RIC value: not a record-carrying line (header/footer/etc.) — skip.
  }

  return rows;
}

// One multi-row "INSERT ... ON CONFLICT DO UPDATE" per batch instead of one
// upsert() round-trip per code — same fix as the ICD-10 script, for the
// same reason (500+ separate round-trips per batch was the real bottleneck,
// not the parsing).
async function bulkUpsertRows(db: PrismaClient, batch: ParsedRow[], quarter: string): Promise<void> {
  // Same defensive dedup as the ICD-10 script — a single multi-row INSERT
  // can't ON CONFLICT DO UPDATE the same code twice in one statement.
  // HCPCS codes checked clean during verification, but this guards against
  // ever crashing the whole import over it regardless of cause.
  const dedupedByCode = new Map<string, ParsedRow>();
  for (const row of batch) dedupedByCode.set(row.code, row);
  const deduped = [...dedupedByCode.values()];
  if (deduped.length !== batch.length) {
    console.warn(
      `  [warning] batch had ${batch.length - deduped.length} duplicate code(s) within one batch — kept the last occurrence of each, dropped the rest.`
    );
  }

  const values = deduped.map(
    (r) => Prisma.sql`(
      ${randomUUID()}, ${r.code}, ${r.shortDesc}, ${r.longDesc ?? null}, ${r.coverageCode ?? null},
      ${r.actionCode ?? null}, ${r.effectiveDate ?? null}, ${r.terminationDate ?? null}, ${quarter}, now(), now()
    )`
  );

  await db.$executeRaw(Prisma.sql`
    INSERT INTO "HcpcsLevelIIEntry"
      (id, code, "shortDesc", "longDesc", "coverageCode", "actionCode", "effectiveDate", "terminationDate",
       quarter, "createdAt", "updatedAt")
    VALUES ${Prisma.join(values)}
    ON CONFLICT (code) DO UPDATE SET
      "shortDesc" = EXCLUDED."shortDesc",
      "longDesc" = EXCLUDED."longDesc",
      "coverageCode" = EXCLUDED."coverageCode",
      "actionCode" = EXCLUDED."actionCode",
      "effectiveDate" = EXCLUDED."effectiveDate",
      "terminationDate" = EXCLUDED."terminationDate",
      quarter = EXCLUDED.quarter,
      "updatedAt" = now()
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const quarterIdx = args.indexOf("--quarter");
  const dryRun = args.includes("--dry-run");

  if (fileIdx === -1 || quarterIdx === -1) {
    console.error(
      "Usage: npx tsx scripts/cms-data/parse-hcpcs-quarterly.ts --file <path to CMS .txt> --quarter 2026Q4 [--dry-run]"
    );
    process.exit(1);
  }

  const filePath = args[fileIdx + 1];
  const quarter = args[quarterIdx + 1];
  // CMS ships this file in Latin-1/Windows-1252, not UTF-8 — reading as utf8
  // would mangle any non-ASCII character (rare, but it happens in a handful
  // of descriptions).
  const text = readFileSync(filePath, "latin1");
  const rows = parseFixedWidth(text);

  console.log(`Parsed ${rows.length} HCPCS/modifier records from ${filePath}`);

  if (dryRun) {
    console.log("\n--- DRY RUN: first 10 rows ---");
    for (const r of rows.slice(0, 10)) console.log(JSON.stringify(r));
    console.log("\n--- DRY RUN: 5 rows with a merged multi-line description (sanity check) ---");
    for (const r of rows.filter((r) => (r.longDesc?.length ?? 0) > 80).slice(0, 5)) {
      console.log(JSON.stringify(r));
    }
    console.log("\nNo database changes made (--dry-run).");
    return;
  }

  let db = new PrismaClient();
  const startAt = readCheckpoint(quarter);
  if (startAt > 0) {
    console.log(`Resuming from checkpoint: ${startAt} / ${rows.length} already written.`);
  }

  try {
    console.log("Writing to database in batches of 1000 (safe to re-run if this is interrupted — it resumes)...");
    const BATCH = 1000;
    const MAX_ATTEMPTS = 5;

    for (let i = startAt; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      for (let attempt = 1; ; attempt++) {
        try {
          await bulkUpsertRows(db, batch, quarter);
          break; // batch succeeded
        } catch (err) {
          if (!isConnectionError(err) || attempt >= MAX_ATTEMPTS) throw err;
          const waitMs = Math.min(2000 * attempt, 15000);
          console.warn(
            `  [connection dropped, attempt ${attempt}/${MAX_ATTEMPTS}] reconnecting in ${waitMs}ms and retrying this batch...`
          );
          await db.$disconnect().catch(() => {});
          await new Promise((r) => setTimeout(r, waitMs));
          db = new PrismaClient();
        }
      }

      const done = Math.min(i + BATCH, rows.length);
      console.log(`  ${done} / ${rows.length}`);
      writeCheckpoint(quarter, done);
    }

    clearCheckpoint(quarter);
    console.log("Done.");
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});