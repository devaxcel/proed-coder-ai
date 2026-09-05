"use client";

import { useState } from "react";

const TEAL = "#14457B";
const TEAL_LIGHT = "#E7ECF4";
const TEAL_DARK = "#14457B";

type Year = "2024" | "2025" | "2026";

// Different years have different underlying columns (2024 uniquely has
// RxHCC V05, retired afterward; payment-year boolean field names also
// differ per year — hccV28Payment2024 vs ...2025 vs ...2026). Rather than
// one rigid type, treat rows loosely and look up the right payment flag
// by year at render time.
type RichDetail = {
  includes: string[];
  excludes1: string[];
  excludes2: string[];
  codeFirst: string[];
  useAdditionalCode: string[];
  codeAlso: string[];
  parentNotes: {
    code: string;
    description: string;
    includes: string[];
    excludes1: string[];
    excludes2: string[];
    useAdditionalCode: string[];
  } | null;
} | null;

type Row = {
  id: string;
  icd10Code: string;
  description: string;
  esrdV21: number | null;
  esrdV24: number | null;
  hccV22: number | null;
  hccV24: number | null;
  hccV28: number | null;
  rxhccV05?: number | null;
  rxhccV08: number | null;
  richDetail?: RichDetail;
  [key: string]: unknown; // payment-year boolean flags, name varies by year
};

const YEAR_META: Record<Year, { title: string; sourceLine: string }> = {
  2024: {
    title: "2024 ICD-10 HCC Mappings",
    sourceLine: "Source: CMS.gov — FY23/FY24 ICD-10 Payment Codes crosswalk (Payment Year 2024). Includes retired RxHCC V05.",
  },
  2025: {
    title: "2025 ICD-10 HCC Mappings",
    sourceLine: "Source: CMS.gov — FY24/FY25 ICD-10 Payment Codes crosswalk (Payment Year 2025).",
  },
  2026: {
    title: "2026 ICD-10 HCC Mappings",
    sourceLine: "Source: CMS.gov — CY25/CY26 ICD-10 Payment Codes crosswalk (Payment Year 2026).",
  },
};

function Badge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium mr-1 mb-1" style={{ backgroundColor: TEAL_LIGHT, color: TEAL_DARK }}>
      {label} {value}
    </span>
  );
}

const NOTE_TONE_COLOR: Record<string, string> = {
  neutral: "#334155",
  warn: "#991B1B",
  action: "#0A555C",
};

function NoteBlock({ label, items, tone }: { label: string; items: string[]; tone: "neutral" | "warn" | "action" }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-1.5">
      <div className="font-semibold" style={{ color: NOTE_TONE_COLOR[tone] }}>{label}:</div>
      <ul className="list-disc list-inside text-slate-600">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Icd10MappingsPage() {
  const [year, setYear] = useState<Year>("2026");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 25;

  async function search(newPage = 1, useYear: Year = year) {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    // CMS stores codes without the decimal point (E1122, not E11.22).
    // Strip any dots the user types so "E11.22" still matches — this is
    // safe for description searches too, since real descriptions never
    // contain a literal period in a way that would change the match.
    const normalizedQ = q.replace(/\./g, "");
    setLoading(true);
    try {
      const r = await fetch(`/api/icd10-mappings/search?q=${encodeURIComponent(normalizedQ)}&page=${newPage}&year=${useYear}`);
      const json = await r.json();
      setResults(json.results);
      setTotal(json.total);
      setPage(newPage);
    } finally {
      setLoading(false);
    }
  }

  function onYearChange(newYear: Year) {
    setYear(newYear);
    if (q.trim()) search(1, newYear);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paymentFlagKey = `hccV28Payment${year}`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">{YEAR_META[year].title}</h1>
            <p className="mt-1 text-sm text-white/85">
              Full CMS crosswalk — ESRD, CMS-HCC, and RxHCC models · Payment Year {year}
            </p>
          </div>
          <div className="rounded-md bg-white/95 px-4 py-2 text-center shadow-sm">
            <div className="font-serif italic text-lg leading-none" style={{ color: TEAL_DARK }}>proed</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">Consulting · Staffing · Scanning</div>
          </div>
        </div>
      </section>

      {/* Year selector */}
      <div className="flex gap-2">
        {(["2024", "2025", "2026"] as Year[]).map((y) => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className="rounded-md px-4 py-2 text-sm font-medium border"
            style={{
              borderColor: TEAL,
              backgroundColor: year === y ? TEAL : "white",
              color: year === y ? "white" : TEAL_DARK,
            }}
          >
            Payment Year {y}
          </button>
        ))}
      </div>

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
      <p className="text-xs text-slate-500 -mt-4">
        Enter codes without the decimal point — e.g. <b>E1122</b> instead of E11.22.
      </p>

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
              {year === "2024" && <Badge label="RxHCC V05" value={row.rxhccV05} />}
              <Badge label="RxHCC V08" value={row.rxhccV08} />
            </div>
            {row[paymentFlagKey] !== null && row[paymentFlagKey] !== undefined && (
              <div className="mt-1 text-xs text-slate-500">
                V28 applies for {year} payment year: <b>{row[paymentFlagKey] ? "Yes" : "No"}</b>
              </div>
            )}

            {row.richDetail && (
              <details className="mt-3 border-t border-slate-100 pt-2">
                <summary className="cursor-pointer text-xs font-medium" style={{ color: TEAL }}>
                  📋 View full coding notes (Includes, Excludes, Use Additional Code)
                </summary>
                <div className="mt-2 space-y-2 text-xs">
                  <NoteBlock label="Includes" items={row.richDetail.includes} tone="neutral" />
                  <NoteBlock label="Excludes1 — never code together" items={row.richDetail.excludes1} tone="warn" />
                  <NoteBlock label="Excludes2 — may code together" items={row.richDetail.excludes2} tone="neutral" />
                  <NoteBlock label="Use Additional Code" items={row.richDetail.useAdditionalCode} tone="action" />
                  <NoteBlock label="Code First" items={row.richDetail.codeFirst} tone="action" />
                  <NoteBlock label="Code Also" items={row.richDetail.codeAlso} tone="neutral" />

                  {row.richDetail.parentNotes && (
                    <div className="mt-2 rounded-md bg-slate-50 p-2 border border-slate-200">
                      <div className="font-semibold text-slate-600 mb-1">
                        Parent Code Notes: {row.richDetail.parentNotes.code} — {row.richDetail.parentNotes.description}
                      </div>
                      <NoteBlock label="Includes" items={row.richDetail.parentNotes.includes} tone="neutral" />
                      <NoteBlock label="Excludes1" items={row.richDetail.parentNotes.excludes1} tone="warn" />
                      <NoteBlock label="Excludes2" items={row.richDetail.parentNotes.excludes2} tone="neutral" />
                      <NoteBlock label="Use Additional Code" items={row.richDetail.parentNotes.useAdditionalCode} tone="action" />
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
        {q && !loading && results.length === 0 && (
          <p className="text-sm text-slate-500">No codes match &ldquo;{q}&rdquo; for Payment Year {year}.</p>
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
        {YEAR_META[year].sourceLine} Public data, no license required.
      </p>
    </div>
  );
}
