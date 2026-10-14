/**
 * Emailed one-time sign-in codes.
 *  - 6 digits from a CSPRNG, valid 10 minutes, single use
 *  - only an HMAC of the code is stored (the plaintext exists only in the email)
 *  - max 5 wrong guesses per code, then it is dead and a new one must be requested
 *  - at most one email per 30 seconds per user
 */
import crypto from "node:crypto";
import { db } from "./db";
import { audit } from "./login-security";
import { sendMail } from "./mailer";

export const EMAIL_OTP_TTL_MINUTES = 10;
export const EMAIL_OTP_RESEND_SECONDS = 30;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

export function generateEmailCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashEmailCode(userId: string, code: string): string {
  const pepper = process.env.AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", `${pepper}|email-otp|${userId}`).update(code.trim()).digest("hex");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your email";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

type OtpUser = { id: string; email: string; emailOtpHash: string | null; emailOtpExpires: Date | null; emailOtpSentAt: Date | null };

/** Sends a fresh code (or reports that one was sent moments ago). */
export async function issueEmailCode(user: OtpUser): Promise<{ ok: boolean; resent: boolean }> {
  const now = Date.now();
  const recent = user.emailOtpSentAt && now - user.emailOtpSentAt.getTime() < EMAIL_OTP_RESEND_SECONDS * 1000;
  if (recent && user.emailOtpHash && user.emailOtpExpires && user.emailOtpExpires.getTime() > now) {
    return { ok: true, resent: false }; // a valid code was just emailed — don't spam
  }

  const code = generateEmailCode();
  await db.user.update({
    where: { id: user.id },
    data: {
      emailOtpHash: hashEmailCode(user.id, code),
      emailOtpExpires: new Date(now + EMAIL_OTP_TTL_MINUTES * 60_000),
      emailOtpAttempts: 0,
      emailOtpSentAt: new Date(now),
    },
  });

  const res = await sendMail({
    to: user.email,
    subject: `${code} is your MedRecPros MD sign-in code`,
    text:
      `Your MedRecPros MD sign-in code is: ${code}\n\n` +
      `It expires in ${EMAIL_OTP_TTL_MINUTES} minutes and can be used once.\n` +
      `If you did not try to sign in, you can ignore this email — your account stays protected by your password — and let your administrator know.`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">` +
      `<p>Your MedRecPros MD sign-in code is:</p>` +
      `<p style="font-size:28px;letter-spacing:6px;font-weight:bold;margin:12px 0">${code}</p>` +
      `<p>It expires in ${EMAIL_OTP_TTL_MINUTES} minutes and can be used once.</p>` +
      `<p style="color:#555">If you did not try to sign in, you can ignore this email — your account stays protected by your password — and let your administrator know.</p></div>`,
  });
  if (!res.ok) {
    await db.user.update({ where: { id: user.id }, data: { emailOtpHash: null, emailOtpExpires: null, emailOtpSentAt: null } });
    await audit("email_code_send_failed", user.id, {});
    return { ok: false, resent: false };
  }
  await audit("email_code_sent", user.id, {});
  return { ok: true, resent: true };
}

/** Checks a code. Single use; wrong guesses are limited per code. */
export async function verifyEmailCode(user: OtpUser, codeRaw: string): Promise<boolean> {
  const code = (codeRaw ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  if (!user.emailOtpHash || !user.emailOtpExpires || user.emailOtpExpires.getTime() <= Date.now()) return false;

  // Count this guess atomically; refuse once the per-code limit is reached.
  const counted = await db.user.updateMany({
    where: { id: user.id, emailOtpHash: user.emailOtpHash, emailOtpAttempts: { lt: EMAIL_OTP_MAX_ATTEMPTS } },
    data: { emailOtpAttempts: { increment: 1 } },
  });
  if (counted.count !== 1) return false;

  const given = Buffer.from(hashEmailCode(user.id, code), "hex");
  const stored = Buffer.from(user.emailOtpHash, "hex");
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) return false;

  // Burn the code — only the first request to claim it wins.
  const burned = await db.user.updateMany({
    where: { id: user.id, emailOtpHash: user.emailOtpHash, emailOtpExpires: { gt: new Date() } },
    data: { emailOtpHash: null, emailOtpExpires: null, emailOtpAttempts: 0 },
  });
  return burned.count === 1;
}
