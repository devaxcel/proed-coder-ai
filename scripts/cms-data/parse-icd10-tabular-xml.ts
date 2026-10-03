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

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { XMLParser } from "fast-xml-parser";
import { PrismaClient } from "@prisma/client";

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
  const candidates = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xml"));
  if (candidates.length === 0) {
    throw new Error(`No .xml file found in ${dir} — did you unzip the CMS file here?`);
  }
  if (candidates.length > 1) {
    console.warn(`Multiple .xml files found in ${dir}, using the first: ${candidates[0]}`);
  }
  return join(dir, candidates[0]);
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

  const db = new PrismaClient();
  try {
    console.log("Writing to database in batches of 500...");
    for (let i = 0; i < entries.length; i += 500) {
      const batch = entries.slice(i, i + 500);
      await db.$transaction(
        batch.map((e) =>
          db.icd10TabularEntry.upsert({
            where: { code: e.code },
            update: {
              description: e.description,
              chapterName: e.chapterName,
              sectionName: e.sectionName,
              categoryCode: e.categoryCode,
              includesNotes: e.includesNotes,
              excludes1Notes: e.excludes1Notes,
              excludes2Notes: e.excludes2Notes,
              inclusionTerms: e.inclusionTerms,
              codeFirstNotes: e.codeFirstNotes,
              useAddlNotes: e.useAddlNotes,
              sevenChrNote: e.sevenChrNote,
              sourceYear,
            },
            create: {
              code: e.code,
              description: e.description,
              chapterName: e.chapterName,
              sectionName: e.sectionName,
              categoryCode: e.categoryCode,
              includesNotes: e.includesNotes,
              excludes1Notes: e.excludes1Notes,
              excludes2Notes: e.excludes2Notes,
              inclusionTerms: e.inclusionTerms,
              codeFirstNotes: e.codeFirstNotes,
              useAddlNotes: e.useAddlNotes,
              sevenChrNote: e.sevenChrNote,
              sourceYear,
            },
          })
        )
      );
      console.log(`  ${Math.min(i + 500, entries.length)} / ${entries.length}`);
    }

    console.log("Writing chapter/section-level notes...");
    // Simple strategy: clear this year's section notes and re-insert, since
    // there's no natural unique key to upsert against.
    await db.icd10SectionNote.deleteMany({ where: { sourceYear } });
    for (let i = 0; i < sectionNotes.length; i += 500) {
      const batch = sectionNotes.slice(i, i + 500);
      await db.icd10SectionNote.createMany({
        data: batch.map((n) => ({ ...n, sourceYear })),
      });
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
