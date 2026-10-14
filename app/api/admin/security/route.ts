import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/login-security";
import { isMfaEnforced } from "@/lib/mfa-config";
import { getMfaMethod, setMfaMethod, type MfaMethod } from "@/lib/mfa-method";
import { isMailConfigured, mailFrom, mailProvider, sendMail } from "@/lib/mailer";

export const runtime = "nodejs";

// Hardcoded Admin-only (not capability-based), same as the permissions screens.
async function requireAdmin() {
  const session = await auth();
  const user = session?.user as { role?: string; id?: string; email?: string | null } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return user;
}

const TEST_OK_KEY = "smtpTestOkAt";
const TEST_VALID_MINUTES = 60;

async function lastTestOk(): Promise<Date | null> {
  const row = await db.appSetting.findUnique({ where: { key: TEST_OK_KEY } }).catch(() => null);
  const d = row ? new Date(row.value) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const t = await lastTestOk();
  return NextResponse.json({
    method: await getMfaMethod(),
    enforced: isMfaEnforced(),
    mailConfigured: isMailConfigured(),
    mailProvider: mailProvider(),
    mailFrom: isMailConfigured() ? mailFrom() : null,
    testOkRecently: !!t && Date.now() - t.getTime() < TEST_VALID_MINUTES * 60_000,
    adminEmail: admin.email ?? null,
  });
}

/** Choose the second-factor method for everyone. */
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { method?: string };
  if (body.method !== "AUTHENTICATOR" && body.method !== "EMAIL") {
    return NextResponse.json({ error: "Invalid method." }, { status: 400 });
  }
  const method = body.method as MfaMethod;

  if (method === "EMAIL") {
    // Safety: never switch to email codes unless email demonstrably works, or nobody could sign in.
    if (!isMailConfigured()) {
      return NextResponse.json({ error: "Email is not configured on the server yet (add RESEND_API_KEY and MAIL_FROM in Vercel, then redeploy)." }, { status: 400 });
    }
    const t = await lastTestOk();
    if (!t || Date.now() - t.getTime() > TEST_VALID_MINUTES * 60_000) {
      return NextResponse.json({ error: "Send a test email to yourself first and confirm it arrives, then save." }, { status: 400 });
    }
  }

  const before = await getMfaMethod();
  await setMfaMethod(method, admin.id ?? null);
  await audit("mfa_method_changed", admin.id ?? null, { from: before, to: method });
  return NextResponse.json({ ok: true, method });
}

/** Send a test email to the signed-in admin's own address. */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (!admin.email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
  if (!isMailConfigured()) {
    return NextResponse.json({ error: "Email is not configured on the server. Add RESEND_API_KEY and MAIL_FROM in Vercel, then redeploy." }, { status: 400 });
  }
  const res = await sendMail({
    to: admin.email,
    subject: "MedRecPros MD — test email",
    text: "This is a test email from MedRecPros MD. If you can read this, sign-in codes can be delivered by email.",
  });
  if (!res.ok) {
    return NextResponse.json({ error: `The test email failed${res.detail ? `: ${res.detail}` : ""}. Check the email settings in Vercel and the server logs.` }, { status: 502 });
  }
  await db.appSetting.upsert({
    where: { key: TEST_OK_KEY },
    create: { key: TEST_OK_KEY, value: new Date().toISOString(), updatedBy: admin.id ?? null },
    update: { value: new Date().toISOString(), updatedBy: admin.id ?? null },
  });
  return NextResponse.json({ ok: true, sentTo: admin.email });
}
