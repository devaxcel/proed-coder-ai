/**
 * Outgoing email. Two ways to send — the first one configured wins:
 *
 *  1) Resend (recommended)  — https://resend.com
 *       RESEND_API_KEY   re_xxxxxxxx...
 *       MAIL_FROM        "MedRecPros MD <no-reply@yourdomain.com>"
 *                        (until a domain is verified in Resend, use "MedRecPros MD <onboarding@resend.dev>" —
 *                         Resend then only delivers to the email address of your own Resend account)
 *
 *  2) Any SMTP mailbox (Google Workspace, Zoho, cPanel, …)
 *       SMTP_HOST, SMTP_PORT (587 or 465), SMTP_USER, SMTP_PASS, SMTP_FROM, [SMTP_SECURE="true"]
 */
import nodemailer from "nodemailer";

export type MailProvider = "resend" | "smtp";

const fromAddress = () => process.env.MAIL_FROM || process.env.SMTP_FROM || "";

export function mailProvider(): MailProvider | null {
  if (process.env.RESEND_API_KEY && fromAddress()) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && fromAddress()) return "smtp";
  return null;
}

export function isMailConfigured(): boolean {
  return mailProvider() !== null;
}

export function mailFrom(): string {
  return fromAddress();
}

type Mail = { to: string; subject: string; text: string; html?: string };
export type SendResult = { ok: boolean; error?: string; detail?: string };

async function sendViaResend(m: Mail): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    console.error("[mailer] Resend rejected the email:", res.status, j.message ?? "");
    return { ok: false, error: "The email could not be sent.", detail: j.message ?? `Resend returned HTTP ${res.status}` };
  } catch (e) {
    console.error("[mailer] Resend request failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "The email could not be sent.", detail: "Could not reach Resend." };
  }
}

async function sendViaSmtp(m: Mail): Promise<SendResult> {
  try {
    const port = parseInt(process.env.SMTP_PORT as string, 10);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transport.sendMail({ from: fromAddress(), to: m.to, subject: m.subject, text: m.text, html: m.html });
    return { ok: true };
  } catch (e) {
    console.error("[mailer] SMTP send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "The email could not be sent.", detail: "The SMTP server rejected the message or could not be reached." };
  }
}

/** Never logs credentials or message bodies. */
export async function sendMail(m: Mail): Promise<SendResult> {
  const p = mailProvider();
  if (!p) return { ok: false, error: "Email is not configured on the server." };
  return p === "resend" ? sendViaResend(m) : sendViaSmtp(m);
}
