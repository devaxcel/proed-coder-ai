"use client";

import { useEffect, useRef, useState } from "react";
import { THEME } from "@/lib/theme";

export type Icd10Pick = { code: string; description: string };
type Suggestion = Icd10Pick & { billable: boolean; via: "code" | "index"; indexTerm?: string };

/**
 * Type-ahead input backed by /api/icd10-suggest (ICD-10-CM code table + Alphabetic Index).
 * The text stays freely editable — search is an aid, not a gate. `splitOn` lets the
 * box hold several entries ("E11.40, N18.4"): only the text after the last separator
 * is searched, and picking replaces just that fragment (done by the parent in onPick).
 */
export default function Icd10Combo({
  value,
  onChange,
  onPick,
  placeholder,
  splitOn,
  label,
  labelColor = THEME.primary,
  inputClassName = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1",
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Icd10Pick) => void;
  placeholder?: string;
  splitOn?: RegExp; // e.g. /[,;]/
  label?: string;
  labelColor?: string;
  inputClassName?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const fragment = (splitOn ? value.split(splitOn).pop() ?? "" : value).trim();

  useEffect(() => {
    if (fragment.length < 2) {
      setItems([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/icd10-suggest?q=${encodeURIComponent(fragment)}`);
        const j = await r.json();
        if (id === reqId.current) {
          setItems(Array.isArray(j.results) ? j.results : []);
          setActive(0);
        }
      } catch {
        if (id === reqId.current) setItems([]);
      } finally {
        if (id === reqId.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [fragment]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(s: Suggestion) {
    onPick({ code: s.code, description: s.description });
    setOpen(false);
    setItems([]);
    reqId.current++;
  }

  return (
    <div ref={boxRef} className="relative">
      {label && <label className="mb-0.5 block text-xs font-medium" style={{ color: labelColor }}>{label}</label>}
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      {open && fragment.length >= 2 && (busy || items.length > 0) && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full min-w-[280px] overflow-auto rounded-md border border-slate-300 bg-white text-sm shadow-lg">
          {busy && items.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">Searching…</li>}
          {items.map((s, i) => (
            <li
              key={s.code}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              className="cursor-pointer px-3 py-1.5"
              style={{ background: i === active ? THEME.primaryLight : undefined }}
            >
              <span className="font-bold" style={{ color: THEME.primary }}>{s.code}</span>
              {!s.billable && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">header</span>}
              {s.via === "index" && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-600">index</span>}
              <div className="text-xs text-slate-600">{s.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Replace the text after the last separator with `replacement`, keeping earlier entries. */
export function replaceLastFragment(value: string, sepChar: string, replacement: string): string {
  const idx = value.lastIndexOf(sepChar);
  const head = idx >= 0 ? value.slice(0, idx + 1).trimEnd() + " " : "";
  return head + replacement;
}
