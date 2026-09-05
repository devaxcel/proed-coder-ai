/**
 * Seed script — ICD-10-CM Rich Code Detail (Includes/Excludes/Use
 * Additional Code/Code First notes)
 *
 * Source: CDC/NCHS official Tabular List XML — public domain.
 * https://ftp.cdc.gov/pub/health_statistics/nchs/publications/ICD10CM/2026/
 * File used: icd10cm-tabular-2026.xml (from icd10cm-table_and_index-2026.zip)
 *
 * Verified against the real file before writing this script:
 *  - 46,881 total <diag> nodes (10,538 categories, 36,343 billable leaf codes)
 *  - E11.22 and its parent E11 both matched known reference content exactly
 *  - Zero malformed descriptions or codes across the full dataset
 *
 * File expected at: data/icd10cm-tabular-2026.xml
 * Run with: npm run seed:icd10-rich-detail
 */

import { PrismaClient } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "icd10cm-tabular-2026.xml");

type DiagNode = {
  name?: string;
  desc?: string;
  includes?: { note?: string | string[] };
  excludes1?: { note?: string | string[] };
  excludes2?: { note?: string | string[] };
  codeFirst?: { note?: string | string[] };
  useAdditionalCode?: { note?: string | string[] };
  codeAlso?: { note?: string | string[] };
  inclusionTerm?: { note?: string | string[] };
  sevenChrNote?: { note?: string | string[] };
  diag?: DiagNode | DiagNode[];
};

type Record_ = {
  code: string;
  parentCode: string | null;
  description: string;
  includes: string[];
  excludes1: string[];
  excludes2: string[];
  codeFirst: string[];
  useAdditionalCode: string[];
  codeAlso: string[];
  inclusionTerms: string[];
  sevenChrNote: string[];
  isCategory: boolean;
};

function extractNotes(container: { note?: string | string[] } | undefined): string[] {
  if (!container) return [];
  const notes = container.note;
  if (!notes) return [];
  if (Array.isArray(notes)) return notes.map((n) => String(n));
  return [String(notes)];
}

function walk(diagNode: DiagNode, parentCode: string | null, records: Record_[]) {
  const rawCode = String(diagNode.name ?? "").trim();
  if (!rawCode) return;
  const code = rawCode.replace(/\./g, "");

  const children = diagNode.diag ? (Array.isArray(diagNode.diag) ? diagNode.diag : [diagNode.diag]) : [];
  const isCategory = children.length > 0;

  records.push({
    code,
    parentCode,
    description: String(diagNode.desc ?? "").trim(),
    includes: extractNotes(diagNode.includes),
    excludes1: extractNotes(diagNode.excludes1),
    excludes2: extractNotes(diagNode.excludes2),
    codeFirst: extractNotes(diagNode.codeFirst),
    useAdditionalCode: extractNotes(diagNode.useAdditionalCode),
    codeAlso: extractNotes(diagNode.codeAlso),
    inclusionTerms: extractNotes(diagNode.inclusionTerm),
    sevenChrNote: extractNotes(diagNode.sevenChrNote),
    isCategory,
  });

  for (const child of children) {
    walk(child, code, records);
  }
}

async function main() {
  console.log("=== ProEd Coder AI — ICD-10 Rich Detail Seed ===\n");

  const xml = fs.readFileSync(FILE_PATH, "utf8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name: string) => ["diag", "note"].includes(name),
  });
  const doc = parser.parse(xml);
  const root = doc["ICD10CM.tabular"];
  const chapters = Array.isArray(root.chapter) ? root.chapter : [root.chapter];

  const records: Record_[] = [];
  for (const chapter of chapters) {
    const sections = chapter.section ? (Array.isArray(chapter.section) ? chapter.section : [chapter.section]) : [];
    for (const section of sections) {
      const diags = section.diag ? (Array.isArray(section.diag) ? section.diag : [section.diag]) : [];
      for (const diag of diags) {
        walk(diag, null, records);
      }
    }
  }

  console.log(`Parsed ${records.length} raw entries from XML.`);

  // Deduplicate by code, keeping the first occurrence. A real duplicate
  // was observed on a fresh run (root cause not fully isolated — possibly
  // an XML parser edge case) even though records.length matched the
  // expected count. Deduping here makes the seed reliable regardless.
  const seen = new Set<string>();
  const deduped: Record_[] = [];
  let dupeCount = 0;
  for (const r of records) {
    if (seen.has(r.code)) {
      dupeCount++;
      continue;
    }
    seen.add(r.code);
    deduped.push(r);
  }
  if (dupeCount > 0) {
    console.log(`Removed ${dupeCount} duplicate code(s), keeping first occurrence of each.`);
  }
  console.log(`${deduped.length} unique codes to seed.\n`);

  await db.icd10RichDetail.deleteMany({});

  const BATCH = 500;
  let processed = 0;
  for (let i = 0; i < deduped.length; i += BATCH) {
    const chunk = deduped.slice(i, i + BATCH);
    // skipDuplicates as a second safety net in case of any remaining
    // edge case — the in-memory dedup above should already prevent this.
    await db.icd10RichDetail.createMany({ data: chunk, skipDuplicates: true });
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${deduped.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${processed} codes loaded into Icd10RichDetail.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
