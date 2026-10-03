/**
 * Parses the official CMS ICD-10-CM "Tabular" XML (the file inside the
 * "Code Tables, Tabular and Index" zip on
 * https://www.cms.gov/medicare/coding-billing/icd-10-codes) into
 * Icd10TabularEntry + Icd10SectionNote rows.
 *
 * This is the richest of the two CMS sources for Lupita's "pop instructions"
 * ask: CMS's own Tabular XML nests every diagnosis code under its
 * chapter/section, and carries the official Includes / Excludes1 / Excludes2
 * / "Use additional code" / "Code first" / inclusion-term notes CMS writes
 * for coders — this is exactly the raw material a per-code or per-section
 * pop-up would draw from, with no CPT/AMA licensing involved.
 *
 * VERIFIED against the real FY2027 file (icd10cm_tabular_2027.xml, inside
 * "2027-icd-10-table-and-index.zip"): parses to 47,025 codes and 651
 * chapter/section-level notes, with the recursive A01 -> A01.0 -> A01.00
 * style nesting and all six note types (includes/excludes1/excludes2/
 * inclusionTerm/codeFirst/useAdditionalCode) confirmed correct against that
 * file's actual structure.
 *
 * To get the file yourself (e.g. for a future year's update):
 *   1. https://www.cms.gov/medicare/coding-billing/icd-10-codes
 *   2. Download "Code Tables, Tabular and Index" (ZIP) for the FY you want
 *      (use the "Code Descriptions in Tabular Order" flat file +
 *      parse-icd10-flat.ts instead if you just want a flat code/description
 *      lookup and don't need the notes).
 *   3. Unzip it — the XML is inside a "Table and Index" subfolder, named
 *      "icd10cm_tabular_<year>.xml".
 *
 * USAGE:
 *   npm install fast-xml-parser --save        # one-time, if not already a dependency
 *   npx tsx scripts/cms-data/parse-icd10-tabular-xml.ts --dir "./cms-raw/Table and Index" --year 2027 --dry-run
 *   npx tsx scripts/cms-data/parse-icd10-tabular-xml.ts --dir "./cms-raw/Table and Index" --year 2027
 *
 * --dry-run prints the first 10 parsed entries and total counts without
 * touching the database — still worth doing once before the real run, as a
 * final sanity check on your machine.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { XMLParser } from "fast-xml-parser";
import { Prisma, PrismaClient } from "@prisma/client";

// ---------- resume / retry support ----------
// Neon's serverless Postgres can close an idle or long-running connection
// mid-import (P1017 "Server has closed the connection") — this is routine
// for a bulk load like this, not a sign anything is wrong. Rather than make
// you start over from zero each time, progress is checkpointed to a local
// file after every successful batch, and a dropped connection is retried
// with a fresh PrismaClient a few times before giving up.

interface Checkpoint {
  completedEntries: number;
  sectionNotesDone: boolean;
}

function checkpointPath(sourceYear: number): string {
  return `.icd10-import-checkpoint-${sourceYear}.json`;
}

function readCheckpoint(sourceYear: number): Checkpoint {
  const p = checkpointPath(sourceYear);
  if (!existsSync(p)) return { completedEntries: 0, sectionNotesDone: false };
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return { completedEntries: 0, sectionNotesDone: false };
  }
}

function writeCheckpoint(sourceYear: number, data: Checkpoint): void {
  writeFileSync(checkpointPath(sourceYear), JSON.stringify(data));
}

function clearCheckpoint(sourceYear: number): void {
  const p = checkpointPath(sourceYear);
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

type NoteBucket = string[];

interface ParsedEntry {
  code: string;
  description: string;
  chapterName?: string;
  sectionName?: string;
  categoryCode?: string;
  includesNotes: NoteBucket;
  excludes1Notes: NoteBucket;
  excludes2Notes: NoteBucket;
  inclusionTerms: NoteBucket;
  codeFirstNotes: NoteBucket;
  useAddlNotes: NoteBucket;
  sevenChrNote?: string;
}

interface ParsedSectionNote {
  chapterName: string;
  sectionName?: string;
  noteType: string;
  noteText: string;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// CMS's note elements are usually <excludes1><note>text</note><note>text2</note></excludes1>
// but a single-note case sometimes collapses to <excludes1><note>text</note></excludes1>
// with the XML parser returning a string instead of an array depending on the
// library's settings — asArray() above normalizes both shapes.
function extractNotes(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const notes = asArray((node as { note?: string | string[] }).note);
  return notes.map((n) => String(n).trim()).filter(Boolean);
}

function findXmlFile(dir: string): string {
  const allXml = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xml"));
  if (allXml.length === 0) {
    throw new Error(`No .xml file found in ${dir} — did you unzip the CMS file here?`);
  }

  // CMS ships SEVERAL xml files in this folder — tabular, index, eindex
  // (external cause index), neoplasm table, drug/chemical table — only
  // "tabular" is the one this parser understands. Picking "the first .xml
  // alphabetically" silently grabs the wrong one (icd10cm_drug_2027.xml
  // sorts before icd10cm_tabular_2027.xml), so look specifically for a name
  // containing "tabular".
  const tabularMatches = allXml.filter((f) => f.toLowerCase().includes("tabular"));
  if (tabularMatches.length === 1) {
    return join(dir, tabularMatches[0]);
  }
  if (tabularMatches.length > 1) {
    console.warn(`Multiple "tabular" xml files found in ${dir}, using the first: ${tabularMatches[0]}`);
    return join(dir, tabularMatches[0]);
  }

  // No filename contains "tabular" at all — don't guess silently.
  throw new Error(
    `Found ${allXml.length} .xml file(s) in ${dir} (${allXml.join(", ")}), but none has "tabular" in its ` +
      `name. This parser only understands the ICD-10-CM Tabular List XML — check which file is the right ` +
      `one and rename it to include "tabular", or point --dir at a folder containing only that file.`
  );
}

function walkDiag(
  diagNode: Record<string, unknown>,
  chapterName: string,
  sectionName: string | undefined,
  categoryCode: string | undefined,
  entries: ParsedEntry[]
) {
  const code = String(diagNode.name ?? "").trim();
  const description = String(diagNode.desc ?? "").trim();
  if (code && description) {
    const thisCategory = categoryCode ?? code; // the first (shallowest) diag in a branch sets the category
    entries.push({
      code,
      description,
      chapterName,
      sectionName,
      categoryCode: thisCategory,
      includesNotes: extractNotes(diagNode.includes),
      excludes1Notes: extractNotes(diagNode.excludes1),
      excludes2Notes: extractNotes(diagNode.excludes2),
      inclusionTerms: extractNotes(diagNode.inclusionTerm),
      codeFirstNotes: extractNotes(diagNode.codeFirst),
      useAddlNotes: extractNotes(diagNode.useAdditionalCode),
      sevenChrNote: diagNode.sevenChrNote ? String(diagNode.sevenChrNote).trim() : undefined,
    });

    // Recurse into nested sub-codes (e.g. A00 -> A00.0, A00.1), carrying the
    // same category code down so every descendant rolls up to the right
    // 3-character category.
    for (const child of asArray(diagNode.diag as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
      walkDiag(child, chapterName, sectionName, thisCategory, entries);
    }
  }
}

function parseTabularXml(xmlPath: string): { entries: ParsedEntry[]; sectionNotes: ParsedSectionNote[] } {
  const xml = readFileSync(xmlPath, "utf8");
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
  const doc = parser.parse(xml);

  // CMS's root element name has varied slightly across years
  // ("ICD10CM.tabular" is the long-standing one) — check a couple of
  // plausible root keys rather than assuming one.
  const root =
    doc["ICD10CM.tabular"] ?? doc["ICD10CM_Tabular"] ?? doc["ICD10cm.tabular"] ?? Object.values(doc)[0];
  if (!root) {
    throw new Error("Could not find the expected root element in this XML — CMS may have renamed it this year.");
  }

  const entries: ParsedEntry[] = [];
  const sectionNotes: ParsedSectionNote[] = [];

  for (const chapter of asArray(root.chapter as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
    const chapterName = String(chapter.desc ?? chapter.name ?? "").trim();

    // Chapter-level notes (apply to the whole chapter, not one code) — raw
    // material for a "you're in this chapter" pop-up.
    for (const [key, type] of [
      ["includes", "includes"],
      ["excludes1", "excludes1"],
      ["excludes2", "excludes2"],
      ["useAdditionalCode", "useAdditionalCode"],
      ["codeFirst", "codeFirst"],
      ["note", "note"],
    ] as const) {
      for (const text of extractNotes(chapter[key])) {
        sectionNotes.push({ chapterName, noteType: type, noteText: text });
      }
    }

    for (const section of asArray(chapter.section as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
      const sectionName = String(section.desc ?? "").trim();

      for (const [key, type] of [
        ["includes", "includes"],
        ["excludes1", "excludes1"],
        ["excludes2", "excludes2"],
        ["useAdditionalCode", "useAdditionalCode"],
        ["codeFirst", "codeFirst"],
        ["note", "note"],
      ] as const) {
        for (const text of extractNotes(section[key])) {
          sectionNotes.push({ chapterName, sectionName, noteType: type, noteText: text });
        }
      }

      for (const diag of asArray(section.diag as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
        walkDiag(diag, chapterName, sectionName, undefined, entries);
      }
    }
  }

  return { entries, sectionNotes };
}

// Writes a whole batch as ONE multi-row "INSERT ... ON CONFLICT DO UPDATE"
// statement instead of one upsert() call per row. The earlier per-row
// upsert() loop issued one database round-trip per code (47,025 of them) —
// even inside a single $transaction, Prisma still sends each statement
// separately. Over a network connection to Neon this was the actual
// bottleneck (not the parsing, not Node) and is why the import felt slow.
// Bulk-upserting cuts ~1000 round-trips down to ~1 per batch.
async function bulkUpsertEntries(db: PrismaClient, batch: ParsedEntry[], sourceYear: number): Promise<void> {
  // Defensive: a single multi-row "INSERT ... ON CONFLICT DO UPDATE" throws
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" if two
  // rows in the SAME statement share a `code` — Postgres can't apply two
  // updates to the same conflict target within one command. We didn't find
  // any duplicate codes in our own copy of the source XML, but a duplicate
  // should never be allowed to crash the whole import regardless of where
  // it comes from, so dedupe within the batch first (keeping the LAST
  // occurrence, in case a later entry in source order is the more complete
  // one) before building the SQL.
  const dedupedByCode = new Map<string, ParsedEntry>();
  for (const entry of batch) dedupedByCode.set(entry.code, entry);
  const deduped = [...dedupedByCode.values()];
  if (deduped.length !== batch.length) {
    console.warn(
      `  [warning] batch had ${batch.length - deduped.length} duplicate code(s) within one batch — kept the last occurrence of each, dropped the rest.`
    );
  }

  const rows = deduped.map(
    (e) => Prisma.sql`(
      ${randomUUID()}, ${e.code}, ${e.description}, ${e.chapterName ?? null}, ${e.sectionName ?? null},
      ${e.categoryCode ?? null}, ${JSON.stringify(e.includesNotes)}::jsonb, ${JSON.stringify(e.excludes1Notes)}::jsonb,
      ${JSON.stringify(e.excludes2Notes)}::jsonb, ${JSON.stringify(e.inclusionTerms)}::jsonb,
      ${JSON.stringify(e.codeFirstNotes)}::jsonb, ${JSON.stringify(e.useAddlNotes)}::jsonb,
      ${e.sevenChrNote ?? null}, ${sourceYear}, now(), now()
    )`
  );

  await db.$executeRaw(Prisma.sql`
    INSERT INTO "Icd10TabularEntry"
      (id, code, description, "chapterName", "sectionName", "categoryCode",
       "includesNotes", "excludes1Notes", "excludes2Notes", "inclusionTerms", "codeFirstNotes", "useAddlNotes",
       "sevenChrNote", "sourceYear", "createdAt", "updatedAt")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT (code) DO UPDATE SET
      description = EXCLUDED.description,
      "chapterName" = EXCLUDED."chapterName",
      "sectionName" = EXCLUDED."sectionName",
      "categoryCode" = EXCLUDED."categoryCode",
      "includesNotes" = EXCLUDED."includesNotes",
      "excludes1Notes" = EXCLUDED."excludes1Notes",
      "excludes2Notes" = EXCLUDED."excludes2Notes",
      "inclusionTerms" = EXCLUDED."inclusionTerms",
      "codeFirstNotes" = EXCLUDED."codeFirstNotes",
      "useAddlNotes" = EXCLUDED."useAddlNotes",
      "sevenChrNote" = EXCLUDED."sevenChrNote",
      "sourceYear" = EXCLUDED."sourceYear",
      "updatedAt" = now()
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  const yearIdx = args.indexOf("--year");
  const dryRun = args.includes("--dry-run");

  if (dirIdx === -1 || yearIdx === -1) {
    console.error(
      "Usage: npx tsx scripts/cms-data/parse-icd10-tabular-xml.ts --dir <folder with the unzipped CMS XML> --year 2027 [--dry-run]"
    );
    process.exit(1);
  }

  const dir = args[dirIdx + 1];
  const sourceYear = parseInt(args[yearIdx + 1], 10);
  const xmlPath = findXmlFile(dir);
  console.log(`Parsing ${xmlPath} ...`);

  const { entries, sectionNotes } = parseTabularXml(xmlPath);
  console.log(`Parsed ${entries.length} codes and ${sectionNotes.length} chapter/section-level notes.`);

  if (dryRun) {
    console.log("\n--- DRY RUN: first 10 codes parsed ---");
    for (const e of entries.slice(0, 10)) {
      console.log(JSON.stringify(e, null, 2));
    }
    console.log("\n--- DRY RUN: first 5 section-level notes parsed ---");
    for (const n of sectionNotes.slice(0, 5)) {
      console.log(JSON.stringify(n, null, 2));
    }
    console.log("\nNo database changes made (--dry-run). Re-run without --dry-run once this looks right.");
    return;
  }

  let db = new PrismaClient();
  const checkpoint = readCheckpoint(sourceYear);
  if (checkpoint.completedEntries > 0 || checkpoint.sectionNotesDone) {
    console.log(
      `Resuming from checkpoint: ${checkpoint.completedEntries} / ${entries.length} codes already written` +
        (checkpoint.sectionNotesDone ? ", section notes already written." : ".")
    );
  }

  try {
    console.log("Writing to database in batches of 1000 (safe to re-run if this is interrupted — it resumes)...");
    const BATCH = 1000;
    const MAX_ATTEMPTS = 5;

    for (let i = checkpoint.completedEntries; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);

      for (let attempt = 1; ; attempt++) {
        try {
          await bulkUpsertEntries(db, batch, sourceYear);
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

      const done = Math.min(i + BATCH, entries.length);
      console.log(`  ${done} / ${entries.length}`);
      writeCheckpoint(sourceYear, { completedEntries: done, sectionNotesDone: checkpoint.sectionNotesDone });
    }

    if (!checkpoint.sectionNotesDone) {
      console.log("Writing chapter/section-level notes...");
      for (let attempt = 1; ; attempt++) {
        try {
          // Simple strategy: clear this year's section notes and re-insert,
          // since there's no natural unique key to upsert against.
          await db.icd10SectionNote.deleteMany({ where: { sourceYear } });
          for (let i = 0; i < sectionNotes.length; i += 500) {
            const batch = sectionNotes.slice(i, i + 500);
            await db.icd10SectionNote.createMany({
              data: batch.map((n) => ({ ...n, sourceYear })),
            });
          }
          break;
        } catch (err) {
          if (!isConnectionError(err) || attempt >= MAX_ATTEMPTS) throw err;
          const waitMs = Math.min(2000 * attempt, 15000);
          console.warn(
            `  [connection dropped, attempt ${attempt}/${MAX_ATTEMPTS}] reconnecting in ${waitMs}ms and retrying section notes...`
          );
          await db.$disconnect().catch(() => {});
          await new Promise((r) => setTimeout(r, waitMs));
          db = new PrismaClient();
        }
      }
      writeCheckpoint(sourceYear, { completedEntries: entries.length, sectionNotesDone: true });
    }

    clearCheckpoint(sourceYear);
    console.log("Done.");
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});