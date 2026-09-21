/**
 * Seed script — ICD-9-CM Legacy Codes (Version 32, final version before
 * retirement on October 1, 2015)
 *
 * Source: CMS.gov — public domain, same status as ICD-10-CM.
 * https://www.cms.gov/medicare/coding-billing/icd-10-codes/icd-9-cm-diagnosis-procedure-codes-abbreviated-and-full-code-titles
 *
 * Version 32 is used because it's the final, most complete version ever
 * published — useful for historical/legacy date-of-service lookups.
 *
 * Files expected at:
 *   data/icd9-dx-v32.xlsx (diagnosis codes)
 *   data/icd9-sg-v32.xlsx (procedure/surgery codes)
 * Run with: npm run seed:icd9
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

async function loadFile(fileName: string, codeType: "DX" | "SG") {
  const filePath = path.join(process.cwd(), "data", fileName);
  const wb = XLSX.readFile(filePath);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  return rows
    .slice(1)
    .filter((r) => clean(r[0]))
    .map((r) => ({
      code: clean(r[0]),
      longDesc: clean(r[1]),
      shortDesc: clean(r[2]),
      codeType,
    }));
}

async function main() {
  console.log("=== ProEd Coder AI — ICD-9-CM Legacy Codes Seed ===\n");

  const dxRecords = await loadFile("icd9-dx-v32.xlsx", "DX");
  const sgRecords = await loadFile("icd9-sg-v32.xlsx", "SG");
  const allRecords = [...dxRecords, ...sgRecords];

  console.log(`Parsed ${dxRecords.length} diagnosis codes, ${sgRecords.length} procedure codes.\n`);

  await db.icd9Code.deleteMany({});

  const BATCH = 500;
  let processed = 0;
  for (let i = 0; i < allRecords.length; i += BATCH) {
    const chunk = allRecords.slice(i, i + BATCH);
    await db.icd9Code.createMany({ data: chunk, skipDuplicates: true });
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${allRecords.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${processed} ICD-9-CM codes loaded.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
