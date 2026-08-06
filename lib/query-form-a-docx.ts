/**
 * ProEdCS Form A — General Clinical Documentation Query
 * DOCX generator that mirrors ProEd's sample layout: metadata header, 6 sections
 * with table-based structure, checkboxes, signature blocks, compliance attestation.
 *
 * Called from app/api/query-form/export/route.ts.
 */

import type { FormAOutput, QueryFormHeaderInputs } from "./query-form-prompts";

// docx is CJS — unwrap default at call site
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let docxLib: any = null;
async function loadDocx() {
  if (docxLib) return docxLib;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("docx");
  docxLib = mod.default ?? mod;
  return docxLib;
}

const FONT = "Calibri";
// ProEdCS visual identity — sampled from proedcs.com
const BRAND_BLUE = "3B7DD8";      // ProEdCS primary blue
const BRAND_NAVY = "0A2F5C";      // ProEdCS dark navy (top bar / letterhead)
const BRAND_DARK = "1F2937";      // body text
const BRAND_GRAY = "4B5563";      // secondary text
const LIGHT_GRAY = "6B7280";      // tertiary / caption
const CARD_BG = "F5F7FB";         // subtle surface (matches ProEdCS testimonial cards)
const TABLE_HEADER_BG = "EEF4FC"; // brand-50 tint
const YELLOW_ACCENT = "EFC932";   // ProEdCS accent yellow

// Unicode ballot symbols (matches ProEd's use of ☐ and ☑)
const CHECKBOX_EMPTY = "☐";
const CHECKBOX_FILLED = "☑";

// -------- helpers --------

/* eslint-disable @typescript-eslint/no-explicit-any */
function textRun(text: string, opts: any = {}) {
  const { TextRun } = docxLib;
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 20,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? BRAND_DARK,
  });
}

function para(text: string, opts: any = {}) {
  const { Paragraph } = docxLib;
  return new Paragraph({
    children: [textRun(text, opts)],
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80 },
    alignment: opts.alignment,
  });
}

function h1(text: string) {
  const { Paragraph, HeadingLevel } = docxLib;
  return new Paragraph({
    children: [textRun(text, { size: 28, bold: true, color: BRAND_BLUE })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
  });
}

function h2(text: string) {
  const { Paragraph, HeadingLevel } = docxLib;
  return new Paragraph({
    children: [textRun(text, { size: 22, bold: true, color: BRAND_GRAY })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
  });
}

function hr() {
  const { Paragraph, BorderStyle, TextRun } = docxLib;
  return new Paragraph({
    children: [new TextRun({ text: "", font: FONT, size: 2 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 } },
    spacing: { before: 180, after: 180 },
  });
}

/**
 * Render a single-row, multi-column info strip (like the Query Header row with
 * Query ID / Date / Priority / Response Due).
 */
function infoRow(cells: Array<{ label: string; value: string; width?: number }>) {
  const { Table, TableRow, TableCell, WidthType, ShadingType, Paragraph } = docxLib;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              width: c.width
                ? { size: c.width, type: WidthType.PERCENTAGE }
                : undefined,
              shading: { type: ShadingType.CLEAR, fill: CARD_BG, color: "auto" },
              children: [
                new Paragraph({
                  children: [
                    textRun(`${c.label} `, { bold: true, size: 18, color: BRAND_GRAY }),
                    textRun(c.value, { size: 18 }),
                  ],
                  spacing: { after: 40 },
                }),
              ],
            })
        ),
      }),
    ],
  });
}

/**
 * Two-column checkbox table for "Query Type & Impact Domain" section.
 */
function twoColumnCheckboxTable(
  leftTitle: string,
  leftItems: Array<{ label: string; checked: boolean }>,
  rightTitle: string,
  rightItems: Array<{ label: string; checked: boolean }>
) {
  const { Table, TableRow, TableCell, WidthType, ShadingType, Paragraph } = docxLib;

  const renderCell = (title: string, items: Array<{ label: string; checked: boolean }>) => {
    const kids = [
      new Paragraph({
        children: [textRun(title, { bold: true, size: 20, color: BRAND_BLUE })],
        spacing: { after: 60 },
      }),
      ...items.map(
        (it) =>
          new Paragraph({
            children: [
              textRun(
                `${it.checked ? CHECKBOX_FILLED : CHECKBOX_EMPTY}  ${it.label}`,
                { size: 18 }
              ),
            ],
            spacing: { after: 30 },
          })
      ),
    ];
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: "FFFFFF", color: "auto" },
      children: kids,
    });
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [renderCell(leftTitle, leftItems), renderCell(rightTitle, rightItems)],
      }),
    ],
  });
}

/**
 * A single "content" cell in a bordered container — used for clinical
 * indicators, question/options, provider response fields.
 */
function contentBox(paragraphs: any[]) {
  const { Table, TableRow, TableCell, WidthType, ShadingType } = docxLib;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "FFFFFF", color: "auto" },
            children: paragraphs,
          }),
        ],
      }),
    ],
  });
}

function checkboxLine(label: string, checked = false, extra = "") {
  const { Paragraph } = docxLib;
  return new Paragraph({
    children: [
      textRun(`${checked ? CHECKBOX_FILLED : CHECKBOX_EMPTY}  ${label}${extra ? `: ${extra}` : ""}`, {
        size: 20,
      }),
    ],
    spacing: { after: 40 },
  });
}

function labelValueLine(label: string, value: string) {
  const { Paragraph } = docxLib;
  return new Paragraph({
    children: [
      textRun(`${label} `, { bold: true, size: 20, color: BRAND_GRAY }),
      textRun(value || "____________________", { size: 20 }),
    ],
    spacing: { after: 60 },
  });
}

// -------- Main builder --------

const QUERY_TYPE_LABELS: Record<string, string> = {
  diagnosis_specificity: "Diagnosis clarification / specificity",
  conflict_resolution: "Conflict resolution between record elements",
  procedure_operative: "Procedure / operative detail",
  poa_indicator: "POA indicator",
  em_level_mdm: "E/M level / MDM / time",
  modifier_support: "Modifier support",
  hcc_risk_adjustment: "HCC / risk adjustment",
  quality_hedis: "Quality / HEDIS / PSI / HAC",
  other: "Other",
};

const IMPACT_DOMAIN_LABELS: Record<string, string> = {
  ip_coding_drg: "Inpatient coding / MS-DRG / APR-DRG",
  op_professional_coding: "Outpatient / professional coding",
  medical_necessity: "Medical necessity / coverage",
  quality_measure: "Quality measure / registry",
  risk_adjustment_hcc: "Risk adjustment (HCC/RAF)",
  denial_audit_defense: "Denial / audit defense",
  patient_safety: "Patient safety / clinical integrity only",
  compliance_review: "Compliance review",
};

const PRIORITY_LABELS: Record<string, string> = {
  concurrent: "Concurrent",
  pre_bill: "Pre-bill",
  retro: "Retro",
  audit: "Audit",
};

const SETTING_OPTIONS = ["IP", "OP", "ED", "SNF", "Home", "Telehealth", "Other"];
const PAYER_OPTIONS = ["Medicare", "Medicaid", "Commercial", "MA", "Self-pay"];
const ROLE_OPTIONS = ["CDI", "Coder", "Auditor", "Other"];

export async function generateFormADocx(input: {
  form: FormAOutput;
  header: QueryFormHeaderInputs;
  createdAt: Date;
  citationsUsed?: number;
}): Promise<Buffer> {
  await loadDocx();
  const {
    Document,
    Packer,
    Paragraph,
    PageOrientation,
    AlignmentType,
    convertInchesToTwip,
  } = docxLib;

  const dateStr = input.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const settingChecked = (opt: string) =>
    (input.header.setting || "").toLowerCase() === opt.toLowerCase();
  const payerChecked = (opt: string) =>
    (input.header.payerType || "").toLowerCase() === opt.toLowerCase();
  const roleChecked = (opt: string) =>
    (input.header.queryAuthorRole || "").toLowerCase() === opt.toLowerCase();

  const priorityItems = Object.entries(PRIORITY_LABELS).map(([key, label]) => ({
    label,
    checked: input.form.priority === key,
  }));

  const queryTypeItems = Object.entries(QUERY_TYPE_LABELS).map(([key, label]) => ({
    label,
    checked: input.form.query_types.includes(key),
  }));

  const impactDomainItems = Object.entries(IMPACT_DOMAIN_LABELS).map(([key, label]) => ({
    label,
    checked: input.form.impact_domains.includes(key),
  }));

  // ---- Build children (linear flow) ----
  const children: any[] = [];

  // === Letterhead — matches ProEdCS site: navy strip + primary title ===
  children.push(
    new Paragraph({
      children: [
        textRun("PCS-DOC-001-Q  |  Form A — General Clinical Documentation Query  |  ", {
          size: 15,
          color: "FFFFFF",
        }),
        textRun("Confidential – Internal Use", {
          size: 15,
          color: "FFFFFF",
          italics: true,
        }),
      ],
      shading: { type: "clear" as any, fill: BRAND_NAVY, color: "auto" },
      spacing: { before: 0, after: 160 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        textRun("ProEd Consulting & Staffing", { size: 34, bold: true, color: BRAND_NAVY }),
      ],
      spacing: { after: 40 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        textRun("Medical Coding · Auditing · Compliance", {
          size: 18,
          color: BRAND_BLUE,
          bold: true,
        }),
      ],
      spacing: { after: 20 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        textRun("Query Forms Packet — Form A", { size: 22, color: BRAND_GRAY }),
      ],
      spacing: { after: 40 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        textRun(
          "Aligned with ACDIS/AHIMA Guidelines for Achieving a Compliant Query Practice (2026 Update)",
          {
            size: 15,
            color: LIGHT_GRAY,
            italics: true,
          }
        ),
      ],
      spacing: { after: 220 },
    })
  );
  children.push(hr());

  // === Section title ===
  children.push(
    new Paragraph({
      children: [
        textRun("CODER / CDI / AUDITOR → PROVIDER  ·  CLINICAL DOCUMENTATION QUERY (FORM A)", {
          size: 20,
          bold: true,
          color: "FFFFFF",
        }),
      ],
      shading: { type: "clear" as any, fill: BRAND_BLUE, color: "auto" },
      spacing: { before: 100, after: 140 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        textRun("Purpose: ", { bold: true, size: 20 }),
        textRun(
          "Clarify incomplete, conflicting, or nonspecific documentation so coding, quality reporting, and claims accurately reflect the care provided. This is not a request to document for reimbursement alone.",
          { size: 20, italics: true }
        ),
      ],
      spacing: { after: 200 },
    })
  );

  // === 1. Query Header ===
  children.push(h2("1. Query Header"));
  children.push(
    infoRow([
      { label: "Query ID #", value: input.form.query_id_suggestion || "____________" },
      { label: "Date Issued", value: dateStr },
      {
        label: "Priority",
        value: priorityItems
          .map((it) => `${it.checked ? CHECKBOX_FILLED : CHECKBOX_EMPTY} ${it.label}`)
          .join("  "),
      },
      { label: "Response Due", value: "____/____/________" },
    ])
  );
  children.push(new Paragraph({ children: [textRun("", { size: 2 })], spacing: { after: 40 } }));

  children.push(
    infoRow([
      { label: "Patient Name", value: input.header.patientName || "______________________________" },
      { label: "MRN / Account #", value: input.header.mrn || "____________________" },
      { label: "DOB", value: input.header.dob || "____/____/________" },
    ])
  );
  children.push(new Paragraph({ children: [textRun("", { size: 2 })], spacing: { after: 40 } }));

  children.push(
    infoRow([
      { label: "Date(s) of Service", value: input.header.dateOfService || "____________________" },
      {
        label: "Setting",
        value: SETTING_OPTIONS.map((s) => `${settingChecked(s) ? CHECKBOX_FILLED : CHECKBOX_EMPTY} ${s}`).join("  "),
      },
      {
        label: "Payer Type",
        value: PAYER_OPTIONS.map((p) => `${payerChecked(p) ? CHECKBOX_FILLED : CHECKBOX_EMPTY} ${p}`).join("  "),
      },
    ])
  );
  children.push(new Paragraph({ children: [textRun("", { size: 2 })], spacing: { after: 40 } }));

  children.push(
    infoRow([
      { label: "Attending / Rendering Provider", value: input.header.attendingProvider || "______________________________" },
      { label: "NPI", value: input.header.providerNpi || "____________________" },
      { label: "Specialty", value: input.header.providerSpecialty || "____________________" },
    ])
  );
  children.push(new Paragraph({ children: [textRun("", { size: 2 })], spacing: { after: 40 } }));

  children.push(
    infoRow([
      { label: "Query Author Name / Credentials", value: input.header.queryAuthorName || "______________________________" },
      {
        label: "Role",
        value: ROLE_OPTIONS.map((r) => `${roleChecked(r) ? CHECKBOX_FILLED : CHECKBOX_EMPTY} ${r}`).join("  "),
      },
      { label: "Contact / Ext", value: input.header.queryAuthorContact || "____________________" },
    ])
  );

  // === 2. Query Type & Impact Domain ===
  children.push(h2("2. Query Type & Impact Domain"));
  children.push(
    twoColumnCheckboxTable("Query Type", queryTypeItems, "Impact Domain (check all that apply)", impactDomainItems)
  );

  // === 3. Clinical Indicators from the Medical Record ===
  children.push(h2("3. Clinical Indicators from the Medical Record"));
  children.push(
    new Paragraph({
      children: [
        textRun(
          "List objective findings already in the record that support the need for clarification (labs, imaging, meds, notes, pathology, vital signs). Do not introduce unsupported diagnoses.",
          { size: 18, italics: true, color: LIGHT_GRAY }
        ),
      ],
      spacing: { after: 100 },
    })
  );

  const indicatorParas: any[] = [
    new Paragraph({
      children: [
        textRun("Source document / date: ", { bold: true, size: 20 }),
        textRun(input.form.clinical_indicators.source_document || "_______________________________________________", { size: 20 }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [textRun("Indicators:", { bold: true, size: 20 })],
      spacing: { after: 60 },
    }),
  ];
  const indList =
    input.form.clinical_indicators.indicators.length > 0
      ? input.form.clinical_indicators.indicators
      : ["___________________________________________________________________________"];
  for (const ind of indList) {
    indicatorParas.push(
      new Paragraph({
        children: [textRun(`• ${ind}`, { size: 20 })],
        spacing: { after: 40 },
      })
    );
  }
  children.push(contentBox(indicatorParas));

  // === 4. Clarification Request (Non-Leading) ===
  children.push(h2("4. Clarification Request (Non-Leading)"));
  children.push(
    new Paragraph({
      children: [
        textRun(
          "Based on the clinical indicators above, please clarify the following. Select all that apply or provide free text. Your clinical judgment controls.",
          { size: 18, italics: true, color: LIGHT_GRAY }
        ),
      ],
      spacing: { after: 100 },
    })
  );

  const clarParas: any[] = [
    new Paragraph({
      children: [textRun("Question:", { bold: true, size: 20 })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        textRun(
          input.form.clarification_question ||
            "___________________________________________________________________________",
          { size: 20 }
        ),
      ],
      spacing: { after: 140 },
    }),
    new Paragraph({
      children: [textRun("Clinically reasonable options (customize per case):", { bold: true, size: 20 })],
      spacing: { after: 60 },
    }),
  ];

  const letters = ["A", "B", "C", "D"];
  const options = input.form.clinically_reasonable_options || [];
  letters.forEach((letter, i) => {
    const opt = options[i]?.trim();
    clarParas.push(
      checkboxLine(
        `Option ${letter}`,
        false,
        opt || "_______________________________________________________________"
      )
    );
  });
  clarParas.push(checkboxLine("Other (please specify)", false, "__________________________________________________"));
  clarParas.push(checkboxLine("Unable to determine / Not clinically indicated", false));
  clarParas.push(checkboxLine("The condition was ruled out", false));

  if (input.form.poa_applicable) {
    clarParas.push(
      new Paragraph({
        children: [textRun("", { size: 2 })],
        spacing: { after: 80 },
      })
    );
    clarParas.push(
      new Paragraph({
        children: [
          textRun("Present on admission (if inpatient diagnosis already established):", {
            bold: true,
            size: 20,
          }),
        ],
        spacing: { after: 60 },
      })
    );
    clarParas.push(checkboxLine("Yes — POA"));
    clarParas.push(checkboxLine("No — not POA / developed after admission"));
    clarParas.push(checkboxLine("Unknown / clinically undetermined"));
    clarParas.push(checkboxLine("Exempt"));
    if (input.form.poa_context) {
      clarParas.push(
        new Paragraph({
          children: [
            textRun("POA note: ", { bold: true, size: 18, color: BRAND_GRAY }),
            textRun(input.form.poa_context, { size: 18, italics: true }),
          ],
          spacing: { before: 60, after: 40 },
        })
      );
    }
  }

  children.push(contentBox(clarParas));

  // === Reason for query ===
  if (input.form.reason_for_query) {
    children.push(
      new Paragraph({
        children: [
          textRun("Reason for query: ", { bold: true, size: 20, color: BRAND_GRAY }),
          textRun(input.form.reason_for_query, { size: 20, italics: true }),
        ],
        spacing: { before: 120, after: 120 },
      })
    );
  }

  // === 5. Provider Response ===
  children.push(h2("5. Provider Response (Required)"));
  children.push(
    contentBox([
      new Paragraph({
        children: [textRun("Provider narrative response / addendum language:", { bold: true, size: 20 })],
        spacing: { after: 60 },
      }),
      para("_______________________________________________________________________________", { after: 40 }),
      para("_______________________________________________________________________________", { after: 40 }),
      para("_______________________________________________________________________________", { after: 40 }),
      para("_______________________________________________________________________________", { after: 120 }),
      checkboxLine("I will place an authenticated addendum / updated note in the EHR reflecting this clarification"),
      checkboxLine("No change to documentation is clinically appropriate (reason above)"),
      new Paragraph({
        children: [textRun("", { size: 2 })],
        spacing: { after: 80 },
      }),
      labelValueLine("Provider printed name:", ""),
      labelValueLine("Credentials:", ""),
      labelValueLine("Signature:", ""),
      labelValueLine("Date/Time:", ""),
      labelValueLine("Electronic signature ID (if applicable):", ""),
    ])
  );

  // === 6. Coding / CDI Disposition ===
  children.push(h2("6. Coding / CDI Disposition"));
  children.push(
    infoRow([
      { label: "Response received date", value: "____/____/________" },
      {
        label: "Addendum verified in record",
        value: `${CHECKBOX_EMPTY} Yes  ${CHECKBOX_EMPTY} No  ${CHECKBOX_EMPTY} N/A`,
      },
      {
        label: "Codes updated",
        value: `${CHECKBOX_EMPTY} Yes  ${CHECKBOX_EMPTY} No  ${CHECKBOX_EMPTY} N/A`,
      },
    ])
  );
  children.push(new Paragraph({ children: [textRun("", { size: 2 })], spacing: { after: 40 } }));
  children.push(
    infoRow([
      { label: "Final DRG / codes (if changed)", value: "______________________________" },
      { label: "Closed by", value: "____________________" },
      { label: "Close date", value: "____/____/________" },
    ])
  );

  // === Compliance attestation footer ===
  children.push(hr());
  children.push(
      new Paragraph({
        children: [
          textRun("Compliant query attestation: ", { bold: true, size: 18, color: BRAND_BLUE }),
          textRun(
            "This query presents clinical indicators from the record, offers multiple reasonable options including other/unable to determine, and does not lead the provider to a particular response. Retained with the permanent medical record or designated CDI/coding system per organizational retention policy.",
            { size: 18, italics: true, color: BRAND_DARK }
          ),
        ],
        spacing: { before: 100, after: 200 },
      })
  );

  children.push(
    new Paragraph({
      children: [
        textRun(
          "ProEd Consulting & Staffing  ·  West Covina, California  ·  info@proedcs.com  ·  +1-626-771-3704",
          { size: 14, color: "FFFFFF" }
        ),
      ],
      shading: { type: "clear" as any, fill: BRAND_NAVY, color: "auto" },
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        textRun(
          `Generated by ProEdCS Coder AI  ·  Built by AXCEL  ·  Version 1.0  ·  ${dateStr}`,
          { size: 13, italics: true, color: LIGHT_GRAY }
        ),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    })
  );

  const doc = new Document({
    creator: "ProEd Coder AI",
    title: `ProEdCS Form A - ${input.form.query_id_suggestion || "Query"}`,
    description: "Compliant clinical documentation query - Form A",
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
            margin: {
              top: convertInchesToTwip(0.6),
              bottom: convertInchesToTwip(0.6),
              left: convertInchesToTwip(0.7),
              right: convertInchesToTwip(0.7),
            },
          },
        },
        children,
      },
    ],
  });

  const buf: Buffer = await Packer.toBuffer(doc);
  return buf;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
