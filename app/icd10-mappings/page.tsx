"use client";

import { useState } from "react";

const TEAL = "#0F6E77";
const TEAL_LIGHT = "#E6F4F5";
const TEAL_DARK = "#0A555C";

type Row = {
  id: string;
  icd10Code: string;
  description: string;
  esrdV21: number | null;
  esrdV24: number | null;
  hccV22: number | null;
  hccV24: number | null;
  hccV28: number | null;
  rxhccV08: number | null;
  hccV28Payment2026: boolean | null;
};

function Badge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium mr-1 mb-1" style={{ backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}>
      {label} {value}
    </span>
  );
}

export default function Icd10MappingsPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
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
      const r = await fetch(`/api/icd10-mappings/search?q=${encodeURIComponent(q)}&page=${newPage}`);
      const json = await r.json();
      setResults(json.results);
      setTotal(json.total);
      setPage(newPage);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">2026 ICD-10 HCC Mappings</h1>
            <p className="mt-1 text-sm text-white/85">
              Full CMS crosswalk — ESRD, CMS-HCC, and RxHCC models · V21/V22/V24/V28 · 2026 Payment Year
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
          placeholder="Search by ICD-10 code or description…"
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
        {results.map((row) => (
          <div key={row.id} className="rounded-lg border p-4" style={{ borderColor: TEAL }}>
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-bold" style={{ color: TEAL_DARK }}>{row.icd10Code}</span>
              <span className="text-sm text-slate-700">{row.description}</span>
            </div>
            <div className="mt-2 flex flex-wrap">
              <Badge label="ESRD V21" value={row.esrdV21} />
              <Badge label="ESRD V24" value={row.esrdV24} />
              <Badge label="HCC V22" value={row.hccV22} />
              <Badge label="HCC V24" value={row.hccV24} />
              <Badge label="HCC V28" value={row.hccV28} />
              <Badge label="RxHCC V08" value={row.rxhccV08} />
            </div>
            {row.hccV28Payment2026 !== null && (
              <div className="mt-1 text-xs text-slate-500">
                V28 applies for 2026 payment year: <b>{row.hccV28Payment2026 ? "Yes" : "No"}</b>
              </div>
            )}
          </div>
        ))}
        {q && !loading && results.length === 0 && (
          <p className="text-sm text-slate-500">No codes match &ldquo;{q}&rdquo;.</p>
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
        Source: CMS.gov — CY25/CY26 ICD-10 Payment Codes crosswalk. Public data, no license required.
      </p>
    </div>
  );
}
