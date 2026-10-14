/**
 * Outgoing email — two providers, chosen by an Admin in Admin > Sign-in Security.
 *
 * Credentials can be entered IN THE APP (stored encrypted in the database with MFA_ENCRYPTION_KEY, never shown again)
 * or supplied as server environment variables. A value saved in the app wins over the environment variable.
 *
 *  "resend"  Resend API — apiKey + from        (env: RESEND_API_KEY, MAIL_FROM)
 *  "smtp"    Google Workspace / Gmail / any SMTP mailbox — user + app password [+ from, host, port]
 *            (env: SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_HOST, SMTP_PORT, SMTP_SECURE)
 *            host defaults to smtp.gmail.com, port to 587, from to the user. For Google use an App Password.
 */
import nodemailer from "nodemailer";
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./mfa";

export type MailProvider = "resend" | "smtp";
export const MAIL_PROVIDER_KEY = "mailProvider";
export const MAIL_CONFIG_KEY = "mailConfig";

export type StoredMail = {
  resendApiKey?: string; resendFrom?: string;
  smtpHost?: string; smtpPort?: string; smtpUser?: string; smtpPass?: string; smtpFrom?: string;
};

async function readStored(): Promise<StoredMail> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: MAIL_CONFIG_KEY } });
    if (!row) return {};
    return JSON.parse(decryptSecret(row.value)) as StoredMail;
  } catch {
    return {}; // table missing / key missing / unreadable → fall back to environment variables
  }
}

/** Merge new values into the stored config. Empty/undefined values are ignored; `clear` wipes a provider's saved values. */
export async function saveStoredMail(patch: StoredMail, clear: MailProvider | null, updatedBy: string | null) {
  const cur = await readStored();
  const next: StoredMail = { ...cur };
  if (clear === "resend") { delete next.resendApiKey; delete next.resendFrom; }
  if (clear === "smtp") { delete next.smtpHost; delete next.smtpPort; delete next.smtpUser; delete next.smtpPass; delete next.smtpFrom; }
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "string" && v.trim() !== "") (next as Record<string, string>)[k] = v.trim();
  }
  const value = encryptSecret(JSON.stringify(next)); // throws if MFA_ENCRYPTION_KEY is missing — nothing is stored in plain text
  await db.appSetting.upsert({
    where: { key: MAIL_CONFIG_KEY },
    create: { key: MAIL_CONFIG_KEY, value, updatedBy },
    update: { value, updatedBy },
  });
}

type Effective = {
  resendApiKey?: string; resendFrom: string;
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser?: string; smtpPass?: string; smtpFrom: string;
  src: { resend: "app" | "env" | null; smtp: "app" | "env" | null };
};

async function effective(): Promise<Effective> {
  const st = await readStored();
  const e = process.env;
  const smtpUser = st.smtpUser || e.SMTP_USER;
  const smtpPort = parseInt(st.smtpPort || e.SMTP_PORT || "587", 10) || 587;
  return {
    resendApiKey: st.resendApiKey || e.RESEND_API_KEY,
    resendFrom: st.resendFrom || e.MAIL_FROM || e.SMTP_FROM || "",
    smtpHost: st.smtpHost || e.SMTP_HOST || "smtp.gmail.com",
    smtpPort,
    smtpSecure: e.SMTP_SECURE === "true" || smtpPort === 465,
    smtpUser,
    smtpPass: st.smtpPass || e.SMTP_PASS,
    smtpFrom: st.smtpFrom || e.SMTP_FROM || smtpUser || "",
    src: {
      resend: st.resendApiKey ? "app" : e.RESEND_API_KEY ? "env" : null,
      smtp: st.smtpPass ? "app" : e.SMTP_PASS ? "env" : null,
    },
  };
}

const resendOk = (c: Effective) => !!(c.resendApiKey && c.resendFrom);
const smtpOk = (c: Effective) => !!(c.smtpUser && c.smtpPass);

export async function availableProviders(): Promise<Record<MailProvider, boolean>> {
  const c = await effective();
  return { resend: resendOk(c), smtp: smtpOk(c) };
}

/** Non-secret view for the Admin screen (passwords / API keys are never returned). */
export async function mailStatus() {
  const c = await effective();
  return {
    resend: { configured: resendOk(c), source: c.src.resend, from: c.resendFrom || null, hasKey: !!c.resendApiKey },
    smtp: { configured: smtpOk(c), source: c.src.smtp, user: c.smtpUser ?? null, from: c.smtpFrom || null, host: c.smtpHost, port: c.smtpPort, hasPassword: !!c.smtpPass },
  };
}

/** The provider Admin selected; if none (or it isn't configured) the first configured one (Resend, then SMTP). */
export async function getMailProvider(): Promise<MailProvider | null> {
  const avail = await availableProviders();
  let chosen: string | null = null;
  try {
    chosen = (await db.appSetting.findUnique({ where: { key: MAIL_PROVIDER_KEY } }))?.value ?? null;
  } catch {
    /* settings table unavailable → auto */
  }
  if ((chosen === "resend" || chosen === "smtp") && avail[chosen]) return chosen;
  if (avail.resend) return "resend";
  if (avail.smtp) return "smtp";
  return null;
}

export async function isMailConfigured(): Promise<boolean> {
  return (await getMailProvider()) !== null;
}

export async function mailFrom(provider: MailProvider): Promise<string> {
  const c = await effective();
  return provider === "resend" ? c.resendFrom : c.smtpFrom;
}

type Mail = { to: string; subject: string; text: string; html?: string };
export type SendResult = { ok: boolean; error?: string; detail?: string };

async function sendViaResend(c: Effective, m: Mail): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: c.resendFrom, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
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

async function sendViaSmtp(c: Effective, m: Mail): Promise<SendResult> {
  try {
    const transport = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpSecure,
      auth: { user: c.smtpUser, pass: c.smtpPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transport.sendMail({ from: c.smtpFrom, to: m.to, subject: m.subject, text: m.text, html: m.html });
    return { ok: true };
  } catch (e) {
    const code = (e as { responseCode?: number })?.responseCode;
    console.error("[mailer] SMTP send failed:", e instanceof Error ? e.message : e);
    const detail =
      code === 535 || (e as { code?: string })?.code === "EAUTH"
        ? "Google rejected the login. Use an App Password (not the normal password) and make sure 2-Step Verification is on for that account."
        : "The SMTP server rejected the message or could not be reached.";
    return { ok: false, error: "The email could not be sent.", detail };
  }
}

/** Never logs credentials or message bodies. `force` is used by the Admin "test email" to try a specific provider. */
export async function sendMail(m: Mail, force?: MailProvider): Promise<SendResult> {
  const c = await effective();
  const avail = { resend: resendOk(c), smtp: smtpOk(c) };
  const p = force ?? (await getMailProvider());
  if (!p || !avail[p]) return { ok: false, error: "Email is not configured on the server." };
  return p === "resend" ? sendViaResend(c, m) : sendViaSmtp(c, m);
}
