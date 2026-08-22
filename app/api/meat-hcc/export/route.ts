import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLogoImageRun } from "@/lib/proed-logo-docx";

export const runtime = "nodejs";

const Body = z.object({
  icdCodes: z.string().optional().default(""),
  condition: z.string().optional().default(""),
  dos: z.string().optional().default(""),
  npi: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  checked: z.record(z.boolean()).optional().default({}),
});

const FONT = "Calibri";
const NAVY = "14457B";
const BLUE = "14457B";
const GRAY = "4B5563";
const LIGHT = "6B7280";
const DARK = "1F2937";
const CARD = "E7ECF4";

const MONITORED = [
  { id: "m1", label: "Vital signs reviewed (BP, weight, O2 sat, HR)" },
  { id: "m2", label: "Symptom frequency/severity documented" },
  { id: "m3", label: "Disease progression assessed" },
  { id: "m4", label: "Functional status/ADL impact noted" },
  { id: "m5", label: "Complications or new symptoms identified" },
];
const EVALUATED = [
  { id: "e1", label: "Lab results reviewed & interpreted" },
  { id: "e2", label: "Imaging/diagnostic studies reviewed" },
  { id: "e3", label: "Medication efficacy assessed" },
  { id: "e4", label: "Side effects/tolerance evaluated" },
  { id: "e5", label: "Specialist reports reviewed" },
];
const ASSESSED = [
  { id: "a1", label: "Condition status: Stable / Improving / Worsening" },
  { id: "a2", label: "Acute vs. chronic distinction documented" },
  { id: "a3", label: "Comorbidity interactions addressed" },
  { id: "a4", label: "Risk stratification noted" },
  { id: "a5", label: "Patient education/counseling addressed" },
];
const TREATED = [
  { id: "t1", label: "Current medications listed with dosage" },
  { id: "t2", label: "New Rx or dosage change documented" },
  { id: "t3", label: "Referrals ordered or pending" },
  { id: "t4", label: "Procedures/interventions performed" },
  { id: "t5", label: "Follow-up plan & frequency specified" },
];

const QUICK_REF = [
  { hcc: "Diabetes w/ Complications (HCC 18/19)", codes: "E11.65, E11.40, E11.51, E11.319", must: "A1c value, insulin/oral med, complication, current management plan" },
  { hcc: "Congestive Heart Failure (HCC 85/86)", codes: "I50.20, I50.30, I50.40, I50.9", must: "EF%, NYHA class, current diuretic/ARNI/BB, BNP/echo, fluid status" },
  { hcc: "CKD Stage 3–5 (HCC 136/137)", codes: "N18.3, N18.4, N18.5, N18.6", must: "eGFR value & trend, BMP reviewed, proteinuria, nephrology consult if applicable" },
  { hcc: "COPD/Asthma (HCC 111)", codes: "J44.0, J44.1, J45.50, J45.51", must: "Spirometry/FEV1, inhaler regimen, exacerbation frequency, O2 sat, smoking status" },
  { hcc: "Vascular Disease (HCC 108/107)", codes: "I25.10, I70.213, I73.9, I71.4", must: "Statin therapy, antiplatelet use, last imaging date, symptom severity, revascularization hx" },
];

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { icdCodes, condition, dos, npi, notes, checked } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("docx");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docxLib: any = mod.default ?? mod;
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    BorderStyle,
    AlignmentType,
    PageOrientation,
    convertInchesToTwip,
  } = docxLib;

  const logoRun = await getLogoImageRun(docxLib);

  const tr = (text: string, o: Record<string, unknown> = {}) =>
    new TextRun({ text, font: FONT, size: (o.size as number) ?? 20, bold: o.bold as boolean, italics: o.italics as boolean, color: (o.color as string) ?? DARK });
  const p = (children: unknown, o: Record<string, unknown> = {}) =>
    new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { before: (o.before as number) ?? 0, after: (o.after as number) ?? 80 } });

  function quadrant(letter: string, title: string, items: { id: string; label: string }[]) {
    const rows = items.map(
      (it) =>
        new Paragraph({
          children: [tr(`${checked[it.id] ? "☑" : "☐"}  ${it.label}`, { size: 18 })],
          spacing: { after: 60 },
        })
    );
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" },
              children: [p(tr(`${letter}   ${title}`, { bold: true, size: 18, color: "FFFFFF" }))],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: rows,
            }),
          ],
        }),
      ],
    });
  }

  const children: unknown[] = [];

  // Navy header strip
  children.push(
    new Paragraph({
      children: [tr("PCS-DOC-MEAT  |  MEAT Documentation Checklist  |  Confidential – Internal Use", { size: 15, color: "FFFFFF" })],
      shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" },
      spacing: { after: 160 },
    })
  );
  children.push(new Paragraph({ children: [logoRun], spacing: { after: 120 } }));
  children.push(p(tr("ProEd Consulting & Staffing", { size: 32, bold: true, color: NAVY }), { after: 40 }));
  children.push(p(tr("MEAT Documentation Checklist", { size: 22, color: BLUE, bold: true }), { after: 20 }));
  children.push(p(tr("HCC Risk Adjustment Coding — Applicable to All Chronic Conditions", { size: 16, italics: true, color: LIGHT }), { after: 220 }));

  // Header fields
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Date of Service: ", { bold: true, size: 18, color: GRAY }), tr(dos || "____________", { size: 18 })])] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Provider NPI: ", { bold: true, size: 18, color: GRAY }), tr(npi || "____________", { size: 18 })])] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("ICD-10 Code(s): ", { bold: true, size: 18, color: GRAY }), tr(icdCodes || "____________", { size: 18 })])] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Condition/Diagnosis: ", { bold: true, size: 18, color: GRAY }), tr(condition || "____________", { size: 18 })])] }),
          ],
        }),
      ],
    })
  );
  children.push(p(tr("", { size: 2 }), { after: 160 }));

  // MEAT 2x2 grid — as a table so quadrants sit side by side
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [quadrant("M", "MONITORED — Signs, Symptoms & Progression", MONITORED)] }),
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [quadrant("E", "EVALUATED — Tests & Medication Efficacy", EVALUATED)] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [quadrant("A", "ASSESSED/ADDRESSED — Stability & Complications", ASSESSED)] }),
            new TableCell({ children: [quadrant("T", "TREATED — Medications, Therapy & Referrals", TREATED)] }),
          ],
        }),
      ],
    })
  );
  children.push(p(tr("", { size: 2 }), { after: 200 }));

  // Quick reference table
  children.push(
    new Paragraph({
      children: [tr("COMMON HCC QUICK REFERENCE — Documentation Must-Haves", { bold: true, size: 18, color: "FFFFFF" })],
      shading: { type: ShadingType.CLEAR, fill: BLUE, color: "auto" },
      spacing: { before: 100, after: 100 },
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" }, children: [p(tr("HCC Category", { bold: true, size: 16, color: "FFFFFF" }))] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" }, children: [p(tr("Key ICD-10 Codes", { bold: true, size: 16, color: "FFFFFF" }))] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" }, children: [p(tr("MEAT Must-Document", { bold: true, size: 16, color: "FFFFFF" }))] }),
          ],
        }),
        ...QUICK_REF.map(
          (row, i) =>
            new TableRow({
              children: [
                new TableCell({ shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "FFFFFF" : CARD, color: "auto" }, children: [p(tr(row.hcc, { bold: true, size: 15 }))] }),
                new TableCell({ shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "FFFFFF" : CARD, color: "auto" }, children: [p(tr(row.codes, { size: 15 }))] }),
                new TableCell({ shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "FFFFFF" : CARD, color: "auto" }, children: [p(tr(row.must, { size: 15 }))] }),
              ],
            })
        ),
      ],
    })
  );
  children.push(p(tr("", { size: 2 }), { after: 200 }));

  // Provider notes
  if (notes) {
    children.push(p(tr("Provider Notes / Additional Documentation:", { bold: true, size: 18, color: GRAY }), { after: 60 }));
    children.push(p(tr(notes, { size: 18 }), { after: 200 }));
  }

  // Attestation
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "", font: FONT, size: 2 })],
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 } },
      spacing: { before: 100, after: 120 },
    })
  );
  children.push(
    p(
      [
        tr("Attestation: ", { bold: true, size: 18, color: BLUE }),
        tr("I certify that the above documentation reflects my clinical assessment and active management of the listed chronic condition(s).", { size: 18, italics: true }),
      ],
      { after: 160 }
    )
  );
  children.push(p(tr("Provider Signature: ____________________________   Date: ____________   Credentials: ____________", { size: 18 }), { after: 200 }));

  // Footer
  children.push(
    new Paragraph({
      children: [tr("ProEd Consulting & Staffing  ·  West Covina, California  ·  info@proedcs.com  ·  +1-626-771-3704", { size: 14, color: "FFFFFF" })],
      shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" },
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 40 },
    })
  );
  children.push(
    new Paragraph({
      children: [tr("Generated by ProEdCS Coder AI · Built by AXCEL · MEAT criteria per CMS HCC Risk Adjustment guidelines", { size: 12, italics: true, color: LIGHT })],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    creator: "ProEdCS Coder AI",
    title: "MEAT HCC Documentation Checklist",
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: children as any[],
      },
    ],
  });

  const buffer: Buffer = await Packer.toBuffer(doc);
  const filename = `ProEdCS-MEAT-HCC-Checklist-${Date.now()}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
