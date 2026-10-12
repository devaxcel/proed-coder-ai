/**
 * Break-glass: remove a user's authenticator and clear any lockout from the command line.
 * Use when the ONLY admin lost their phone AND their backup codes (nobody can use the Admin screen).
 *
 *   npx tsx scripts/reset-mfa.ts someone@example.com
 *
 * Needs DATABASE_URL (same .env as the other scripts). The user sets up a new authenticator at next sign-in.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-mfa.ts <email>");
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }
  await db.mfaBackupCode.deleteMany({ where: { userId: user.id } });
  await db.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecretEnc: null, mfaEnrolledAt: null, mfaLastStep: null, failedLoginCount: 0, lockedUntil: null },
  });
  await db.auditLog.create({ data: { action: "mfa_reset", userId: null, payload: { target: email, via: "cli" } } });
  console.log(`✅ Two-factor reset for ${email}. They will set up a new authenticator at next sign-in.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
