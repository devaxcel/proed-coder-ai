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

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

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

  const db = new PrismaClient();
  try {
    console.log("Writing to database in batches of 500...");
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      await db.$transaction(
        batch.map((r) =>
          db.hcpcsLevelIIEntry.upsert({
            where: { code: r.code },
            update: { ...r, quarter },
            create: { ...r, quarter },
          })
        )
      );
      console.log(`  ${Math.min(i + 500, rows.length)} / ${rows.length}`);
    }
    console.log("Done.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
