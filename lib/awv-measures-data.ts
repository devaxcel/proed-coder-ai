// AWV HEDIS Quality Measures — full 2026 dataset
// Source: ProEd's "AWV HEDIS Tool 2026 In-Office" reference document
// (CMS CY 2026 MPFS Final Rule; NCQA HEDIS MY 2026 What's New)
//
// Retired items EXCLUDED per the source document:
//   - Anticonvulsants (row is blank/retired in source)
//   - CPT 93923 (explicitly removed)
// Items marked "documentation only" (AMR, MSC) are KEPT since the source
// says their underlying codes remain valid for in-office documentation,
// just no longer used for the old HEDIS reporting label.

export type MeasureItem = {
  code: string;
  description: string;
  dx?: string;
  status: "IN OFFICE" | "DOC ONLY";
  note?: string;
};

export type MeasureGroup =
  | { type: "single-select"; label?: string; items: MeasureItem[] }
  | { type: "checklist"; items: MeasureItem[] };

export type MeasureSection = {
  key: string;
  title: string;
  populationNote?: string;
  sectionNote?: string;
  groups: MeasureGroup[];
};

export const AWV_MEASURE_SECTIONS: MeasureSection[] = [
  {
    key: "awv-visit",
    title: "Annual Wellness Visit / Welcome to Medicare",
    populationNote: "In-office AWV, FQHC/RHC, and IPPE coding",
    groups: [
      {
        type: "single-select",
        label: "Visit type",
        items: [
          { code: "G0438", description: "Annual Wellness Visit, Initial", dx: "Z00.00", status: "IN OFFICE", note: "Performed in office; POS 11" },
          { code: "G0439", description: "Annual Wellness Visit, Subsequent", dx: "Z00.00", status: "IN OFFICE", note: "Performed in office; POS 11" },
          { code: "G0468", description: "FQHC / RHC visit, IPPE or AWV", dx: "Z00.00", status: "IN OFFICE", note: "FQHC/RHC AWV/IPPE code; POS 11" },
          { code: "G0402", description: "Welcome to Medicare / IPPE", dx: "Z00.00", status: "IN OFFICE", note: "Performed in office; POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [
          { code: "G0136", description: "Physical Activity and Nutrition Risk Assessment", status: "IN OFFICE", note: "Every 6 months with AWV or E/M; NOT standalone. Mod 33 same-day AWV waives cost-share" },
        ],
      },
    ],
  },
  {
    key: "bmi",
    title: "BMI / Obesity",
    populationNote: "Adults only — MIPS BMI quality codes included",
    groups: [
      {
        type: "checklist",
        items: [{ code: "3008F", description: "Body mass index (BMI)", dx: "Z68.__", status: "DOC ONLY", note: "Document exact BMI value" }],
      },
      {
        type: "single-select",
        label: "BMI status",
        items: [
          { code: "G8417", description: "MIPS — BMI documented ABOVE normal parameters; follow-up plan documented", status: "IN OFFICE" },
          { code: "G8418", description: "MIPS — BMI documented BELOW normal parameters; follow-up plan documented", status: "IN OFFICE" },
          { code: "G8420", description: "MIPS — BMI documented WITHIN normal parameters; no follow-up plan required", status: "IN OFFICE" },
          { code: "G8421", description: "MIPS — BMI NOT CALCULATED", status: "IN OFFICE" },
        ],
      },
      {
        type: "checklist",
        items: [{ code: "G0447", description: "Behavioral counseling for obesity, 15 minutes", status: "IN OFFICE", note: "Document time start and time end" }],
      },
    ],
  },
  {
    key: "blood-pressure",
    title: "Blood Pressure",
    populationNote: "CBP: 18–85 | BPD: 18–75 — MIPS BP quality codes included",
    groups: [
      {
        type: "single-select",
        label: "Systolic reading",
        items: [
          { code: "3074F", description: "BP measured / systolic < 130", dx: "I10 or Z00.00", status: "IN OFFICE", note: "In-office measured BP; document exact values" },
          { code: "3075F", description: "BP systolic 130–139", dx: "I10", status: "IN OFFICE", note: "Document in-office reading" },
          { code: "3077F", description: "BP systolic >= 140", dx: "I10", status: "IN OFFICE", note: "Document in-office reading" },
        ],
      },
      {
        type: "single-select",
        label: "Diastolic reading",
        items: [
          { code: "3078F", description: "BP diastolic < 80", dx: "I10", status: "IN OFFICE", note: "Document in-office reading" },
          { code: "3079F", description: "BP diastolic 80–89", dx: "I10", status: "IN OFFICE", note: "Document in-office reading" },
          { code: "3080F", description: "BP diastolic >= 90", dx: "I10", status: "IN OFFICE", note: "Use with follow-up plan" },
        ],
      },
      {
        type: "checklist",
        items: [{ code: "4050F", description: "Follow-up plan for high BP documented", dx: "I10", status: "IN OFFICE", note: "POS 11" }],
      },
      {
        type: "single-select",
        label: "MIPS BP status",
        items: [
          { code: "G8783", description: "MIPS — Normal blood pressure reading documented; follow-up not required", status: "IN OFFICE" },
          { code: "G8950", description: "MIPS — Elevated/Hypertensive blood pressure reading documented; indicated follow-up documented", status: "IN OFFICE" },
        ],
      },
    ],
  },
  {
    key: "pain-assessments",
    title: "Pain Assessments",
    populationNote: "Pain screening, plan of care, and management",
    groups: [
      {
        type: "checklist",
        items: [{ code: "0521F", description: "Plan of care to address pain documented", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" }],
      },
      {
        type: "single-select",
        label: "Pain level",
        items: [
          { code: "1126F", description: "Pain Assessment / Zero Pain", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "1125F", description: "Pain Assessment / Pain Level 1–10", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "single-select",
        label: "Imaging decision",
        items: [
          { code: "3331F", description: "Imaging study NOT ordered for pain", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "3330F", description: "Imaging study ordered for pain", dx: "PAIN DX", status: "IN OFFICE", note: "Order placed during visit" },
        ],
      },
      {
        type: "checklist",
        items: [
          { code: "4016F", description: "Anti-inflammatory / analgesic agent prescribed (OA), incl. OTC", dx: "PAIN DX", status: "IN OFFICE", note: "e-Rx during visit" },
          { code: "4234F", description: "Counseling for supervised exercise for pain > 12 weeks", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "back-pain",
    title: "Back Pain",
    populationNote: "LBP: 18–75",
    groups: [
      {
        type: "checklist",
        items: [{ code: "1130F", description: "Back Pain & Function Assessed", dx: "M54.50", status: "IN OFFICE", note: "POS 11" }],
      },
      {
        type: "single-select",
        label: "Visit type",
        items: [
          { code: "0525F", description: "Initial Visit for Back Pain", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
          { code: "0526F", description: "Subsequent Visit for Back Pain", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "single-select",
        label: "Episode length (6-week threshold)",
        items: [
          { code: "1134F", description: "Episode Lasting < 6 Weeks", dx: "M54.50", status: "IN OFFICE", note: "POS 11" },
          { code: "1135F", description: "Episode Lasting > 6 Weeks", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "single-select",
        label: "Episode length (12-week threshold)",
        items: [
          { code: "1136F", description: "Episode Lasting < 12 Weeks", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
          { code: "1137F", description: "Episode Lasting > 12 Weeks", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [
          { code: "4240F", description: "Exercise Instruction for Pain Lasting > 12 weeks", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
          { code: "4243F", description: "Counseling for supervised exercise for pain > 12 weeks", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
          { code: "4248F", description: "Counsel during initial visit against bed rest > 4 days", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
          { code: "4245F", description: "Counsel during initial visit to maintain / resume normal activities", dx: "PAIN DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "acp",
    title: "Advance Care Planning (COA)",
    populationNote: "Document time start/end for ACP services",
    groups: [
      {
        type: "checklist",
        items: [{ code: "99498", description: "ACP — Each additional 30 min; add-on to 99497", dx: "Z00.00", status: "IN OFFICE", note: "Add-on to 99497; document additional time" }],
      },
      {
        type: "single-select",
        label: "ACP outcome",
        items: [
          { code: "1158F", description: "MIPS — ACP Documented — Patient Wishes Confirmed (Wish Form)", dx: "Z00.00 / Z71.89", status: "IN OFFICE", note: "POS 11" },
          { code: "1157F", description: "ACP Documented — Surrogate Named / legal document stored", dx: "Z00.00 / Z71.89", status: "IN OFFICE", note: "POS 11" },
          { code: "1124F", description: "MIPS — ACP Discussed — Patient Declined or Did Not Name Surrogate", dx: "Z00.00 / Z71.89", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "med-reconciliation",
    title: "Medication Reconciliation (COA)",
    populationNote: "COA: 66+ | TRC: 18+ | Reconciliation on discharge date through 30 days after discharge",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "1159F", description: "Medication List documented in medical record (COA)", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "1160F", description: "Review of medication by a prescribing practitioner or clinical pharmacist", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "G8427", description: "MIPS — Medical Documentation Attestation (medication reconciliation)", status: "IN OFFICE", note: "Medication reconciliation attestation" },
          { code: "1111F", description: "Medication Reconciliation after hospital discharge", dx: "Z00.00", status: "IN OFFICE", note: "TRC measure; POS 11" },
          { code: "1110F", description: "Patient discharged from inpatient facility in past 60 days", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "functional-status",
    title: "Functional Status",
    populationNote: "COA: 66+ (at least 5 components)",
    groups: [
      {
        type: "checklist",
        items: [{ code: "1170F", description: "Functional Status Assessment (COA) (RA); assess ADLs, mobility, and gait in office", dx: "COA / RA", status: "IN OFFICE", note: "Visual gait assessment performed in-office" }],
      },
    ],
  },
  {
    key: "fall-risk",
    title: "Fall Risk Assessment",
    populationNote: "FRM: 65+",
    groups: [
      {
        type: "checklist",
        items: [{ code: "3288F", description: "Fall Risk Assessment Documented", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" }],
      },
      {
        type: "single-select",
        label: "Fall history",
        items: [
          { code: "1101F", description: "Future Fall Risk — No Falls in Past Year / Only One Fall Without Injury", dx: "FALL DX", status: "IN OFFICE", note: "POS 11" },
          { code: "1100F", description: "Future Fall Risk — 2 or More Falls in Past Year", dx: "FALL DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [
          { code: "1150F", description: "Substantial Risk of Death Within Year", dx: "FALL DX", status: "IN OFFICE", note: "POS 11" },
          { code: "0518F", description: "MIPS — Falls Plan of Care Documented", dx: "FALL DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "urinary-incontinence",
    title: "Urinary Incontinence",
    populationNote: "MUI: 65+",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "1090F", description: "Presence or Absence of Urinary Incontinence Assessed", dx: "R32 OR Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "1091F", description: "Urinary Incontinence Characterized (frequency, volume, timing, type, how bothersome)", dx: "R32", status: "IN OFFICE", note: "POS 11" },
          { code: "0509F", description: "Urinary Incontinence Plan of Care Documented", dx: "R32", status: "IN OFFICE", note: "POS 11" },
          { code: "99497-33", description: "ACP: explanation & discussion of advance directives such as standard forms (completion when performed); first 30 min F2F", dx: "Z00.00", status: "IN OFFICE", note: "Mod -33 w/ same-day AWV waives deductible; doc time" },
        ],
      },
    ],
  },
  {
    key: "dementia",
    title: "Dementia",
    populationNote: "MIPS frailty + dementia medication quality code — Ages 66+",
    groups: [
      {
        type: "checklist",
        items: [{ code: "G2106", description: "MIPS — Patients 66+ with at least one claim/encounter for frailty during the measurement period AND a dispensed medication for dementia during the measurement period or the year prior", status: "IN OFFICE" }],
      },
    ],
  },
  {
    key: "mdd-screening",
    title: "Major Depression Disorder (MDD) Screening",
    populationNote: "Annual screening with PHQ-2 / PHQ-9",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "G0444", description: "Annual Depression Screening (PHQ-2/PHQ-9 administered)", dx: "Z13.31", status: "IN OFFICE", note: "Bundled into G0438 & G0402 — NOT separately payable; bill separately only with G0439" },
          { code: "3725F", description: "Screening for Depression Performed", dx: "Z13.31", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "single-select",
        label: "Screening result",
        items: [
          { code: "3351F", description: "Negative Screening for Depressive Symptoms", dx: "Z13.31", status: "IN OFFICE", note: "POS 11" },
          { code: "G8511", description: "MIPS — Depression Screening Positive; Follow-up Plan Not Documented", dx: "Z13.31", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [{ code: "G8510", description: "MIPS — Screening Documented as Negative; Follow-up Plan Not Required", status: "IN OFFICE", note: "POS 11" }],
      },
      {
        type: "single-select",
        label: "MDD status",
        items: [
          { code: "3092F", description: "MDD In Remission", dx: "F32.5", status: "IN OFFICE", note: "POS 11" },
          { code: "3093F", description: "New Dx of Initial or Recurrent Episode", dx: "DEPRES DX", status: "IN OFFICE", note: "POS 11" },
          { code: "3091F", description: "Major Depressive Disorder, Severe With Psychotic Feature", dx: "F32.3", status: "IN OFFICE", note: "POS 11" },
          { code: "3090F", description: "MDD Severe Without Psychosis", dx: "F32.3", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [
          { code: "4065F", description: "Antipsychotic Pharmacotherapy Prescribed", dx: "DEPRES DX", status: "IN OFFICE", note: "e-Rx" },
          { code: "1040F", description: "MDD Initial Evaluation", dx: "F32.9", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "single-select",
        label: "Severity (mild/moderate scale)",
        items: [
          { code: "3088F", description: "MDD Minimal or Mild", dx: "F32.0", status: "IN OFFICE", note: "POS 11" },
          { code: "3089F", description: "MDD Moderate", dx: "F32.1", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "single-select",
        label: "Symptom severity (alternate scale)",
        items: [
          { code: "3352F", description: "No Significant Depressive Symptoms", dx: "F32.1", status: "IN OFFICE", note: "POS 11" },
          { code: "3353F", description: "Mild to Moderate Depressive Symptoms", dx: "F32.9", status: "IN OFFICE", note: "POS 11" },
          { code: "3354F", description: "Clinically Significant Depressive Symptoms", dx: "DEPRESS DX", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "single-select",
        label: "Antidepressant decision",
        items: [
          { code: "4063F", description: "Antidepressant Pharmacotherapy NOT Prescribed", dx: "Z13.31", status: "IN OFFICE", note: "POS 11" },
          { code: "4064F", description: "Antidepressant Pharmacotherapy Prescribed", dx: "DEPRESS DX", status: "IN OFFICE", note: "e-Rx" },
        ],
      },
    ],
  },
  {
    key: "tobacco",
    title: "Tobacco Use Screening & Cessation Intervention",
    populationNote: "Ages 12+ — MSC (retired MY 2026) replaced by new ECDS measure",
    sectionNote: "The old Medical Assistance With Smoking & Tobacco Use Cessation (MSC) measure is retired for MY 2026, replaced by this ECDS measure. Counseling codes 99406/99407 remain valid CMS billing codes.",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "99406", description: "Smoking/Tobacco Cessation Counseling — Intermediate, >3 min up to 10 min", status: "IN OFFICE", note: "Document start and end time" },
          { code: "99407", description: "Smoking/Tobacco Cessation Counseling — Intensive, >10 min", status: "IN OFFICE", note: "Document start and end time" },
        ],
      },
      {
        type: "single-select",
        label: "Tobacco status",
        items: [
          { code: "1036F", description: "Current Tobacco Non-User", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "1034F", description: "Current Tobacco Smoker", dx: "Z72.0", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [{ code: "G9906", description: "MIPS — Tobacco User Received Cessation Intervention During Measurement Period or 6 Months Prior", status: "IN OFFICE", note: "POS 11" }],
      },
      {
        type: "single-select",
        label: "Secondhand smoke exposure (asthma patients)",
        items: [
          { code: "1033F", description: "Non-Smoker and Not Currently Exposed to Secondhand Smoke (Asthma)", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "1032F", description: "Current Tobacco Smoker or Currently Exposed to Secondhand Smoke (Asthma)", dx: "Z72.0", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [
          { code: "1000F", description: "Tobacco Use Assessed", dx: "Z00.00", status: "IN OFFICE", note: "POS 11" },
          { code: "4000F", description: "Tobacco Use Cessation Intervention — Counseling", dx: "Z72.0", status: "IN OFFICE", note: "POS 11" },
          { code: "4004F", description: "Smoker — Screened for Tobacco Use / Intervention", dx: "Z72.0", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "diabetic-foot",
    title: "Diabetic Foot Exams",
    populationNote: "EED/KED: 18–75 — MIPS foot / neuro exam codes included",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "G9226", description: "Foot examination performed (visual inspection, sensory exam with 10-g monofilament plus any one of: 128-Hz tuning fork, pinprick sensation, ankle reflexes, or vibration perception threshold, and pulse exam; report when all 3 components completed)", status: "IN OFFICE", note: "Perform in office; POS 11" },
          { code: "2028F", description: "Foot Exam Performed (visual inspection, monofilament, pulse — any of 3 components)", status: "IN OFFICE", note: "Perform in office; POS 11" },
          { code: "G8404", description: "MIPS — Lower extremity neurological exam performed and documented", status: "IN OFFICE", note: "POS 11" },
          { code: "4305F", description: "Patient Education Regarding Foot Care and Daily Inspection of Feet Received", status: "IN OFFICE", note: "Education delivered in office" },
        ],
      },
    ],
  },
  {
    key: "retinopathy",
    title: "Retinopathy / Glaucoma Examination Results",
    populationNote: "Specialist referral — after study, wait for report before reporting to CMS/NCQA",
    groups: [
      {
        type: "single-select",
        label: "Exam result",
        items: [
          { code: "2022F", description: "Dilated Retinal Eye Exam With Interpretation by Ophthalmologist/Optometrist — WITH Evidence of Retinopathy (DM)", dx: "Z13.5", status: "DOC ONLY", note: "After study — wait for specialist report before reporting to CMS/NCQA" },
          { code: "2023F", description: "Dilated Retinal Eye Exam With Interpretation by Ophthalmologist/Optometrist — WITHOUT Evidence of Retinopathy", dx: "Z13.5", status: "DOC ONLY", note: "After study — wait for specialist report before reporting to CMS/NCQA" },
        ],
      },
    ],
  },
  {
    key: "alcohol-screening",
    title: "Unhealthy Alcohol Screening (ASF-E / CMS)",
    populationNote: "ASF-E: 18+",
    groups: [
      {
        type: "checklist",
        items: [{ code: "G0442", description: "Annual alcohol misuse screening, 5-15 min (CMS). Screens for risky/hazardous drinking in primary care.", dx: "Z13.89", status: "IN OFFICE", note: "Medicare preventive annual screen; document time" }],
      },
      {
        type: "single-select",
        label: "Screening result",
        items: [
          { code: "G9621", description: "MIPS — Unhealthy alcohol user when screened; received brief counseling (ASF-E numerator)", status: "IN OFFICE", note: "Document time start/end for counseling" },
          { code: "G9622", description: "MIPS — NOT identified as unhealthy alcohol user when screened (ASF-E numerator)", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "glycemic-status",
    title: "Glycemic Status",
    populationNote: "GSD: 18–75",
    groups: [
      {
        type: "single-select",
        label: "HbA1c level",
        items: [
          { code: "3044F", description: "HbA1c Level < 7% (DM)", dx: "PRE-DIAB OR DM DX", status: "DOC ONLY", note: "Document prior lab result" },
          { code: "3051F", description: "HbA1c Level >= 7% and < 8% (DM)", dx: "DM DX", status: "DOC ONLY", note: "Document prior lab result" },
          { code: "3052F", description: "HbA1c Level 8%–9%", dx: "DM DX", status: "DOC ONLY", note: "Document prior lab result" },
          { code: "3046F / M1211", description: "HbA1c Level > 9% — MIPS: M1211", dx: "DM DX", status: "DOC ONLY", note: "Document prior lab result" },
        ],
      },
      {
        type: "checklist",
        items: [{ code: "M1212", description: "MIPS — Glycemic Status Assessment (HbA1c or GMI) Missing or Not Performed During Measurement Period", status: "IN OFFICE", note: "Order lab during visit" }],
      },
    ],
  },
  {
    key: "ldl",
    title: "LDL Screening — IVD & Diabetes Chol & CVD (After Study)",
    populationNote: "After study, wait for report before reporting to CMS/NCQA",
    groups: [
      {
        type: "single-select",
        label: "LDL result",
        items: [
          { code: "3048F", description: "LDL Lab Screening < 100", dx: "Z13.220", status: "DOC ONLY", note: "After study — wait for report; document prior lab result" },
          { code: "3049F", description: "LDL Lab Screening 100–129", dx: "Z13.220", status: "DOC ONLY", note: "After study — wait for report; document prior lab result" },
          { code: "3050F", description: "LDL Lab Screening > 129", dx: "Z13.220", status: "DOC ONLY", note: "After study — wait for report; document prior lab result" },
        ],
      },
    ],
  },
  {
    key: "nephropathy",
    title: "Nephropathy — Urine Microalbumin (After Study)",
    populationNote: "After study, wait for report before reporting to CMS/NCQA",
    groups: [
      {
        type: "single-select",
        label: "Microalbuminuria result",
        items: [
          { code: "3060F", description: "Positive Microalbuminuria Test >= 300", dx: "Z13.228", status: "DOC ONLY", note: "After study — wait for report; document prior lab result" },
          { code: "3061F", description: "Negative Microalbuminuria Test < 30", dx: "Z13.228", status: "DOC ONLY", note: "After study — wait for report; document prior lab result" },
          { code: "3062F", description: "Positive Microalbuminuria Test & Confirmation with Lab Results 30–300+ (DX by provider)", dx: "DX BY DOC", status: "DOC ONLY", note: "After study — wait for report; document prior lab result" },
        ],
      },
    ],
  },
  {
    key: "colorectal",
    title: "Colorectal Screening (After Study)",
    populationNote: "COL-E: 45–75",
    groups: [
      {
        type: "checklist",
        items: [{ code: "3017F", description: "Colorectal cancer screening results documented and reviewed — colonoscopy every 10 years; FOBT or FIT annually; stool DNA every 3 years; high-risk: colonoscopy every 2 years", dx: "Z12.11", status: "DOC ONLY", note: "Document prior result; FIT kit can be provided in office" }],
      },
    ],
  },
  {
    key: "asthma-followup",
    title: "Asthma Follow-Up",
    populationNote: "AMR: 5–64 (retired MY 2026) → AAF-E: 5–64",
    sectionNote: "The Asthma Medication Ratio (AMR) measure is retired for MY 2026. Replacement measure is Follow-Up After Acute & Urgent Care Visits for Asthma (AAF-E), ages 5–64. These codes are retained for in-office documentation only — the AMR HEDIS reporting label no longer applies.",
    groups: [
      {
        type: "single-select",
        label: "Asthma classification",
        items: [
          { code: "1038F", description: "Persistent (Mild, Moderate or Severe)", dx: "J45.x", status: "IN OFFICE", note: "AMR HEDIS validation via ED/UC asthma event to documentation only; use AAF-E follow-up logic" },
          { code: "1039F", description: "Intermittent", dx: "J45.2x", status: "IN OFFICE", note: "Documentation only (AMR retired)" },
        ],
      },
      {
        type: "checklist",
        items: [
          { code: "4015F", description: "Persistent — Long-Term Control Medication", dx: "J45.x", status: "IN OFFICE", note: "e-Rx; documentation only" },
          { code: "4140F", description: "Inhaled Corticosteroid Prescribed", dx: "J45.x", status: "IN OFFICE", note: "e-Rx; documentation only" },
          { code: "4144F", description: "Asthma Long-Term Control Medication", dx: "J45.x", status: "IN OFFICE", note: "e-Rx; documentation only" },
        ],
      },
    ],
  },
  {
    key: "osteoporosis",
    title: "Osteoporosis",
    populationNote: "OMW: Women 67–85 | OSW: Women 65–75",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "4005F", description: "Osteoporosis — Pharmacologic Therapy", dx: "M81.0", status: "IN OFFICE", note: "e-Rx; POS 11" },
          { code: "5015F", description: "Osteoporosis — Fracture Occurred", dx: "M80.00XA", status: "IN OFFICE", note: "POS 11" },
        ],
      },
    ],
  },
  {
    key: "osteoarthritis",
    title: "Osteoarthritis (OA)",
    populationNote: "Anti-inflammatory / analgesic management",
    groups: [
      {
        type: "checklist",
        items: [{ code: "4016F", description: "Anti-inflammatory/analgesic agent prescribed (OA) — incl. OTC", status: "IN OFFICE", note: "e-Rx; POS 11" }],
      },
    ],
  },
  {
    key: "rheumatoid-arthritis",
    title: "Rheumatoid Arthritis (RA)",
    populationNote: "DMARD therapy management",
    groups: [
      {
        type: "checklist",
        items: [{ code: "4187F", description: "Disease Modifying Anti-Rheumatic Drug (DMARD) Therapy Prescribed or Dispensed (RA)", dx: "RA", status: "IN OFFICE", note: "e-Rx; POS 11" }],
      },
    ],
  },
  {
    key: "copd",
    title: "COPD",
    populationNote: "PCE: 40+",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "3023F", description: "Spirometry results documented and reviewed (COPD)", dx: "J44.9", status: "DOC ONLY", note: "Document prior result" },
          { code: "(No code)", description: "Systemic corticosteroids after a hospital discharge or ED visit for a COPD exacerbation", dx: "J44.1", status: "IN OFFICE", note: "e-Rx; POS 11" },
        ],
      },
    ],
  },
  {
    key: "antibiotics-uri",
    title: "Antibiotics for URI (J06.9) or Pharyngitis (J02.9)",
    populationNote: "CWP: 3+ | URI: 3 mo+",
    groups: [
      {
        type: "single-select",
        label: "Prescribing decision",
        items: [
          { code: "4120F", description: "Antibiotic Prescribed or Dispensed", dx: "J06.9 / J02.9", status: "IN OFFICE", note: "e-Rx; POS 11" },
          { code: "4124F", description: "Neither Antibiotics Prescribed nor Dispensed", dx: "J06.9 / J02.9", status: "IN OFFICE", note: "POS 11" },
        ],
      },
      {
        type: "checklist",
        items: [{ code: "3210F", description: "Group A Strep Test Performed (PHAR)", dx: "J02.9", status: "IN OFFICE", note: "Specimen collected in office" }],
      },
    ],
  },
  {
    key: "immunizations",
    title: "Immunizations",
    populationNote: "AIS-E: 19+ — Administration in office. Use \"after study\" codes for prior admin in record/registry (CAIR / state IIS)",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "1030F", description: "Influenza Assessment", dx: "Z23", status: "IN OFFICE", note: "POS 11" },
          { code: "4037F", description: "Flu Vaccine Given", dx: "Z23", status: "IN OFFICE", note: "Administered in office (or document prior administration)" },
          { code: "4274F", description: "Influenza immunization administered or previously received", dx: "Z23", status: "DOC ONLY", note: "Document prior administration" },
          { code: "1022F", description: "Pneumococcus immunization status assessed", dx: "Z23", status: "IN OFFICE", note: "POS 11" },
          { code: "4040F", description: "Pneumococcal Vaccine Given", dx: "Z23", status: "IN OFFICE", note: "Administered in office (or document prior administration)" },
        ],
      },
    ],
  },
  {
    key: "dxa",
    title: "DXA Bone Density",
    populationNote: "OSW: Women 65–75",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "3096F", description: "DEXA Screening Ordered every 2 years", dx: "Z13.820", status: "IN OFFICE", note: "Order during visit; POS 11" },
          { code: "3095F", description: "DEXA Results Documented", dx: "Z13.820 or result", status: "DOC ONLY", note: "Document prior result (after study)" },
        ],
      },
    ],
  },
  {
    key: "mammogram",
    title: "Breast Cancer Mammogram Assessment",
    populationNote: "BCS-E: 50–74",
    groups: [
      {
        type: "checklist",
        items: [{ code: "3014F", description: "Mammography Screening Results Documented and Reviewed", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result; order during visit" }],
      },
      {
        type: "single-select",
        label: "Assessment result",
        items: [
          { code: "3341F", description: "Assessment Negative", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result" },
          { code: "3340F", description: "Assessment Incomplete — Need Additional Imaging", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result" },
          { code: "3342F", description: "Assessment Benign", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result" },
          { code: "3343F", description: "Assessment Probably Benign", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result" },
          { code: "3344F", description: "Assessment Suspicious", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result" },
          { code: "3345F", description: "Assessment Highly Suggests Malignancy", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result" },
          { code: "3350F", description: "Assessment Known Biopsy-Proven Malignancy", dx: "Z12.31", status: "DOC ONLY", note: "Document prior result" },
        ],
      },
    ],
  },
  {
    key: "cervical-cancer",
    title: "Cervical Cancer Screening",
    populationNote: "CCS-E: 21–64",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "3015F", description: "Cervical Cancer Screening Results Documented and Reviewed", dx: "Z12.4", status: "DOC ONLY", note: "Medicare Part B covers Pap + pelvic every 24 months, ages 21–64 unless high risk; document prior result" },
          { code: "Q0091", description: "Screening Pap smear; obtaining, preparing & conveyance to lab (Medicare)", dx: "Z12.4", status: "IN OFFICE", note: "Screening collection performed in office" },
        ],
      },
    ],
  },
  {
    key: "in-office-procedures",
    title: "In-Office Procedures & Labs",
    populationNote: "All procedures below are performed in the office (POS 11)",
    groups: [
      {
        type: "checklist",
        items: [
          { code: "93005", description: "EKG Done in Office", dx: "HTN-CARD", status: "IN OFFICE", note: "Performed in office" },
          { code: "51798", description: "Bladder Scan Done in Office", dx: "R35.0", status: "IN OFFICE", note: "Performed in office" },
          { code: "76705", description: "Aorta Ultrasound Done in Office", dx: "HTN-CARD", status: "IN OFFICE", note: "Performed in office" },
          { code: "83036-QW", description: "A1C Lab In-House Done in Office", dx: "DM DX", status: "IN OFFICE", note: "In-office CLIA lab" },
          { code: "82947-QW", description: "Finger Stick / Glucose Done in Office (CLIA)", dx: "DM DX", status: "IN OFFICE", note: "In-office CLIA — do NOT also bill 36415" },
          { code: "36415", description: "Venipuncture (routine blood draw) — Commercial ins. ONLY when blood sample is sent to an outside lab (Quest/LabCorp). Do NOT bill for in-office CLIA labs.", status: "IN OFFICE", note: "Outside-lab send-out only. NOT for in-office CLIA-certified laboratory work." },
          { code: "81000", description: "Urine Dipstick Done in Office", status: "IN OFFICE", note: "Performed in office" },
          { code: "81003-QW", description: "Urine automated Done in Office", status: "IN OFFICE", note: "Performed in office" },
          { code: "93922", description: "ABI Ankle-Brachial Index single-level PAD assessment Done in Office", status: "IN OFFICE", note: "Performed in office" },
        ],
      },
    ],
  },
];
