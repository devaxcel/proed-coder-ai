/**
 * Seed script — ICD-10-CM Alphabetic Index to Diseases & Injuries
 *
 * Source: CDC/NCHS official Alphabetic Index XML — public domain, same
 * source zip as the Tabular List (Rich Detail feature).
 * File used: icd10cm-index-2026.xml
 *
 * This is a genuinely different data structure from the Tabular List:
 * a nested TREE of medical terms (main term > subterms > sub-subterms),
 * matching how the physical index book works — e.g. "Diabetes" > "with"
 * > "chronic kidney disease" > E11.22. One code can be reachable through
 * many different index paths, so this table is intentionally larger than
 * the Tabular List (81,509 entries vs. 46,881 codes).
 *
 * Verified before writing this script:
 *  - 26 letters, 8,121 main terms, 81,509 total entries (incl. nested)
 *  - Diabetes > with > chronic kidney disease correctly resolves to
 *    E11.22, matching the Tabular List's own entry for that exact code
 *  - 5,182 entries are pure organizational headers (no code, no
 *    cross-reference) — their children carry the actual codes; kept in
 *    the table so users can browse into them, distinguished in the UI
 *
 * File expected at: data/icd10cm-index-2026.xml
 * Run with: npm run seed:icd10-index
 */

import { PrismaClient } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "icd10cm-index-2026.xml");

type TitleNode = string | { "#text"?: string; nemod?: string } | undefined;
type TermNode = {
  title?: TitleNode;
  code?: string | number;
  see?: string;
  seeAlso?: string;
  term?: TermNode | TermNode[];
};
type LetterNode = {
  title?: TitleNode;
  mainTerm?: TermNode | TermNode[];
};

type Entry = {
  term: string;
  fullPath: string;
  code: string | null;
  seeRef: string | null;
  seeAlsoRef: string | null;
  letter: string;
  level: number;
};

function titleText(t: TitleNode): string {
  if (t == null) return "";
  if (typeof t === "string") return t;
  const text = t["#text"] ?? "";
  return String(text).trim();
}
function nemodText(t: TitleNode): string {
  if (t && typeof t === "object" && t.nemod) return String(t.nemod).trim();
  return "";
}

function walk(node: TermNode, pathParts: string[], letter: string, level: number, entries: Entry[]) {
  const title = titleText(node.title);
  const nemod = nemodText(node.title);
  const label = nemod ? `${title} ${nemod}` : title;
  const fullPath = [...pathParts, label].join(" > ");

  const code = node.code != null ? String(node.code).trim().replace(/\./g, "") : null;
  const seeRef = node.see != null ? String(node.see).trim() : null;
  const seeAlsoRef = node.seeAlso != null ? String(node.seeAlso).trim() : null;

  entries.push({ term: label, fullPath, code, seeRef, seeAlsoRef, letter, level });

  const children = node.term ? (Array.isArray(node.term) ? node.term : [node.term]) : [];
  for (const child of children) {
    walk(child, [...pathParts, label], letter, level + 1, entries);
  }
}

async function main() {
  console.log("=== ProEd Coder AI — ICD-10-CM Alphabetic Index Seed ===\n");

  const xml = fs.readFileSync(FILE_PATH, "utf8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name: string) => ["letter", "mainTerm", "term"].includes(name),
    textNodeName: "#text",
  });
  const doc = parser.parse(xml);
  const letters: LetterNode[] = doc["ICD10CM.index"].letter;

  const entries: Entry[] = [];
  for (const letterNode of letters) {
    const letterTitle = titleText(letterNode.title);
    const mainTerms = letterNode.mainTerm ? (Array.isArray(letterNode.mainTerm) ? letterNode.mainTerm : [letterNode.mainTerm]) : [];
    for (const mt of mainTerms) {
      walk(mt, [], letterTitle, 0, entries);
    }
  }

  console.log(`Parsed ${entries.length} index entries across ${letters.length} letters.\n`);

  await db.icdAlphabeticIndexEntry.deleteMany({});

  const BATCH = 500;
  let processed = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);
    await db.icdAlphabeticIndexEntry.createMany({ data: chunk });
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${entries.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${processed} index entries loaded.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
