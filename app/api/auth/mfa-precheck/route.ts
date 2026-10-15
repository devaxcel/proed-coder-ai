import { NextRequest, NextResponse } from "next/server";
import { checkPassword } from "@/lib/login-flow";
import { isMfaEnforced } from "@/lib/mfa-config";
import { getBypass } from "@/lib/mfa-bypass";
import { isMailConfigured } from "@/lib/mailer";
import { issueEmailCode, maskEmail } from "@/lib/email-otp";

export const runtime = "nodejs";

/**
 * Sign-in step 1. Verifies email + password (counting failures toward lockout)
 * and tells the login form what to ask for next. Creates NO session.
 *   invalid | locked
 *   ok                — no code needed (2FA not enforced, or an Admin has switched it off for now)
 *   mfa_required      — the user has an authenticator app: ask for its code (emailBackup = "email me a code" is available)
 *   email_code_sent   — a 6-digit code was emailed (user has no app, or asked for the email backup with sendEmail:true)
 *   email_failed      — the email could not be sent / email is not set up
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; sendEmail?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ state: "invalid" }, { status: 400 });
  }
  const check = await checkPassword(String(body.email ?? ""), String(body.password ?? ""));
  if (check.state === "invalid") return NextResponse.json({ state: "invalid" });
  if (check.state === "locked") return NextResponse.json({ state: "locked", minutes: check.minutes });

  if (!isMfaEnforced()) return NextResponse.json({ state: "ok" });
  if ((await getBypass()).active) return NextResponse.json({ state: "ok" });

  const enrolled = check.user.mfaEnabled && !!check.user.mfaSecretEnc;
  const mailOk = await isMailConfigured();

  if (enrolled && !body.sendEmail) {
    return NextResponse.json({ state: "mfa_required", emailBackup: mailOk });
  }

  // Email code: primary for people without the app, backup for people with it.
  if (!mailOk) return NextResponse.json({ state: "email_failed" });
  const sent = await issueEmailCode(check.user);
  if (!sent.ok) return NextResponse.json({ state: "email_failed" });
  return NextResponse.json({ state: "email_code_sent", to: maskEmail(check.user.email), resent: sent.resent, hasApp: enrolled });
}
