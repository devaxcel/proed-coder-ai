import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLogoImageRun } from "@/lib/proed-logo-docx";

export const runtime = "nodejs";

const CaseEntry = z.object({
  id: z.string().optional().default(""),
  patientName: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),
  dos: z.string().optional().default(""),
  npi: z.string().optional().default(""),
  patientType: z.enum(["new", "established"]).nullable().optional(),
  basis: z.enum(["time", "mdm"]).nullable().optional(),
  timeCode: z.string().nullable().optional(),
  timeLabel: z.string().nullable().optional(),
  problemLevel: z.number().default(0),
  dataLevel: z.number().default(0),
  riskLevel: z.number().default(0),
  mdmFinalLevel: z.number().nullable().optional(),
  mdmOverall: z.string().nullable().optional(),
  mdmCode: z.string().nullable().optional(),
  wasDowncoded: z.boolean().default(false),
});

const Body = z.object({
  cases: z.array(CaseEntry).default([]),
});

const FONT = "Calibri";
const NAVY = "14457B";
const BLUE = "14457B";
const GRAY = "4B5563";
const LIGHT = "6B7280";
const DARK = "1F2937";
const CARD = "E7ECF4";
const AMBER = "B45309";
const AMBER_LIGHT = "FEF3C7";

type CaseData = z.infer<typeof CaseEntry>;

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { cases } = parsed.data;

  if (cases.length === 0) {
    return NextResponse.json(
      { error: "No saved cases to export — save at least one case first." },
      { status: 400 }
    );
  }

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

  function buildCaseChildren(c: CaseData): unknown[] {
    const children: unknown[] = [];
    const finalCode = c.basis === "time" ? c.timeCode : c.mdmCode;
    const resultLabel =
      c.basis === "time"
        ? `${c.timeCode ?? "—"} — ${c.timeLabel ?? ""} (time-based)`
        : `${c.mdmCode ?? "—"} — ${c.mdmOverall ?? ""} complexity (MDM-based)`;

    // Navy header strip
    children.push(
      new Paragraph({
        children: [tr("PCS-DOC-EM  |  E/M Level Determination  |  Confidential – Internal Use", { size: 15, color: "FFFFFF" })],
        shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" },
        spacing: { after: 160 },
      })
    );
    children.push(new Paragraph({ children: [logoRun], spacing: { after: 120 } }));
    children.push(p(tr("ProEd Consulting & Staffing", { size: 32, bold: true, color: NAVY }), { after: 40 }));
    children.push(p(tr("E/M Level Determination", { size: 22, color: BLUE, bold: true }), { after: 20 }));
    children.push(p(tr("Evaluation & Management Coding Worksheet", { size: 16, italics: true, color: LIGHT }), { after: 220 }));

    // Patient info
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Patient Name: ", { bold: true, size: 18, color: GRAY }), tr(c.patientName || "____________", { size: 18 })])] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Account Number: ", { bold: true, size: 18, color: GRAY }), tr(c.accountNumber || "____________", { size: 18 })])] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Date of Service: ", { bold: true, size: 18, color: GRAY }), tr(c.dos || "____________", { size: 18 })])] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Provider NPI: ", { bold: true, size: 18, color: GRAY }), tr(c.npi || "____________", { size: 18 })])] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Patient Type: ", { bold: true, size: 18, color: GRAY }), tr(c.patientType ? c.patientType[0].toUpperCase() + c.patientType.slice(1) : "____________", { size: 18 })])] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Basis: ", { bold: true, size: 18, color: GRAY }), tr(c.basis === "time" ? "Time-based" : c.basis === "mdm" ? "MDM-based" : "____________", { size: 18 })])] }),
            ],
          }),
        ],
      })
    );
    children.push(p(tr("", { size: 2 }), { after: 160 }));

    // Result
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: "FFFFFF", color: "auto" },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: NAVY },
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY },
                  left: { style: BorderStyle.SINGLE, size: 6, color: NAVY },
                  right: { style: BorderStyle.SINGLE, size: 6, color: NAVY },
                },
                children: [
                  p(tr("RESULT", { bold: true, size: 14, color: BLUE }), { after: 40 }),
                  p(tr(resultLabel, { bold: true, size: 26 }), { after: 40 }),
                ],
              }),
            ],
          }),
        ],
      })
    );
    children.push(p(tr("", { size: 2 }), { after: 180 }));

    // MDM breakdown + downcode explanation
    if (c.basis === "mdm") {
      children.push(
        new Paragraph({
          children: [tr("MEDICAL DECISION MAKING ELEMENTS", { bold: true, size: 17, color: "FFFFFF" })],
          shading: { type: ShadingType.CLEAR, fill: BLUE, color: "auto" },
          spacing: { before: 60, after: 0 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            tr(`Problems: Level ${c.problemLevel || "—"}    `, { size: 17 }),
            tr(`Data: Level ${c.dataLevel || "—"}    `, { size: 17 }),
            tr(`Risk: Level ${c.riskLevel || "—"}`, { size: 17 }),
          ],
          shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" },
          spacing: { before: 40, after: 160 },
        })
      );

      const explanation = c.wasDowncoded
        ? `Downcoded. Problems = Level ${c.problemLevel}, Data = Level ${c.dataLevel}, Risk = Level ${c.riskLevel} — these three elements are not all at the same level. Per ProEd policy, all three MDM elements must match; when they don't, the encounter is downcoded to the lowest of the three: Level ${c.mdmFinalLevel} (${c.mdmCode}).`
        : `No downcoding. All three MDM elements (Problems, Data, Risk) are at Level ${c.mdmFinalLevel} — code reflects that level directly.`;

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: c.wasDowncoded ? AMBER_LIGHT : "FFFFFF", color: "auto" },
                  children: [
                    p(tr(c.wasDowncoded ? "DOWNCODING APPLIED" : "NO DOWNCODING", { bold: true, size: 16, color: c.wasDowncoded ? AMBER : DARK }), { after: 40 }),
                    p(tr(explanation, { size: 16, color: c.wasDowncoded ? AMBER : DARK }), { after: 40 }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
      children.push(p(tr("", { size: 2 }), { after: 160 }));
    }

    // Disclaimer
    children.push(
      p(
        tr(
          "This is a decision-support estimate, not a final coding determination — always verify against the full documentation and your organization's coding policy before billing.",
          { size: 15, italics: true, color: LIGHT }
        ),
        { after: 160 }
      )
    );

    // Signature
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "", font: FONT, size: 2 })],
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 } },
        spacing: { before: 100, after: 120 },
      })
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
        children: [tr("Generated by ProEdCS Coder AI · Built by AXCEL · E/M leveling per ProEd coding policy", { size: 12, italics: true, color: LIGHT })],
        alignment: AlignmentType.CENTER,
      })
    );

    return children;
  }

  const pageProps = {
    page: {
      size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
      margin: {
        top: convertInchesToTwip(0.6),
        bottom: convertInchesToTwip(0.6),
        left: convertInchesToTwip(0.7),
        right: convertInchesToTwip(0.7),
      },
    },
  };

  const doc = new Document({
    creator: "ProEdCS Coder AI",
    title: "E/M Level Determination — Batch",
    sections: cases.map((c) => ({
      properties: pageProps,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: buildCaseChildren(c) as any[],
    })),
  });

  const buffer: Buffer = await Packer.toBuffer(doc);
  const filename = `ProEdCS-EM-Level-Batch-${cases.length}-Patients-${Date.now()}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
