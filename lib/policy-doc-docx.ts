/**
 * Policy Document Generator — DOCX renderer.
 * Matches the structure of ProEd's original sample: metadata table,
 * disclaimer, 20 numbered sections, references list, approval block,
 * version history table.
 */

import type { PolicyDocOutput } from "./policy-doc-prompts";
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

function para(text: string, opts: any = {}) {
  const { Paragraph } = docxLib;
  return new Paragraph({
    children: [textRun(text, opts)],
    spacing: { before: opts.before ?? 0, after: opts.after ?? 100 },
  });
}

function sectionHeading(num: number, heading: string) {
  const { Paragraph, HeadingLevel } = docxLib;
  return new Paragraph({
    children: [textRun(`${num}. ${heading}`, { size: 24, bold: true, color: BRAND })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
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

function metaRow(cells: Array<{ label: string; value: string }>) {
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
                  children: [textRun(`${c.label}: `, { bold: true, size: 18, color: GRAY }), textRun(c.value, { size: 18 })],
                  spacing: { after: 40 },
                }),
              ],
            })
        ),
      }),
    ],
  });
}

export async function generatePolicyDocDocx(input: {
  policy: PolicyDocOutput;
  references: Array<{ n: number; source: string; docTitle: string; sourceUrl: string }>;
  createdAt: Date;
}): Promise<Buffer> {
  await loadDocx();
  const { Document, Packer, Paragraph, PageOrientation, AlignmentType, convertInchesToTwip } = docxLib;
  const logoRun = await getLogoImageRun(docxLib);

  const { policy, references, createdAt } = input;
  const dateStr = createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const children: any[] = [];

  // Letterhead
  children.push(
    new Paragraph({
      children: [
        textRun(`${policy.policy_number_suggestion || "PCS-DOC"}  |  Policy Document  |  `, { size: 15, color: "FFFFFF" }),
        textRun(policy.confidentiality, { size: 15, color: "FFFFFF", italics: true }),
      ],
      shading: { type: "clear" as any, fill: BRAND, color: "auto" },
      spacing: { after: 160 },
    })
  );
  children.push(new Paragraph({ children: [logoRun], spacing: { after: 120 } }));
  children.push(para("ProEd Consulting & Staffing", { size: 34, bold: true, color: BRAND, after: 40 }));
  children.push(para("Medical Coding · Auditing · Compliance", { size: 18, bold: true, color: BRAND, after: 200 }));
  children.push(hr());

  // Title
  children.push(para(policy.policy_title, { size: 32, bold: true, color: DARK, after: 160 }));

  // Metadata table
  children.push(
    metaRow([
      { label: "Policy Number", value: policy.policy_number_suggestion || "____________" },
      { label: "Version", value: "1.0" },
      { label: "Effective Date", value: dateStr },
    ])
  );
  children.push(para("", { after: 40 }));
  children.push(
    metaRow([
      { label: "Review Cycle", value: "Annual" },
      { label: "Applies To", value: policy.applies_to },
      { label: "Confidentiality", value: policy.confidentiality },
    ])
  );
  children.push(para("", { after: 40 }));
  children.push(metaRow([{ label: "Regulatory Basis", value: policy.regulatory_basis_summary }]));
  children.push(para("", { after: 200 }));

  // Disclaimer
  children.push(
    para(policy.disclaimer, {
      size: 18,
      italics: true,
      color: LIGHT,
      before: 100,
      after: 260,
    })
  );
  children.push(hr());

  // 20 sections
  for (const section of policy.sections) {
    children.push(sectionHeading(section.number, section.heading));
    // Split on paragraph breaks so multi-paragraph section bodies render cleanly
    const paragraphs = section.body.split(/\n\n+/).filter((p) => p.trim());
    for (const p of paragraphs) {
      children.push(para(p.trim(), { size: 20, after: 120 }));
    }
  }

  // References (rendered separately from the LLM's Section 19 intro line)
  children.push(hr());
  children.push(
    new Paragraph({
      children: [textRun("REFERENCES", { size: 22, bold: true, color: "FFFFFF" })],
      shading: { type: "clear" as any, fill: BRAND, color: "auto" },
      spacing: { before: 100, after: 140 },
    })
  );
  if (references.length > 0) {
    references.forEach((ref) => {
      children.push(
        para(`[${ref.n}] ${ref.source} — ${ref.docTitle}${ref.sourceUrl ? `. ${ref.sourceUrl}` : ""}`, {
          size: 18,
          after: 80,
        })
      );
    });
  } else {
    children.push(para("No external references were used in generating this document.", { size: 18, italics: true, color: LIGHT }));
  }

  // Approval block
  children.push(hr());
  children.push(para("APPROVAL", { size: 22, bold: true, color: BRAND, after: 140 }));
  children.push(para("Prepared by: ____________________________   Title: ____________________   Date: ____________", { size: 20, after: 100 }));
  children.push(para("Approved by: ____________________________   Title: ____________________   Date: ____________", { size: 20, after: 200 }));

  // Version history table
  children.push(
    new Paragraph({
      children: [textRun("VERSION HISTORY", { size: 22, bold: true, color: "FFFFFF" })],
      shading: { type: "clear" as any, fill: BRAND, color: "auto" },
      spacing: { before: 100, after: 100 },
    })
  );
  const { Table, TableRow, TableCell, WidthType, ShadingType } = docxLib;
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: BRAND, color: "auto" }, children: [para("Version", { bold: true, size: 16, color: "FFFFFF" })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: BRAND, color: "auto" }, children: [para("Date", { bold: true, size: 16, color: "FFFFFF" })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: BRAND, color: "auto" }, children: [para("Description", { bold: true, size: 16, color: "FFFFFF" })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [para("1.0", { size: 16 })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [para(dateStr, { size: 16 })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [para("Initial generation via ProEdCS Coder AI", { size: 16 })] }),
          ],
        }),
      ],
    })
  );

  // Footer
  children.push(
    new Paragraph({
      children: [textRun("ProEd Consulting & Staffing  ·  West Covina, California  ·  info@proedcs.com  ·  +1-626-771-3704", { size: 14, color: "FFFFFF" })],
      shading: { type: "clear" as any, fill: BRAND, color: "auto" },
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 40 },
    })
  );
  children.push(
    new Paragraph({
      children: [textRun(`Generated by ProEdCS Coder AI · Built by AXCEL · ${dateStr}`, { size: 13, italics: true, color: LIGHT })],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    creator: "ProEdCS Coder AI",
    title: policy.policy_title,
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
            margin: {
              top: convertInchesToTwip(0.7),
              bottom: convertInchesToTwip(0.7),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
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
