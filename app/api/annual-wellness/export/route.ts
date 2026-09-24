import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLogoImageRun } from "@/lib/proed-logo-docx";
import { THEME_HEX } from "@/lib/theme";

export const runtime = "nodejs";

const SelectedItem = z.object({
  sectionTitle: z.string(),
  code: z.string(),
  description: z.string(),
  dx: z.string().optional().default(""),
});

const Body = z.object({
  patientName: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),
  dos: z.string().optional().default(""),
  items: z.array(SelectedItem).default([]),
});

const FONT = "Calibri";
const BLUE = THEME_HEX.primary;
const GRAY = "4B5563";
const DARK = "1F2937";
const CARD = THEME_HEX.primaryLight;

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { patientName, accountNumber, dos, items } = parsed.data;

  if (items.length === 0) {
    return NextResponse.json({ error: "No codes selected — select at least one code before exporting." }, { status: 400 });
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
  } = docxLib;

  const logoRun = await getLogoImageRun(docxLib);

  const tr = (text: string, o: Record<string, unknown> = {}) =>
    new TextRun({ text, font: FONT, size: (o.size as number) ?? 20, bold: o.bold as boolean, color: (o.color as string) ?? DARK });
  const p = (children: unknown, o: Record<string, unknown> = {}) =>
    new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { before: (o.before as number) ?? 0, after: (o.after as number) ?? 80 } });

  // Group selected items by their section, preserving first-seen order.
  const bySection = new Map<string, typeof items>();
  for (const item of items) {
    if (!bySection.has(item.sectionTitle)) bySection.set(item.sectionTitle, []);
    bySection.get(item.sectionTitle)!.push(item);
  }

  const sectionBlocks = [...bySection.entries()].flatMap(([sectionTitle, sectionItems]) => [
    new Paragraph({
      children: [tr(sectionTitle, { bold: true, size: 22, color: BLUE })],
      spacing: { before: 200, after: 80 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: sectionItems.map(
        (item, i) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "FFFFFF" : CARD, color: "auto" },
                children: [
                  p([
                    tr(item.code + "  ", { bold: true, size: 20, color: BLUE }),
                    tr(item.description, { size: 20 }),
                    ...(item.dx ? [tr("  (Dx: " + item.dx + ")", { size: 18, color: GRAY })] : []),
                  ]),
                ],
              }),
            ],
          })
      ),
    }),
  ]);

  const doc = new Document({
    sections: [
      {
        children: [
          ...(logoRun ? [new Paragraph({ children: [logoRun], spacing: { after: 200 } })] : []),
          new Paragraph({ children: [tr("Annual Wellness Visit — Selected Quality Measures", { bold: true, size: 28, color: BLUE })], spacing: { after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Patient Name: ", { bold: true, size: 18, color: GRAY }), tr(patientName || "____________", { size: 18 })])] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" }, children: [p([tr("Account Number: ", { bold: true, size: 18, color: GRAY }), tr(accountNumber || "____________", { size: 18 })])] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 2,
                    shading: { type: ShadingType.CLEAR, fill: CARD, color: "auto" },
                    children: [p([tr("Date of Service: ", { bold: true, size: 18, color: GRAY }), tr(dos || "____________", { size: 18 })])],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 100 } }),
          new Paragraph({
            children: [tr(`${items.length} code${items.length !== 1 ? "s" : ""} selected across ${bySection.size} section${bySection.size !== 1 ? "s" : ""}`, { italics: true, size: 18, color: GRAY })],
            spacing: { after: 200 },
          }),
          ...sectionBlocks,
          new Paragraph({ text: "", spacing: { before: 300 } }),
          new Paragraph({
            children: [tr("Generated by ProEdCS Coder AI — educational reference only. Final coding judgment remains with the provider/coder.", { italics: true, size: 16, color: GRAY })],
          }),
        ],
      },
    ],
  });

  const buffer: Buffer = await Packer.toBuffer(doc);
  const filename = `ProEdCS-AWV-Measures-${Date.now()}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
