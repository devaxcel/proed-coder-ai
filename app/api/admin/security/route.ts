import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/login-security";
import { isMfaEnforced } from "@/lib/mfa-config";
import { getBypass, setBypass } from "@/lib/mfa-bypass";
import { availableProviders, getMailProvider, mailFrom, mailStatus, MAIL_PROVIDER_KEY, saveStoredMail, sendMail, type MailProvider } from "@/lib/mailer";

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
  const provider = await getMailProvider();
  const b = await getBypass();
  return NextResponse.json({
    enforced: isMfaEnforced(),
    bypass: b.active ? { active: true, mode: b.mode, until: b.until ? b.until.toISOString() : null, since: b.since, by: b.by } : { active: false },
    mailConfigured: provider !== null,
    mailProvider: provider,
    providers: await availableProviders(),
    mailSettings: await mailStatus(),
    mailFrom: provider ? await mailFrom(provider) : null,
    testOkRecently: !!t && Date.now() - t.getTime() < TEST_VALID_MINUTES * 60_000,
    adminEmail: admin.email ?? null,
  });
}

/**
 * Turn 2FA off / back on.
 *   { action: "off24" }        2FA skipped for 24 hours, then back on by itself
 *   { action: "offPermanent" } 2FA skipped until an Admin turns it back on
 *   { action: "on" }           2FA back on now
 */
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "off24" && action !== "offPermanent" && action !== "on") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const before = await getBypass();
  const mode = action === "off24" ? "24h" : action === "offPermanent" ? "permanent" : null;
  await setBypass(mode, admin.id ?? null);
  await audit("mfa_bypass_changed", admin.id ?? null, { from: before.active ? before.mode : "on", to: mode ?? "on" });
  const after = await getBypass();
  return NextResponse.json({ ok: true, bypass: after.active ? { active: true, mode: after.mode, until: after.until ? after.until.toISOString() : null } : { active: false } });
}

/**
 * Send a test email to the signed-in admin's own address using the chosen provider.
 * On success the provider becomes the selected one and the "email works" proof is recorded.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (!admin.email) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { provider?: string };
  const provider = body.provider === "resend" || body.provider === "smtp" ? (body.provider as MailProvider) : await getMailProvider();
  if (!provider || !(await availableProviders())[provider]) {
    return NextResponse.json(
      {
        error:
          provider === "smtp"
            ? "Google email is not set up yet. Enter the mailbox and App Password above and save."
            : provider === "resend"
              ? "Resend is not set up yet. Enter the API key and sender address above and save."
              : "Email is not set up yet. Enter the Google or Resend details above and save.",
      },
      { status: 400 }
    );
  }

  const res = await sendMail(
    {
      to: admin.email,
      subject: "MedRecPros MD — test email",
      text: "This is a test email from MedRecPros MD. If you can read this, sign-in codes can be delivered by email.",
    },
    provider
  );
  if (!res.ok) {
    return NextResponse.json({ error: `The test email failed${res.detail ? `: ${res.detail}` : ""}` }, { status: 502 });
  }
  const now = new Date().toISOString();
  const previous = await getMailProvider();
  await db.appSetting.upsert({
    where: { key: TEST_OK_KEY },
    create: { key: TEST_OK_KEY, value: now, updatedBy: admin.id ?? null },
    update: { value: now, updatedBy: admin.id ?? null },
  });
  await db.appSetting.upsert({
    where: { key: MAIL_PROVIDER_KEY },
    create: { key: MAIL_PROVIDER_KEY, value: provider, updatedBy: admin.id ?? null },
    update: { value: provider, updatedBy: admin.id ?? null },
  });
  if (previous !== provider) await audit("mail_provider_changed", admin.id ?? null, { from: previous, to: provider });
  return NextResponse.json({ ok: true, sentTo: admin.email, provider });
}

/**
 * Save email credentials entered in the app (stored encrypted; never returned to the browser).
 * Body: { smtp?: {host,port,user,pass,from}, resend?: {apiKey,from}, clear?: "smtp"|"resend" }
 * Empty fields keep the saved value, so the password never has to be re-typed to change another field.
 * Any change invalidates the last "test email worked" proof — the Admin must test again.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (!process.env.MFA_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "Credentials can't be stored securely: MFA_ENCRYPTION_KEY is not set on the server." }, { status: 400 });
  }
  type Body = { smtp?: Record<string, string>; resend?: Record<string, string>; clear?: string };
  const b = (await req.json().catch(() => ({}))) as Body;
  const clear = b.clear === "smtp" || b.clear === "resend" ? (b.clear as MailProvider) : null;

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const port = str(b.smtp?.port, 5);
  if (port && !/^\d{2,5}$/.test(port)) return NextResponse.json({ error: "Port must be a number such as 587 or 465." }, { status: 400 });

  const patch = {
    smtpHost: str(b.smtp?.host, 200), smtpPort: port, smtpUser: str(b.smtp?.user, 200),
    smtpPass: str(b.smtp?.pass, 200).replace(/\s+/g, ""), // Google shows app passwords in groups of 4 — spaces are not part of it
    smtpFrom: str(b.smtp?.from, 300),
    resendApiKey: str(b.resend?.apiKey, 300), resendFrom: str(b.resend?.from, 300),
  };
  try {
    await saveStoredMail(patch, clear, admin.id ?? null);
  } catch {
    return NextResponse.json({ error: "Could not save the email settings." }, { status: 500 });
  }
  await db.appSetting.deleteMany({ where: { key: TEST_OK_KEY } });
  await audit("mail_settings_changed", admin.id ?? null, {
    fields: Object.entries(patch).filter(([, v]) => v).map(([k]) => k), // names only — never values
    cleared: clear,
  });
  return NextResponse.json({ ok: true });
}
