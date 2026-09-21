/**
 * Seed script — DME Supplier Services Medically Unlikely Edits (MUE)
 *
 * Source: CMS.gov — public quarterly NCCI MUE file, DME Supplier
 * Services table specifically (not Practitioner or Outpatient Hospital,
 * which are HCPCS/CPT mixed and AMA-gated).
 * https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits-mues
 *
 * SAFETY VERIFIED before writing this script: checked all 3,109 rows for
 * any purely-numeric (potential CPT/Level I) code — found zero. Every
 * code is alphanumeric HCPCS Level II (prefixes L, J, E, A, Q, K, V, B,
 * C, G), matching CMS's own description of this file's scope exactly.
 * The AMA copyright notice printed in the file header is standard
 * boilerplate CMS attaches to any file touching this code space — it
 * does not indicate CPT codes are actually present here.
 *
 * File expected at: data/dme-mue-2026-oct.xlsx
 * Run with: npm run seed:dme-mue
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "dme-mue-2026-oct.xlsx");
const QUARTER = "2026-OCT";

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

async function main() {
  console.log("=== ProEd Coder AI — DME Supplier MUE Seed ===\n");

  const wb = XLSX.readFile(FILE_PATH);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  // Row 0 = AMA boilerplate notice, row 1 = header, row 2+ = data
  const dataRows = rows.slice(2);

  console.log(`Found ${dataRows.length} raw rows.\n`);

  // Safety check — abort rather than risk seeding CPT content if this
  // file's format ever changes to include numeric codes.
  const numericCodes = dataRows.filter((r) => /^\d+$/.test(clean(r[0])));
  if (numericCodes.length > 0) {
    throw new Error(
      `SAFETY ABORT: found ${numericCodes.length} purely-numeric codes — this may include CPT/Level I content. Seed cancelled.`
    );
  }
  console.log("Safety check passed — zero numeric (potential CPT) codes found.\n");

  await db.dmeMueLimit.deleteMany({ where: { quarter: QUARTER } });

  const records = dataRows
    .filter((r) => clean(r[0]))
    .map((r) => ({
      code: clean(r[0]),
      mueValue: parseInt(clean(r[1]), 10) || 0,
      adjudicationIndicator: clean(r[2]),
      rationale: clean(r[3]),
      quarter: QUARTER,
    }));

  const BATCH = 500;
  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    await db.dmeMueLimit.createMany({ data: chunk, skipDuplicates: true });
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${records.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${processed} DME MUE limits loaded for ${QUARTER}.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
