"use client";

import { useEffect, useState } from "react";

/**
 * Drop-in "pop" instructions button + modal for ICD-10-CM codes.
 *
 * Usage — next to a code wherever your app already displays one:
 *
 *   <Icd10CodeNotesButton code={row.code} />
 *
 * It fetches /api/icd10/code/[code] on click (not on every render — see
 * below), shows a small loading state, then renders CMS's own Includes /
 * Excludes1 / Excludes2 / inclusion-term / "code first" / "use additional
 * code" notes in a modal. If the code has no notes attached, nothing
 * renders at all (silently) — pass `hideIfEmpty={false}` to instead show a
 * disabled/greyed button.
 *
 * This is intentionally framework-light — a fixed-position modal with
 * inline Tailwind classes, no external modal library dependency — so it
 * drops into an existing page without pulling in anything new. If the app
 * already has a shared <Modal> component, swap the JSX below for that one
 * and keep the fetch/state logic as-is.
 */

type Icd10CodeNotes = {
  code: string;
  description: string;
  chapterName: string | null;
  sectionName: string | null;
  categoryCode: string | null;
  includesNotes: string[] | null;
  excludes1Notes: string[] | null;
  excludes2Notes: string[] | null;
  inclusionTerms: string[] | null;
  codeFirstNotes: string[] | null;
  useAddlNotes: string[] | null;
  sevenChrNote: string | null;
  sourceYear: number;
  hasNotes: boolean;
};

const NOTE_SECTIONS: {
  key: keyof Icd10CodeNotes;
  label: string;
  tone: "includes" | "excludes" | "info";
}[] = [
  { key: "includesNotes", label: "Includes", tone: "includes" },
  { key: "inclusionTerms", label: "Inclusion terms", tone: "includes" },
  { key: "excludes1Notes", label: "Excludes1 — not coded here, mutually exclusive", tone: "excludes" },
  { key: "excludes2Notes", label: "Excludes2 — not included here, may code both", tone: "excludes" },
  { key: "codeFirstNotes", label: "Code first", tone: "info" },
  { key: "useAddlNotes", label: "Use additional code", tone: "info" },
];

const TONE_CLASSES: Record<string, string> = {
  includes: "border-emerald-200 bg-emerald-50 text-emerald-900",
  excludes: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-amber-200 bg-amber-50 text-amber-900",
};

export function Icd10CodeNotesButton({
  code,
  hideIfEmpty = true,
  className = "",
}: {
  code: string;
  hideIfEmpty?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Icd10CodeNotes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedEmpty, setCheckedEmpty] = useState(false);

  // Fetch lazily on first open rather than for every row on page load —
  // a code list can have hundreds of rows, and most codes won't be opened.
  async function handleOpen() {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/icd10/code/${encodeURIComponent(code)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const json: Icd10CodeNotes = await res.json();
      setData(json);
      setCheckedEmpty(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }

  // If hideIfEmpty is set and we've already confirmed (from a prior open)
  // that this code has nothing to show, don't render the trigger at all.
  if (hideIfEmpty && checkedEmpty && data && !data.hasNotes) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ||
          "inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        }
        title={`CMS coding notes for ${code}`}
      >
        <InfoIcon />
        Notes
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-lg font-semibold text-slate-900">
                  {code}
                </div>
                {data?.description && (
                  <div className="text-sm text-slate-600">{data.description}</div>
                )}
                {(data?.chapterName || data?.sectionName) && (
                  <div className="mt-1 text-xs text-slate-400">
                    {[data?.chapterName, data?.sectionName].filter(Boolean).join(" › ")}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {loading && <div className="py-6 text-center text-sm text-slate-500">Loading notes…</div>}

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {data && !loading && !error && (
              <div className="space-y-3">
                {NOTE_SECTIONS.map(({ key, label, tone }) => {
                  const raw = data[key];
                  const value = Array.isArray(raw) ? (raw as string[]) : null;
                  if (!value || value.length === 0) return null;
                  return (
                    <div
                      key={key}
                      className={`rounded-md border px-3 py-2 ${TONE_CLASSES[tone]}`}
                    >
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-75">
                        {label}
                      </div>
                      <ul className="list-inside list-disc space-y-0.5 text-sm">
                        {value.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

                {data.sevenChrNote && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      7th character note
                    </div>
                    {data.sevenChrNote}
                  </div>
                )}

                {!data.hasNotes && (
                  <div className="py-4 text-center text-sm text-slate-400">
                    CMS has no Includes/Excludes/instructional notes on file for this code.
                  </div>
                )}

                <div className="pt-1 text-right text-[11px] text-slate-400">
                  Source: CMS ICD-10-CM Tabular List, FY{data.sourceYear}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-5a1 1 0 100 2 1 1 0 000-2zm-1 4a1 1 0 112 0v5a1 1 0 11-2 0v-5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
