"use client";

import { useMemo, useState } from "react";

const BRAND = "#14457B";
const CARD = "#E7ECF4";

type Row = { code: string; desc: string; dx: string; status: string; note: string };
type Category = { name: string; rows: Row[] };

const CATEGORIES: Category[] = [
  {
    name: "Blood Pressure",
    rows: [
      { code: "3074F", desc: "BP measured / systolic < 130", dx: "I10 or Z00.00", status: "IN OFFICE", note: "Document exact values" },
      { code: "3075F", desc: "BP systolic 130–139", dx: "I10", status: "IN OFFICE", note: "Document reading" },
      { code: "3077F", desc: "BP systolic ≥ 140", dx: "I10", status: "IN OFFICE", note: "Document reading" },
      { code: "3078F", desc: "BP diastolic < 80", dx: "I10", status: "IN OFFICE", note: "Document reading" },
      { code: "3079F", desc: "BP diastolic 80–89", dx: "I10", status: "IN OFFICE", note: "Document reading" },
      { code: "3080F", desc: "BP diastolic ≥ 90", dx: "I10", status: "IN OFFICE", note: "Use with follow-up plan" },
      { code: "4050F", desc: "Follow-up plan for high BP documented", dx: "I10", status: "IN OFFICE", note: "" },
      { code: "G8783", desc: "MIPS — Normal BP reading; follow-up not required", dx: "—", status: "IN OFFICE", note: "" },
      { code: "G8950", desc: "MIPS — Elevated/Hypertensive BP reading; follow-up documented", dx: "—", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Pain Assessments",
    rows: [
      { code: "0521F", desc: "Plan of care to address pain documented", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "1126F", desc: "Pain Assessment / Zero Pain", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "1125F", desc: "Pain Assessment / Pain Level 1–10", dx: "—", status: "IN OFFICE", note: "" },
      { code: "3331F", desc: "Imaging study NOT ordered for pain", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "3330F", desc: "Imaging study ordered for pain", dx: "PAIN DX", status: "IN OFFICE", note: "Order placed during visit" },
      { code: "4016F", desc: "Anti-inflammatory/analgesic prescribed (OA), incl. OTC", dx: "PAIN DX", status: "IN OFFICE", note: "e-Rx during visit" },
      { code: "4234F", desc: "Counseling for supervised exercise for pain > 12 weeks", dx: "PAIN DX", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Back Pain",
    rows: [
      { code: "1130F", desc: "Back Pain & Function Assessed", dx: "M54.50", status: "IN OFFICE", note: "" },
      { code: "0525F", desc: "Initial Visit for Back Pain", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "0526F", desc: "Subsequent Visit for Back Pain", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "1134F", desc: "Episode Lasting < 6 Weeks", dx: "M54.50", status: "IN OFFICE", note: "" },
      { code: "1135F", desc: "Episode Lasting > 6 Weeks", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "1136F", desc: "Episode Lasting < 12 Weeks", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "1137F", desc: "Episode Lasting > 12 Weeks", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "4240F", desc: "Exercise Instruction for Pain Lasting > 12 weeks", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "4243F", desc: "Counseling for supervised exercise for pain > 12 weeks", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "4248F", desc: "Counsel initial visit against bed rest > 4 days", dx: "PAIN DX", status: "IN OFFICE", note: "" },
      { code: "4245F", desc: "Counsel initial visit to maintain/resume normal activities", dx: "PAIN DX", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Advance Care Planning (ACP)",
    rows: [
      { code: "99498", desc: "ACP — Each additional 30 min; add-on to 99497", dx: "Z00.00", status: "IN OFFICE", note: "Document additional time" },
      { code: "1158F", desc: "MIPS — ACP Documented — Patient Wishes Confirmed", dx: "Z00.00 / Z71.89", status: "IN OFFICE", note: "" },
      { code: "1157F", desc: "ACP Documented — Surrogate Named / legal document stored", dx: "Z00.00 / Z71.89", status: "IN OFFICE", note: "" },
      { code: "1124F", desc: "MIPS — ACP Discussed — Patient Declined or Did Not Name Surrogate", dx: "Z00.00 / Z71.89", status: "IN OFFICE", note: "" },
      { code: "99497-33", desc: "ACP: explanation & discussion of advance directives, first 30 min F2F", dx: "Z00.00", status: "IN OFFICE", note: "Mod -33 w/ same-day AWV waives deductible; doc time" },
    ],
  },
  {
    name: "Medication Reconciliation",
    rows: [
      { code: "1159F", desc: "Medication List documented in medical record (COA)", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "1160F", desc: "Review of medication by prescribing practitioner or clinical pharmacist", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "G8427", desc: "MIPS — Medical Documentation Attestation (medication reconciliation)", dx: "—", status: "IN OFFICE", note: "" },
      { code: "1111F", desc: "Medication Reconciliation after hospital discharge", dx: "Z00.00", status: "IN OFFICE", note: "TRC measure" },
      { code: "1110F", desc: "Patient discharged from inpatient facility in past 60 days", dx: "Z00.00", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Functional Status",
    rows: [
      { code: "1170F", desc: "Functional Status Assessment (COA)(RA); assess ADLs, mobility, gait", dx: "COA / RA", status: "IN OFFICE", note: "Visual gait assessment in office" },
    ],
  },
  {
    name: "Fall Risk Assessment",
    rows: [
      { code: "3288F", desc: "Fall Risk Assessment Documented", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "1101F", desc: "Future Fall Risk — No Falls / Only One Fall Without Injury", dx: "FALL DX", status: "IN OFFICE", note: "" },
      { code: "1100F", desc: "Future Fall Risk — 2 or More Falls in Past Year", dx: "FALL DX", status: "IN OFFICE", note: "" },
      { code: "1150F", desc: "Substantial Risk of Death Within Year", dx: "FALL DX", status: "IN OFFICE", note: "" },
      { code: "0518F", desc: "MIPS — Falls Plan of Care Documented", dx: "FALL DX", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Urinary Incontinence",
    rows: [
      { code: "1090F", desc: "Presence or Absence of Urinary Incontinence Assessed", dx: "R32 or Z00.00", status: "IN OFFICE", note: "" },
      { code: "1091F", desc: "Urinary Incontinence Characterized (frequency, volume, timing, type)", dx: "R32", status: "IN OFFICE", note: "" },
      { code: "0509F", desc: "Urinary Incontinence Plan of Care Documented", dx: "R32", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Dementia",
    rows: [
      { code: "G2106", desc: "MIPS — Patients 66+ with frailty claim AND dispensed dementia medication", dx: "—", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Major Depression Screening (MDD)",
    rows: [
      { code: "G0444", desc: "Annual Depression Screening (PHQ-2/PHQ-9)", dx: "Z13.31", status: "IN OFFICE", note: "Bundled into G0438/G0402 — bill separately only with G0439" },
      { code: "3725F", desc: "Screening for Depression Performed", dx: "Z13.31", status: "IN OFFICE", note: "" },
      { code: "3351F", desc: "Negative Screening for Depressive Symptoms", dx: "Z13.31", status: "IN OFFICE", note: "" },
      { code: "G8510", desc: "MIPS — Screening Negative; Follow-up Not Required", dx: "—", status: "IN OFFICE", note: "" },
      { code: "G8511", desc: "MIPS — Screening Positive; Follow-up Plan Not Documented", dx: "Z13.31", status: "IN OFFICE", note: "" },
      { code: "3092F", desc: "MDD In Remission", dx: "F32.5", status: "IN OFFICE", note: "" },
      { code: "3093F", desc: "New Dx of Initial or Recurrent Episode", dx: "DEPRES DX", status: "IN OFFICE", note: "" },
      { code: "3091F", desc: "MDD Severe With Psychotic Feature", dx: "F32.3", status: "IN OFFICE", note: "" },
      { code: "3090F", desc: "MDD Severe Without Psychosis", dx: "F32.3", status: "IN OFFICE", note: "" },
      { code: "4065F", desc: "Antipsychotic Pharmacotherapy Prescribed", dx: "DEPRES DX", status: "IN OFFICE", note: "e-Rx" },
      { code: "1040F", desc: "MDD Initial Evaluation", dx: "F32.9", status: "IN OFFICE", note: "" },
      { code: "3088F", desc: "MDD Minimal or Mild", dx: "F32.0", status: "IN OFFICE", note: "" },
      { code: "3089F", desc: "MDD Moderate", dx: "F32.1", status: "IN OFFICE", note: "" },
      { code: "3352F", desc: "No Significant Depressive Symptoms", dx: "F32.1", status: "IN OFFICE", note: "" },
      { code: "3353F", desc: "Mild to Moderate Depressive Symptoms", dx: "F32.9", status: "IN OFFICE", note: "" },
      { code: "3354F", desc: "Clinically Significant Depressive Symptoms", dx: "DEPRESS DX", status: "IN OFFICE", note: "" },
      { code: "4063F", desc: "Antidepressant Pharmacotherapy NOT Prescribed", dx: "Z13.31", status: "IN OFFICE", note: "" },
      { code: "4064F", desc: "Antidepressant Pharmacotherapy Prescribed", dx: "DEPRESS DX", status: "IN OFFICE", note: "e-Rx" },
    ],
  },
  {
    name: "Tobacco Use Screening & Cessation",
    rows: [
      { code: "99406", desc: "Smoking/Tobacco Cessation Counseling — Intermediate, 3–10 min", dx: "—", status: "IN OFFICE", note: "Document start/end time" },
      { code: "99407", desc: "Smoking/Tobacco Cessation Counseling — Intensive, >10 min", dx: "—", status: "IN OFFICE", note: "Document start/end time" },
      { code: "1036F", desc: "Current Tobacco Non-User", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "1034F", desc: "Current Tobacco Smoker", dx: "Z72.0", status: "IN OFFICE", note: "" },
      { code: "G9906", desc: "MIPS — Tobacco User Received Cessation Intervention", dx: "—", status: "IN OFFICE", note: "" },
      { code: "1033F", desc: "Non-Smoker, Not Exposed to Secondhand Smoke (Asthma)", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "1032F", desc: "Current Smoker or Exposed to Secondhand Smoke (Asthma)", dx: "Z72.0", status: "IN OFFICE", note: "" },
      { code: "1000F", desc: "Tobacco Use Assessed", dx: "Z00.00", status: "IN OFFICE", note: "" },
      { code: "4000F", desc: "Tobacco Use Cessation Intervention — Counseling", dx: "Z72.0", status: "IN OFFICE", note: "" },
      { code: "4004F", desc: "Smoker — Screened for Tobacco Use / Intervention", dx: "Z72.0", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Diabetic Foot Exams",
    rows: [
      { code: "G9226", desc: "Foot exam (visual, monofilament + one of tuning fork/pinprick/reflexes/vibration, plus pulse)", dx: "—", status: "IN OFFICE", note: "All 3 components completed" },
      { code: "2028F", desc: "Foot Exam Performed (visual, monofilament, pulse — any of 3)", dx: "—", status: "IN OFFICE", note: "" },
      { code: "G8404", desc: "MIPS — Lower extremity neurological exam performed", dx: "—", status: "IN OFFICE", note: "" },
      { code: "4305F", desc: "Patient Education Regarding Foot Care", dx: "—", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Retinopathy / Glaucoma",
    rows: [
      { code: "2022F", desc: "Dilated Retinal Eye Exam WITH Evidence of Retinopathy (DM)", dx: "Z13.5", status: "DOC ONLY", note: "After study — wait for specialist report" },
      { code: "2023F", desc: "Dilated Retinal Eye Exam WITHOUT Evidence of Retinopathy", dx: "Z13.5", status: "DOC ONLY", note: "After study — wait for specialist report" },
    ],
  },
  {
    name: "Unhealthy Alcohol Screening",
    rows: [
      { code: "G0442", desc: "Annual alcohol misuse screening, 5–15 min", dx: "Z13.89", status: "IN OFFICE", note: "Document time" },
      { code: "G9621", desc: "MIPS — Unhealthy alcohol user; received brief counseling", dx: "—", status: "IN OFFICE", note: "Document time start/end" },
      { code: "G9622", desc: "MIPS — NOT identified as unhealthy alcohol user", dx: "—", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Glycemic Status",
    rows: [
      { code: "3044F", desc: "HbA1c Level < 7% (DM)", dx: "PRE-DIAB or DM DX", status: "DOC ONLY", note: "Document prior lab result" },
      { code: "3046F / M1211", desc: "HbA1c Level > 9%", dx: "DM DX", status: "DOC ONLY", note: "Document prior lab result" },
      { code: "3051F", desc: "HbA1c Level ≥ 7% and < 8% (DM)", dx: "DM DX", status: "DOC ONLY", note: "" },
      { code: "3052F", desc: "HbA1c Level 8%–9%", dx: "DM DX", status: "DOC ONLY", note: "" },
      { code: "M1212", desc: "MIPS — Glycemic Status Assessment Missing or Not Performed", dx: "—", status: "IN OFFICE", note: "Order lab during visit" },
    ],
  },
  {
    name: "LDL Screening",
    rows: [
      { code: "3048F", desc: "LDL Lab Screening < 100", dx: "Z13.220", status: "DOC ONLY", note: "After study — wait for report" },
      { code: "3049F", desc: "LDL Lab Screening 100–129", dx: "Z13.220", status: "DOC ONLY", note: "After study — wait for report" },
      { code: "3050F", desc: "LDL Lab Screening > 129", dx: "Z13.220", status: "DOC ONLY", note: "After study — wait for report" },
    ],
  },
  {
    name: "Nephropathy (Urine Microalbumin)",
    rows: [
      { code: "3060F", desc: "Positive Microalbuminuria Test ≥ 300", dx: "Z13.228", status: "DOC ONLY", note: "After study — wait for report" },
      { code: "3061F", desc: "Negative Microalbuminuria Test < 30", dx: "Z13.228", status: "DOC ONLY", note: "After study — wait for report" },
      { code: "3062F", desc: "Positive Microalbuminuria + Confirmation, 30–300+", dx: "DX BY DOC", status: "DOC ONLY", note: "After study — wait for report" },
    ],
  },
  {
    name: "Colorectal Screening",
    rows: [
      { code: "3017F", desc: "Colorectal cancer screening results documented and reviewed", dx: "Z12.11", status: "DOC ONLY", note: "Colonoscopy q10yr; FOBT/FIT annually; stool DNA q3yr; high-risk q2yr" },
    ],
  },
  {
    name: "Asthma Follow-Up",
    rows: [
      { code: "1038F", desc: "Persistent (Mild, Moderate or Severe)", dx: "J45.x", status: "IN OFFICE", note: "AAF-E follow-up logic applies" },
      { code: "1039F", desc: "Intermittent", dx: "J45.2x", status: "IN OFFICE", note: "" },
      { code: "4015F", desc: "Persistent — Long-Term Control Medication", dx: "J45.x", status: "IN OFFICE", note: "e-Rx" },
      { code: "4140F", desc: "Inhaled Corticosteroid Prescribed", dx: "J45.x", status: "IN OFFICE", note: "e-Rx" },
      { code: "4144F", desc: "Asthma Long-Term Control Medication", dx: "J45.x", status: "IN OFFICE", note: "e-Rx" },
    ],
  },
  {
    name: "Osteoporosis",
    rows: [
      { code: "4005F", desc: "Osteoporosis — Pharmacologic Therapy", dx: "M81.0", status: "IN OFFICE", note: "e-Rx" },
      { code: "5015F", desc: "Osteoporosis — Fracture Occurred", dx: "M80.00XA", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Osteoarthritis (OA)",
    rows: [
      { code: "4016F", desc: "Anti-inflammatory/analgesic agent prescribed (OA), incl. OTC", dx: "OA", status: "IN OFFICE", note: "e-Rx" },
    ],
  },
  {
    name: "Rheumatoid Arthritis (RA)",
    rows: [
      { code: "4187F", desc: "DMARD Therapy Prescribed or Dispensed (RA)", dx: "RA", status: "IN OFFICE", note: "e-Rx" },
    ],
  },
  {
    name: "COPD",
    rows: [
      { code: "3023F", desc: "Spirometry results documented and reviewed (COPD)", dx: "J44.9", status: "DOC ONLY", note: "" },
      { code: "(no code)", desc: "Systemic corticosteroids after hospital discharge/ED for COPD exacerbation", dx: "J44.1", status: "IN OFFICE", note: "e-Rx" },
    ],
  },
  {
    name: "Antibiotics for URI / Pharyngitis",
    rows: [
      { code: "4120F", desc: "Antibiotic Prescribed or Dispensed", dx: "J06.9 / J02.9", status: "IN OFFICE", note: "e-Rx" },
      { code: "4124F", desc: "Neither Antibiotics Prescribed nor Dispensed", dx: "J06.9 / J02.9", status: "IN OFFICE", note: "" },
      { code: "3210F", desc: "Group A Strep Test Performed (PHAR)", dx: "J02.9", status: "IN OFFICE", note: "Specimen collected in office" },
    ],
  },
  {
    name: "Immunizations",
    rows: [
      { code: "1030F", desc: "Influenza Assessment", dx: "Z23", status: "IN OFFICE", note: "" },
      { code: "4037F", desc: "Flu Vaccine Given", dx: "Z23", status: "IN OFFICE", note: "Administered or document prior" },
      { code: "4274F", desc: "Influenza immunization administered or previously received", dx: "Z23", status: "DOC ONLY", note: "Document prior administration" },
      { code: "1022F", desc: "Pneumococcus immunization status assessed", dx: "Z23", status: "IN OFFICE", note: "" },
      { code: "4040F", desc: "Pneumococcal Vaccine Given", dx: "Z23", status: "IN OFFICE", note: "Administered or document prior" },
    ],
  },
  {
    name: "DXA Bone Density",
    rows: [
      { code: "3096F", desc: "DEXA Screening Ordered every 2 years", dx: "Z13.820", status: "IN OFFICE", note: "Order during visit" },
      { code: "3095F", desc: "DEXA Results Documented after study", dx: "Z13.820 or result", status: "DOC ONLY", note: "Document prior result" },
    ],
  },
  {
    name: "Breast Cancer Mammogram",
    rows: [
      { code: "3014F", desc: "Mammography Screening Results Documented and Reviewed", dx: "Z12.31", status: "DOC ONLY", note: "Order during visit" },
      { code: "3341F", desc: "Assessment Negative", dx: "Z12.31", status: "DOC ONLY", note: "" },
      { code: "3340F", desc: "Assessment Incomplete — Need Additional Imaging", dx: "Z12.31", status: "DOC ONLY", note: "" },
      { code: "3342F", desc: "Assessment Benign", dx: "Z12.31", status: "DOC ONLY", note: "" },
      { code: "3343F", desc: "Assessment Probably Benign", dx: "Z12.31", status: "DOC ONLY", note: "" },
      { code: "3344F", desc: "Assessment Suspicious", dx: "Z12.31", status: "DOC ONLY", note: "" },
      { code: "3345F", desc: "Assessment Highly Suggests Malignancy", dx: "Z12.31", status: "DOC ONLY", note: "" },
      { code: "3350F", desc: "Assessment Known Biopsy-Proven Malignancy", dx: "Z12.31", status: "DOC ONLY", note: "" },
    ],
  },
  {
    name: "Cervical Cancer Screening",
    rows: [
      { code: "3015F", desc: "Cervical Cancer Screening Results Documented and Reviewed", dx: "Z12.4", status: "DOC ONLY", note: "Medicare covers q24mo ages 21-64 unless high risk" },
      { code: "Q0091", desc: "Screening Pap smear; obtaining, preparing & conveyance to lab", dx: "Z12.4", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Medication Validation — Diuretics",
    rows: [
      { code: "4190F", desc: "Diuretic Monitor Ordered/Performed", dx: "HTN, CKD, HF", status: "IN OFFICE", note: "Order during visit" },
      { code: "4221F", desc: "Diuretic Medication Therapy > 6 months", dx: "—", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Medication Validation — ACE/ARB",
    rows: [
      { code: "4095F", desc: "ACE/ARB Prescribed 1st time", dx: "I10 or other DX", status: "IN OFFICE", note: "e-Rx" },
      { code: "4010F", desc: "ACE Inhibitor or ARB therapy prescribed or currently taken", dx: "CAD, CKD, HF, DM / HTN", status: "IN OFFICE", note: "" },
      { code: "4210F", desc: "ACE/ARB > 6 months", dx: "HTN, CKD, HF", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Medication Validation — Beta Blocker",
    rows: [
      { code: "4008F", desc: "Beta Blocker Prescribed or Currently Being Taken", dx: "HTN, HF", status: "IN OFFICE", note: "" },
    ],
  },
  {
    name: "Medication Validation — Statin",
    rows: [
      { code: "4013F", desc: "Statin therapy prescribed or currently being taken", dx: "CAD", status: "IN OFFICE", note: "e-Rx; SPC-E/SPD-E now ECDS-only" },
    ],
  },
  {
    name: "In-Office Procedures & Labs",
    rows: [
      { code: "93005", desc: "EKG Done in Office", dx: "HTN-CARD", status: "IN OFFICE", note: "" },
      { code: "Q0091", desc: "Cervical / Pap screening collection (Medicare)", dx: "Z12.4", status: "IN OFFICE", note: "" },
      { code: "51798", desc: "Bladder Scan Done in Office", dx: "R35.0", status: "IN OFFICE", note: "" },
      { code: "76705", desc: "Aorta Ultrasound Done in Office", dx: "HTN-CARD", status: "IN OFFICE", note: "" },
      { code: "83036-QW", desc: "A1C Lab In-House Done in Office", dx: "DM DX", status: "IN OFFICE", note: "In-office CLIA lab" },
      { code: "82947-QW", desc: "Finger Stick / Glucose Done in Office (CLIA)", dx: "DM DX", status: "IN OFFICE", note: "Do NOT also bill 36415" },
      { code: "36415", desc: "Venipuncture — Commercial ins. ONLY when sent to outside lab", dx: "—", status: "IN OFFICE", note: "NOT for in-office CLIA labs" },
      { code: "81000", desc: "Urine Dipstick Done in Office", dx: "—", status: "IN OFFICE", note: "" },
      { code: "81003-QW", desc: "Urine automated Done in Office", dx: "—", status: "IN OFFICE", note: "" },
      { code: "93922", desc: "ABI Ankle-Brachial Index single-level PAD assessment", dx: "—", status: "IN OFFICE", note: "" },
    ],
  },
];

export default function HedisMeasuresPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      rows: cat.rows.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.desc.toLowerCase().includes(q) ||
          r.dx.toLowerCase().includes(q) ||
          cat.name.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.rows.length > 0);
  }, [query]);

  const totalCodes = CATEGORIES.reduce((sum, c) => sum + c.rows.length, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-lg overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: BRAND }}>
          <h1 className="text-xl font-bold text-white">HEDIS &amp; Quality Measures Reference</h1>
          <p className="mt-1 text-sm text-white/85">
            {CATEGORIES.length} measure categories · {totalCodes} codes — full reference from the ProEd AWV/HEDIS Tracking Tool
          </p>
        </div>
      </section>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by code, description, or category…"
        className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm"
      />

      <div className="space-y-6">
        {filtered.map((cat) => (
          <div key={cat.name} className="rounded-lg border overflow-hidden" style={{ borderColor: BRAND }}>
            <div className="px-4 py-2 text-white font-semibold text-sm" style={{ backgroundColor: BRAND }}>
              {cat.name} <span className="font-normal text-white/70">({cat.rows.length})</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: CARD }}>
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600">Code</th>
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600">Description</th>
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600">Dx</th>
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600">Status</th>
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600">Note</th>
                </tr>
              </thead>
              <tbody>
                {cat.rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : ""} style={i % 2 !== 0 ? { backgroundColor: "#F8FAFC" } : {}}>
                    <td className="px-3 py-1.5 font-medium">{r.code}</td>
                    <td className="px-3 py-1.5">{r.desc}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.dx}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.status}</td>
                    <td className="px-3 py-1.5 text-slate-500 italic">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-500">No matches for &ldquo;{query}&rdquo;.</p>}
      </div>

      <p className="text-xs text-slate-500">
        Source: ProEd Consulting AWV/HEDIS Tool 2026. Verified against NCQA HEDIS MY 2026 &amp; CMS CY 2026 MPFS Final Rule (CMS-1832-F). CPT is a registered trademark of the American Medical Association.
      </p>
    </div>
  );
}
