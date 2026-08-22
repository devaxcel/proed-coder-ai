/**
 * Query Forms B–H — shared prompt engine.
 *
 * Rather than building 7 separate bespoke pipelines (like Form A), these
 * forms share one generic output schema and one DOCX renderer. Each form
 * letter gets its own system-prompt guidance appended to a common base,
 * steering the LLM to produce form-appropriate content within the same
 * structural envelope. This keeps the forms visually and structurally
 * consistent while letting each one ask the right clinical/coding question.
 */

export type FormLetter = "B" | "C" | "D" | "E" | "F" | "G" | "H";

export const FORM_META: Record<FormLetter, { title: string; purpose: string }> = {
  B: {
    title: "Provider Clarification / Dispute Request",
    purpose: "Provider responds to or disputes a coding/DRG assignment, requesting review from coding/CDI.",
  },
  C: {
    title: "Inpatient Diagnosis Specificity / CC-MCC / POA Query",
    purpose: "Coder/CDI asks the provider to clarify inpatient diagnosis specificity affecting CC/MCC capture and Present on Admission status.",
  },
  D: {
    title: "Outpatient E/M Level / MDM / Time Clarification",
    purpose: "Coder asks the provider to confirm whether an E/M level was based on time or Medical Decision Making, and to supply the supporting detail.",
  },
  E: {
    title: "Procedure / Operative / Modifier Documentation Query",
    purpose: "Coder asks the provider to clarify operative note details needed to support a procedure code or modifier.",
  },
  F: {
    title: "HCC / Risk Adjustment Chronic Condition Query",
    purpose: "Coder/CDI asks the provider to confirm current status and specificity of a chronic condition for HCC risk adjustment capture.",
  },
  G: {
    title: "Quality / HEDIS Gaps-in-Care Documentation Query",
    purpose: "Coder asks the provider to confirm whether a HEDIS-relevant service was performed or document why it was not, to close a quality measure gap.",
  },
  H: {
    title: "Audit Findings Response (Provider Rebuttal)",
    purpose: "Provider or coder responds to an auditor's finding — concurring, disputing, or partially disputing — with clinical rationale.",
  },
};

const FORM_SPECIFIC_GUIDANCE: Record<FormLetter, string> = {
  B: `This is a REVERSE-direction form: the PROVIDER is responding to or disputing a coding/DRG decision, not the other way around.
- detail_sections should cover: the original code/DRG assignment in question, the provider's clinical rationale for the dispute, and what correction (if any) is being requested.
- The "question" should ask the coding/CDI team to review and respond — not ask the provider a clinical question.
- options should be responses the CODING TEAM can select once they review (e.g., "Agree, code will be revised", "Disagree, original code stands, rationale below", "Requires further physician documentation before a decision can be made").`,
  C: `Focus specifically on inpatient diagnosis specificity that affects CC/MCC (complication/comorbidity or major complication/comorbidity) capture, AND Present on Admission (POA) status.
- detail_sections must include a section on CC/MCC impact — explain in plain terms what capturing more specificity could mean for DRG assignment, without pressuring toward a particular code.
- Always include a POA determination as part of options: "Yes — present on admission", "No — developed after admission", "Unknown / clinically undetermined", "Exempt from POA reporting".
- The core "question" should ask for the specific diagnosis detail needed (type, severity, acuity, causal relationship) plus the POA status.`,
  D: `Focus on E/M code level support — outpatient setting.
- detail_sections must clarify whether the visit level was intended as TIME-BASED or MDM-BASED, and what documentation exists for each path.
- If time-based: ask for total time spent on the date of the encounter.
- If MDM-based: ask about number/complexity of problems addressed, data reviewed, and risk of complications/management.
- options should include: "Time-based — total time was [documented amount]", "MDM-based — see problem/data/risk detail below", "Unable to determine from documentation", "Other (please specify)".`,
  E: `Focus on procedure, operative, or modifier documentation.
- detail_sections should identify the procedure/CPT-family in question (describe generically, do not invent AMA-copyrighted code descriptors) and the specific documentation gap: laterality, distinct procedural service justification, unusual circumstances, or approach (open/laparoscopic/etc).
- options should offer plausible clarifications specific to what's missing (e.g., "Bilateral procedure performed", "Left side only", "Right side only", "Distinct/separate procedure from [X], see rationale", "Unable to determine from documentation").`,
  F: `Focus on HCC / risk adjustment for a specific chronic condition, similar in spirit to MEAT criteria but framed as a query TO the provider (not a checklist for the coder).
- detail_sections should name the condition/HCC category in question and explain, in plain non-leading terms, what additional documentation would support accurate risk adjustment capture (current management, current status, any complications).
- options should offer condition-status choices: "Stable, actively managed as documented", "Improving", "Worsening / exacerbated", "Resolved / no longer active", "Unable to determine from documentation".`,
  G: `Focus on a HEDIS quality measure gap in care.
- detail_sections should name the measure in question (e.g., diabetic eye exam, blood pressure control, cancer screening — describe generically) and what evidence would close the gap.
- options should include: "Service was performed — documentation to follow", "Service was performed, results below", "Service was declined by patient", "Service is not clinically indicated, rationale below", "Unable to determine from documentation".`,
  H: `This is NOT a query to a provider — it's a REBUTTAL RESPONSE to an audit finding, written from the coder/provider's perspective back to an auditor.
- detail_sections should summarize the audit finding being addressed, and the responding party's position with clinical/coding rationale.
- The "question" field should instead be used as a one-line summary of the position taken (e.g., "Response: Partially concur — code changed for DOS 3/15, remaining findings disputed").
- options should be the possible positions: "Concur with finding", "Dispute finding — rationale below", "Partially concur — see detail below", "Request additional documentation review before response".`,
};

export function buildFormSystemPrompt(letter: FormLetter): string {
  const meta = FORM_META[letter];
  const guidance = FORM_SPECIFIC_GUIDANCE[letter];

  return `You are a Clinical Documentation Integrity (CDI) and coding compliance assistant for ProEd Consulting & Staffing, drafting Form ${letter} — ${meta.title} — from the ProEdCS Query Forms Packet.

Purpose of this form: ${meta.purpose}

FORM-SPECIFIC GUIDANCE:
${guidance}

STRICT COMPLIANCE RULES (apply regardless of form letter):
1. NON-LEADING LANGUAGE — never suggest the "correct" answer; present facts/indicators and ask for clarification or confirmation.
2. USE ONLY INFORMATION PROVIDED in the scenario — never invent clinical facts, dates, or values not given.
3. MULTI-CHOICE FORMAT where applicable — always include "Other (please specify)" and "Unable to determine from documentation" as options, unless the form type is H (rebuttal), where options represent positions instead.
4. PROFESSIONAL, NON-ACCUSATORY TONE throughout.
5. IF THE SCENARIO LACKS ENOUGH INFORMATION to draft a meaningful form, say so rather than fabricating detail.

---

OUTPUT FORMAT — Respond with a JSON object EXACTLY like this. No markdown fences, no preamble, no trailing text:

{
  "form_letter": "${letter}",
  "title": "${meta.title}",
  "query_id_suggestion": "<short suggested ID like 'QRY-2026-${letter}-001'>",
  "priority": "concurrent" | "pre_bill" | "retro" | "audit",
  "summary_line": "<one sentence describing what this form addresses>",
  "detail_sections": [
    { "heading": "<section heading>", "body": "<2-4 sentences of relevant detail, citing only what's in the scenario>" }
  ],
  "question": "<the core non-leading question or, for Form H, a one-line position summary>",
  "options": ["<option 1>", "<option 2>", "<option 3 if applicable>"],
  "reason": "<one line: why this form/query is needed>"
}

Produce 2-4 detail_sections. If the scenario doesn't support a meaningful form, set "question" to "INSUFFICIENT_INFORMATION" and explain why in detail_sections.`;
}

export function buildFormUserPrompt(input: {
  scenario: string;
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

  parts.push("SCENARIO FROM CODER:");
  parts.push(input.scenario.trim());
  parts.push("");
  parts.push("Now output the JSON object exactly per the system prompt. Return valid JSON with no other text.");

  return parts.join("\n");
}

export type FormBHOutput = {
  form_letter: FormLetter;
  title: string;
  query_id_suggestion: string;
  priority: "concurrent" | "pre_bill" | "retro" | "audit";
  summary_line: string;
  detail_sections: { heading: string; body: string }[];
  question: string;
  options: string[];
  reason: string;
};
