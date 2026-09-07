/**
 * Seed script — default Role Permissions
 *
 * Admin is never seeded here — Admin always has full access, hardcoded
 * in lib/auth.ts, regardless of this table's contents.
 *
 * Defaults chosen to match the INTENDED behavior established throughout
 * this project, not necessarily today's unenforced reality:
 *   - CODER / AUDITOR: full access to every tool tab (matches how they've
 *     always been used), but NOT User Management or Legal-editing.
 *   - CLIENT: only Compliance and Legal (view-only) — matching the
 *     original spirit of the Client role as a restricted, view-limited
 *     account, even though nothing technically enforced that limit until
 *     this permission system existed.
 *
 * Run with: npm run seed:permissions
 * Safe to re-run — upserts, never duplicates, and never overwrites a
 * value Admin has already changed via the matrix UI (insert-if-missing
 * only, same pattern as seed-legal.ts).
 */

import { PrismaClient } from "@prisma/client";
import { CAPABILITIES, EDIT_CAPABILITIES } from "../lib/permissions";

const db = new PrismaClient();

const ALL_TOOL_KEYS = CAPABILITIES.map((c) => c.key);

const DEFAULTS: Record<string, string[]> = {
  CODER: ALL_TOOL_KEYS.filter((k) => k !== "user-management"),
  AUDITOR: ALL_TOOL_KEYS.filter((k) => k !== "user-management"),
  CLIENT: ["compliance", "legal"],
};

const EDIT_DEFAULTS: Record<string, string[]> = {
  CODER: [],
  AUDITOR: [],
  CLIENT: [],
};

async function main() {
  console.log("=== ProEd Coder AI — Role Permissions Seed ===\n");

  let created = 0;
  let skipped = 0;

  for (const role of ["CODER", "AUDITOR", "CLIENT"] as const) {
    const allowedTabs = new Set(DEFAULTS[role]);
    const allowedEdits = new Set(EDIT_DEFAULTS[role]);

    for (const cap of [...CAPABILITIES, ...EDIT_CAPABILITIES]) {
      const existing = await db.rolePermission.findUnique({
        where: { role_capabilityKey: { role, capabilityKey: cap.key } },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const allowed = allowedTabs.has(cap.key) || allowedEdits.has(cap.key);
      await db.rolePermission.create({
        data: { role, capabilityKey: cap.key, allowed },
      });
      created++;
    }
  }

  console.log(`✅ Seed complete — ${created} permission rows created, ${skipped} already existed (left untouched).`);
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
