/**
 * Break-glass: set the app-wide second-factor method from the command line.
 * Use if email codes stop arriving (SMTP problem) and nobody can sign in.
 *
 *   npx tsx scripts/set-mfa-method.ts AUTHENTICATOR
 *   npx tsx scripts/set-mfa-method.ts EMAIL
 *
 * Needs DATABASE_URL (same .env as the other scripts).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const method = (process.argv[2] ?? "").toUpperCase();
  if (method !== "AUTHENTICATOR" && method !== "EMAIL") {
    console.error("Usage: npx tsx scripts/set-mfa-method.ts AUTHENTICATOR|EMAIL");
    process.exit(1);
  }
  await db.appSetting.upsert({
    where: { key: "mfaMethod" },
    create: { key: "mfaMethod", value: method, updatedBy: "cli" },
    update: { value: method, updatedBy: "cli" },
  });
  await db.auditLog.create({ data: { action: "mfa_method_changed", userId: null, payload: { to: method, via: "cli" } } });
  console.log(`✅ Second-factor method is now ${method}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
