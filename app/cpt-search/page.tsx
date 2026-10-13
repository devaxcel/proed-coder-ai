"use client";

import { useState } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

type CptResult = {
  code: string;
  category: string;
  longDesc: string;
  shortDesc: string | null;
  consumerDesc: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  I: "Category I",
  II: "Category II (performance measure)",
  III: "Category III (emerging tech)",
  PLA: "PLA (proprietary lab)",
  MAAA: "Administrative MAAA",
};

export default function CptSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CptResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);

  async function runSearch(q: string, y: number | null = year) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cpt-search?q=${encodeURIComponent(q)}${y ? `&year=${y}` : ""}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setYears(json.years ?? []);
      if (y == null && json.year) setYear(json.year);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">CPT Code Search</h1>
          <p className="mt-1 text-sm text-white/85">Search the AMA CPT® code set by code or description{year ? ` — ${year} code set` : ""}.</p>
        </div>
      </section>

      <div className="flex gap-3">
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search by CPT code or description…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          style={{ borderColor: BRAND }}
        />
        {years.length > 1 && (
          <select
            value={year ?? ""}
            onChange={(e) => { const y = Number(e.target.value); setYear(y); if (query.trim()) runSearch(query, y); }}
            className="rounded-md border bg-white px-3 py-2 text-sm"
            style={{ borderColor: BRAND }}
            aria-label="CPT code-set year"
          >
            {years.map((y) => <option key={y} value={y}>{y} code set</option>)}
          </select>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Searching…</p>}

      {!loading && searched && results.length === 0 && (
        <div className="rounded-md border p-4 text-sm text-slate-500" style={{ borderColor: BRAND, backgroundColor: CARD }}>
          No CPT codes matched &ldquo;{query}&rdquo; in the {year ?? ""} code set. If the CPT tables have not been loaded yet, an administrator needs to run the CPT import.
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND }} className="text-white text-left">
                <th className="px-3 py-2 w-28">Code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 w-44">Type</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.code} className="border-t" style={{ borderColor: CARD }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: BRAND }}>{r.code}</td>
                  <td className="px-3 py-2">
                    <div className="text-slate-800">{r.longDesc}</div>
                    {r.consumerDesc && <div className="text-xs text-slate-500 mt-1"><span className="font-semibold">Plain language:</span> {r.consumerDesc}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        CPT® codes, descriptions and other data are copyright American Medical Association. All rights reserved. CPT is a registered trademark of the American Medical Association. Used under license to ProEd Consulting &amp; Staffing.
      </p>
    </div>
  );
}
