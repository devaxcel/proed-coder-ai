"use client";

import { useEffect, useState } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;
type P = "groq" | "anthropic" | "openai";
type Info = { label: string; configured: boolean; source: "app" | "env" | null; model: string; testedRecently: boolean };
type State = { active: P; activeSource: string; providers: Record<P, Info>; encryptionReady: boolean };

const META: Record<P, { title: string; blurb: string; keyHint: string; modelHint: string; link: string }> = {
  groq: { title: "Groq", blurb: "Fast and low-cost (open-source models). Good default for everyday use.", keyHint: "gsk_...", modelHint: "openai/gpt-oss-120b", link: "console.groq.com → API Keys" },
  anthropic: { title: "Claude (Anthropic)", blurb: "Highest-quality answers for coding and compliance text. Paid per use.", keyHint: "sk-ant-...", modelHint: "claude-sonnet-4-5-20250929", link: "console.anthropic.com → API Keys" },
  openai: { title: "OpenAI", blurb: "GPT models. Paid per use.", keyHint: "sk-...", modelHint: "gpt-4.1-mini", link: "platform.openai.com → API keys" },
};
const ORDER: P[] = ["groq", "anthropic", "openai"];
const inputCls = "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm";

export default function AiModelClient() {
  const [s, setS] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<P>("groq");
  const [f, setF] = useState<Record<P, { apiKey: string; model: string }>>({
    groq: { apiKey: "", model: "" }, anthropic: { apiKey: "", model: "" }, openai: { apiKey: "", model: "" },
  });
  const [inited, setInited] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/llm");
    const j = await r.json();
    if (r.ok) { setS(j); if (!inited) { setInited(true); setOpen(j.active); } }
    else setMsg({ kind: "err", text: j.error ?? "Could not load settings." });
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function call(method: string, body: object, label: string) {
    setBusy(label); setMsg(null);
    const r = await fetch("/api/admin/llm", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    return { ok: r.ok, j };
  }

  async function save(p: P) {
    const { ok, j } = await call("PATCH", { [p]: f[p] }, `save-${p}`);
    if (ok) { setF({ ...f, [p]: { apiKey: "", model: "" } }); setMsg({ kind: "ok", text: "Saved securely. Now click “Test” to confirm it works." }); }
    else setMsg({ kind: "err", text: j.error ?? "Save failed." });
    load();
  }
  async function remove(p: P) {
    if (!confirm("Remove the key saved in the app for this provider? (A key set in Vercel, if any, will be used instead.)")) return;
    const { ok } = await call("PATCH", { clear: p }, `clear-${p}`);
    setMsg(ok ? { kind: "ok", text: "Saved key removed." } : { kind: "err", text: "Could not remove it." });
    load();
  }
  async function test(p: P) {
    const { ok, j } = await call("POST", { provider: p }, `test-${p}`);
    setMsg(ok ? { kind: "ok", text: `✓ ${META[p].title} works (model ${j.model}). You can now switch the app to it.` } : { kind: "err", text: j.error ?? "Test failed." });
    load();
  }
  async function use(p: P) {
    const { ok, j } = await call("PUT", { provider: p }, `use-${p}`);
    setMsg(ok ? { kind: "ok", text: `The app now uses ${META[p].title}. This reaches every user within about 30 seconds.` } : { kind: "err", text: j.error ?? "Could not switch." });
    load();
  }

  if (!s) return <p className="text-sm text-slate-500">{msg?.text ?? "Loading…"}</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">AI Model</h1>
          <p className="mt-1 text-sm text-white/85">Choose which AI provider powers Claim Validation, Policy Q&amp;A, Query Forms and document generation — and enter its key here.</p>
        </div>
      </section>

      {!s.encryptionReady && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <code>MFA_ENCRYPTION_KEY</code> is not set on the server, so keys can&apos;t be saved here. Existing Vercel settings still work.
        </div>
      )}

      <div className="rounded-md border p-3 text-sm" style={{ borderColor: BRAND, backgroundColor: CARD }}>
        Currently using <b>{META[s.active].title}</b> · model <b>{s.providers[s.active].model}</b>
        {!s.providers[s.active].configured && <span className="ml-2 font-semibold text-red-700">— no API key! AI features will show an error until one is added.</span>}
      </div>

      <div className="space-y-3">
        {ORDER.map((p) => {
          const i = s.providers[p]; const m = META[p]; const isActive = s.active === p; const isOpen = open === p;
          return (
            <div key={p} className="rounded-lg border bg-white p-4" style={{ borderColor: isActive ? BRAND : "#CBD5E1", boxShadow: isActive ? `0 0 0 1px ${BRAND}` : undefined }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{m.title}{isActive && <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: BRAND }}>In use</span>}</div>
                  <div className="mt-0.5 text-sm text-slate-600">{m.blurb}</div>
                  <div className={`mt-1 text-xs ${i.configured ? "text-green-700" : "text-red-700"}`}>
                    {i.configured ? `✓ Key saved ${i.source === "app" ? "in the app" : "as a server (Vercel) setting"} · model ${i.model}` : "No key yet"}
                    {i.testedRecently && " · tested OK"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setOpen(isOpen ? ("" as P) : p)} className="rounded border px-3 py-1.5 text-sm font-semibold" style={{ borderColor: BRAND, color: BRAND }}>{isOpen ? "Hide" : "Key & model"}</button>
                  <button type="button" onClick={() => test(p)} disabled={!!busy || !i.configured} className="rounded border bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: BRAND, color: BRAND }}>{busy === `test-${p}` ? "Testing…" : "Test"}</button>
                  {!isActive && <button type="button" onClick={() => use(p)} disabled={!!busy || !i.configured} className="rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BRAND }}>Use this one</button>}
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="password" className={inputCls} placeholder={i.source === "app" ? "API key saved — type to replace" : `API key (${m.keyHint})`} value={f[p].apiKey} onChange={(e) => setF({ ...f, [p]: { ...f[p], apiKey: e.target.value } })} autoComplete="new-password" />
                  <input className={inputCls} placeholder={`Model (now: ${i.model}) — leave empty to keep`} value={f[p].model} onChange={(e) => setF({ ...f, [p]: { ...f[p], model: e.target.value } })} autoComplete="off" />
                  <div className="flex gap-2 md:col-span-2">
                    <button type="button" onClick={() => save(p)} disabled={!!busy || !s.encryptionReady || !(f[p].apiKey || f[p].model)} className="rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BRAND }}>{busy === `save-${p}` ? "Saving…" : `Save ${m.title} settings`}</button>
                    {i.source === "app" && <button type="button" onClick={() => remove(p)} disabled={!!busy} className="rounded border px-3 py-1.5 text-sm text-red-700">Remove saved key</button>}
                  </div>
                  <p className="text-xs text-slate-500 md:col-span-2">Get a key: {m.link}. The key is stored encrypted and is never shown again. Example model: <code>{m.modelHint}</code>.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {msg && <div className={`rounded-md border p-3 text-sm ${msg.kind === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</div>}

      <div className="rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-1">
        <div><b>Safe switching:</b> a provider can only be switched on after a successful Test within the last hour, so a wrong key can&apos;t break the AI features.</div>
        <div><b>Changing a key or model</b> requires a new Test before switching to it.</div>
        <div><b>Fallback:</b> if nothing is saved here, the app keeps using the old Vercel variables (<code>LLM_PROVIDER</code>, <code>GROQ_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>).</div>
        <div><b>Cost note:</b> Groq is the cheapest; Claude and OpenAI are billed by the provider per use. Quality of long compliance text is typically best on Claude.</div>
      </div>
    </div>
  );
}
