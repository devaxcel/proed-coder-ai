import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc = await db.policyDocument.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      sourceName: true,
      sourceUrl: true,
      content: true,
      ingestedAt: true,
      docType: true,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Policy document not found" }, { status: 404 });
  }

  // docx package is CommonJS; unwrap default under dynamic import
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("docx").catch(() => null);
  if (!mod) {
    return NextResponse.json(
      { error: "docx package not installed. Run: npm install docx" },
      { status: 500 }
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docxLib: any = mod.default ?? mod;
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    BorderStyle,
    PageOrientation,
    convertInchesToTwip,
  } = docxLib;

  const font = "Calibri";
  const BRAND_BLUE = "1E40AF";
  const BRAND_GRAY = "374151";
  const LIGHT_GRAY = "6B7280";

  const downloadedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const ingestedAt = doc.ingestedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Split content into paragraphs on blank lines to preserve structure
  const rawLines = doc.content.split(/\r?\n/);
  const bodyParagraphs: unknown[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ").trim();
    if (!text) return;
    bodyParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text, font, size: 22, color: "111827" })],
        spacing: { after: 140 },
      })
    );
    buffer = [];
  };

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushBuffer();
    } else {
      buffer.push(trimmed);
    }
  }
  flushBuffer();

  const docxDoc = new Document({
    creator: "ProEd Coder AI",
    title: doc.title,
    description: `Policy document downloaded from ProEd Coder AI on ${downloadedAt}`,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240,
              height: 15840,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.9),
              right: convertInchesToTwip(0.9),
            },
          },
        },
        children: [
          // Letterhead
          new Paragraph({
            children: [
              new TextRun({
                text: "ProEd Consulting & Staffing",
                font,
                size: 32,
                bold: true,
                color: BRAND_BLUE,
              }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Policy Reference Document",
                font,
                size: 20,
                color: BRAND_GRAY,
              }),
            ],
            spacing: { after: 260 },
          }),
          // Horizontal rule
          new Paragraph({
            children: [new TextRun({ text: "", font, size: 2 })],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 },
            },
            spacing: { after: 200 },
          }),
          // Document title
          new Paragraph({
            children: [
              new TextRun({
                text: doc.title,
                font,
                size: 32,
                bold: true,
                color: "111827",
              }),
            ],
            spacing: { after: 120 },
          }),
          // Metadata block
          new Paragraph({
            children: [
              new TextRun({ text: "Source: ", font, size: 20, bold: true, color: BRAND_GRAY }),
              new TextRun({ text: doc.sourceName, font, size: 20, color: "111827" }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Document type: ", font, size: 20, bold: true, color: BRAND_GRAY }),
              new TextRun({ text: doc.docType, font, size: 20, color: "111827" }),
            ],
            spacing: { after: 40 },
          }),
          ...(doc.sourceUrl
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Original URL: ", font, size: 20, bold: true, color: BRAND_GRAY }),
                    new TextRun({ text: doc.sourceUrl, font, size: 20, color: BRAND_BLUE }),
                  ],
                  spacing: { after: 40 },
                }),
              ]
            : []),
          new Paragraph({
            children: [
              new TextRun({ text: "Ingested on: ", font, size: 20, bold: true, color: BRAND_GRAY }),
              new TextRun({ text: ingestedAt, font, size: 20, color: "111827" }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Downloaded on: ", font, size: 20, bold: true, color: BRAND_GRAY }),
              new TextRun({ text: downloadedAt, font, size: 20, color: "111827" }),
            ],
            spacing: { after: 260 },
          }),
          // HR
          new Paragraph({
            children: [new TextRun({ text: "", font, size: 2 })],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 },
            },
            spacing: { after: 200 },
          }),
          // Body
          ...(bodyParagraphs as InstanceType<typeof Paragraph>[]),
          // Footer
          new Paragraph({
            children: [new TextRun({ text: "", font, size: 2 })],
            border: {
              top: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 },
            },
            spacing: { before: 240, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Downloaded via ProEd Coder AI · Built by AXCEL · Retain per your organization's document retention policy.",
                font,
                size: 16,
                italics: true,
                color: LIGHT_GRAY,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80 },
          }),
        ],
      },
    ],
  });

  const buffer: Buffer = await Packer.toBuffer(docxDoc);

  // Safe filename — strip anything weird
  const safeTitle = doc.title
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  const filename = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
