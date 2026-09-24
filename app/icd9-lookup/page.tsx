"use client";

import { useState } from "react";
import { THEME } from "@/lib/theme";

const TEAL = THEME.primary;
const TEAL_LIGHT = THEME.primaryLight;
const TEAL_DARK = THEME.primary;
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

type Row = { id: string; code: string; longDesc: string; shortDesc: string; codeType: string };

export default function Icd9LookupPage() {
  const [q, setQ] = useState("");
  const [codeType, setCodeType] = useState<"" | "DX" | "SG">("");
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
      const params = new URLSearchParams({ q, page: String(newPage) });
      if (codeType) params.set("type", codeType);
      const r = await fetch(`/api/icd9-lookup?${params}`);
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
        <div className="px-6 py-5" style={{ backgroundColor: TEAL }}>
          <h1 className="text-xl font-bold text-white">ICD-9-CM Legacy Lookup</h1>
          <p className="mt-1 text-sm text-white/85">
            Version 32 — the final ICD-9-CM code set before retirement on October 1, 2015. For historical dates of service only.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-300 p-3 text-xs" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
        ICD-9-CM was retired for current billing on October 1, 2015. Use this tool only when reviewing historical claims, prior records, or crosswalk research — never for a current date of service.
      </div>

      <form onSubmit={(e) => { e.preventDefault(); search(1); }} className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by code or description…"
          className="flex-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-4 py-3 text-sm"
        />
        <select
          value={codeType}
          onChange={(e) => setCodeType(e.target.value as "" | "DX" | "SG")}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="DX">Diagnosis only</option>
          <option value="SG">Procedure only</option>
        </select>
        <button type="submit" disabled={loading} className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {total > 0 && (
        <div className="text-sm text-slate-600">{total.toLocaleString()} match{total !== 1 ? "es" : ""} · page {page} of {totalPages}</div>
      )}

      <div className="space-y-2">
        {results.map((row) => (
          <div key={row.id} className="rounded-lg border p-4" style={{ borderColor: TEAL }}>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-lg font-bold" style={{ color: TEAL_DARK }}>{row.code}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}
              >
                {row.codeType === "DX" ? "Diagnosis" : "Procedure"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{row.longDesc}</p>
            <p className="text-xs text-slate-500 italic">Short: {row.shortDesc}</p>
          </div>
        ))}
        {q && !loading && results.length === 0 && (
          <p className="text-sm text-slate-500">No ICD-9-CM codes match &ldquo;{q}&rdquo;.</p>
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
        Source: CMS.gov — ICD-9-CM Version 32 (final release). Public data, no license required.
      </p>
    </div>
  );
}
