"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { THEME } from "@/lib/theme";

export default function MfaSetupClient({ email }: { email: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const started = useRef(false);

  async function start() {
    setErr(null);
    const r = await fetch("/api/mfa/setup", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error ?? "Could not start setup.");
      return;
    }
    setQr(j.qr);
    setManualKey(j.manualKey);
  }

  useEffect(() => {
    if (started.current) return; // React strict mode runs effects twice in dev
    started.current = true;
    void start();
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error ?? "Could not verify the code.");
        setCode("");
        return;
      }
      setBackupCodes(j.backupCodes as string[]);
    } finally {
      setBusy(false);
    }
  }

  function downloadCodes() {
    if (!backupCodes) return;
    const text = `MedRecPros MD — backup codes for ${email}\nEach code works once. Keep them somewhere safe and private.\n\n${backupCodes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "medrecpros-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const card = "w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl border border-slate-200";

  return (
    <div className="flex w-full justify-center">
      {!backupCodes ? (
        <div className={card}>
          <h1 className="text-xl font-bold" style={{ color: THEME.primary }}>Set up two-factor sign-in</h1>
          <p className="mt-1 text-sm text-slate-600">
            To protect patient information, MedRecPros MD requires a code from an authenticator app each time you sign in.
          </p>

          <ol className="mt-4 space-y-4 text-sm text-slate-800">
            <li>
              <b>1.</b> Install an authenticator app on your phone (Microsoft Authenticator, Google Authenticator, Authy, or 1Password).
            </li>
            <li>
              <b>2.</b> In the app choose <b>Add account → Scan QR code</b> and scan:
              <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                {qr ? <img src={qr} alt="Authenticator QR code" width={220} height={220} /> : <div className="h-[220px] w-[220px] animate-pulse rounded bg-slate-200" />}
                {manualKey && (
                  <div className="text-center text-xs text-slate-600">
                    Can&apos;t scan? Enter this key manually:
                    <div className="mt-1 select-all font-mono text-sm font-semibold tracking-wider text-slate-900">{manualKey}</div>
                  </div>
                )}
              </div>
            </li>
            <li>
              <b>3.</b> Enter the 6-digit code the app shows to confirm:
              <form onSubmit={confirm} className="mt-2 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={busy || code.length !== 6 || !qr}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: THEME.primary }}
                >
                  {busy ? "Checking…" : "Verify"}
                </button>
              </form>
            </li>
          </ol>

          {err && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="mt-6 text-xs text-slate-500 underline">
            Cancel and sign out
          </button>
        </div>
      ) : (
        <div className={card}>
          <h1 className="text-xl font-bold" style={{ color: THEME.primary }}>Save your backup codes</h1>
          <p className="mt-1 text-sm text-slate-600">
            If you lose your phone, each of these codes can be used <b>once</b> in place of the app code. They are shown only now — store them somewhere private (not in this app).
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm font-semibold">
            {backupCodes.map((c) => <div key={c} className="select-all">{c}</div>)}
          </div>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={downloadCodes} className="rounded-lg border px-3 py-1.5 text-sm">Download .txt</button>
            <button type="button" onClick={() => navigator.clipboard?.writeText(backupCodes.join("\n"))} className="rounded-lg border px-3 py-1.5 text-sm">Copy</button>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            I have saved these backup codes
          </label>
          <button
            type="button"
            disabled={!saved}
            onClick={() => signOut({ callbackUrl: "/login?mfa=enabled" })}
            className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: THEME.primary }}
          >
            Finish — sign in again with my code
          </button>
        </div>
      )}
    </div>
  );
}
