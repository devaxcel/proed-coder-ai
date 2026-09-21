"use client";

import { useState, useEffect, useCallback } from "react";

const TEAL = "#14457B";
const TEAL_LIGHT = "#E7ECF4";
const TEAL_DARK = "#14457B";
const GREEN = "#059669";
const RED = "#DC2626";
const AMBER = "#B45309";

type Update = {
  id: string;
  code: string;
  longDesc: string;
  shortDesc: string | null;
  actionCode: string;
  addDate: string | null;
  effectiveDate: string | null;
  termDate: string | null;
  quarter: string;
};

const ACTION_COLOR: Record<string, string> = { A: GREEN, D: RED, N: "#64748B", R: GREEN };

export default function HcpcsUpdatesPage() {
  const [results, setResults] = useState<Update[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [quarters, setQuarters] = useState<string[]>([]);
  const [actionLabels, setActionLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  const load = useCallback(async (p: number, action: string, query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (action) params.set("action", action);
      if (query) params.set("q", query);
      const r = await fetch(`/api/hcpcs-updates?${params}`);
      const json = await r.json();
      setResults(json.results);
      setTotal(json.total);
      setQuarters(json.quarters);
      setActionLabels(json.actionLabels);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, actionFilter, q);
  }, [page, actionFilter, load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, actionFilter, q);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: TEAL }}>
          <h1 className="text-xl font-bold text-white">Upcoming & Recent HCPCS Changes</h1>
          <p className="mt-1 text-sm text-white/85">
            Codes added, discontinued, or revised in the current CMS quarterly update{quarters.length ? ` (${quarters.join(", ")})` : ""}
          </p>
        </div>
      </section>

      <form onSubmit={onSearch} className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by code or description…"
          className="flex-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All changes</option>
          <option value="D">Discontinued only</option>
          <option value="A">Added only</option>
          <option value="R">Reactivated only</option>
        </select>
        <button type="submit" className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: TEAL }}>
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="text-xs text-slate-500">{total.toLocaleString()} entries · page {page} of {totalPages}</div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: TEAL }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: TEAL }}>
                  <th className="px-3 py-2 text-left text-white font-medium">Code</th>
                  <th className="px-3 py-2 text-left text-white font-medium">Description</th>
                  <th className="px-3 py-2 text-left text-white font-medium">Change</th>
                  <th className="px-3 py-2 text-left text-white font-medium">Effective Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((u, i) => (
                  <tr key={u.id} style={{ backgroundColor: i % 2 === 0 ? "white" : TEAL_LIGHT }}>
                    <td className="px-3 py-2 font-bold" style={{ color: TEAL_DARK }}>{u.code}</td>
                    <td className="px-3 py-2 text-slate-700">{u.longDesc}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: ACTION_COLOR[u.actionCode] ?? AMBER }}>
                        {actionLabels[u.actionCode] ?? u.actionCode}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{u.termDate || u.effectiveDate || u.addDate || "—"}</td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">No entries match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-40" style={{ borderColor: TEAL }}>
                ← Prev
              </button>
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-40" style={{ borderColor: TEAL }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-slate-500">
        Source: CMS.gov — HCPCS Quarterly Update, public Alpha-Numeric HCPCS File. Public data, no license required.
      </p>
    </div>
  );
}
