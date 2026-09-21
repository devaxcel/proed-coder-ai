/**
 * Seed script — COVID-19 Vaccine Codes (CVX/NDC only)
 *
 * Source: CDC — public domain.
 * https://www.cdc.gov/iis/downloads/COVID-19-Vaccine-Codes-Crosswalk.xlsx
 *
 * IMPORTANT: the source file has 2 additional columns — "CPT Code" and
 * "CPT Description" — which are DELIBERATELY EXCLUDED here. Those are
 * real AMA-copyrighted CPT codes (e.g. 91320) embedded in an otherwise
 * public CDC file. Everything else in this file (manufacturer, CVX
 * codes, NDC codes, packaging, age cohort) is public CDC/FDA data with
 * no AMA involvement — confirmed by checking the actual column layout
 * before writing this script.
 *
 * File expected at: data/covid-vaccine-crosswalk.xlsx
 * Run with: npm run seed:covid-vaccine
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "covid-vaccine-crosswalk.xlsx");

// Source cells frequently contain embedded \r and \n line breaks —
// collapse to single spaces for clean display.
function clean(v: unknown): string {
  return String(v ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  console.log("=== ProEd Coder AI — COVID Vaccine Codes Seed (CPT columns excluded) ===\n");

  const wb = XLSX.readFile(FILE_PATH);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  // Row 0 = title, row 1 = header, row 2+ = data
  const dataRows = rows.slice(2).filter((r) => clean(r[2])); // CVX code column

  console.log(`Found ${dataRows.length} vaccine formulation rows.\n`);

  const records = dataRows.map((r) => ({
    manufacturer: clean(r[0]),
    productLabel: clean(r[1]),
    cvxCode: clean(r[2]),
    cvxTermDesc: clean(r[3]),
    cvxShortDesc: clean(r[4]),
    virusStrain: clean(r[5]) || null,
    ndcCodes: clean(r[6]) || null,
    packaging: clean(r[7]) || null,
    ageCohort: clean(r[9]) || null,
    // Columns 10 (CPT Code) and 11 (CPT Description) intentionally skipped.
  }));

  await db.covidVaccineCode.deleteMany({});
  await db.covidVaccineCode.createMany({ data: records, skipDuplicates: true });

  console.log(`✅ Seed complete — ${records.length} COVID vaccine formulations loaded (CPT columns excluded).`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
