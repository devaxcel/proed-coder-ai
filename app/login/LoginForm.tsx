"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;

export default function LoginForm({ callbackUrl, notice }: { callbackUrl: string; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needCode, setNeedCode] = useState(false); // step 2: second-factor code
  const [codeMode, setCodeMode] = useState<"totp" | "email">("totp");
  const [sentTo, setSentTo] = useState("");
  const [hasApp, setHasApp] = useState(false); // user has an authenticator app (email is then the backup)
  const [emailBackup, setEmailBackup] = useState(false); // "email me a code" is available
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      // Step 1 (only when no code is being asked for yet): check password and
      // find out whether an authenticator code / enrollment is required.
      let state = "mfa_required";
      if (!needCode) {
        const pre = await fetch("/api/auth/mfa-precheck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const j = await pre.json().catch(() => ({ state: "invalid" }));
        state = j.state;
        if (state === "invalid") {
          setErr("Invalid email or password.");
          return;
        }
        if (state === "locked") {
          setErr(`Too many failed attempts. This account is locked for about ${j.minutes ?? 15} minutes.`);
          return;
        }
        if (state === "email_failed") {
          setErr("We couldn't send your sign-in code by email. Please try again in a moment, or contact your administrator.");
          return;
        }
        if (state === "mfa_required" || state === "email_code_sent") {
          setCodeMode(state === "email_code_sent" ? "email" : "totp");
          setHasApp(state === "mfa_required" || j.hasApp === true);
          setEmailBackup(j.emailBackup === true);
          setSentTo(j.to ?? "");
          setNeedCode(true);
          return;
        }
      }

      // Step 2: create the session (code included when required).
      const result = await signIn("credentials", {
        email,
        password,
        code: needCode ? code : "",
        redirect: false,
      });
      if (result?.error) {
        setErr(needCode ? (codeMode === "email" ? "That code is invalid or expired. Check your email, or use \"Send a new code\"." : "That code is invalid or expired. Check your authenticator app and try again.") : "Invalid email or password.");
        if (needCode) setCode("");
      } else if (result?.ok) {
        // First-time users are sent to set up their authenticator by the middleware.
        router.push(state === "enrollment_required" ? "/mfa/setup" : callbackUrl);
        router.refresh();
      } else {
        setErr("Login failed. Please try again.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setErr(null);
    setResendInfo(null);
    try {
      const pre = await fetch("/api/auth/mfa-precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, sendEmail: true }),
      });
      const j = await pre.json().catch(() => ({ state: "invalid" }));
      if (j.state === "email_code_sent") {
        setCodeMode("email");
        setSentTo(j.to ?? sentTo);
        setResendInfo(j.resent ? "A new code was sent." : "A code was just sent — please wait about 30 seconds before asking for another.");
        setCode("");
      } else if (j.state === "locked") {
        setErr(`Too many failed attempts. This account is locked for about ${j.minutes ?? 15} minutes.`);
      } else {
        setErr("We couldn't send a code by email. Please try again in a moment, or use your authenticator app / ask your administrator.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2 bg-white">
      {/* Left panel — branded, only shown on md+ screens */}
      <div
        className="hidden md:flex flex-col justify-between p-10 text-white relative overflow-hidden"
        style={{ backgroundColor: BRAND }}
      >
        {/* Subtle decorative circles for visual interest */}
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative z-10">
          <div className="rounded-lg bg-white p-3 inline-block shadow-lg">
            <img src="/proed-logo.png" alt="ProEd Consulting" className="h-10 w-auto" />
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <h1 className="text-2xl font-bold leading-snug">
            MedRecPros MD™
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            AI-powered medical coding, policy research, and compliant physician query drafting — built for ProEd&apos;s coding and CDI team.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["Code Search", "Policies Q&A", "Query Forms A–H", "HCC Risk", "HEDIS"].map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium rounded-full px-3 py-1 bg-white/10 border border-white/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/75">
          ProEd Consulting &amp; Staffing · City of Industry, CA
        </div>
      </div>

      {/* Right panel — the actual form */}
      <div className="p-8 sm:p-10 flex flex-col justify-center">
        {/* Mobile-only compact logo, since the branded panel is hidden below md */}
        <div className="md:hidden mb-6 flex items-center gap-3">
          <div className="rounded-md bg-white p-2 shadow-sm border border-slate-100">
            <img src="/proed-logo.png" alt="ProEd Consulting" className="h-7 w-auto" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">MedRecPros MD™</div>
            <div className="text-xs text-slate-500">ProEd Consulting &amp; Staffing</div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue.</p>

        {notice && (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-800">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={needCode}
              autoFocus={!needCode}
              autoComplete="email"
              placeholder="you@proedcs.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2"
              style={{ borderColor: "#CBD5E1" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#CBD5E1")}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-800">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              readOnly={needCode}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2"
              style={{ borderColor: "#CBD5E1" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#CBD5E1")}
            />
          </div>

          {needCode && (
            <div>
              <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-800">
                {codeMode === "email" ? "Email code" : "Authenticator code"}
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                autoComplete="one-time-code"
                inputMode={codeMode === "email" ? "numeric" : "text"}
                placeholder={codeMode === "email" ? "6-digit code from your email" : "6-digit code (or a backup code)"}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm tracking-widest shadow-sm focus:outline-none focus:ring-2"
              />
              {codeMode === "email" ? (
                <p className="mt-1 text-xs text-slate-500">
                  We emailed a 6-digit code to <b>{sentTo || "your email address"}</b>. It expires in 10 minutes. Check your spam folder if it doesn&apos;t arrive.{" "}
                  <button type="button" onClick={resendCode} disabled={loading} className="font-semibold underline disabled:opacity-50" style={{ color: BRAND }}>
                    Send a new code
                  </button>
                  {hasApp && (
                    <>
                      {" · "}
                      <button type="button" onClick={() => { setCodeMode("totp"); setCode(""); setResendInfo(null); setErr(null); }} className="font-semibold underline" style={{ color: BRAND }}>
                        Use my authenticator app instead
                      </button>
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Open your authenticator app and enter the current code for MedRecPros MD. Lost your phone? Use a backup code, or ask an administrator to reset it.
                  {emailBackup && (
                    <>
                      {" "}
                      <button type="button" onClick={resendCode} disabled={loading} className="font-semibold underline disabled:opacity-50" style={{ color: BRAND }}>
                        Can&apos;t use your app? Email me a code
                      </button>
                    </>
                  )}
                </p>
              )}
              {resendInfo && <p className="mt-1 text-xs text-green-700">{resendInfo}</p>}
            </div>
          )}

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || (needCode && !code.trim())}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            {loading ? "Signing in…" : needCode ? "Verify and sign in" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-400 text-center">
          Don&apos;t have an account? Ask your ProEd administrator to create one for you.
        </p>
      </div>
    </div>
  );
}
