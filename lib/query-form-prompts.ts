/**
 * ProEdCS Form A — General Clinical Documentation Query
 *
 * Structured extraction prompt. The LLM reads a scenario written by a coder/CDI
 * specialist and produces a JSON object matching the fields of ProEd's
 * Form A packet. The DOCX generator then renders those fields into the exact
 * Form A layout with tables, checkboxes, and signature blocks.
 *
 * Ground rules: no leading language, cite only clinical indicators present in
 * the scenario, always include "Other" and "Unable to determine" in options.
 */

export const FORM_A_SYSTEM_PROMPT = `You are a Clinical Documentation Integrity (CDI) specialist assistant working for ProEd Consulting & Staffing. Your job is to convert a coder's free-text scenario into a compliant Form A physician query — a General Clinical Documentation Query — that follows ACDIS/AHIMA 2026 guidelines and the ProEdCS Query Forms Packet standard.

STRICT COMPLIANCE RULES (every output must satisfy these):

1. NON-LEADING LANGUAGE. Never suggest the "right" diagnosis. Present clinical indicators from the scenario and ask the provider to clarify.

2. USE ONLY INDICATORS PROVIDED. Cite only labs, medications, findings, and notes present in the scenario. NEVER invent clinical data.

3. MULTI-CHOICE FORMAT. Provide 3–4 clinically reasonable options plus:
   - "Other (please specify)"
   - "Unable to determine / Not clinically indicated"
   - "The condition was ruled out"

4. PROFESSIONAL, NON-ACCUSATORY TONE. This is a clarification request, not a challenge.

5. IDENTIFY QUERY TYPE AND IMPACT DOMAIN based on the scenario:
   Query types: diagnosis_specificity | conflict_resolution | procedure_operative | poa_indicator | em_level_mdm | modifier_support | hcc_risk_adjustment | quality_hedis | other
   Impact domains: ip_coding_drg | op_professional_coding | medical_necessity | quality_measure | risk_adjustment_hcc | denial_audit_defense | patient_safety | compliance_review

6. IF SCENARIO INDICATES INPATIENT AND A NEW DIAGNOSIS IS BEING CLARIFIED, include Present on Admission (POA) evaluation.

---

OUTPUT FORMAT — Respond with a JSON object EXACTLY like this. No markdown fences, no preamble, no trailing text:

{
  "query_id_suggestion": "<short suggested ID like 'QRY-2026-DM-001'>",
  "priority": "concurrent" | "pre_bill" | "retro" | "audit",
  "query_types": ["diagnosis_specificity", ...],
  "impact_domains": ["ip_coding_drg", "risk_adjustment_hcc", ...],
  "clinical_indicators": {
    "source_document": "<e.g. 'Progress note dated 3/15/2024'>",
    "indicators": [
      "<indicator 1 — labs/vitals/meds/exam>",
      "<indicator 2>",
      "<indicator 3>"
    ]
  },
  "clarification_question": "<one clear non-leading question, e.g. 'Based on the clinical indicators above, can you clarify the specific type and current control of the diabetes documented on this DOS?'>",
  "clinically_reasonable_options": [
    "<Option A — a clinically reasonable diagnosis with any relevant modifiers>",
    "<Option B — an alternate reasonable diagnosis>",
    "<Option C — an alternate reasonable diagnosis>",
    "<Option D — an alternate reasonable diagnosis if applicable, else empty string>"
  ],
  "poa_applicable": true | false,
  "poa_context": "<one line about why POA matters here, or empty string>",
  "reason_for_query": "<one line: why is this clarification needed?>",
  "compliance_checklist": {
    "cites_specific_indicators": true,
    "offers_multiple_options": true,
    "includes_other_and_unable_to_determine": true,
    "non_leading": true,
    "defines_reason_for_query": true
  }
}

If you cannot produce a compliant query from the scenario (insufficient clinical indicators, unclear ask), respond with the same JSON structure but with clarification_question set to "INSUFFICIENT_INFORMATION" and clinical_indicators.indicators empty.`;

export type FormAOutput = {
  query_id_suggestion: string;
  priority: "concurrent" | "pre_bill" | "retro" | "audit";
  query_types: string[];
  impact_domains: string[];
  clinical_indicators: {
    source_document: string;
    indicators: string[];
  };
  clarification_question: string;
  clinically_reasonable_options: string[];
  poa_applicable: boolean;
  poa_context: string;
  reason_for_query: string;
  compliance_checklist: {
    cites_specific_indicators: boolean;
    offers_multiple_options: boolean;
    includes_other_and_unable_to_determine: boolean;
    non_leading: boolean;
    defines_reason_for_query: boolean;
  };
};

export type QueryFormHeaderInputs = {
  patientName?: string;
  mrn?: string;
  dob?: string;
  dateOfService?: string;
  setting?: string;
  payerType?: string;
  attendingProvider?: string;
  providerNpi?: string;
  providerSpecialty?: string;
  queryAuthorName?: string;
  queryAuthorRole?: string;
  queryAuthorContact?: string;
};

/**
 * Build the user prompt that combines the scenario with reference materials
 * from RAG (AHIMA/ACDIS policy chunks) and the coder-supplied header info.
 */
export function buildFormAUserPrompt(input: {
  scenario: string;
  header: QueryFormHeaderInputs;
  referenceMaterials: Array<{ title: string; source: string; excerpt: string }>;
}): string {
  const parts: string[] = [];

  if (input.referenceMaterials.length > 0) {
    parts.push("COMPLIANCE REFERENCE MATERIALS (guide your language and structure):");
    parts.push("");
    input.referenceMaterials.forEach((ref, i) => {
      parts.push(`[${i + 1}] ${ref.source} — ${ref.title}`);
      parts.push(`    "${ref.excerpt}"`);
      parts.push("");
    });
  }

  parts.push("SCENARIO FROM CODER (documentation gap description):");
  parts.push(input.scenario.trim());
  parts.push("");

  parts.push("HEADER CONTEXT (may be blank; use if provided):");
  parts.push(`- Patient: ${input.header.patientName || "(not provided)"}`);
  parts.push(`- MRN: ${input.header.mrn || "(not provided)"}`);
  parts.push(`- DOB: ${input.header.dob || "(not provided)"}`);
  parts.push(`- Date of service: ${input.header.dateOfService || "(not provided)"}`);
  parts.push(`- Setting: ${input.header.setting || "(not provided)"}`);
  parts.push(`- Payer: ${input.header.payerType || "(not provided)"}`);
  parts.push(`- Attending / Rendering: ${input.header.attendingProvider || "(not provided)"}`);
  parts.push(`- Provider NPI: ${input.header.providerNpi || "(not provided)"}`);
  parts.push(`- Specialty: ${input.header.providerSpecialty || "(not provided)"}`);
  parts.push(`- Query author: ${input.header.queryAuthorName || "(not provided)"}`);
  parts.push(`- Author role: ${input.header.queryAuthorRole || "(not provided)"}`);
  parts.push("");

  parts.push("Now output the Form A JSON object exactly per the system prompt. Cite ONLY the indicators from the scenario. Return valid JSON with no other text.");

  return parts.join("\n");
}
