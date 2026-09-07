/**
 * Seed script — HCPCS Quarterly Update (deleted/retired codes)
 *
 * Source: CMS.gov HCPCS Quarterly Update, public Alpha-Numeric HCPCS File.
 * https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update
 * File used: HCPC2026_OCT_ANWEB.xlsx (October 2026 release)
 *
 * IMPORTANT — verified before writing this script: this "Alpha-Numeric"
 * file contains ZERO purely-numeric codes (checked across all 9,153 rows).
 * That means it is genuinely HCPCS Level II only — no CPT/Level I content
 * at all. This file is safe to seed and display with no AMA involvement.
 *
 * Action Code meanings (per CMS record layout):
 *   A = Add, B/C/F/S/T = various changes, D = Discontinue, N = No change,
 *   P = Payment change, R = Re-activate
 *
 * File expected at: data/hcpcs-quarterly-2026-oct.xlsx
 * Run with: npm run seed:hcpcs-updates
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const db = new PrismaClient();
const FILE_PATH = path.join(process.cwd(), "data", "hcpcs-quarterly-2026-oct.xlsx");
const QUARTER = "2026-OCT";

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

async function main() {
  console.log("=== ProEd Coder AI — HCPCS Quarterly Update Seed ===\n");

  const wb = XLSX.readFile(FILE_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`Found ${rows.length} rows.\n`);

  // Safety check — this file must never contain purely-numeric (CPT/Level I)
  // codes. If it ever does (e.g. a future file format change), abort rather
  // than risk seeding AMA-copyrighted content.
  const numericCodes = rows.filter((r) => /^\d+$/.test(clean(r["HCPC"])));
  if (numericCodes.length > 0) {
    throw new Error(
      `SAFETY ABORT: found ${numericCodes.length} purely-numeric HCPCS codes — this looks like it may include CPT/Level I content, which this app must never store. Seed cancelled.`
    );
  }
  console.log("Safety check passed — zero numeric (potential CPT) codes found.\n");

  await db.hcpcsCodeUpdate.deleteMany({ where: { quarter: QUARTER } });

  const records = rows
    .filter((r) => clean(r["HCPC"]))
    .map((r) => ({
      code: clean(r["HCPC"]),
      longDesc: clean(r["LONG DESCRIPTION"]),
      shortDesc: clean(r["SHORT DESCRIPTION"]) || null,
      actionCode: clean(r["ACTION CD"]),
      addDate: clean(r["ADD DT"]) || null,
      effectiveDate: clean(r["ACT EFF DT"]) || null,
      termDate: clean(r["TERM DT"]) || null,
      quarter: QUARTER,
    }));

  const BATCH = 500;
  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    await db.hcpcsCodeUpdate.createMany({ data: chunk, skipDuplicates: true });
    processed += chunk.length;
    process.stdout.write(`\r  Processed ${processed}/${records.length}...`);
  }

  const discontinuedCount = records.filter((r) => r.actionCode === "D").length;
  console.log(`\n\n✅ Seed complete — ${processed} codes loaded for ${QUARTER}.`);
  console.log(`   ${discontinuedCount} of those are discontinued (Action Code = D) this quarter.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
