/**
 * Seed script — 2026 Final ICD-10-CM Mappings (CMS CY25/CY26 Payment Codes)
 *
 * Reads the ProEd-provided Excel file and loads all 11,876 rows into the
 * IcdHccMapping2026 table. Source: CMS.gov (public).
 *
 * File expected at: data/icd10-hcc-2026-mappings.xlsx
 * (copy the CMS file there before running this script)
 *
 * Run with: npm run seed:icd10-mappings
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();

const FILE_PATH = path.join(process.cwd(), "data", "icd10-hcc-2026-mappings.xlsx");

/**
 * NOTE: the source file's sheet name has a trailing space
 * ("CY25 ICD10 Payment Codes ") — same gotcha as the original HCC crosswalk.
 * Match by trimmed comparison rather than an exact string to avoid this.
 */
function findSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const target = "cy25 icd10 payment codes";
  const match = wb.SheetNames.find((name) => name.trim().toLowerCase() === target);
  if (match) return wb.Sheets[match];
  // Fall back to first sheet if naming ever changes
  return wb.Sheets[wb.SheetNames[0]];
}

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

async function main() {
  console.log("=== ProEd Coder AI — ICD-10 HCC Mappings 2026 Seed ===\n");

  const wb = XLSX.readFile(FILE_PATH);
  const sheet = findSheet(wb);
  if (!sheet) {
    throw new Error(`No sheet found. Available sheets: ${wb.SheetNames.join(", ")}`);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const dataRows = rows.slice(1); // skip header row

  console.log(`Found ${dataRows.length} rows to process.\n`);

  // Clear existing data for a clean re-seed (safe — this table is independent
  // of your other models and only holds this CMS reference data)
  await db.icdHccMapping2026.deleteMany({});

  const BATCH = 500;
  let processed = 0;

  for (let i = 0; i < dataRows.length; i += BATCH) {
    const chunk = dataRows.slice(i, i + BATCH);
    const records = chunk
      .filter((r) => r[0] && String(r[0]).trim() !== "")
      .map((r) => ({
        icd10Code: String(r[0]).trim(),
        description: String(r[1] ?? "").trim(),
        esrdV21: toIntOrNull(r[2]),
        esrdV24: toIntOrNull(r[3]),
        hccV22: toIntOrNull(r[4]),
        hccV24: toIntOrNull(r[5]),
        hccV28: toIntOrNull(r[6]),
        rxhccV08: toIntOrNull(r[7]),
        esrdV21Payment2026: toBoolOrNull(r[8]),
        esrdV24Payment2026: toBoolOrNull(r[9]),
        hccV22Payment2026: toBoolOrNull(r[10]),
        hccV24Payment2026: toBoolOrNull(r[11]),
        hccV28Payment2026: toBoolOrNull(r[12]),
        rxhccV08Payment2026: toBoolOrNull(r[13]),
      }));

    if (records.length > 0) {
      await db.icdHccMapping2026.createMany({ data: records });
    }
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${dataRows.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${processed} rows loaded into IcdHccMapping2026.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
