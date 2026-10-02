"use client";

import { useState } from "react";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

type CptResult = {
  code: string;
  description: string;
  isBillable: boolean;
  hccCategory: string | null;
  hedisMeasure: string | null;
  codingNotes: string | null;
};

export default function CptSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CptResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cpt-search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results ?? []);
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
          <p className="mt-1 text-sm text-white/85">Search CPT codes and descriptions.</p>
        </div>
      </section>

      <input
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        placeholder="Search by CPT code or description…"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        style={{ borderColor: BRAND }}
      />

      {loading && <p className="text-sm text-slate-500">Searching…</p>}

      {!loading && searched && results.length === 0 && (
        <div className="rounded-md border p-4 text-sm text-slate-500" style={{ borderColor: BRAND, backgroundColor: CARD }}>
          No CPT codes matched &ldquo;{query}&rdquo;. If this keeps happening for codes you know exist, the CPT code set may not be loaded into the database yet — that's a data-loading task, not a search-tool issue.
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND }} className="text-white text-left">
                <th className="px-3 py-2 w-28">Code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 w-28">Billable</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.code} className="border-t" style={{ borderColor: CARD }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: BRAND }}>{r.code}</td>
                  <td className="px-3 py-2">
                    <div className="text-slate-800">{r.description}</div>
                    {r.codingNotes && <div className="text-xs text-slate-500 mt-0.5">{r.codingNotes}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.isBillable ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
