import { NextRequest, NextResponse } from "next/server";
import { checkPassword } from "@/lib/login-flow";
import { isMfaEnforced } from "@/lib/mfa-config";
import { getMfaMethod } from "@/lib/mfa-method";
import { issueEmailCode, maskEmail } from "@/lib/email-otp";

export const runtime = "nodejs";

/**
 * Sign-in step 1. Verifies email + password (counting failures toward lockout)
 * and tells the login form what to ask for next. Creates NO session.
 *   invalid | locked | ok (no code needed)
 *   mfa_required        — authenticator-app code
 *   enrollment_required — authenticator app not set up yet
 *   email_code_sent     — a 6-digit code was emailed (Admin chose the Email method)
 *   email_failed        — the email could not be sent
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ state: "invalid" }, { status: 400 });
  }
  const check = await checkPassword(String(body.email ?? ""), String(body.password ?? ""));
  if (check.state === "invalid") return NextResponse.json({ state: "invalid" });
  if (check.state === "locked") return NextResponse.json({ state: "locked", minutes: check.minutes });

  if (!isMfaEnforced()) return NextResponse.json({ state: "ok" });

  if ((await getMfaMethod()) === "EMAIL") {
    const sent = await issueEmailCode(check.user);
    if (!sent.ok) return NextResponse.json({ state: "email_failed" });
    return NextResponse.json({ state: "email_code_sent", to: maskEmail(check.user.email), resent: sent.resent });
  }

  const enrolled = check.user.mfaEnabled && !!check.user.mfaSecretEnc;
  return NextResponse.json({ state: enrolled ? "mfa_required" : "enrollment_required" });
}
