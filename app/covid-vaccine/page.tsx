"use client";

import { useState, useEffect } from "react";

const TEAL = "#14457B";
const TEAL_LIGHT = "#E7ECF4";
const TEAL_DARK = "#14457B";

type Row = {
  id: string;
  manufacturer: string;
  productLabel: string;
  cvxCode: string;
  cvxTermDesc: string;
  cvxShortDesc: string;
  virusStrain: string | null;
  ndcCodes: string | null;
  packaging: string | null;
  ageCohort: string | null;
};

export default function CovidVaccinePage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(query: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/covid-vaccine?q=${encodeURIComponent(query)}`);
      const json = await r.json();
      setResults(json.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: TEAL }}>
          <h1 className="text-xl font-bold text-white">COVID-19 Vaccine Codes</h1>
          <p className="mt-1 text-sm text-white/85">
            CVX and NDC identifiers by manufacturer and formulation — current season crosswalk
          </p>
        </div>
      </section>

      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by manufacturer, product, or CVX code…"
          className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm"
        />
        <button type="submit" disabled={loading} className="rounded-md px-5 py-3 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
          {loading ? "Loading…" : "Search"}
        </button>
      </form>

      <div className="space-y-2">
        {results.map((row) => (
          <div key={row.id} className="rounded-lg border p-4" style={{ borderColor: TEAL }}>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-base font-bold" style={{ color: TEAL_DARK }}>{row.manufacturer}</span>
              <span className="text-sm text-slate-700">{row.productLabel}</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}>
                CVX {row.cvxCode}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{row.cvxTermDesc}</p>
            <p className="text-xs text-slate-500 italic">{row.cvxShortDesc}</p>
            {row.ageCohort && <p className="mt-1 text-xs text-slate-600">Age/Presentation: {row.ageCohort}</p>}
            {row.ndcCodes && <p className="text-xs text-slate-500">NDC: {row.ndcCodes}</p>}
          </div>
        ))}
        {!loading && results.length === 0 && (
          <p className="text-sm text-slate-500">No vaccine formulations match &ldquo;{q}&rdquo;.</p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Source: CDC.gov — COVID-19 Vaccine Codes Crosswalk (CVX/NDC data only). Public data, no license required.
      </p>
    </div>
  );
}
