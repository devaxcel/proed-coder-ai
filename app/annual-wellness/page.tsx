"use client";

import AwvMeasuresPanel from "./AwvMeasuresPanel";
import { THEME } from "@/lib/theme";

const TEAL = THEME.primary;
const TEAL_DARK = THEME.primary;

export default function AnnualWellnessPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: TEAL }}>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">Annual Wellness</h1>
            <p className="mt-1 text-sm text-white/85">Full quality measures panel below</p>
          </div>
          <div className="rounded-md bg-white/95 px-4 py-2 text-center shadow-sm">
            <div className="font-serif italic text-lg leading-none" style={{ color: TEAL_DARK }}>proed</div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500 mt-0.5">Consulting · Staffing · Scanning</div>
          </div>
        </div>
      </section>

      {/* "Medication Reference List" search panel (Beta Blockers / Diuretics /
          COPD Meds / etc.) was removed per Lupita's App_Changes request —
          "We do not need any this section." The medication-validation
          measures themselves (Diuretics, ACE/ARB, Beta Blocker, Statin
          codes) remain fully covered in AwvMeasuresPanel's "Medication
          Validation" section below. */}

      <AwvMeasuresPanel />

      <p className="text-xs text-slate-500">
        Source: ProEd Consulting AWV/HEDIS Tool 2026, BMI ICD-10 reference, and internal medication list. Verified against NCQA HEDIS MY 2026 &amp; CMS CY 2026 MPFS Final Rule (CMS-1832-F).
      </p>
    </div>
  );
}
