"use client";

import { useState } from "react";

const TEAL = "#0F6E77";
const TEAL_LIGHT = "#E6F4F5";
const TEAL_DARK = "#0A555C";
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

type CheckResult = {
  supported_codes: { code_hint: string; description: string; evidence: string }[];
  possible_codes_needing_more_documentation: {
    code_hint: string;
    description: string;
    why_flagged: string;
    documentation_needed: string;
  }[];
  overall_note: string;
};

export default function CodeCheckPage() {
  const [codeSystem, setCodeSystem] = useState<"ICD-10" | "HCPCS">("ICD-10");
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const examples: Record<"ICD-10" | "HCPCS", string> = {
    "ICD-10": "Patient presents with right knee pain after fall 2 days ago. X-ray shows fracture. Patient placed in splint, follow up in 1 week. Also noted: patient has diabetes, on metformin.",
    HCPCS: "Patient needs a wheelchair for home use due to difficulty ambulating from CHF and COPD. Ordered oxygen concentrator for home use as well. Will follow up on delivery.",
  };

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await fetch("/api/code-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText, codeSystem }),
      });
      const json = await r.json();
      if (!r.ok) {
        setErr(json.error ?? `HTTP ${r.status}`);
      } else {
        setResult(json);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">Code Documentation Check</h1>
            <p className="mt-1 text-sm text-white/85">
              Paste a note — flags likely codes and what documentation is missing to support them
            </p>
          </div>
          <div className="rounded-md bg-white/95 px-4 py-2 text-center shadow-sm">
            <div className="font-serif italic text-lg leading-none" style={{ color: TEAL_DARK }}>proed</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">Consulting · Staffing · Scanning</div>
          </div>
        </div>
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <b>This tool suggests candidates for your review — it never confirms a code is billable.</b> Final coding judgment is always yours.
      </div>

      <form onSubmit={onAnalyze} className="space-y-3">
        <div className="flex gap-2">
          {(["ICD-10", "HCPCS"] as const).map((sys) => (
            <button
              key={sys}
              type="button"
              onClick={() => setCodeSystem(sys)}
              className="rounded-md px-4 py-2 text-sm font-medium border"
              style={{
                borderColor: TEAL,
                backgroundColor: codeSystem === sys ? TEAL : "white",
                color: codeSystem === sys ? "white" : TEAL_DARK,
              }}
            >
              {sys}
            </button>
          ))}
        </div>

        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={6}
          placeholder="Paste the chart note or describe the encounter…"
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm"
        />
        <button
          type="button"
          onClick={() => setNoteText(examples[codeSystem])}
          className="text-xs"
          style={{ color: TEAL }}
        >
          Try an example
        </button>

        <div>
          <button
            type="submit"
            disabled={loading || !noteText.trim()}
            className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {loading ? "Analyzing…" : `Check ${codeSystem} Documentation`}
          </button>
        </div>
      </form>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {result && (
        <div className="space-y-5">
          {result.overall_note && (
            <div className="rounded-md border p-3 text-sm" style={{ borderColor: TEAL, backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}>
              {result.overall_note}
            </div>
          )}

          {result.supported_codes.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold" style={{ color: TEAL_DARK }}>
                ✅ Supported by documentation
              </h2>
              <div className="space-y-2">
                {result.supported_codes.map((c, i) => (
                  <div key={i} className="rounded-md border p-3" style={{ borderColor: TEAL }}>
                    <div className="font-medium text-sm text-slate-900">{c.code_hint} — {c.description}</div>
                    <div className="text-xs italic text-slate-600 mt-1">&ldquo;{c.evidence}&rdquo;</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.possible_codes_needing_more_documentation.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold" style={{ color: AMBER }}>
                ⚠️ Possible — needs more documentation
              </h2>
              <div className="space-y-2">
                {result.possible_codes_needing_more_documentation.map((c, i) => (
                  <div key={i} className="rounded-md border p-3" style={{ borderColor: AMBER, backgroundColor: AMBER_LIGHT }}>
                    <div className="font-medium text-sm text-slate-900">{c.code_hint} — {c.description}</div>
                    <div className="text-xs text-slate-700 mt-1">Mentioned: {c.why_flagged}</div>
                    <div className="text-xs font-medium mt-1" style={{ color: AMBER }}>
                      Documentation needed: {c.documentation_needed}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.supported_codes.length === 0 && result.possible_codes_needing_more_documentation.length === 0 && (
            <p className="text-sm text-slate-500">No clear code candidates identified — try a more detailed note.</p>
          )}
        </div>
      )}
    </div>
  );
}
