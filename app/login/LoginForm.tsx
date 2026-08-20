"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
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
        password,
        redirect: false,
      });
      if (result?.error) {
        setErr("Invalid team password. Try again.");
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setErr("Login failed. Check your APP_PASSWORD env var.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-500 text-lg font-bold text-white">
            P
          </div>
          <div>
            <div className="font-semibold text-slate-900">ProEdCS Coder AI</div>
            <div className="text-xs text-slate-500">Sign in with the team password</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-800">
              Team password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Built by AXCEL for ProEd Consulting &amp; Staffing · West Covina, CA
        </p>
      </div>
    </div>
  );
}
