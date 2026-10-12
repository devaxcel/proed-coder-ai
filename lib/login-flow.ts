import bcrypt from "bcryptjs";
import { db } from "./db";
import { verifyPassword } from "./password";
import { audit, isLocked, lockMinutesLeft, registerFailure } from "./login-security";
import { decryptSecret, hashBackupCode, looksLikeBackupCode, verifyTotp } from "./mfa";

type DbUser = NonNullable<Awaited<ReturnType<typeof db.user.findUnique>>>;

export type PasswordCheck =
  | { state: "invalid" }
  | { state: "locked"; minutes: number }
  | { state: "ok"; user: DbUser };

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are real.
let dummyHash: string | null = null;

/** Step 1 of sign-in: email + password, with lockout. Counts failures. */
export async function checkPassword(emailRaw: string, password: string): Promise<PasswordCheck> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) return { state: "invalid" };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.isActive === false) {
    dummyHash ??= await bcrypt.hash("not-a-real-password", 12);
    await bcrypt.compare(password, dummyHash);
    return { state: "invalid" };
  }
  if (isLocked(user)) return { state: "locked", minutes: lockMinutesLeft(user) };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await registerFailure(user.id, "password");
    return { state: "invalid" };
  }
  return { state: "ok", user };
}

/** Step 2: authenticator code (6 digits) OR a one-time backup code. Single use. */
export async function verifySecondFactor(user: DbUser, codeRaw: string): Promise<boolean> {
  const code = (codeRaw ?? "").trim();
  if (!code || !user.mfaSecretEnc) return false;

  if (looksLikeBackupCode(code)) {
    const hash = hashBackupCode(code);
    const res = await db.mfaBackupCode.updateMany({
      where: { userId: user.id, codeHash: hash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (res.count === 1) {
      await audit("mfa_backup_code_used", user.id, {});
      return true;
    }
    return false;
  }

  let secret: string;
  try {
    secret = decryptSecret(user.mfaSecretEnc);
  } catch {
    return false;
  }
  const step = verifyTotp(secret, code, user.mfaLastStep);
  if (step == null) return false;
  // Atomic replay guard: only the first request to claim this step wins.
  const res = await db.user.updateMany({
    where: { id: user.id, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] },
    data: { mfaLastStep: step },
  });
  return res.count === 1;
}
