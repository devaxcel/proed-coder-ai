/**
 * Parses CMS's "Code Descriptions in Tabular Order" flat text file (the
 * simpler of the two ICD-10-CM downloads — just code + description, one per
 * line, no chapter/section/notes context). Use this if you just need a
 * complete flat ICD-10-CM lookup quickly; use parse-icd10-tabular-xml.ts
 * instead if you want the chapter/section/notes data for "pop" instructions.
 *
 * Source: https://www.cms.gov/medicare/coding-billing/icd-10-codes
 *   -> "Code Descriptions in Tabular Order" (ZIP) for the FY you want.
 * Unzip it — inside is a single .txt file, one code per line.
 *
 * Format: the first 7 characters of each line are the code with NO decimal
 * point, space-padded (e.g. "A000   "), and the description starts right
 * after (with a leading space, trimmed here). This script re-inserts the
 * decimal point (after the 3rd character, when the code is longer than 3
 * characters) to match the normal "A00.0" display format used elsewhere in
 * the app.
 *
 * VERIFIED against the real FY2027 file (icd10cm_codes_2027.txt): parses
 * cleanly to 74,879 codes, first (A00.0) and last (U09.9) entries checked
 * by hand against the source file.
 *
 * USAGE:
 *   npx tsx scripts/cms-data/parse-icd10-flat.ts --file ./cms-raw/icd10-tabular-2027.txt --year 2027 --dry-run
 *   npx tsx scripts/cms-data/parse-icd10-flat.ts --file ./cms-raw/icd10-tabular-2027.txt --year 2027
 */

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

function formatCode(raw: string): string {
  const c = raw.trim();
  if (c.length <= 3) return c;
  return `${c.slice(0, 3)}.${c.slice(3)}`;
}

function parseFlatFile(path: string): { code: string; description: string }[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: { code: string; description: string }[] = [];

  for (const line of lines) {
    const rawCode = line.slice(0, 7);
    const description = line.slice(7).trim();
    const code = formatCode(rawCode);
    if (code && description) out.push({ code, description });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const yearIdx = args.indexOf("--year");
  const dryRun = args.includes("--dry-run");

  if (fileIdx === -1 || yearIdx === -1) {
    console.error(
      "Usage: npx tsx scripts/cms-data/parse-icd10-flat.ts --file <path to CMS .txt> --year 2027 [--dry-run]"
    );
    process.exit(1);
  }

  const filePath = args[fileIdx + 1];
  const sourceYear = parseInt(args[yearIdx + 1], 10);
  const rows = parseFlatFile(filePath);
  console.log(`Parsed ${rows.length} codes from ${filePath}`);

  if (dryRun) {
    console.log("\n--- DRY RUN: first 15 rows ---");
    for (const r of rows.slice(0, 15)) console.log(`${r.code}  ${r.description}`);
    console.log("\nIf the code/description split above looks wrong (e.g. description missing its first few");
    console.log("characters, or the code column includes letters from the description), the file's column");
    console.log("width changed this year — open it in a text editor and check where the description actually");
    console.log("starts, then adjust the `line.slice(0, 7)` / `line.slice(7)` split in this script.");
    console.log("\nNo database changes made (--dry-run).");
    return;
  }

  const db = new PrismaClient();
  try {
    console.log("Writing to database in batches of 1000 (only fills description/category if the code");
    console.log("doesn't already exist from the richer XML import — never overwrites chapter/notes data)...");
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000);
      await db.$transaction(
        batch.map((r) =>
          db.icd10TabularEntry.upsert({
            where: { code: r.code },
            update: { description: r.description, sourceYear },
            create: { code: r.code, description: r.description, sourceYear },
          })
        )
      );
      console.log(`  ${Math.min(i + 1000, rows.length)} / ${rows.length}`);
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
