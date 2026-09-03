/**
 * Seed script — 2024 Payment Year ICD-10-CM Mappings (CMS Midyear/Final)
 * Source: https://www.cms.gov/medicare/health-plans/medicareadvtgspecratestats/risk-adjustors/2024-model-software/icd-10-mappings
 *
 * NOTE: this file has an extra column vs. 2025/2026 — RxHCC V05, which
 * was retired after 2024 (replaced entirely by V08 going forward).
 *
 * File expected at: data/icd10-hcc-2024-mappings.xlsx
 * Run with: npm run seed:icd10-mappings-2024
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "icd10-hcc-2024-mappings.xlsx");

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
function looksLikeIcdCode(v: unknown): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return /^[A-Z][0-9A-Z]{2,7}$/i.test(s);
}

async function main() {
  console.log("=== ProEd Coder AI — ICD-10 HCC Mappings 2024 Seed ===\n");

  const wb = XLSX.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]]; // "FY23-FY24 ICD10 Payment Codes"
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  // Row 0 = title, row 1 = subtitle, row 2 = blank, row 3 = headers, row 4+ = data
  const dataRows = rows.slice(4);

  console.log(`Found ${dataRows.length} raw rows to process.\n`);

  await db.icdHccMapping2024.deleteMany({});

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
        rxhccV05: toIntOrNull(r[7]),
        rxhccV08: toIntOrNull(r[8]),
        esrdV21Payment2024: toBoolOrNull(r[9]),
        esrdV24Payment2024: toBoolOrNull(r[10]),
        hccV22Payment2024: toBoolOrNull(r[11]),
        hccV24Payment2024: toBoolOrNull(r[12]),
        hccV28Payment2024: toBoolOrNull(r[13]),
        rxhccV05Payment2024: toBoolOrNull(r[14]),
        rxhccV08Payment2024: toBoolOrNull(r[15]),
      }));

    if (records.length > 0) {
      await db.icdHccMapping2024.createMany({ data: records });
      inserted += records.length;
    }
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${dataRows.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${inserted} valid rows loaded into IcdHccMapping2024.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
