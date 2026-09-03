"use client";

import { useState } from "react";
import { AIOutputDisclaimer } from "@/lib/disclaimers";

const BRAND = "#14457B";
const CARD = "#E7ECF4";
const AMBER = "#B45309";
const AMBER_LIGHT = "#FEF3C7";

type Basis = "time" | "mdm" | null;
type PatientType = "new" | "established" | null;
type ProblemLevel = "minimal" | "low" | "moderate" | "high" | null;
type DataLevel = "minimal" | "limited" | "moderate" | "extensive" | null;
type RiskLevel = "minimal" | "low" | "moderate" | "high" | null;

const COMPLEXITY_RANK: Record<string, number> = { minimal: 1, low: 2, limited: 2, moderate: 3, high: 4, extensive: 4 };

export default function EMToolPage() {
  const [basis, setBasis] = useState<Basis>(null);
  const [patientType, setPatientType] = useState<PatientType>(null);
  const [totalTime, setTotalTime] = useState("");
  const [problems, setProblems] = useState<ProblemLevel>(null);
  const [data, setData] = useState<DataLevel>(null);
  const [risk, setRisk] = useState<RiskLevel>(null);

  const mdmOverall = (() => {
    if (!problems || !data || !risk) return null;
    const ranks = [COMPLEXITY_RANK[problems], COMPLEXITY_RANK[data], COMPLEXITY_RANK[risk]].sort((a, b) => a - b);
    // MDM overall level = the middle (2nd highest) of the three elements — matches
    // the general "2 of 3" methodology described in public CMS documentation.
    const middle = ranks[1];
    if (middle >= 4) return "High";
    if (middle === 3) return "Moderate";
    if (middle === 2) return "Low";
    return "Straightforward";
  })();

  function reset() {
    setBasis(null);
    setPatientType(null);
    setTotalTime("");
    setProblems(null);
    setData(null);
    setRisk(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">E/M Level Helper</h1>
          <p className="mt-1 text-sm text-white/85">
            Walks through the time-based vs. MDM-based decision and estimates a general complexity level.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-amber-300 p-4 text-sm" style={{ backgroundColor: AMBER_LIGHT, color: AMBER }}>
        <b>⚠️ Placeholder mode — pending AMA CPT license.</b> This tool shows a general complexity level (Straightforward / Low / Moderate / High) but does <b>not</b> display specific CPT code numbers, since those require a license from the American Medical Association. Once ProEd secures that license, this will show the actual corresponding code.
      </div>

      <AIOutputDisclaimer />

      {/* Step 1: New vs Established */}
      <div className="rounded-lg border p-5" style={{ borderColor: BRAND }}>
        <div className="text-sm font-semibold mb-3" style={{ color: BRAND }}>1. Patient Type</div>
        <div className="flex gap-2">
          {(["new", "established"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPatientType(t)}
              className="rounded-md px-4 py-2 text-sm font-medium border capitalize"
              style={{
                borderColor: BRAND,
                backgroundColor: patientType === t ? BRAND : "white",
                color: patientType === t ? "white" : BRAND,
              }}
            >
              {t} patient
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Time vs MDM */}
      <div className="rounded-lg border p-5" style={{ borderColor: BRAND }}>
        <div className="text-sm font-semibold mb-3" style={{ color: BRAND }}>2. Basis for Level Selection</div>
        <div className="flex gap-2">
          <button
            onClick={() => setBasis("time")}
            className="rounded-md px-4 py-2 text-sm font-medium border"
            style={{ borderColor: BRAND, backgroundColor: basis === "time" ? BRAND : "white", color: basis === "time" ? "white" : BRAND }}
          >
            Time-based
          </button>
          <button
            onClick={() => setBasis("mdm")}
            className="rounded-md px-4 py-2 text-sm font-medium border"
            style={{ borderColor: BRAND, backgroundColor: basis === "mdm" ? BRAND : "white", color: basis === "mdm" ? "white" : BRAND }}
          >
            MDM-based
          </button>
        </div>

        {basis === "time" && (
          <div className="mt-4">
            <label className="text-xs font-medium text-slate-600 block mb-1">Total time spent on date of encounter (minutes)</label>
            <input
              type="number"
              value={totalTime}
              onChange={(e) => setTotalTime(e.target.value)}
              placeholder="e.g. 25"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm w-40"
            />
            <p className="mt-2 text-xs text-slate-500">
              Countable time includes: reviewing history, exam, counseling, ordering tests, documenting, and care coordination performed by the billing provider on the date of the encounter.
            </p>
          </div>
        )}
      </div>

      {/* Step 3: MDM elements (only if MDM basis selected) */}
      {basis === "mdm" && (
        <div className="rounded-lg border p-5" style={{ borderColor: BRAND }}>
          <div className="text-sm font-semibold mb-3" style={{ color: BRAND }}>3. Medical Decision Making Elements</div>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Number & Complexity of Problems Addressed</div>
              <div className="flex flex-wrap gap-2">
                {(["minimal", "low", "moderate", "high"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setProblems(l)}
                    className="rounded px-3 py-1.5 text-xs font-medium border capitalize"
                    style={{ borderColor: BRAND, backgroundColor: problems === l ? BRAND : "white", color: problems === l ? "white" : BRAND }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Amount/Complexity of Data Reviewed</div>
              <div className="flex flex-wrap gap-2">
                {(["minimal", "limited", "moderate", "extensive"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setData(l)}
                    className="rounded px-3 py-1.5 text-xs font-medium border capitalize"
                    style={{ borderColor: BRAND, backgroundColor: data === l ? BRAND : "white", color: data === l ? "white" : BRAND }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Risk of Complications / Management</div>
              <div className="flex flex-wrap gap-2">
                {(["minimal", "low", "moderate", "high"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setRisk(l)}
                    className="rounded px-3 py-1.5 text-xs font-medium border capitalize"
                    style={{ borderColor: BRAND, backgroundColor: risk === l ? BRAND : "white", color: risk === l ? "white" : BRAND }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {((basis === "time" && totalTime) || (basis === "mdm" && mdmOverall)) && (
        <div className="rounded-lg border p-5" style={{ borderColor: BRAND, backgroundColor: CARD }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: BRAND }}>
            Result — General Complexity
          </div>
          {basis === "time" ? (
            <div className="text-lg font-bold text-slate-900">
              Time-based visit — {totalTime} minutes documented
            </div>
          ) : (
            <div className="text-lg font-bold text-slate-900">{mdmOverall} complexity (MDM-based)</div>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Patient type: <b className="capitalize">{patientType ?? "not selected"}</b>
          </p>
          <div className="mt-3 rounded-md bg-white border border-slate-200 p-3 text-xs text-slate-500 italic">
            Specific CPT code number will appear here once ProEd's AMA CPT license is active and real code data is integrated.
          </div>
        </div>
      )}

      <button onClick={reset} className="text-xs text-slate-500 hover:underline">
        Reset all selections
      </button>
    </div>
  );
}
