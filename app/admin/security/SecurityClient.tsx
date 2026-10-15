"use client";

import { useEffect, useRef, useState } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

type State = {
  enforced: boolean;
  bypass: { active: false } | { active: true; mode: "24h" | "permanent"; until: string | null; since: string | null; by: string | null };
  mailConfigured: boolean;
  mailProvider: "resend" | "smtp" | null;
  providers: { resend: boolean; smtp: boolean };
  mailSettings: {
    resend: { configured: boolean; source: "app" | "env" | null; from: string | null; hasKey: boolean };
    smtp: { configured: boolean; source: "app" | "env" | null; user: string | null; from: string | null; host: string; port: number; hasPassword: boolean };
  };
  mailFrom: string | null;
  testOkRecently: boolean;
  adminEmail: string | null;
};

export default function SecurityClient() {
  const [s, setS] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<"resend" | "smtp">("resend");
  // credential forms (secrets are write-only: the server never sends them back)
  const [g, setG] = useState({ user: "", pass: "", from: "", host: "", port: "" });
  const [rs, setRs] = useState({ apiKey: "", from: "" });
  const [showAdv, setShowAdv] = useState(false);
  const initialised = useRef(false);

  async function load() {
    const r = await fetch("/api/admin/security");
    const j = await r.json();
    if (r.ok) {
      setS(j);
      if (!initialised.current) {
        initialised.current = true;
        setProvider(j.mailProvider ?? (j.providers?.smtp && !j.providers?.resend ? "smtp" : "resend"));
      }
    } else setMsg({ kind: "err", text: j.error ?? "Could not load settings." });
  }
  useEffect(() => { load(); }, []);

  async function saveCreds(which: "smtp" | "resend") {
    setBusy(true); setMsg(null);
    const body = which === "smtp" ? { smtp: g } : { resend: rs };
    const r = await fetch("/api/admin/security", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      if (which === "smtp") setG({ user: "", pass: "", from: "", host: "", port: "" });
      else setRs({ apiKey: "", from: "" });
      setMsg({ kind: "ok", text: "Saved securely. Now click “Send a test email” to confirm it works." });
    } else setMsg({ kind: "err", text: j.error ?? "Save failed." });
    setBusy(false);
    load();
  }

  async function clearCreds(which: "smtp" | "resend") {
    if (!confirm("Remove the saved credentials for this provider?")) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/security", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear: which }) });
    setMsg(r.ok ? { kind: "ok", text: "Saved credentials removed." } : { kind: "err", text: "Could not remove them." });
    setBusy(false);
    load();
  }

  async function sendTest() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? { kind: "ok", text: `Test email sent to ${j.sentTo}. Check your inbox (and spam) to confirm it arrived.` } : { kind: "err", text: j.error ?? "Test failed." });
    setBusy(false);
    load();
  }

  async function setBypass(action: "off24" | "offPermanent" | "on") {
    if (action === "off24" && !confirm("Turn OFF two-factor sign-in for EVERYONE for 24 hours? It switches back on automatically.")) return;
    if (action === "offPermanent" && !confirm("Turn OFF two-factor sign-in for EVERYONE until you turn it back on yourself?\n\nThis lowers protection of patient information. Only do this if you have to.")) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/security", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok
      ? { kind: "ok", text: action === "on" ? "Two-factor sign-in is ON." : action === "off24" ? "Two-factor sign-in is OFF for 24 hours, then it turns back on by itself." : "Two-factor sign-in is OFF until you turn it back on." }
      : { kind: "err", text: j.error ?? "Could not change the setting." });
    setBusy(false);
    load();
  }

  if (!s) return <p className="text-sm text-slate-500">{msg?.text ?? "Loading…"}</p>;

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
  const off = s.bypass.active;

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Sign-in Security</h1>
          <p className="mt-1 text-sm text-white/85">Everyone proves it&apos;s really them after entering their password — with an authenticator app, or an emailed code.</p>
        </div>
      </section>

      {!s.enforced && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Two-factor sign-in is switched <b>off at the server level</b> (setting <code>MFA_ENFORCEMENT</code> in Vercel is not <code>on</code>). Nothing below takes effect until it is turned on.
        </div>
      )}

      {/* ---------------- Status + on/off ---------------- */}
      <div className="rounded-lg border-2 p-4" style={{ borderColor: off ? "#DC2626" : "#16A34A", backgroundColor: off ? "#FEF2F2" : "#F0FDF4" }}>
        <div className="text-lg font-bold" style={{ color: off ? "#B91C1C" : "#15803D" }}>
          {off ? "Two-factor sign-in is OFF" : "Two-factor sign-in is ON"}
        </div>
        <p className="mt-1 text-sm text-slate-700">
          {s.bypass.active
            ? s.bypass.mode === "24h"
              ? <>Everyone can sign in with a password only. It switches back <b>on automatically at {fmt(s.bypass.until)}</b>.</>
              : <>Everyone can sign in with a password only, <b>until an Admin turns it back on</b>. Turned off {fmt(s.bypass.since)}.</>
            : <>Everyone needs a second check after their password: the <b>authenticator app</b> if they have set it up (email code is their backup), otherwise an <b>emailed code</b>.</>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {off ? (
            <button type="button" onClick={() => setBypass("on")} disabled={busy} className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#15803D" }}>Turn 2FA back on now</button>
          ) : (
            <>
              <button type="button" onClick={() => setBypass("off24")} disabled={busy} className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Turn off for 24 hours</button>
              <button type="button" onClick={() => setBypass("offPermanent")} disabled={busy} className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Turn off until I turn it on</button>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Sessions started while 2FA is off end when the off-period ends (or after 8 hours at most). Every change is recorded in the audit log.
        </p>
      </div>

      {/* ---------------- Who uses what ---------------- */}
      <div className="rounded-lg border bg-white p-4 text-sm text-slate-700" style={{ borderColor: "#CBD5E1" }}>
        <div className="font-semibold text-slate-900">How each person signs in</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b>Has an authenticator app:</b> enters the app code. If they can&apos;t use it, “Email me a code” on the login screen sends a backup code. One-time backup codes are the last resort.</li>
          <li><b>No authenticator app:</b> a 6-digit code is emailed to their account address at each sign-in. They can add the app any time from “My sign-in security”.</li>
        </ul>
      </div>

      {/* ---------------- Email delivery ---------------- */}
      <div className="rounded-lg border p-4 text-sm" style={{ borderColor: BRAND, backgroundColor: CARD }}>
        <div className="font-semibold text-slate-900">Email delivery — how are sign-in codes sent?</div>
        {!s.mailConfigured && (
          <p className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
            Email is <b>not set up</b>. People without an authenticator app can&apos;t sign in until it is — set it up below and send a test email.
          </p>
        )}
        <p className="mt-1 text-xs text-slate-600">Enter the details here — they are stored encrypted and are never shown again after saving.</p>

          <div className="mt-3 space-y-3">
            {/* ---------------- Google ---------------- */}
            <div className="rounded border bg-white p-3" style={{ borderColor: provider === "smtp" ? BRAND : "#CBD5E1" }}>
              <label className="flex cursor-pointer gap-2">
                <input type="radio" name="provider" className="mt-1" checked={provider === "smtp"} onChange={() => setProvider("smtp")} style={{ accentColor: BRAND }} />
                <span>
                  <span className="block font-semibold text-slate-900">Google (Gmail / Google Workspace)</span>
                  <span className="block text-xs text-slate-600">Sends from a Google mailbox using an App Password. No domain verification needed; works for any recipient.</span>
                  <span className={`mt-1 block text-xs ${s.mailSettings.smtp.configured ? "text-green-700" : "text-red-700"}`}>
                    {s.mailSettings.smtp.configured
                      ? `✓ Saved ${s.mailSettings.smtp.source === "app" ? "in the app" : "as a server setting"} — ${s.mailSettings.smtp.user}`
                      : "Not set up yet"}
                  </span>
                </span>
              </label>
              {provider === "smtp" && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input className={`${"w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"}`} placeholder={s.mailSettings.smtp.user ? `Mailbox: ${s.mailSettings.smtp.user} (leave empty to keep)` : "Mailbox, e.g. no-reply@yourdomain.com"} value={g.user} onChange={(e) => setG({ ...g, user: e.target.value })} autoComplete="off" />
                  <input type="password" className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" placeholder={s.mailSettings.smtp.hasPassword ? "App Password saved — type to replace" : "Google App Password (16 characters)"} value={g.pass} onChange={(e) => setG({ ...g, pass: e.target.value })} autoComplete="new-password" />
                  <input className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2" placeholder={`Sender name & address (optional) — e.g. MedRecPros MD <no-reply@yourdomain.com>${s.mailSettings.smtp.from ? ` · now: ${s.mailSettings.smtp.from}` : ""}`} value={g.from} onChange={(e) => setG({ ...g, from: e.target.value })} />
                  <button type="button" onClick={() => setShowAdv(!showAdv)} className="text-left text-xs font-semibold underline md:col-span-2" style={{ color: BRAND }}>{showAdv ? "Hide" : "Show"} advanced (server / port)</button>
                  {showAdv && (
                    <>
                      <input className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" placeholder={`SMTP server (now: ${s.mailSettings.smtp.host})`} value={g.host} onChange={(e) => setG({ ...g, host: e.target.value })} />
                      <input className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" placeholder={`Port (now: ${s.mailSettings.smtp.port}; 587 or 465)`} inputMode="numeric" value={g.port} onChange={(e) => setG({ ...g, port: e.target.value.replace(/\D/g, "") })} />
                    </>
                  )}
                  <div className="flex gap-2 md:col-span-2">
                    <button type="button" onClick={() => saveCreds("smtp")} disabled={busy || !(g.user || g.pass || g.from || g.host || g.port)} className="rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BRAND }}>Save Google settings</button>
                    {s.mailSettings.smtp.source === "app" && <button type="button" onClick={() => clearCreds("smtp")} disabled={busy} className="rounded border px-3 py-1.5 text-sm text-red-700">Remove saved</button>}
                  </div>
                  <p className="text-xs text-slate-500 md:col-span-2">Get an App Password: sign in to that Google account → turn on 2-Step Verification → open myaccount.google.com/apppasswords → create one. Spaces in it don&apos;t matter.</p>
                </div>
              )}
            </div>

            {/* ---------------- Resend ---------------- */}
            <div className="rounded border bg-white p-3" style={{ borderColor: provider === "resend" ? BRAND : "#CBD5E1" }}>
              <label className="flex cursor-pointer gap-2">
                <input type="radio" name="provider" className="mt-1" checked={provider === "resend"} onChange={() => setProvider("resend")} style={{ accentColor: BRAND }} />
                <span>
                  <span className="block font-semibold text-slate-900">Resend</span>
                  <span className="block text-xs text-slate-600">Email API. Needs a domain verified in Resend before it can email anyone other than the Resend account owner.</span>
                  <span className={`mt-1 block text-xs ${s.mailSettings.resend.configured ? "text-green-700" : "text-red-700"}`}>
                    {s.mailSettings.resend.configured
                      ? `✓ Saved ${s.mailSettings.resend.source === "app" ? "in the app" : "as a server setting"} — from ${s.mailSettings.resend.from}`
                      : "Not set up yet"}
                  </span>
                </span>
              </label>
              {provider === "resend" && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="password" className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" placeholder={s.mailSettings.resend.hasKey ? "API key saved — type to replace" : "Resend API key (re_...)"} value={rs.apiKey} onChange={(e) => setRs({ ...rs, apiKey: e.target.value })} autoComplete="new-password" />
                  <input className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" placeholder={s.mailSettings.resend.from ? `From (now: ${s.mailSettings.resend.from})` : "From, e.g. MedRecPros MD <no-reply@yourdomain.com>"} value={rs.from} onChange={(e) => setRs({ ...rs, from: e.target.value })} />
                  <div className="flex gap-2 md:col-span-2">
                    <button type="button" onClick={() => saveCreds("resend")} disabled={busy || !(rs.apiKey || rs.from)} className="rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BRAND }}>Save Resend settings</button>
                    {s.mailSettings.resend.source === "app" && <button type="button" onClick={() => clearCreds("resend")} disabled={busy} className="rounded border px-3 py-1.5 text-sm text-red-700">Remove saved</button>}
                  </div>
                </div>
              )}
            </div>
          </div>


        {s.mailProvider && <p className="mt-3 text-xs text-slate-600">Currently sending via <b>{s.mailProvider === "resend" ? "Resend" : "Google"}</b> from <b>{s.mailFrom}</b>.</p>}
        <button type="button" onClick={sendTest} disabled={busy || !s.providers[provider]} className="mt-3 rounded border bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: BRAND, color: BRAND }}>
          Send a test email to {s.adminEmail ?? "me"} using {provider === "resend" ? "Resend" : "Google"}
        </button>
        {s.testOkRecently && <span className="ml-3 text-xs text-green-700">✓ Test email delivered recently</span>}
        <p className="mt-2 text-xs text-slate-500">A successful test also makes that provider the one used for sign-in codes.</p>
      </div>

      {msg && (
        <div className={`rounded-md border p-3 text-sm ${msg.kind === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      <div className="rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-1">
        <div><b>Locked out?</b> If email stops working and people can&apos;t get in, an Admin who is still signed in can turn 2FA off here for 24 hours. If no Admin can sign in, run <code>npx tsx scripts/set-2fa-bypass.ts 24h</code> on a computer that has the project&apos;s <code>.env</code>.</div>
        <div><b>Lost phone:</b> Admin &gt; User Management &gt; “Reset 2FA / unlock” — that person falls back to the emailed code and can add a new app afterwards.</div>
      </div>
    </div>
  );
}
