"use client";

import { useState } from "react";

const BRAND = "#14457B";
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  info: { bg: "#E7ECF4", text: "#14457B", label: "Info" },
  review_needed: { bg: "#FEF3C7", text: "#B45309", label: "Review Needed" },
  likely_issue: { bg: "#FEE2E2", text: "#991B1B", label: "Likely Issue" },
};

type Finding = { area: string; concern: string; citation: string; severity: string };
type Result = {
  summary: string;
  cpt_validation_note: string;
  findings: Finding[];
  not_reviewable: string;
};
type Citation = { n: number; source: string; docTitle: string; sourceUrl: string };

export default function ClaimValidationPage() {
  const [claimDescription, setClaimDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const example =
    "Claim for outpatient E/M visit, established patient, hypertension follow-up. Diagnosis coded as unspecified essential hypertension. Modifier -25 appended for a separately billed injection administration on the same date. No documented total time or MDM detail in the note.";

  async function onValidate(e: React.FormEvent) {
    e.preventDefault();
    if (!claimDescription.trim()) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await fetch("/api/claim-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimDescription }),
      });
      const json = await r.json();
      if (!r.ok || json.error) {
        setErr(json.error ?? `HTTP ${r.status}`);
      } else {
        setResult(json.result);
        setCitations(json.citations ?? []);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Claim Validation</h1>
          <p className="mt-1 text-sm text-white/85">
            Cross-references a claim description against ICD-10, HCPCS, modifier, and general Medicare coverage policy.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-300 p-4 text-sm" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
        <b>⚠️ Partial validation — CPT/modifier-pair checks unavailable pending AMA CPT license.</b> This tool validates ICD-10 coding conventions, HCPCS/modifier policy, and general Medicare medical necessity documentation. It never validates CPT code numbers or CPT-modifier combinations until ProEd's AMA license is active.
      </div>

      <form onSubmit={onValidate} className="space-y-3">
        <textarea
          value={claimDescription}
          onChange={(e) => setClaimDescription(e.target.value)}
          rows={5}
          placeholder="Describe the claim/encounter — diagnosis codes, modifiers, documentation present…"
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm"
        />
        <button type="button" onClick={() => setClaimDescription(example)} className="text-xs" style={{ color: BRAND }}>
          Try an example
        </button>
        <div>
          <button
            type="submit"
            disabled={loading || !claimDescription.trim()}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {loading ? "Validating…" : "Validate Claim"}
          </button>
        </div>
      </form>

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {result && (
        <section className="space-y-4">
          <div className="rounded-lg border p-5 bg-white" style={{ borderColor: BRAND }}>
            <p className="text-sm text-slate-700">{result.summary}</p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {result.cpt_validation_note}
          </div>

          {result.findings.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Findings</h2>
              {result.findings.map((f, i) => {
                const style = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.info;
                return (
                  <div key={i} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: style.bg, color: style.text }}>
                        {style.label}
                      </span>
                      <span className="text-xs font-medium text-slate-700">{f.area}</span>
                    </div>
                    <p className="text-sm text-slate-700">{f.concern}</p>
                    <p className="text-xs text-slate-400 mt-1">{f.citation}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <b>Not reviewable by this tool:</b> {result.not_reviewable}
          </div>

          {citations.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sources referenced</h2>
              <ul className="space-y-1 text-xs text-slate-600">
                {citations.map((c) => (
                  <li key={c.n}>[{c.n}] {c.source} — {c.docTitle}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
