"use client";

import { useEffect, useState } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

type State = {
  method: "AUTHENTICATOR" | "EMAIL";
  enforced: boolean;
  mailConfigured: boolean;
  mailProvider: "resend" | "smtp" | null;
  mailFrom: string | null;
  testOkRecently: boolean;
  adminEmail: string | null;
};

export default function SecurityClient() {
  const [s, setS] = useState<State | null>(null);
  const [choice, setChoice] = useState<"AUTHENTICATOR" | "EMAIL">("AUTHENTICATOR");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/security");
    const j = await r.json();
    if (r.ok) {
      setS(j);
      setChoice(j.method);
    } else setMsg({ kind: "err", text: j.error ?? "Could not load settings." });
  }
  useEffect(() => { load(); }, []);

  async function sendTest() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/security", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? { kind: "ok", text: `Test email sent to ${j.sentTo}. Check your inbox (and spam), then click Save.` } : { kind: "err", text: j.error ?? "Test failed." });
    setBusy(false);
    load();
  }

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/security", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: choice }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? { kind: "ok", text: "Saved. The new method applies at each person's next sign-in." } : { kind: "err", text: j.error ?? "Save failed." });
    setBusy(false);
    load();
  }

  if (!s) return <p className="text-sm text-slate-500">{msg?.text ?? "Loading…"}</p>;

  const Option = ({ value, title, body }: { value: "AUTHENTICATOR" | "EMAIL"; title: string; body: string }) => (
    <label className="flex cursor-pointer gap-3 rounded-lg border bg-white p-4" style={{ borderColor: choice === value ? BRAND : "#CBD5E1", boxShadow: choice === value ? `0 0 0 1px ${BRAND}` : undefined }}>
      <input type="radio" name="method" className="mt-1" checked={choice === value} onChange={() => { setChoice(value); setMsg(null); }} style={{ accentColor: BRAND }} />
      <span>
        <span className="block font-semibold text-slate-900">{title}{s.method === value && <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: BRAND }}>Current</span>}</span>
        <span className="mt-1 block text-sm text-slate-600">{body}</span>
      </span>
    </label>
  );

  const needsTest = choice === "EMAIL" && s.method !== "EMAIL" && !s.testOkRecently;

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Sign-in Security</h1>
          <p className="mt-1 text-sm text-white/85">Choose how everyone proves it&apos;s really them after entering their password.</p>
        </div>
      </section>

      {!s.enforced && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Two-factor sign-in is currently <b>switched off</b> for the whole app (server setting <code>MFA_ENFORCEMENT</code>). The choice below is saved but only takes effect once it is turned on.
        </div>
      )}

      <div className="space-y-3">
        <Option value="AUTHENTICATOR" title="Authenticator app" body="Users scan a QR code once with Google Authenticator, Microsoft Authenticator, Authy or 1Password, then enter the 6-digit code from the app at each sign-in. Includes one-time backup codes." />
        <Option value="EMAIL" title="Email code" body="At each sign-in a 6-digit code is emailed to the user's account address (valid 10 minutes, single use). Nothing to install. Security depends on the user's mailbox, so make sure mailboxes are protected." />
      </div>

      {choice === "EMAIL" && (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: BRAND, backgroundColor: CARD }}>
          <div className="font-semibold text-slate-900">Email delivery</div>
          {s.mailConfigured ? (
            <p className="mt-1 text-slate-700">Sending from <b>{s.mailFrom}</b> via <b>{s.mailProvider === "resend" ? "Resend" : "SMTP"}</b>.</p>
          ) : (
            <p className="mt-1 text-red-700">Email is not configured on the server. Add <code>RESEND_API_KEY</code> and <code>MAIL_FROM</code> in Vercel, redeploy, then come back.</p>
          )}
          <button type="button" onClick={sendTest} disabled={busy || !s.mailConfigured} className="mt-3 rounded border bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: BRAND, color: BRAND }}>
            Send a test email to {s.adminEmail ?? "me"}
          </button>
          {s.testOkRecently && <span className="ml-3 text-xs text-green-700">✓ Test email delivered recently</span>}
        </div>
      )}

      {msg && (
        <div className={`rounded-md border p-3 text-sm ${msg.kind === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy || choice === s.method || needsTest} className="rounded px-5 py-2 font-semibold text-white disabled:opacity-50" style={{ background: BRAND }}>
          {busy ? "Working…" : "Save"}
        </button>
        {needsTest && <span className="text-xs text-slate-500">Send the test email first — this prevents locking everyone out if email isn&apos;t working.</span>}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-1">
        <div><b>Switching later is safe:</b> anyone with an authenticator app already set up keeps that setup stored, so switching back needs no re-enrollment.</div>
        <div><b>Switching to Authenticator app:</b> anyone not yet enrolled is asked to scan a QR code at their next sign-in.</div>
        <div><b>Emergency:</b> if sign-in ever breaks, run <code>npx tsx scripts/set-mfa-method.ts AUTHENTICATOR</code> on a computer that has the project&apos;s <code>.env</code>.</div>
      </div>
    </div>
  );
}
