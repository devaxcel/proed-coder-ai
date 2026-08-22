"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const BRAND = "#14457B";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setErr("Invalid email or password.");
      } else if (result?.ok) {
        router.push(callbackUrl);
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
            ProEdCS Coder AI
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            AI-powered medical coding, policy research, and compliant physician query drafting — built for ProEd&apos;s coding and CDI team.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["Code Search", "Policies Q&A", "Query Forms A–H", "HCC Risk", "HEDIS"].map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-medium rounded-full px-3 py-1 bg-white/10 border border-white/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/50">
          ProEd Consulting &amp; Staffing · West Covina, CA
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
            <div className="font-semibold text-slate-900 text-sm">ProEdCS Coder AI</div>
            <div className="text-xs text-slate-500">ProEd Consulting &amp; Staffing</div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue.</p>

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
              autoFocus
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
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2"
              style={{ borderColor: "#CBD5E1" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#CBD5E1")}
            />
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-400 text-center">
          Don&apos;t have an account? Ask your ProEd administrator to create one for you.
        </p>
      </div>
    </div>
  );
}
