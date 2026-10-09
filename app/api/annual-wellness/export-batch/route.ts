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

const PatientEntry = z.object({
  id: z.string().optional().default(""),
  patientName: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),
  dos: z.string().optional().default(""),
  items: z.array(SelectedItem).default([]),
});

const Body = z.object({
  patients: z.array(PatientEntry).default([]),
});

const FONT = "Calibri";
const BLUE = THEME_HEX.primary;
const GRAY = "4B5563";
const DARK = "1F2937";
const CARD = THEME_HEX.primaryLight;

type PatientData = z.infer<typeof PatientEntry>;

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { patients } = parsed.data;

  if (patients.length === 0) {
    return NextResponse.json(
      { error: "No saved patients to export — save at least one patient first." },
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
    PageOrientation,
    convertInchesToTwip,
  } = docxLib;

  const logoRun = await getLogoImageRun(docxLib);

  const tr = (text: string, o: Record<string, unknown> = {}) =>
    new TextRun({ text, font: FONT, size: (o.size as number) ?? 20, bold: o.bold as boolean, italics: o.italics as boolean, color: (o.color as string) ?? DARK });
  const p = (children: unknown, o: Record<string, unknown> = {}) =>
    new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { before: (o.before as number) ?? 0, after: (o.after as number) ?? 80 } });

  function buildPatientChildren(patient: PatientData): unknown[] {
    const { patientName, accountNumber, dos, items } = patient;
    const children: unknown[] = [];

    // Group this patient's items by section, preserving first-seen order.
    const bySection = new Map<string, typeof items>();
    for (const item of items) {
      if (!bySection.has(item.sectionTitle)) bySection.set(item.sectionTitle, []);
      bySection.get(item.sectionTitle)!.push(item);
    }

    if (logoRun) children.push(new Paragraph({ children: [logoRun], spacing: { after: 200 } }));
    children.push(p(tr("Annual Wellness Visit — Selected Quality Measures", { bold: true, size: 28, color: BLUE }), { after: 200 }));

    children.push(
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
      })
    );
    children.push(p(tr("", { size: 2 }), { after: 100 }));

    children.push(
      p(tr(`${items.length} code${items.length !== 1 ? "s" : ""} / entries across ${bySection.size} section${bySection.size !== 1 ? "s" : ""}`, { italics: true, size: 18, color: GRAY }), { after: 200 })
    );

    for (const [sectionTitle, sectionItems] of bySection.entries()) {
      children.push(new Paragraph({ children: [tr(sectionTitle, { bold: true, size: 22, color: BLUE })], spacing: { before: 200, after: 80 } }));
      children.push(
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
        })
      );
    }

    children.push(p(tr("", { size: 2 }), { before: 200, after: 0 }));
    children.push(
      p(tr("Generated by ProEdCS Coder AI — educational reference only. Final coding judgment remains with the provider/coder.", { italics: true, size: 16, color: GRAY }))
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
    title: "Annual Wellness Visit — Selected Quality Measures — Batch",
    sections: patients.map((patient) => ({
      properties: pageProps,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: buildPatientChildren(patient) as any[],
    })),
  });

  const buffer: Buffer = await Packer.toBuffer(doc);
  const filename = `ProEdCS-AWV-Batch-${patients.length}-Patients-${Date.now()}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
