"use client";

import { useState } from "react";

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

const EXAMPLE_TOPICS = [
  "Physician query practice and clinical documentation improvement",
  "HCC risk adjustment documentation and MEAT criteria",
  "HEDIS quality measure documentation and gap closure",
  "Medical record documentation and retention standards",
];

export default function PolicyGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [policy, setPolicy] = useState<PolicyOutput | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setErr(null);
    setPolicy(null);
    try {
      const r = await fetch("/api/policy-doc/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const json = await r.json();
      if (!r.ok || json.error) {
        setErr(json.error ?? `HTTP ${r.status}`);
      } else {
        setPolicy(json.policy);
        setReferences(json.references ?? []);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function onExport() {
    if (!policy) return;
    setExporting(true);
    try {
      const r = await fetch("/api/policy-doc/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy, references }),
      });
      if (!r.ok) throw new Error(`Export failed: ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProEdCS-Policy-${policy.policy_number_suggestion || "Document"}.docx`;
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
            Generates a full 20-section organizational policy document — the same format ProEd delivers to consulting clients — grounded in your 11 loaded compliance sources.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        This is the largest generation in the app — a complete 20-section document can take <b>20–40 seconds</b>. That's expected, not a bug.
      </div>

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
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: BRAND }}
        >
          {loading ? "Generating full document… this takes a while" : "Generate Policy Document"}
        </button>
      </form>

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {policy && (
        <section className="space-y-4">
          <div className="rounded-lg border p-6 bg-white" style={{ borderColor: BRAND }}>
            <h2 className="text-lg font-bold" style={{ color: BRAND }}>{policy.policy_title}</h2>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Policy #</div>
                <div>{policy.policy_number_suggestion}</div>
              </div>
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Applies To</div>
                <div>{policy.applies_to}</div>
              </div>
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Confidentiality</div>
                <div>{policy.confidentiality}</div>
              </div>
              <div className="rounded p-2" style={{ backgroundColor: CARD }}>
                <div className="font-semibold text-slate-500">Sections</div>
                <div>{policy.sections.length} of 20</div>
              </div>
            </div>
            <p className="mt-3 text-xs italic text-slate-500">{policy.disclaimer}</p>
          </div>

          <button
            onClick={onExport}
            disabled={exporting}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {exporting ? "Generating DOCX…" : "⬇ Export Full Policy Document (DOCX)"}
          </button>

          <details className="rounded-lg border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-medium" style={{ color: BRAND }}>
              Preview all {policy.sections.length} sections
            </summary>
            <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
              {policy.sections.map((s) => (
                <div key={s.number}>
                  <div className="text-sm font-semibold" style={{ color: BRAND }}>{s.number}. {s.heading}</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{s.body}</div>
                </div>
              ))}
            </div>
          </details>

          {references.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sources used</h3>
              <ul className="space-y-1 text-xs text-slate-600">
                {references.map((r) => (
                  <li key={r.n}>[{r.n}] {r.source} — {r.docTitle}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
