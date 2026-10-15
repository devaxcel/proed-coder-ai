/**
 * Break-glass: switch two-factor sign-in off/on from the command line.
 * Use if email codes stop arriving and no Admin can sign in to use the switch on Admin > Sign-in Security.
 *
 *   npx tsx scripts/set-2fa-bypass.ts 24h        off for 24 hours, then back on by itself
 *   npx tsx scripts/set-2fa-bypass.ts permanent  off until turned back on
 *   npx tsx scripts/set-2fa-bypass.ts on         back on now
 *
 * Needs DATABASE_URL (same .env as the other scripts).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const KEY = "mfaBypass";

async function main() {
  const mode = (process.argv[2] ?? "").toLowerCase();
  if (!["24h", "permanent", "on"].includes(mode)) {
    console.error("Usage: npx tsx scripts/set-2fa-bypass.ts 24h|permanent|on");
    process.exit(1);
  }
  if (mode === "on") {
    await db.appSetting.deleteMany({ where: { key: KEY } });
  } else {
    const now = new Date();
    const value = JSON.stringify({
      mode,
      until: mode === "24h" ? new Date(now.getTime() + 24 * 3600_000).toISOString() : null,
      since: now.toISOString(),
      by: "cli",
    });
    await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedBy: "cli" }, update: { value, updatedBy: "cli" } });
  }
  await db.auditLog.create({ data: { action: "mfa_bypass_changed", userId: null, payload: { to: mode, via: "cli" } } });
  console.log(mode === "on" ? "✅ Two-factor sign-in is ON." : mode === "24h" ? "✅ Two-factor sign-in is OFF for 24 hours." : "✅ Two-factor sign-in is OFF until you turn it back on.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
