// CPT Level I (AMA) and common HCPCS Level II modifiers.
// AMA CPT-licensed content — descriptions are brief, paraphrased summaries
// of the official modifier definitions, consistent with how other
// AMA-licensed content (E/M tool) is presented elsewhere in this app.
// Not an exhaustive national modifier list — curated to the modifiers
// ProEd's coders actually use in outpatient/office-visit work.

export type Modifier = {
  code: string;
  category: "CPT Level I" | "HCPCS Level II";
  description: string;
  note?: string;
};

export const MODIFIERS: Modifier[] = [
  { code: "22", category: "CPT Level I", description: "Increased Procedural Services", note: "Work substantially greater than usual; documentation must support the increase" },
  { code: "23", category: "CPT Level I", description: "Unusual Anesthesia" },
  { code: "24", category: "CPT Level I", description: "Unrelated E/M Service by Same Physician During Postoperative Period" },
  { code: "25", category: "CPT Level I", description: "Significant, Separately Identifiable E/M Service on Same Day of Procedure", note: "Common on same-day AWV + problem-focused visit" },
  { code: "26", category: "CPT Level I", description: "Professional Component" },
  { code: "32", category: "CPT Level I", description: "Mandated Services" },
  { code: "33", category: "CPT Level I", description: "Preventive Service", note: "Waives cost-share when billed with qualifying same-day preventive/AWV services" },
  { code: "47", category: "CPT Level I", description: "Anesthesia by Surgeon" },
  { code: "50", category: "CPT Level I", description: "Bilateral Procedure" },
  { code: "51", category: "CPT Level I", description: "Multiple Procedures" },
  { code: "52", category: "CPT Level I", description: "Reduced Services" },
  { code: "53", category: "CPT Level I", description: "Discontinued Procedure" },
  { code: "54", category: "CPT Level I", description: "Surgical Care Only" },
  { code: "55", category: "CPT Level I", description: "Postoperative Management Only" },
  { code: "56", category: "CPT Level I", description: "Preoperative Management Only" },
  { code: "57", category: "CPT Level I", description: "Decision for Surgery" },
  { code: "58", category: "CPT Level I", description: "Staged or Related Procedure by Same Physician During Postoperative Period" },
  { code: "59", category: "CPT Level I", description: "Distinct Procedural Service", note: "Use only when no more specific modifier (XE/XP/XS/XU) applies" },
  { code: "62", category: "CPT Level I", description: "Two Surgeons" },
  { code: "63", category: "CPT Level I", description: "Procedure Performed on Infant Less Than 4 kg" },
  { code: "66", category: "CPT Level I", description: "Surgical Team" },
  { code: "73", category: "CPT Level I", description: "Discontinued Outpatient Procedure Before Anesthesia" },
  { code: "74", category: "CPT Level I", description: "Discontinued Outpatient Procedure After Anesthesia" },
  { code: "76", category: "CPT Level I", description: "Repeat Procedure or Service by Same Physician" },
  { code: "77", category: "CPT Level I", description: "Repeat Procedure by Another Physician" },
  { code: "78", category: "CPT Level I", description: "Unplanned Return to OR for Related Procedure During Postoperative Period" },
  { code: "79", category: "CPT Level I", description: "Unrelated Procedure by Same Physician During Postoperative Period" },
  { code: "80", category: "CPT Level I", description: "Assistant Surgeon" },
  { code: "81", category: "CPT Level I", description: "Minimum Assistant Surgeon" },
  { code: "82", category: "CPT Level I", description: "Assistant Surgeon (Qualified Resident Unavailable)" },
  { code: "90", category: "CPT Level I", description: "Reference (Outside) Laboratory" },
  { code: "91", category: "CPT Level I", description: "Repeat Clinical Diagnostic Laboratory Test" },
  { code: "92", category: "CPT Level I", description: "Alternative Laboratory Platform Testing" },
  { code: "93", category: "CPT Level I", description: "Synchronous Telemedicine Service (Audio-Only)" },
  { code: "95", category: "CPT Level I", description: "Synchronous Telemedicine Service (Audio and Video)" },
  { code: "96", category: "CPT Level I", description: "Habilitative Services" },
  { code: "97", category: "CPT Level I", description: "Rehabilitative Services" },
  { code: "99", category: "CPT Level I", description: "Multiple Modifiers" },

  { code: "LT", category: "HCPCS Level II", description: "Left Side" },
  { code: "RT", category: "HCPCS Level II", description: "Right Side" },
  { code: "GT", category: "HCPCS Level II", description: "Via Interactive Audio and Video Telecommunication System" },
  { code: "GQ", category: "HCPCS Level II", description: "Via Asynchronous Telecommunications System" },
  { code: "GA", category: "HCPCS Level II", description: "Waiver of Liability Statement Issued, as Required by Payer Policy (ABN on file)" },
  { code: "GZ", category: "HCPCS Level II", description: "Item or Service Expected to Be Denied as Not Reasonable and Necessary" },
  { code: "KX", category: "HCPCS Level II", description: "Requirements Specified in the Medical Policy Have Been Met" },
  { code: "TC", category: "HCPCS Level II", description: "Technical Component" },
  { code: "QW", category: "HCPCS Level II", description: "CLIA Waived Test", note: "Used throughout the AWV in-office lab codes (e.g. 82947-QW, 83036-QW)" },
  { code: "Q6", category: "HCPCS Level II", description: "Service Furnished by a Locum Tenens Physician" },
];
