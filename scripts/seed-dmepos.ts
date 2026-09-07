/**
 * Seed script — DMEPOS Fee Schedule (California pricing)
 *
 * Source: CMS.gov DMEPOS Fee Schedule Public Use File.
 * https://www.cms.gov/medicare/payment/fee-schedules/dmepos/dmepos-fee-schedule
 * File used: DMEPOS_JUL.xlsx (DME26-C, July 2026 release)
 *
 * This is a completely separate, public CMS pricing dataset from CPT RVU
 * data — HCPCS Level II supply/equipment codes only, no AMA involvement.
 *
 * The source file has 110 columns (all 50 states + territories, each with
 * a Non-Rural and Rural amount). Since ProEd operates in California, this
 * seed captures California pricing specifically (columns 13/14 in the raw
 * file) rather than all 108 state columns — easy to extend to other states
 * later if ever needed.
 *
 * File expected at: data/dmepos-2026-jul.xlsx
 * Run with: npm run seed:dmepos
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "dmepos-2026-jul.xlsx");
const QUARTER = "2026-JUL";

function toFloatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}
function clean(v: unknown): string {
  return String(v ?? "").trim();
}

async function main() {
  console.log("=== ProEd Coder AI — DMEPOS Fee Schedule (California) Seed ===\n");

  const wb = XLSX.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Row 6 (0-indexed) is the real header; data starts at row 7. Verified
  // against the real file before writing this — rows 0-5 are a title block.
  const header = rows[6].map((h) => String(h));
  const dataRows = rows.slice(7);

  const idx = {
    hcpcs: header.indexOf("HCPCS"),
    mod: header.indexOf("Mod"),
    mod2: header.indexOf("Mod2"),
    juris: header.indexOf("JURIS"),
    catg: header.indexOf("CATG"),
    ceiling: header.indexOf("Ceiling"),
    floor: header.indexOf("Floor"),
    caNR: header.indexOf("CA (NR)"),
    caR: header.indexOf("CA (R)"),
    desc: header.indexOf("Description"),
  };

  // Fail loudly if column positions ever shift in a future file, rather
  // than silently seeding data under the wrong column.
  for (const [key, i] of Object.entries(idx)) {
    if (i === -1) throw new Error(`Expected column not found in header: ${key}`);
  }

  console.log(`Found ${dataRows.length} raw rows. Column positions verified.\n`);

  await db.dmeposFeeSchedule.deleteMany({ where: { quarter: QUARTER } });

  const records = dataRows
    .filter((r) => clean(r[idx.hcpcs]))
    .map((r) => ({
      code: clean(r[idx.hcpcs]),
      modifier1: clean(r[idx.mod]) || null,
      modifier2: clean(r[idx.mod2]) || null,
      jurisdiction: clean(r[idx.juris]),
      category: clean(r[idx.catg]),
      description: clean(r[idx.desc]),
      ceiling: toFloatOrNull(r[idx.ceiling]),
      floor: toFloatOrNull(r[idx.floor]),
      caNonRural: toFloatOrNull(r[idx.caNR]),
      caRural: toFloatOrNull(r[idx.caR]),
      quarter: QUARTER,
    }));

  const BATCH = 500;
  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    await db.dmeposFeeSchedule.createMany({ data: chunk });
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${records.length}...`);
  }

  console.log(`\n\n✅ Seed complete — ${processed} California fee-schedule rows loaded for ${QUARTER}.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
