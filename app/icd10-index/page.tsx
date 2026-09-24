"use client";

import { useState } from "react";
import { THEME } from "@/lib/theme";

const TEAL = THEME.primary;
const TEAL_LIGHT = THEME.primaryLight;
const TEAL_DARK = THEME.primary;

type Entry = {
  id: string;
  term: string;
  fullPath: string;
  code: string | null;
  seeRef: string | null;
  seeAlsoRef: string | null;
  letter: string;
  level: number;
};

export default function Icd10IndexPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 25;

  async function search(newPage = 1) {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/icd10-index?q=${encodeURIComponent(q)}&page=${newPage}`);
      const json = await r.json();
      setResults(json.results);
      setTotal(json.total);
      setPage(newPage);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Render the breadcrumb path with the searched-for term bolded, and the
  // final segment (the actual matched term) visually distinct from its
  // parent context.
  function renderPath(entry: Entry) {
    const parts = entry.fullPath.split(" > ");
    return (
      <span className="text-xs text-slate-500">
        {parts.slice(0, -1).map((p, i) => (
          <span key={i}>{p}<span className="mx-1 text-slate-300">›</span></span>
        ))}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">ICD-10-CM Alphabetic Index</h1>
            <p className="mt-1 text-sm text-white/85">
              Browse by medical term, the way the official index book works — search a condition to see its sub-entries and resulting code
            </p>
          </div>
          <div className="rounded-md bg-white/95 px-4 py-2 text-center shadow-sm">
            <div className="font-serif italic text-lg leading-none" style={{ color: TEAL_DARK }}>proed</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">Consulting · Staffing · Scanning</div>
          </div>
        </div>
      </section>

      <form onSubmit={(e) => { e.preventDefault(); search(1); }} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a term, e.g. 'diabetes', 'chronic kidney disease', or a code…"
          className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm"
        />
        <button type="submit" disabled={loading} className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {total > 0 && (
        <div className="text-sm text-slate-600">
          {total.toLocaleString()} match{total !== 1 ? "es" : ""} · page {page} of {totalPages}
        </div>
      )}

      <div className="space-y-2">
        {results.map((entry) => (
          <div key={entry.id} className="rounded-lg border p-4" style={{ borderColor: TEAL }}>
            {entry.fullPath.includes(" > ") && <div className="mb-1">{renderPath(entry)}</div>}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-base font-semibold text-slate-900">{entry.term}</span>
              {entry.code && (
                <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}>
                  {entry.code}
                </span>
              )}
            </div>
            {entry.seeRef && (
              <div className="mt-1 text-xs text-slate-600">
                See <span className="font-medium" style={{ color: TEAL_DARK }}>{entry.seeRef}</span>
              </div>
            )}
            {entry.seeAlsoRef && (
              <div className="mt-1 text-xs text-slate-600">
                See also <span className="font-medium" style={{ color: TEAL_DARK }}>{entry.seeAlsoRef}</span>
              </div>
            )}
            {!entry.code && !entry.seeRef && !entry.seeAlsoRef && (
              <div className="mt-1 text-xs italic text-slate-400">
                No code at this level — search a more specific sub-term to find the code (this is a heading for multiple sub-entries).
              </div>
            )}
          </div>
        ))}
        {q && !loading && results.length === 0 && (
          <p className="text-sm text-slate-500">No index entries match &ldquo;{q}&rdquo;.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => search(page - 1)} className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-40" style={{ borderColor: TEAL }}>
            ← Prev
          </button>
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => search(page + 1)} className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-40" style={{ borderColor: TEAL }}>
            Next →
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Source: CDC/NCHS — 2026 ICD-10-CM Alphabetic Index to Diseases and Injuries. Public data, no license required.
      </p>
    </div>
  );
}
