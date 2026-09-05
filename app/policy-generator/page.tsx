"use client";

import { useState } from "react";
import { AIOutputDisclaimer } from "@/lib/disclaimers";

const BRAND = "#14457B";
const CARD = "#E7ECF4";

type PolicySection = { number: number; heading: string; body: string };

type PolicyOutput = {
  policy_title: string;
  policy_number_suggestion: string;
  regulatory_basis_summary: string;
  applies_to: string;
  confidentiality: string;
  disclaimer: string;
  sections: PolicySection[];
};

type Reference = { n: number; source: string; docTitle: string; sourceUrl: string };
type PayerType = "medicare" | "commercial" | null;

type Version = {
  label: string; // "Initial request" or the revision instruction text
  policy: PolicyOutput;
  references: Reference[];
};

const EXAMPLE_TOPICS = [
  "Physician query practice and clinical documentation improvement",
  "HCC risk adjustment documentation and MEAT criteria",
  "HEDIS quality measure documentation and gap closure",
  "Medical record documentation and retention standards",
];

export default function PolicyGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [payerType, setPayerType] = useState<PayerType>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [revisionInput, setRevisionInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const active = activeIdx >= 0 ? versions[activeIdx] : null;

  async function callGenerate(body: Record<string, unknown>) {
    const r = await fetch("/api/policy-doc/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await r.json();
    if (!r.ok || json.error) throw new Error(json.error ?? `HTTP ${r.status}`);
    return { policy: json.policy as PolicyOutput, references: (json.references ?? []) as Reference[] };
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const { policy, references } = await callGenerate({ topic, payerType });
      const v: Version = { label: "Initial request", policy, references };
      setVersions([v]);
      setActiveIdx(0);
      setRevisionInput("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function onRevise(e: React.FormEvent) {
    e.preventDefault();
    if (!revisionInput.trim() || !active) return;
    setLoading(true);
    setErr(null);
    try {
      const { policy, references } = await callGenerate({
        topic,
        payerType,
        priorDocument: active.policy,
        revisionInstruction: revisionInput,
      });
      const v: Version = { label: revisionInput.trim(), policy, references };
      const next = [...versions, v];
      setVersions(next);
      setActiveIdx(next.length - 1);
      setRevisionInput("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Revision failed");
    } finally {
      setLoading(false);
    }
  }

  async function onExport() {
    if (!active) return;
    setExporting(true);
    try {
      const r = await fetch("/api/policy-doc/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: active.policy, references: active.references }),
      });
      if (!r.ok) throw new Error(`Export failed: ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-Policy-${active.policy.policy_number_suggestion || "Document"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Policy Document Generator</h1>
          <p className="mt-1 text-sm text-white/85">
            Generates a full 20-section organizational policy document — grounded in your loaded compliance sources, including CMS, AHIMA, OIG, HHS, DHCS, and Noridian.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        This is the largest generation in the app — a complete 20-section document can take <b>20–40 seconds</b>. That&apos;s expected, not a bug.
      </div>

      <AIOutputDisclaimer />

      {versions.length === 0 && (
        <form onSubmit={onGenerate} className="space-y-3">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="Describe the policy topic you need — e.g. 'Physician query practice and CDI standards'"
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-500">Try:</span>
            {EXAMPLE_TOPICS.map((t, i) => (
              <button key={i} type="button" onClick={() => setTopic(t)} style={{ color: BRAND }} className="hover:underline">
                Example {i + 1}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Is this policy for Medicare/Medicare Advantage or Commercial insurance? <span className="text-slate-400">(optional)</span>
            </label>
            <div className="flex gap-2">
              {([
                { v: null, label: "Not specific to a payer" },
                { v: "medicare" as const, label: "Medicare / MA" },
                { v: "commercial" as const, label: "Commercial" },
              ]).map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setPayerType(opt.v)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium border"
                  style={{
                    borderColor: BRAND,
                    backgroundColor: payerType === opt.v ? BRAND : "white",
                    color: payerType === opt.v ? "white" : BRAND,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {loading ? "Generating full document… this takes a while" : "Generate Policy Document"}
          </button>
        </form>
      )}

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {active && (
        <section className="space-y-4">
          {/* Version history — click to view/branch from any prior version */}
          {versions.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {versions.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className="rounded-full px-3 py-1 text-xs font-medium border"
                  style={{
                    borderColor: BRAND,
                    backgroundColor: activeIdx === i ? BRAND : "white",
                    color: activeIdx === i ? "white" : BRAND,
                  }}
                  title={v.label}
                >
                  v{i + 1}{i === 0 ? " (Initial)" : ""}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-lg border p-6 bg-white" style={{ borderColor: BRAND }}>
            <h2 className="text-lg font-bold" style={{ color: BRAND }}>{active.policy.policy_title}</h2>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Policy #</div>
                <div>{active.policy.policy_number_suggestion}</div>
              </div>
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Applies To</div>
                <div>{active.policy.applies_to}</div>
              </div>
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Confidentiality</div>
                <div>{active.policy.confidentiality}</div>
              </div>
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Sections</div>
                <div>{active.policy.sections.length} of 20</div>
              </div>
            </div>
            {payerType && (
              <div className="mt-2 text-xs text-slate-500">
                Payer context: <b>{payerType === "medicare" ? "Medicare / Medicare Advantage" : "Commercial insurance"}</b>
              </div>
            )}
            <p className="mt-3 text-xs italic text-slate-500">{active.policy.disclaimer}</p>
          </div>

          {/* Conversational refinement */}
          <form onSubmit={onRevise} className="rounded-lg border p-4 space-y-2" style={{ borderColor: BRAND }}>
            <label className="block text-xs font-medium" style={{ color: BRAND }}>
              Refine this document — ask for a change, and this exact version will be revised
            </label>
            <div className="flex gap-2">
              <input
                value={revisionInput}
                onChange={(e) => setRevisionInput(e.target.value)}
                placeholder="e.g. 'Make it shorter' or 'Add a section on telehealth documentation'"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={loading || !revisionInput.trim()}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: BRAND }}
              >
                {loading ? "Revising…" : "Apply Revision"}
              </button>
            </div>
          </form>

          <button
            onClick={onExport}
            disabled={exporting}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {exporting ? "Generating DOCX…" : `⬇ Export ${versions.length > 1 ? `v${activeIdx + 1}` : "Full Policy Document"} (DOCX)`}
          </button>

          <details className="rounded-lg border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-medium" style={{ color: BRAND }}>
              Preview all {active.policy.sections.length} sections
            </summary>
            <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
              {active.policy.sections.map((s) => (
                <div key={s.number}>
                  <div className="text-sm font-semibold" style={{ color: BRAND }}>{s.number}. {s.heading}</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{s.body}</div>
                </div>
              ))}
            </div>
          </details>

          {active.references.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sources used</h3>
              <ul className="space-y-1 text-xs text-slate-600">
                {active.references.map((r) => (
                  <li key={r.n}>[{r.n}] {r.source} — {r.docTitle}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => { setVersions([]); setActiveIdx(-1); setTopic(""); setPayerType(null); setRevisionInput(""); }}
            className="text-xs text-slate-500 hover:underline"
          >
            Start a new document
          </button>
        </section>
      )}
    </div>
  );
}
