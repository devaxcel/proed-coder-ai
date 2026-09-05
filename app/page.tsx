"use client";

import { useState } from "react";

type CodeCard = {
  code: string;
  codeSystem: "ICD10CM" | "HCPCS" | "CPT";
  description: string;
  isBillable: boolean;
  hccCategory?: string | null;
  hccWeight?: number | null;
  hedisMeasure?: string | null;
  codingNotes?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  richDetail?: {
    includes: string[];
    excludes1: string[];
    excludes2: string[];
    codeFirst: string[];
    useAdditionalCode: string[];
    codeAlso: string[];
  } | null;
};

type SearchResponse = {
  intent: "codes" | "query_form" | "policy";
  results: CodeCard[];
  latencyMs: number;
};

export default function Page() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json: SearchResponse = await r.json();
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-navy px-6 py-12 md:px-12 md:py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="inline-flex items-center rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white/80 mb-4">
            Requisition · Code lookup
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white leading-snug">
            Ask anything about medical codes, HEDIS, HCC, or policy forms.
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Sources: CMS.gov · NCQA · HHS · Medicaid · ICD10Data · AAPC · AMA · eClinicalWorks
          </p>

          <form onSubmit={onSearch} className="mt-8">
            <div className="flex flex-col sm:flex-row gap-3 mx-auto">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Type 2 diabetes with neuropathy"
                className="flex-1 rounded-md border-0 bg-white px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-yellow"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-accent-yellow px-6 py-3.5 text-sm font-semibold text-navy hover:bg-accent-yellowDark disabled:opacity-50 transition"
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {data && (
        <section className="space-y-4">
          <div className="text-xs text-slate-500">
            Intent: <span className="font-medium text-slate-700">{data.intent}</span> · {data.latencyMs}ms
          </div>
          {data.results.length === 0 && (
            <div className="text-sm text-slate-500">No results yet — Phase 2 will seed ICD-10 data.</div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {data.results.map((c) => (
              <article key={c.code} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{c.code}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">{c.codeSystem}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        c.isBillable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {c.isBillable ? "Billable" : "Header"}
                    </span>
                    {c.hccCategory && (
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {c.hccCategory.split("·")[0].trim()}
                        {c.hccWeight != null && (
                          <span className="ml-1 text-indigo-500">
                            · RAF {c.hccWeight.toFixed(3)}
                          </span>
                        )}
                      </span>
                    )}
                    {c.hedisMeasure && (
                      <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                        HEDIS {c.hedisMeasure}
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">{c.description}</p>
                {c.hccCategory && (
                  <div className="mt-2 rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                    <span className="font-semibold">HCC:</span> {c.hccCategory}
                  </div>
                )}
                {c.hedisMeasure && (
                  <div className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">
                    <span className="font-semibold">HEDIS:</span> Impacts {c.hedisMeasure}
                  </div>
                )}
                {c.richDetail && (
                  <details className="mt-2 border-t border-slate-100 pt-2">
                    <summary className="cursor-pointer text-xs font-medium text-brand-600">
                      📋 View full coding notes (Includes, Excludes, Use Additional Code)
                    </summary>
                    <div className="mt-2 space-y-1.5 text-xs">
                      <NoteBlock label="Includes" items={c.richDetail.includes} />
                      <NoteBlock label="Excludes1 — never code together" items={c.richDetail.excludes1} />
                      <NoteBlock label="Excludes2 — may code together" items={c.richDetail.excludes2} />
                      <NoteBlock label="Use Additional Code" items={c.richDetail.useAdditionalCode} />
                      <NoteBlock label="Code First" items={c.richDetail.codeFirst} />
                      <NoteBlock label="Code Also" items={c.richDetail.codeAlso} />
                    </div>
                  </details>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  {c.sourceName && (
                    <>
                      <dt>Source</dt>
                      <dd className="text-slate-900">{c.sourceName}</dd>
                    </>
                  )}
                </dl>
                {c.sourceUrl && (
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
                  >
                    Open source →
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NoteBlock({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-1">
      <div className="font-semibold text-slate-600">{label}:</div>
      <ul className="list-disc list-inside text-slate-600">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
