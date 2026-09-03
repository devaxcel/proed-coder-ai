/**
 * Seed script — 2025 Payment Year ICD-10-CM Mappings (CMS Midyear/Final)
 * Source: https://www.cms.gov/medicare/payment/medicare-advantage-rates-statistics/risk-adjustment/2025-model-software/icd-10-mappings
 *
 * File expected at: data/icd10-hcc-2025-mappings.xlsx
 * Run with: npm run seed:icd10-mappings-2025
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "icd10-hcc-2025-mappings.xlsx");

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}
function toBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (s === "yes") return true;
  if (s === "no") return false;
  return null;
}
// Real ICD-10-CM codes are alphanumeric, no spaces, 3-8 chars. Rejects
// footnote/citation rows (e.g. "Source: RTI International") that have a
// non-empty first column but aren't codes.
function looksLikeIcdCode(v: unknown): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return /^[A-Z][0-9A-Z]{2,7}$/i.test(s);
}

async function main() {
  console.log("=== ProEd Coder AI — ICD-10 HCC Mappings 2025 Seed ===\n");

  const wb = XLSX.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]]; // "FY24-FY25 ICD10 Payment Codes"
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  // Row 0 = title, row 1 = subtitle, row 2 = blank, row 3 = headers, row 4+ = data
  const dataRows = rows.slice(4);

  console.log(`Found ${dataRows.length} raw rows to process.\n`);

  await db.icdHccMapping2025.deleteMany({});

  const BATCH = 500;
  let processed = 0;
  let inserted = 0;

  for (let i = 0; i < dataRows.length; i += BATCH) {
    const chunk = dataRows.slice(i, i + BATCH);
    const records = chunk
      .filter((r) => looksLikeIcdCode(r[0]))
      .map((r) => ({
        icd10Code: String(r[0]).trim(),
        description: String(r[1] ?? "").trim(),
        esrdV21: toIntOrNull(r[2]),
        esrdV24: toIntOrNull(r[3]),
        hccV22: toIntOrNull(r[4]),
        hccV24: toIntOrNull(r[5]),
        hccV28: toIntOrNull(r[6]),
        rxhccV08: toIntOrNull(r[7]),
        esrdV21Payment2025: toBoolOrNull(r[8]),
        esrdV24Payment2025: toBoolOrNull(r[9]),
        hccV22Payment2025: toBoolOrNull(r[10]),
        hccV24Payment2025: toBoolOrNull(r[11]),
        hccV28Payment2025: toBoolOrNull(r[12]),
        rxhccV08Payment2025: toBoolOrNull(r[13]),
      }));

    if (records.length > 0) {
      await db.icdHccMapping2025.createMany({ data: records });
      inserted += records.length;
    }
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${dataRows.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${inserted} valid rows loaded into IcdHccMapping2025.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
