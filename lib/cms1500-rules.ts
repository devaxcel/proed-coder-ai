/**
 * CMS-1500 (02/12) claim validation engine — pure TypeScript, no I/O.
 *
 * Validates a claim entered in CMS-1500 box layout against a PAYER RULE
 * PROFILE. Database-backed facts (ICD-10 exists/billable, HCPCS
 * discontinued, MUE) are passed in via `lookups` by the API route so this
 * file stays testable and dependency-free.
 *
 * IMPORTANT SCOPE NOTES
 *  - CPT descriptors/validity are NOT checked (AMA license) — CPT codes get
 *    FORMAT checks only. HCPCS Level II codes are checked against the DB.
 *  - Payer profiles below are sensible built-in DEFAULTS (public rules such
 *    as Medicare's 12-month filing limit). Payer-specific values (timely
 *    filing, prior-auth, etc.) vary by contract/plan — they are overridable
 *    per run via `overrides`, and should be replaced with the payer's own
 *    rule sheet where ProEd has one.
 *  - This is a pre-submission screening aid, not a guarantee of payment.
 */

export type Severity = "error" | "warning" | "info";

export type Issue = {
  severity: Severity;
  box: string; // e.g. "1a", "21", "24D (line 2)"
  code: string; // stable rule id, e.g. "TIMELY_FILING"
  message: string;
  fix?: string;
};

export type ServiceLine = {
  dosFrom: string; // YYYY-MM-DD  (24A from)
  dosTo: string; // YYYY-MM-DD  (24A to)
  pos: string; // 24B
  emg: boolean; // 24C
  procedure: string; // 24D CPT/HCPCS
  modifiers: string[]; // 24D up to 4
  dxPointers: string; // 24E letters, e.g. "AB"
  charges: number; // 24F
  units: number; // 24G
  renderingNpi: string; // 24J
};

export type Cms1500 = {
  payerId: PayerId;
  box1: "MEDICARE" | "MEDICAID" | "TRICARE" | "CHAMPVA" | "GROUP" | "FECA" | "OTHER";
  box1a: string; // insured's ID
  box2: string; // patient name "LAST, FIRST MI"
  box3Dob: string; // YYYY-MM-DD
  box3Sex: "M" | "F" | "X" | "";
  box4: string; // insured's name
  box5Address: string;
  box5City: string;
  box5State: string;
  box5Zip: string;
  box6: "SELF" | "SPOUSE" | "CHILD" | "OTHER" | "";
  box10a: boolean; // employment related
  box10b: boolean; // auto accident
  box10bState: string;
  box10c: boolean; // other accident
  box11: string; // insured policy/group/FECA number ("NONE" allowed)
  box11d: boolean; // another health benefit plan?
  box12SignedOnFile: boolean;
  box13SignedOnFile: boolean;
  box14Date: string; // onset / injury date
  box17Qualifier: "" | "DN" | "DK" | "DQ";
  box17Name: string;
  box17bNpi: string;
  box21: string[]; // diagnosis codes A..L (max 12)
  box21Icd: "0" | "9" | "";
  box22Code: string; // resubmission code
  box22OrigRef: string;
  box23: string; // prior authorization number
  lines: ServiceLine[];
  box25: string; // federal tax ID
  box25Type: "EIN" | "SSN";
  box26: string; // patient account no.
  box27AcceptAssignment: boolean;
  box28: number; // total charge
  box29: number; // amount paid
  box31SignedDate: string;
  box32Name: string;
  box32Npi: string;
  box33Name: string;
  box33Npi: string;
};

export type PayerId = "medicare-b" | "medi-cal" | "medicaid-other" | "ma-commercial";

export type PayerProfile = {
  id: PayerId;
  name: string;
  expectedBox1: Cms1500["box1"][];
  timelyFilingDays: number;
  timelyFilingNote: string;
  /** From the end of the month of service rather than the DOS itself? */
  filingFromMonthEnd: boolean;
  insuredIdCheck: (id: string) => string | null; // null = ok, else message
  requireAcceptAssignment: boolean;
  requirePriorAuthNote: string | null;
  notes: string[];
};

export type RuleOverrides = Partial<{
  timelyFilingDays: number;
}>;

export type CodeLookups = {
  icd10?: Record<string, { exists: boolean; billable: boolean; description?: string }>;
  hcpcs?: Record<
    string,
    {
      exists: boolean;
      description?: string;
      discontinued?: { termDate: string | null; quarter: string } | null;
      mue?: number | null;
    }
  >;
  /** ICD-10 "with" convention pairs found among the dx codes */
  withConventionFlags?: { title: string; guidance: string }[];
};

// ---------------------------------------------------------------------------
// Payer profiles
// ---------------------------------------------------------------------------

const MBI_RE = /^[1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y]{2}[0-9]{2}$/;

export const PAYER_PROFILES: Record<PayerId, PayerProfile> = {
  "medicare-b": {
    id: "medicare-b",
    name: "Medicare Part B (Original Medicare / MAC)",
    expectedBox1: ["MEDICARE"],
    timelyFilingDays: 365,
    timelyFilingNote: "Medicare: claims must be filed within 12 months (1 calendar year) of the date of service.",
    filingFromMonthEnd: false,
    insuredIdCheck: (id) =>
      MBI_RE.test(id.replace(/-/g, "").toUpperCase())
        ? null
        : "Medicare ID must be an 11-character MBI (no dashes; letters S, L, O, I, B, Z are never used).",
    requireAcceptAssignment: false,
    requirePriorAuthNote: null,
    notes: [
      "Box 11 should be 'NONE' when no Medicare Secondary Payer (MSP) coverage exists.",
      "Box 17 referring/ordering provider is required for ordered services (e.g., labs, imaging, DME).",
    ],
  },
  "medi-cal": {
    id: "medi-cal",
    name: "Medi-Cal (California Medicaid)",
    expectedBox1: ["MEDICAID"],
    timelyFilingDays: 180,
    timelyFilingNote: "Medi-Cal: generally 6 months following the month of service (exceptions via Claims Inquiry Form / delay reason codes).",
    filingFromMonthEnd: true,
    insuredIdCheck: (id) => {
      const v = id.replace(/\s/g, "").toUpperCase();
      if (/^[0-9]{8}[A-Z]$/.test(v)) return null; // 9-char CIN
      if (/^[A-Z0-9]{14}$/.test(v)) return null; // 14-char BIC
      return "Medi-Cal ID should be a 9-character CIN (8 digits + letter) or a 14-character BIC.";
    },
    requireAcceptAssignment: true,
    requirePriorAuthNote: "Medi-Cal TAR/authorization may be required for some services — verify in the Medi-Cal provider manual.",
    notes: [
      "Medi-Cal is the payer of last resort — report any other health coverage in Boxes 9/11d.",
    ],
  },
  "medicaid-other": {
    id: "medicaid-other",
    name: "Other State Medicaid",
    expectedBox1: ["MEDICAID"],
    timelyFilingDays: 365,
    timelyFilingNote: "State Medicaid filing limits vary (commonly 90 days to 12 months). Default is 365 days — override for the specific state.",
    filingFromMonthEnd: false,
    insuredIdCheck: (id) => (id.trim().length >= 6 ? null : "Medicaid ID looks too short (state formats vary)."),
    requireAcceptAssignment: true,
    requirePriorAuthNote: null,
    notes: ["State Medicaid rules vary — set the timely-filing override to the state's limit."],
  },
  "ma-commercial": {
    id: "ma-commercial",
    name: "Medicare Advantage / Commercial / Other",
    expectedBox1: ["GROUP", "MEDICARE", "OTHER", "TRICARE", "CHAMPVA", "FECA"],
    timelyFilingDays: 90,
    timelyFilingNote: "Commercial/MA timely filing is contract-specific (commonly 90–180 days). Default is 90 days — override per contract.",
    filingFromMonthEnd: false,
    insuredIdCheck: (id) => (/^[A-Za-z0-9\-]{5,}$/.test(id) ? null : "Member ID looks invalid (expect 5+ letters/digits)."),
    requireAcceptAssignment: false,
    requirePriorAuthNote: "Check the plan for prior authorization / referral requirements and enter the number in Box 23.",
    notes: ["For MA plans the member ID is the plan's ID on the card, not the MBI, unless the plan uses MBI."],
  },
};

// POS codes (CMS place of service code set) — widely used subset + full valid list
const VALID_POS = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "20", "21", "22", "23", "24", "25", "26", "27", "31", "32", "33", "34", "41", "42", "49", "50", "51", "52", "53",
  "54", "55", "56", "57", "58", "60", "61", "62", "65", "71", "72", "81", "99",
]);
const FACILITY_POS = new Set(["19", "21", "22", "23", "24", "26", "31", "34", "41", "42", "51", "52", "53", "56", "61"]);
const TELEHEALTH_POS = new Set(["02", "10"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isValidNpi(npi: string): boolean {
  if (!/^[0-9]{10}$/.test(npi)) return false;
  // Luhn with the 80840 prefix
  const digits = ("80840" + npi).split("").map(Number);
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

const DAY = 86400000;
const ICD10_RE = /^[A-TV-Z][0-9][0-9AB](\.[0-9A-TV-Z]{1,4})?$/;
const CPT_RE = /^[0-9]{4}[0-9FTU]$/;
const HCPCS_RE = /^[A-V][0-9]{4}$/;

export function normDx(c: string): string {
  const v = c.trim().toUpperCase().replace(/\s/g, "");
  return v.length > 3 && !v.includes(".") ? v.slice(0, 3) + "." + v.slice(3) : v;
}

const isEM = (p: string) => /^99\d{3}$/.test(p) && Number(p) >= 99202 && Number(p) <= 99499;
const isMinorProcedure = (p: string) => /^\d{5}$/.test(p) && Number(p) >= 10004 && Number(p) <= 69999;

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validateClaim(
  claim: Cms1500,
  opts: { today?: Date; overrides?: RuleOverrides; lookups?: CodeLookups } = {}
): { issues: Issue[]; payer: PayerProfile; effective: { timelyFilingDays: number }; summary: { errors: number; warnings: number; info: number } } {
  const payer = PAYER_PROFILES[claim.payerId] ?? PAYER_PROFILES["ma-commercial"];
  const today = opts.today ?? new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const timelyDays = opts.overrides?.timelyFilingDays ?? payer.timelyFilingDays;
  const lookups = opts.lookups ?? {};
  const issues: Issue[] = [];
  const add = (severity: Severity, box: string, code: string, message: string, fix?: string) =>
    issues.push({ severity, box, code, message, fix });

  // ---- Box 1 / 1a ---------------------------------------------------------
  if (!claim.box1) add("error", "1", "COVERAGE_MISSING", "Type of coverage (Box 1) is not selected.");
  else if (!payer.expectedBox1.includes(claim.box1))
    add("warning", "1", "COVERAGE_MISMATCH", `Box 1 is ${claim.box1}, but ${payer.name} normally uses ${payer.expectedBox1.join(" / ")}.`, "Confirm the coverage type matches the payer selected.");

  if (!claim.box1a.trim()) add("error", "1a", "INSURED_ID_MISSING", "Insured's ID number (Box 1a) is required.");
  else {
    const msg = payer.insuredIdCheck(claim.box1a.trim());
    if (msg) add("error", "1a", "INSURED_ID_FORMAT", msg);
  }

  // ---- Box 2 / 3 ----------------------------------------------------------
  if (!claim.box2.trim()) add("error", "2", "PATIENT_NAME_MISSING", "Patient name (Box 2) is required.");
  else if (!/^[A-Za-z'\-. ]+,\s*[A-Za-z'\-. ]+$/.test(claim.box2.trim()))
    add("warning", "2", "PATIENT_NAME_FORMAT", "Patient name should be 'LAST, FIRST MI' (comma-separated, no titles).");

  const dob = parseDate(claim.box3Dob);
  if (!claim.box3Dob) add("error", "3", "DOB_MISSING", "Patient date of birth (Box 3) is required.");
  else if (!dob) add("error", "3", "DOB_INVALID", "Patient date of birth is not a valid date.");
  else if (dob > todayUtc) add("error", "3", "DOB_FUTURE", "Patient date of birth is in the future.");
  if (!claim.box3Sex) add("error", "3", "SEX_MISSING", "Patient sex (Box 3) is required.");

  // ---- Box 4 / 6 / 11 -----------------------------------------------------
  if (claim.box6 && claim.box6 !== "SELF" && !claim.box4.trim())
    add("error", "4", "INSURED_NAME_MISSING", "Insured's name (Box 4) is required when the patient is not the insured.");
  if (!claim.box6) add("warning", "6", "RELATIONSHIP_MISSING", "Patient relationship to insured (Box 6) is not selected.");

  if (!claim.box11.trim())
    add("warning", "11", "BOX11_BLANK", "Box 11 is blank.", payer.id === "medicare-b" ? "Enter NONE if there is no other insurance (MSP) coverage." : "Enter the insured's policy/group number, or NONE.");
  else if (claim.box11d && /^none$/i.test(claim.box11.trim()))
    add("warning", "11d", "OTHER_PLAN_CONFLICT", "Box 11d says another health plan exists but Box 11 is 'NONE'.", "Reconcile Box 11 / 11d and complete Boxes 9–9d for the secondary plan.");
  if (payer.id === "medi-cal" && claim.box11d)
    add("info", "11d", "MEDICAL_LAST_RESORT", "Other coverage reported — Medi-Cal is payer of last resort; the other carrier's EOB/payment must be reflected (Box 29).");

  // ---- Box 5 ---------------------------------------------------------------
  if (!claim.box5Address.trim() || !claim.box5City.trim()) add("error", "5", "ADDRESS_MISSING", "Patient address and city (Box 5) are required.");
  if (!/^[A-Za-z]{2}$/.test(claim.box5State.trim())) add("error", "5", "STATE_INVALID", "Patient state must be a 2-letter abbreviation.");
  if (!/^(\d{5}|\d{9})$/.test(claim.box5Zip.replace(/-/g, ""))) add("error", "5", "ZIP_INVALID", "Patient ZIP must be 5 or 9 digits.");

  // ---- Box 10 / 14 --------------------------------------------------------
  if (claim.box10b && !/^[A-Za-z]{2}$/.test(claim.box10bState.trim()))
    add("error", "10b", "ACCIDENT_STATE_MISSING", "Auto accident = YES requires the 2-letter state where the accident occurred (Box 10b).");
  if ((claim.box10a || claim.box10b || claim.box10c) && !claim.box14Date)
    add("warning", "14", "INJURY_DATE_MISSING", "Condition is related to employment/accident — enter the date of current illness/injury in Box 14.");
  if (claim.box14Date) {
    const od = parseDate(claim.box14Date);
    if (!od) add("error", "14", "ONSET_INVALID", "Box 14 date is not valid.");
    else if (od > todayUtc) add("error", "14", "ONSET_FUTURE", "Box 14 date is in the future.");
  }

  // ---- Box 12 / 13 / 31 ----------------------------------------------------
  if (!claim.box12SignedOnFile) add("warning", "12", "PATIENT_SIG", "Patient/authorized signature (Box 12) not marked 'Signature on File'.", "Release-of-information must be on file; enter SOF.");
  if (!claim.box13SignedOnFile && claim.box27AcceptAssignment)
    add("warning", "13", "ASSIGNMENT_SIG", "Payment authorization (Box 13) not marked signed while accepting assignment.");
  if (!claim.box31SignedDate) add("warning", "31", "PROVIDER_SIG", "Physician/supplier signature date (Box 31) is blank.");

  // ---- Box 17 ---------------------------------------------------------------
  if (claim.box17Qualifier || claim.box17Name.trim() || claim.box17bNpi.trim()) {
    if (!claim.box17Qualifier) add("error", "17", "REF_QUALIFIER", "Referring/ordering provider entered without qualifier (DN / DK / DQ).");
    if (!claim.box17Name.trim()) add("error", "17", "REF_NAME", "Referring/ordering provider name is missing.");
    if (!isValidNpi(claim.box17bNpi.trim())) add("error", "17b", "REF_NPI", "Referring/ordering provider NPI (Box 17b) is missing or fails the NPI check digit.");
  }

  // ---- Box 21 diagnoses -----------------------------------------------------
  const dx = claim.box21.map(normDx).filter(Boolean);
  if (dx.length === 0) add("error", "21", "DX_MISSING", "At least one diagnosis code is required (Box 21A).");
  if (dx.length > 12) add("error", "21", "DX_TOO_MANY", "A CMS-1500 holds a maximum of 12 diagnosis codes (A–L).");
  if (claim.box21Icd !== "0") add("error", "21", "ICD_INDICATOR", "ICD Indicator must be 0 (ICD-10-CM).", "Select ICD-10 (indicator 0).");
  const seenDx = new Set<string>();
  dx.forEach((c, i) => {
    const letter = String.fromCharCode(65 + i);
    if (!ICD10_RE.test(c)) add("error", `21${letter}`, "DX_FORMAT", `Diagnosis ${c} is not a valid ICD-10-CM code format.`);
    if (seenDx.has(c)) add("warning", `21${letter}`, "DX_DUPLICATE", `Diagnosis ${c} is listed more than once.`);
    seenDx.add(c);
    const lk = lookups.icd10?.[c];
    if (lk) {
      if (!lk.exists) add("error", `21${letter}`, "DX_NOT_FOUND", `${c} was not found in the ICD-10-CM table.`, "Verify the code and add the 4th–7th characters if required.");
      else if (!lk.billable) add("error", `21${letter}`, "DX_NOT_BILLABLE", `${c} is a non-billable header code — more specificity is required.`, "Use the most specific billable child code.");
    }
    // Plausibility
    if (claim.box3Sex === "M" && /^O[0-9]/.test(c)) add("warning", `21${letter}`, "DX_SEX_MISMATCH", `${c} is an obstetric code but patient sex is M.`);
    if (claim.box3Sex === "M" && /^(N7[0-7]|N8[0-9]|N9[0-8]|C5[1-8])/.test(c)) add("warning", `21${letter}`, "DX_SEX_MISMATCH", `${c} is a female-specific diagnosis but patient sex is M.`);
    if (claim.box3Sex === "F" && /^(C61|N4[0-3]|N4[4-9]|N50)/.test(c)) add("warning", `21${letter}`, "DX_SEX_MISMATCH", `${c} is a male-specific diagnosis but patient sex is F.`);
  });
  if (dx[0] && /^[V-Y]/.test(dx[0])) add("error", "21A", "DX_EXTERNAL_PRIMARY", "External-cause codes (V00–Y99) cannot be the first-listed diagnosis.");
  (lookups.withConventionFlags ?? []).forEach((f) =>
    add("warning", "21", "DX_WITH_CONVENTION", `${f.title}: ${f.guidance}`)
  );

  // ---- Box 22 / 23 ------------------------------------------------------------
  if (claim.box22Code) {
    if (!["1", "7", "8"].includes(claim.box22Code)) add("warning", "22", "RESUB_CODE", "Resubmission code is usually 1 (original), 7 (replacement) or 8 (void).");
    if (["7", "8"].includes(claim.box22Code) && !claim.box22OrigRef.trim())
      add("error", "22", "ORIG_REF_MISSING", "Replacement/void claims (7/8) require the payer's original reference number (ICN/DCN).");
  }
  if (payer.requirePriorAuthNote && !claim.box23.trim()) add("info", "23", "PRIOR_AUTH", payer.requirePriorAuthNote);

  // ---- Service lines (Box 24) -------------------------------------------------
  if (claim.lines.length === 0) add("error", "24", "LINES_MISSING", "At least one service line is required.");
  if (claim.lines.length > 6) add("error", "24", "LINES_TOO_MANY", "A CMS-1500 holds a maximum of 6 service lines. Split into additional claims.");

  const seenLine = new Set<string>();
  let lineTotal = 0;
  claim.lines.forEach((ln, idx) => {
    const L = `line ${idx + 1}`;
    const proc = ln.procedure.trim().toUpperCase();
    const mods = ln.modifiers.map((m) => m.trim().toUpperCase()).filter(Boolean);

    // DOS
    const from = parseDate(ln.dosFrom);
    const to = parseDate(ln.dosTo || ln.dosFrom);
    if (!from) add("error", `24A (${L})`, "DOS_INVALID", "Date of service is missing or invalid.");
    else {
      if (from > todayUtc) add("error", `24A (${L})`, "DOS_FUTURE", "Date of service is in the future.");
      if (dob && from < dob) add("error", `24A (${L})`, "DOS_BEFORE_DOB", "Date of service is before the patient's date of birth.");
      if (to && to < from) add("error", `24A (${L})`, "DOS_RANGE", "'To' date is earlier than 'From' date.");
      // Timely filing
      const basis = payer.filingFromMonthEnd && !opts.overrides?.timelyFilingDays
        ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0))
        : from;
      const age = Math.floor((todayUtc.getTime() - basis.getTime()) / DAY);
      if (age > timelyDays)
        add("error", `24A (${L})`, "TIMELY_FILING", `Past timely filing: ${age} days since ${payer.filingFromMonthEnd && !opts.overrides?.timelyFilingDays ? "end of service month" : "DOS"} (limit ${timelyDays}). ${payer.timelyFilingNote}`, "Submit with the payer's late-claim/good-cause documentation, or confirm the limit for this contract.");
      else if (age > timelyDays - 30)
        add("warning", `24A (${L})`, "TIMELY_FILING_NEAR", `Only ${timelyDays - age} day(s) left before the ${timelyDays}-day filing limit. File immediately.`);
    }

    // POS
    if (!VALID_POS.has(ln.pos.trim())) add("error", `24B (${L})`, "POS_INVALID", `Place of service '${ln.pos}' is not a valid 2-digit CMS POS code.`);

    // Procedure
    if (!proc) add("error", `24D (${L})`, "PROC_MISSING", "Procedure code is required.");
    else if (CPT_RE.test(proc)) {
      // CPT — format only
    } else if (HCPCS_RE.test(proc)) {
      const h = lookups.hcpcs?.[proc];
      if (h) {
        if (!h.exists) add("warning", `24D (${L})`, "HCPCS_NOT_FOUND", `${proc} was not found in the HCPCS table loaded in this app.`, "Verify the code against the current quarterly HCPCS file.");
        if (h.discontinued) add("error", `24D (${L})`, "HCPCS_DISCONTINUED", `${proc} was discontinued${h.discontinued.termDate ? ` (term date ${h.discontinued.termDate})` : ""} — ${h.discontinued.quarter} update.`, "Use the replacement code per the HCPCS quarterly update.");
        if (h.mue != null && ln.units > h.mue) add("error", `24G (${L})`, "MUE_EXCEEDED", `${ln.units} units exceeds the MUE of ${h.mue} for ${proc}.`, "Reduce units or document medical necessity for an MUE appeal.");
      }
    } else add("error", `24D (${L})`, "PROC_FORMAT", `'${ln.procedure}' is not a valid CPT (5 digits) or HCPCS Level II (letter + 4 digits) format.`);

    // Modifiers
    if (mods.length > 4) add("error", `24D (${L})`, "MOD_TOO_MANY", "A maximum of 4 modifiers is allowed per line.");
    mods.forEach((m) => {
      if (!/^[A-Z0-9]{2}$/.test(m)) add("error", `24D (${L})`, "MOD_FORMAT", `Modifier '${m}' must be 2 alphanumeric characters.`);
    });
    if (new Set(mods).size !== mods.length) add("error", `24D (${L})`, "MOD_DUPLICATE", "Duplicate modifiers on the same line.");
    if (mods.includes("25") && !isEM(proc)) add("warning", `24D (${L})`, "MOD25_NON_EM", "Modifier 25 is for a significant, separately identifiable E/M service — it is on a non-E/M code.");
    if (isEM(proc) && !mods.includes("25") && claim.lines.some((o, j) => j !== idx && o.dosFrom === ln.dosFrom && isMinorProcedure(o.procedure.trim())))
      add("info", `24D (${L})`, "EM_WITH_PROCEDURE", "E/M billed with a procedure on the same date — modifier 25 may be required if the E/M is separately identifiable.");
    if (mods.includes("50") && ln.units > 1) add("warning", `24G (${L})`, "MOD50_UNITS", "Modifier 50 (bilateral) is usually billed as 1 unit (payer-dependent).");
    if ((mods.includes("95") || mods.includes("GT")) && !TELEHEALTH_POS.has(ln.pos.trim()))
      add("warning", `24D (${L})`, "TELEHEALTH_POS", `Telehealth modifier ${mods.includes("95") ? "95" : "GT"} is normally paired with POS 02 or 10.`);
    if (TELEHEALTH_POS.has(ln.pos.trim()) && !mods.some((m) => ["95", "GT", "GQ", "93", "FQ"].includes(m)) && payer.id !== "medicare-b")
      add("info", `24D (${L})`, "TELEHEALTH_MOD", "POS 02/10 billed without a telehealth modifier — many payers require 95/GT/93.");

    // Diagnosis pointers
    const ptr = ln.dxPointers.trim().toUpperCase();
    if (!ptr) add("error", `24E (${L})`, "DXPTR_MISSING", "Diagnosis pointer is required for each line.");
    else {
      if (!/^[A-L]{1,4}$/.test(ptr)) add("error", `24E (${L})`, "DXPTR_FORMAT", "Diagnosis pointer must be 1–4 letters from A–L (no spaces or commas).");
      else {
        if (new Set(ptr.split("")).size !== ptr.length) add("warning", `24E (${L})`, "DXPTR_DUP", "Duplicate letters in diagnosis pointer.");
        ptr.split("").forEach((ch) => {
          if (ch.charCodeAt(0) - 65 >= dx.length) add("error", `24E (${L})`, "DXPTR_DANGLING", `Pointer '${ch}' refers to a diagnosis that is not entered in Box 21.`);
        });
      }
    }

    // Charges / units
    if (!(ln.charges > 0)) add("error", `24F (${L})`, "CHARGE_INVALID", "Charge must be greater than $0.00.");
    if (!Number.isInteger(ln.units) || ln.units < 1) add("error", `24G (${L})`, "UNITS_INVALID", "Units must be a whole number of 1 or more.");
    lineTotal += Math.round((ln.charges || 0) * 100);

    // Rendering NPI
    if (ln.renderingNpi.trim() && !isValidNpi(ln.renderingNpi.trim())) add("error", `24J (${L})`, "NPI_INVALID", "Rendering provider NPI fails the NPI check-digit test.");
    if (!ln.renderingNpi.trim() && claim.box33Npi.trim() === "") add("error", `24J (${L})`, "NPI_MISSING", "Rendering provider NPI is missing.");

    // Place-of-service sanity
    if (FACILITY_POS.has(ln.pos.trim()) && /^(99(2(1[1-5])))$/.test(proc))
      add("info", `24B (${L})`, "FACILITY_POS", "Facility POS billed with an office/outpatient E/M code (99211–99215) — verify POS or code selection.");

    // Duplicates
    const key = [ln.dosFrom, proc, mods.join(","), ln.pos].join("|");
    if (seenLine.has(key)) add("warning", `24 (${L})`, "DUPLICATE_LINE", "Duplicate service line (same DOS, code, modifiers, POS). Combine units or add a distinguishing modifier (e.g., 76/77/59/X{EPSU}).");
    seenLine.add(key);
  });

  // ---- Unreferenced dx -----------------------------------------------------
  const referenced = new Set(claim.lines.flatMap((l) => l.dxPointers.toUpperCase().split("")));
  dx.forEach((c, i) => {
    const letter = String.fromCharCode(65 + i);
    if (claim.lines.length > 0 && !referenced.has(letter)) add("warning", `21${letter}`, "DX_UNREFERENCED", `Diagnosis ${c} (${letter}) is not pointed to by any service line.`);
  });

  // ---- Box 25 / 26 / 27 / 28 / 29 -----------------------------------------------
  const tin = claim.box25.replace(/-/g, "");
  if (!/^\d{9}$/.test(tin)) add("error", "25", "TIN_INVALID", "Federal tax ID (Box 25) must be 9 digits.");
  if (!claim.box26.trim()) add("info", "26", "ACCT_BLANK", "Patient account number (Box 26) is blank — recommended for payment posting.");
  if (payer.requireAcceptAssignment && !claim.box27AcceptAssignment) add("error", "27", "ASSIGNMENT_REQUIRED", `${payer.name} requires the provider to accept assignment.`);
  if (payer.id === "medicare-b" && !claim.box27AcceptAssignment) add("warning", "27", "NONPAR_ASSIGNMENT", "Accept assignment = NO. Only valid for non-participating providers (limiting-charge rules apply).");

  const lineTotalDollars = lineTotal / 100;
  if (Math.round((claim.box28 || 0) * 100) !== lineTotal)
    add("error", "28", "TOTAL_MISMATCH", `Total charge (${(claim.box28 || 0).toFixed(2)}) does not equal the sum of line charges (${lineTotalDollars.toFixed(2)}).`, "Correct Box 28 to match the service lines.");
  if ((claim.box29 || 0) > (claim.box28 || 0)) add("error", "29", "PAID_EXCEEDS", "Amount paid (Box 29) exceeds the total charge.");
  if ((claim.box29 || 0) > 0 && !claim.box11d) add("warning", "29", "PAID_NO_OTHER_PLAN", "An amount paid is reported but Box 11d does not indicate another health plan.");

  // ---- Boxes 32 / 33 -----------------------------------------------------------
  if (!claim.box33Name.trim()) add("error", "33", "BILLING_NAME", "Billing provider name/address (Box 33) is required.");
  if (!isValidNpi(claim.box33Npi.trim())) add("error", "33a", "BILLING_NPI", "Billing provider NPI (Box 33a) is missing or fails the NPI check-digit test.");
  const facilityLine = claim.lines.some((l) => FACILITY_POS.has(l.pos.trim()));
  if (facilityLine && !claim.box32Name.trim()) add("warning", "32", "FACILITY_MISSING", "Services at a facility POS — service facility name/address (Box 32) is expected.");
  if (claim.box32Npi.trim() && !isValidNpi(claim.box32Npi.trim())) add("error", "32a", "FACILITY_NPI", "Service facility NPI (Box 32a) fails the NPI check-digit test.");

  // payer notes as info (once)
  payer.notes.forEach((n) => add("info", "—", "PAYER_NOTE", n));

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return {
    issues,
    payer,
    effective: { timelyFilingDays: timelyDays },
    summary: {
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
    },
  };
}

export function blankClaim(payerId: PayerId = "medicare-b"): Cms1500 {
  return {
    payerId,
    box1: payerId === "medi-cal" || payerId === "medicaid-other" ? "MEDICAID" : payerId === "medicare-b" ? "MEDICARE" : "GROUP",
    box1a: "", box2: "", box3Dob: "", box3Sex: "", box4: "",
    box5Address: "", box5City: "", box5State: "", box5Zip: "",
    box6: "SELF",
    box10a: false, box10b: false, box10bState: "", box10c: false,
    box11: "", box11d: false,
    box12SignedOnFile: true, box13SignedOnFile: true,
    box14Date: "",
    box17Qualifier: "", box17Name: "", box17bNpi: "",
    box21: [""], box21Icd: "0",
    box22Code: "", box22OrigRef: "", box23: "",
    lines: [blankLine()],
    box25: "", box25Type: "EIN", box26: "",
    box27AcceptAssignment: true,
    box28: 0, box29: 0, box31SignedDate: "",
    box32Name: "", box32Npi: "", box33Name: "", box33Npi: "",
  };
}

export function blankLine(): ServiceLine {
  return { dosFrom: "", dosTo: "", pos: "11", emg: false, procedure: "", modifiers: [], dxPointers: "A", charges: 0, units: 1, renderingNpi: "" };
}
