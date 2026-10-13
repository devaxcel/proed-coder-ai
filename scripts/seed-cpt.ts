/**
 * Seed script — AMA CPT® code sets (licensed to ProEd Consulting & Staffing)
 *
 * Source: AMA Royalty Portal → "CPT Standard" data files (Current Format).
 * Each AMA release is a COMPLETE code set, so only the newest release of each
 * year is needed:
 *   data/cpt/2026/   ← contents of "2026 Standard Update 4" → Current Format → Primary Data Files
 *   data/cpt/2027/   ← contents of "2027 Standard Update 1.1" → Current Format → Primary Data Files
 *
 * Each year folder needs these three files (names exactly as AMA ships them):
 *   ConsolidatedCodeList.txt
 *   Historically Deleted Codes.txt
 *   Modifiers.txt
 * Optional: a file named RELEASE.txt containing the release name, e.g.
 *   2026 Standard Update 4
 *
 * The raw AMA files must NOT be committed (data/cpt/ is git-ignored).
 *
 * Re-running is safe: each year's rows are replaced.
 * Run:  npm run seed:cpt            (all year folders found)
 *       npm run seed:cpt -- 2027    (one year only)
 */

import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import { withRetry, wakeDB } from "./_utils";

const ROOT = path.join(process.cwd(), "data", "cpt");
const BATCH = 500;

function readLines(file: string): string[] {
  return fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/);
}

/** Returns the rows after the header line whose first cell starts with `firstCell`. */
function tabRows(file: string, firstCell: RegExp): { header: string[]; rows: string[][] } {
  const lines = readLines(file);
  const h = lines.findIndex((l) => firstCell.test(l.split("\t")[0] ?? "") && l.includes("\t"));
  if (h < 0) throw new Error(`Header row not found in ${file}`);
  const header = lines[h].split("\t").map((s) => s.trim());
  const rows = lines.slice(h + 1).filter((l) => l.trim() && l.includes("\t")).map((l) => l.split("\t"));
  return { header, rows };
}

function categoryOf(code: string): string {
  if (/^\d{5}$/.test(code)) return "I";
  if (code.endsWith("F")) return "II";
  if (code.endsWith("T")) return "III";
  if (code.endsWith("U")) return "PLA";
  if (code.endsWith("M")) return "MAAA";
  return "I";
}

const nz = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

async function chunked<T>(items: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += BATCH) {
    await withRetry(() => fn(items.slice(i, i + BATCH)) as Promise<unknown>);
    process.stdout.write(`\r   ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }
  process.stdout.write("\n");
}

async function seedYear(year: number, dir: string) {
  console.log(`\n=== CPT ${year} (${dir}) ===`);
  const codeFile = path.join(dir, "ConsolidatedCodeList.txt");
  const delFile = path.join(dir, "Historically Deleted Codes.txt");
  const modFile = path.join(dir, "Modifiers.txt");
  for (const f of [codeFile, delFile, modFile]) {
    if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
  }
  const relFile = path.join(dir, "RELEASE.txt");
  const releaseName = fs.existsSync(relFile) ? fs.readFileSync(relFile, "utf8").trim() : null;

  // ---- codes ----
  const { header, rows } = tabRows(codeFile, /^concept\s*id$/i);
  const ix = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iCode = ix("CPT Code"), iLong = ix("Long"), iMed = ix("Medium"), iShort = ix("Short");
  const iCons = ix("Consumer"), iEff = ix("Current Descriptor Effective Date");
  const iTest = ix("Test Name"), iLab = ix("Lab Name"), iMfr = ix("Manufacturer Name");
  if ([iCode, iLong].some((i) => i < 0)) throw new Error("Unexpected ConsolidatedCodeList layout: " + header.join(" | "));

  const seen = new Set<string>();
  const codeRows = [];
  for (const r of rows) {
    const code = (r[iCode] ?? "").trim().toUpperCase();
    if (!/^[0-9]{4}[0-9FTUM]$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    codeRows.push({
      code, year, category: categoryOf(code),
      longDesc: (r[iLong] ?? "").trim(),
      mediumDesc: nz(r[iMed]), shortDesc: nz(r[iShort]), consumerDesc: nz(r[iCons]),
      descEffective: iEff >= 0 ? nz(r[iEff]) : null,
      testName: iTest >= 0 ? nz(r[iTest]) : null, labName: iLab >= 0 ? nz(r[iLab]) : null,
      manufacturer: iMfr >= 0 ? nz(r[iMfr]) : null,
      releaseName,
    });
  }
  console.log(`   ${codeRows.length} codes parsed`);
  await withRetry(() => db.cptCode.deleteMany({ where: { year } }));
  await chunked(codeRows, (c) => db.cptCode.createMany({ data: c, skipDuplicates: true }));

  // ---- deleted codes (list is cumulative; file for the newest year is a superset) ----
  const del = tabRows(delFile, /^cpt\s*code$/i);
  const delRows = [];
  const delSeen = new Set<string>();
  for (const r of del.rows) {
    const code = (r[0] ?? "").trim().toUpperCase();
    const yd = parseInt((r[1] ?? "").trim(), 10);
    if (!/^[0-9]{4}[0-9FTUM]$/.test(code) || !yd) continue;
    const k = `${code}|${yd}`;
    if (delSeen.has(k)) continue;
    delSeen.add(k);
    delRows.push({ code, yearDeleted: yd, descriptor: (r[2] ?? "").trim() });
  }
  console.log(`   ${delRows.length} historically-deleted codes parsed`);
  await chunked(delRows, (c) => db.cptDeletedCode.createMany({ data: c, skipDuplicates: true }));

  // ---- modifiers ----
  const mod = tabRows(modFile, /^concept\s*id$/i);
  const mSeen = new Set<string>();
  const modRows = [];
  for (const r of mod.rows) {
    const m = (r[1] ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(m) || mSeen.has(m)) continue;
    mSeen.add(m);
    modRows.push({
      modifier: m, year, level: (r[2] ?? "").trim() || "I",
      name: (r[4] ?? "").trim(), description: (r[5] ?? "").trim(), section: nz(r[6]),
    });
  }
  console.log(`   ${modRows.length} modifiers parsed`);
  await withRetry(() => db.cptModifier.deleteMany({ where: { year } }));
  await chunked(modRows, (c) => db.cptModifier.createMany({ data: c, skipDuplicates: true }));
}

async function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`❌ ${ROOT} not found. Create data/cpt/2026 and data/cpt/2027 and copy the AMA "Primary Data Files" into each (see header of this script).`);
    process.exit(1);
  }
  await wakeDB();
  const only = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  const years = fs.readdirSync(ROOT).filter((d) => /^\d{4}$/.test(d)).map(Number).sort();
  for (const y of years) {
    if (only && y !== only) continue;
    await seedYear(y, path.join(ROOT, String(y)));
  }
  const counts = await db.cptCode.groupBy({ by: ["year"], _count: true });
  console.log("\n✅ Done.", JSON.stringify(counts));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
