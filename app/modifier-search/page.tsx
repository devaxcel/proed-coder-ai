"use client";

import { useMemo, useState } from "react";
import { MODIFIERS } from "@/lib/modifier-data";
import { THEME } from "@/lib/theme";

const BRAND = THEME.primary;
const CARD = THEME.primaryLight;

export default function ModifierSearchPage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODIFIERS;
    return MODIFIERS.filter(
      (m) => m.code.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || (m.note?.toLowerCase().includes(q) ?? false)
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">Modifier Search</h1>
          <p className="mt-1 text-sm text-white/85">
            CPT Level I and common HCPCS Level II modifiers used in ProEd's coding workflows.
          </p>
        </div>
      </section>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by modifier code or description…"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        style={{ borderColor: BRAND }}
      />

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: BRAND }} className="text-white text-left">
              <th className="px-3 py-2 w-20">Code</th>
              <th className="px-3 py-2 w-36">Category</th>
              <th className="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {results.map((m) => (
              <tr key={m.code} className="border-t" style={{ borderColor: CARD }}>
                <td className="px-3 py-2 font-semibold" style={{ color: BRAND }}>-{m.code}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{m.category}</td>
                <td className="px-3 py-2">
                  <div className="text-slate-800">{m.description}</div>
                  {m.note && <div className="text-xs text-slate-500 mt-0.5">{m.note}</div>}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">
                  No modifiers match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        This is a curated reference list of the modifiers ProEd's coders most commonly use — not the full national modifier set. Verify against current CMS/payer policy before billing.
      </p>
    </div>
  );
}
