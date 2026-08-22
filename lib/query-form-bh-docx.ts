/**
 * Query Forms B–H — shared DOCX generator.
 *
 * One renderer, driven entirely by the generic structured output from
 * lib/query-form-bh-prompts.ts. Same letterhead/branding/attestation
 * pattern as Form A, so all 8 forms look like one consistent packet.
 */

import type { FormBHOutput } from "./query-form-bh-prompts";
import type { QueryFormHeaderInputs } from "./query-form-prompts";
import { getLogoImageRun } from "./proed-logo-docx";

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
const BRAND = "14457B";
const GRAY = "4B5563";
const LIGHT = "6B7280";
const DARK = "1F2937";
const CARD = "E7ECF4";

const CHECKBOX_EMPTY = "☐";

/* eslint-disable @typescript-eslint/no-explicit-any */
function textRun(text: string, opts: any = {}) {
  const { TextRun } = docxLib;
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 20,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? DARK,
  });
}

function para(text: string | any[], opts: any = {}) {
  const { Paragraph } = docxLib;
  return new Paragraph({
    children: Array.isArray(text) ? text : [textRun(text, opts)],
    spacing: { before: opts.before ?? 0, after: opts.after ?? 100 },
  });
}

function h2(text: string) {
  const { Paragraph, HeadingLevel } = docxLib;
  return new Paragraph({
    children: [textRun(text, { size: 22, bold: true, color: GRAY })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
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

function infoRow(cells: Array<{ label: string; value: string }>) {
  const { Table, TableRow, TableCell, WidthType, ShadingType, Paragraph } = docxLib;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" },
              children: [
                new Paragraph({
                  children: [
                    textRun(`${c.label} `, { bold: true, size: 18, color: GRAY }),
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

export async function generateFormBHDocx(input: {
  form: FormBHOutput;
  header: QueryFormHeaderInputs;
  createdAt: Date;
}): Promise<Buffer> {
  await loadDocx();
  const { Document, Packer, Paragraph, PageOrientation, AlignmentType, convertInchesToTwip } = docxLib;
  const logoRun = await getLogoImageRun(docxLib);

  const { form, header, createdAt } = input;
  const dateStr = createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const children: any[] = [];

  // Letterhead — navy strip matches Form A and every other ProEdCS export
  children.push(
    new Paragraph({
      children: [
        textRun(`PCS-DOC-001-Q  |  Form ${form.form_letter} — ${form.title}  |  `, { size: 15, color: "FFFFFF" }),
        textRun("Confidential – Internal Use", { size: 15, color: "FFFFFF", italics: true }),
      ],
      shading: { type: "clear" as any, fill: BRAND, color: "auto" },
      spacing: { after: 160 },
    })
  );
  children.push(new Paragraph({ children: [logoRun], spacing: { after: 120 } }));
  children.push(para("ProEd Consulting & Staffing", { size: 34, bold: true, color: BRAND, after: 40 }));
  children.push(para("Medical Coding · Auditing · Compliance", { size: 18, bold: true, color: BRAND, after: 20 }));
  children.push(para(`Query Forms Packet — Form ${form.form_letter}`, { size: 22, color: GRAY, after: 40 }));
  children.push(
    para("Aligned with ACDIS/AHIMA Guidelines for Achieving a Compliant Query Practice (2026 Update)", {
      size: 15,
      italics: true,
      color: LIGHT,
      after: 220,
    })
  );
  children.push(hr());

  // Section title strip
  children.push(
    new Paragraph({
      children: [textRun(`FORM ${form.form_letter} — ${form.title.toUpperCase()}`, { size: 20, bold: true, color: "FFFFFF" })],
      shading: { type: "clear" as any, fill: BRAND, color: "auto" },
      spacing: { before: 100, after: 140 },
    })
  );

  children.push(para([textRun("Summary: ", { bold: true, size: 20 }), textRun(form.summary_line, { size: 20, italics: true })], { after: 200 }));

  // Header fields — same pattern as Form A
  children.push(h2("Header"));
  children.push(
    infoRow([
      { label: "Query ID #", value: form.query_id_suggestion || "____________" },
      { label: "Date Issued", value: dateStr },
      { label: "Priority", value: form.priority.replace(/_/g, "-") },
    ])
  );
  children.push(para("", { after: 40 }));
  children.push(
    infoRow([
      { label: "Patient Name", value: header.patientName || "______________________________" },
      { label: "MRN / Account #", value: header.mrn || "____________________" },
      { label: "DOB", value: header.dob || "____/____/________" },
    ])
  );
  children.push(para("", { after: 40 }));
  children.push(
    infoRow([
      { label: "Date(s) of Service", value: header.dateOfService || "____________________" },
      { label: "Attending / Rendering Provider", value: header.attendingProvider || "______________________________" },
      { label: "Query Author", value: header.queryAuthorName || "______________________________" },
    ])
  );

  // Detail sections — generic, driven by the LLM output
  children.push(h2("Detail"));
  const detailParas: any[] = [];
  for (const section of form.detail_sections) {
    detailParas.push(para(section.heading, { bold: true, size: 20, color: BRAND, before: 100, after: 40 }));
    detailParas.push(para(section.body, { size: 20, after: 100 }));
  }
  if (detailParas.length > 0) children.push(contentBox(detailParas));

  // Core question/position + options
  children.push(h2(form.form_letter === "H" ? "Position" : "Clarification Request (Non-Leading)"));
  const qParas: any[] = [
    para(form.question || "___________________________________________________________________________", { size: 20, bold: true, after: 140 }),
  ];
  if (form.options.length > 0) {
    qParas.push(para(form.form_letter === "H" ? "Select position:" : "Options:", { bold: true, size: 20, after: 60 }));
    form.options.forEach((opt) => {
      qParas.push(para(`${CHECKBOX_EMPTY}  ${opt}`, { size: 20, after: 50 }));
    });
    if (form.form_letter !== "H") {
      qParas.push(para(`${CHECKBOX_EMPTY}  Other (please specify): __________________________________________________`, { size: 20, after: 50 }));
      qParas.push(para(`${CHECKBOX_EMPTY}  Unable to determine from documentation`, { size: 20, after: 50 }));
    }
  }
  children.push(contentBox(qParas));

  if (form.reason) {
    children.push(
      para([textRun("Reason: ", { bold: true, size: 20, color: GRAY }), textRun(form.reason, { size: 20, italics: true })], {
        before: 120,
        after: 120,
      })
    );
  }

  // Response + disposition — same shape as Form A, form-generic
  children.push(h2("Response (Required)"));
  children.push(
    contentBox([
      para("Response / addendum language:", { bold: true, size: 20, after: 60 }),
      para("_______________________________________________________________________________", { size: 20, after: 40 }),
      para("_______________________________________________________________________________", { size: 20, after: 40 }),
      para("_______________________________________________________________________________", { size: 20, after: 120 }),
      para("Printed name: ____________________   Credentials: ____________   Date: ____________", { size: 20, after: 40 }),
      para("Signature: ____________________________________", { size: 20 }),
    ])
  );

  // Compliance attestation footer
  children.push(hr());
  children.push(
    para(
      [
        textRun("Compliant query attestation: ", { bold: true, size: 18, color: BRAND }),
        textRun(
          "This form presents information from the medical record, offers reasonable options where applicable, and does not lead the respondent to a particular answer. Retained per organizational retention policy.",
          { size: 18, italics: true, color: DARK }
        ),
      ],
      { before: 100, after: 200 }
    )
  );
  children.push(
    new Paragraph({
      children: [
        textRun("ProEd Consulting & Staffing  ·  West Covina, California  ·  info@proedcs.com  ·  +1-626-771-3704", {
          size: 14,
          color: "FFFFFF",
        }),
      ],
      shading: { type: "clear" as any, fill: BRAND, color: "auto" },
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
    })
  );
  children.push(
    new Paragraph({
      children: [textRun(`Generated by ProEdCS Coder AI · Built by AXCEL · Version 1.0 · ${dateStr}`, { size: 13, italics: true, color: LIGHT })],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    creator: "ProEdCS Coder AI",
    title: `ProEdCS Form ${form.form_letter} - ${form.query_id_suggestion || "Query"}`,
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

  return Packer.toBuffer(doc);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
