import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import { THEME, hexToRgbFloat } from "@/lib/theme";

export const runtime = "nodejs";

const Body = z.object({
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

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const d = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfLib: any;
  try {
    pdfLib = await import("pdf-lib");
  } catch {
    return NextResponse.json(
      { error: "pdf-lib not installed. Run: npm install pdf-lib" },
      { status: 500 }
    );
  }
  const { PDFDocument, StandardFonts, rgb } = pdfLib;

  const TEAL = rgb(...hexToRgbFloat(THEME.primary));
  const TEAL_LIGHT = rgb(...hexToRgbFloat(THEME.primaryLight));
  const WHITE = rgb(1, 1, 1);
  const DARK = rgb(0.122, 0.161, 0.216); // #1F2937
  const GRAY = rgb(0.42, 0.447, 0.502);
  const AMBER = rgb(0.706, 0.325, 0.035); // #B45309
  const AMBER_LIGHT = rgb(0.996, 0.953, 0.78); // #FEF3C7

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const logoBytes = await readFile(path.join(process.cwd(), "public", "proed-logo.png"));
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const LOGO_ASPECT = 2218 / 813;
  const LOGO_H = 30;
  const LOGO_W = LOGO_H * LOGO_ASPECT;

  const MARGIN = 36;
  const WIDTH = 612 - MARGIN * 2;
  let y = 792 - MARGIN;

  function text(
    str: string,
    x: number,
    yPos: number,
    opts: { size?: number; bold?: boolean; italic?: boolean; color?: unknown } = {}
  ) {
    const useFont = opts.bold ? fontBold : opts.italic ? fontItalic : font;
    const size = opts.size ?? 9;
    page.drawText(str, { x, y: yPos, size, font: useFont, color: opts.color ?? DARK });
  }

  // Simple word-wrap helper for the explanation paragraph.
  function wrapText(str: string, maxWidth: number, size: number, useFont = font): string[] {
    const words = str.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (useFont.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---- Header bar ----
  page.drawRectangle({ x: MARGIN, y: y - 46, width: WIDTH, height: 46, color: TEAL });
  text("E/M Level Determination", MARGIN + 12, y - 20, { size: 16, bold: true, color: WHITE });
  text("Evaluation & Management Coding Worksheet", MARGIN + 12, y - 36, { size: 9, color: WHITE });
  const logoBoxX = MARGIN + WIDTH - LOGO_W - 20;
  const logoBoxY = y - 38;
  page.drawRectangle({ x: logoBoxX - 6, y: logoBoxY - 4, width: LOGO_W + 12, height: LOGO_H + 8, color: WHITE });
  page.drawImage(logoImage, { x: logoBoxX, y: logoBoxY, width: LOGO_W, height: LOGO_H });
  y -= 70;

  // ---- Patient info ----
  page.drawRectangle({ x: MARGIN, y: y - 48, width: WIDTH, height: 48, color: TEAL_LIGHT });
  text("Patient Name:", MARGIN + 8, y - 12, { size: 8, bold: true, color: TEAL });
  text(d.patientName || "____________", MARGIN + 90, y - 12, { size: 8, color: DARK });
  text("Account Number:", MARGIN + 220, y - 12, { size: 8, bold: true, color: TEAL });
  text(d.accountNumber || "____________", MARGIN + 310, y - 12, { size: 8, color: DARK });
  text("Date of Service:", MARGIN + 8, y - 26, { size: 8, bold: true, color: TEAL });
  text(d.dos || "____________", MARGIN + 90, y - 26, { size: 8, color: DARK });
  text("Provider NPI:", MARGIN + 220, y - 26, { size: 8, bold: true, color: TEAL });
  text(d.npi || "____________", MARGIN + 310, y - 26, { size: 8, color: DARK });
  text("Patient Type:", MARGIN + 8, y - 40, { size: 8, bold: true, color: TEAL });
  text(d.patientType ? d.patientType[0].toUpperCase() + d.patientType.slice(1) : "____________", MARGIN + 90, y - 40, { size: 8, color: DARK });
  text("Basis:", MARGIN + 220, y - 40, { size: 8, bold: true, color: TEAL });
  text(d.basis === "time" ? "Time-based" : d.basis === "mdm" ? "MDM-based" : "____________", MARGIN + 310, y - 40, { size: 8, color: DARK });
  y -= 68;

  // ---- Result box ----
  const finalCode = d.basis === "time" ? d.timeCode : d.mdmCode;
  const resultLabel =
    d.basis === "time"
      ? `${d.timeCode ?? "—"} — ${d.timeLabel ?? ""} (time-based)`
      : `${d.mdmCode ?? "—"} — ${d.mdmOverall ?? ""} complexity (MDM-based)`;

  page.drawRectangle({ x: MARGIN, y: y - 40, width: WIDTH, height: 40, borderColor: TEAL, borderWidth: 1, color: WHITE });
  text("RESULT", MARGIN + 10, y - 14, { size: 8, bold: true, color: TEAL });
  text(resultLabel, MARGIN + 10, y - 30, { size: 14, bold: true, color: DARK });
  y -= 52;

  // ---- MDM breakdown + downcode explanation ----
  if (d.basis === "mdm") {
    page.drawRectangle({ x: MARGIN, y: y - 20, width: WIDTH, height: 20, color: TEAL });
    text("MEDICAL DECISION MAKING ELEMENTS", MARGIN + 8, y - 14, { size: 8.5, bold: true, color: WHITE });
    y -= 20;
    page.drawRectangle({ x: MARGIN, y: y - 20, width: WIDTH, height: 20, borderColor: TEAL, borderWidth: 1, color: TEAL_LIGHT });
    text(`Problems: Level ${d.problemLevel || "—"}`, MARGIN + 10, y - 13, { size: 8.5, color: DARK });
    text(`Data: Level ${d.dataLevel || "—"}`, MARGIN + 220, y - 13, { size: 8.5, color: DARK });
    text(`Risk: Level ${d.riskLevel || "—"}`, MARGIN + 420, y - 13, { size: 8.5, color: DARK });
    y -= 30;

    const boxColor = d.wasDowncoded ? AMBER_LIGHT : WHITE;
    const borderColor = d.wasDowncoded ? AMBER : TEAL;
    const textColor = d.wasDowncoded ? AMBER : DARK;
    const explanation = d.wasDowncoded
      ? `Downcoded. Problems = Level ${d.problemLevel}, Data = Level ${d.dataLevel}, Risk = Level ${d.riskLevel} — these three elements are not all at the same level. Per ProEd policy, all three MDM elements must match; when they don't, the encounter is downcoded to the lowest of the three: Level ${d.mdmFinalLevel} (${d.mdmCode}).`
      : `No downcoding. All three MDM elements (Problems, Data, Risk) are at Level ${d.mdmFinalLevel} — code reflects that level directly.`;
    const lines = wrapText(explanation, WIDTH - 20, 8);
    const boxH = 16 + lines.length * 11;
    page.drawRectangle({ x: MARGIN, y: y - boxH, width: WIDTH, height: boxH, borderColor, borderWidth: 1, color: boxColor });
    text(d.wasDowncoded ? "DOWNCODING APPLIED" : "NO DOWNCODING", MARGIN + 10, y - 12, { size: 8, bold: true, color: textColor });
    lines.forEach((line, i) => {
      text(line, MARGIN + 10, y - 24 - i * 11, { size: 7.5, color: textColor });
    });
    y -= boxH + 14;
  }

  // ---- Disclaimer ----
  const disclaimerLines = wrapText(
    "This is a decision-support estimate, not a final coding determination — always verify against the full documentation and your organization's coding policy before billing.",
    WIDTH - 20,
    7.5,
    fontItalic
  );
  page.drawRectangle({ x: MARGIN, y: y - (14 + disclaimerLines.length * 10), width: WIDTH, height: 14 + disclaimerLines.length * 10, borderColor: TEAL_LIGHT, borderWidth: 1, color: WHITE });
  disclaimerLines.forEach((line, i) => {
    text(line, MARGIN + 8, y - 12 - i * 10, { size: 7.5, italic: true, color: GRAY });
  });
  y -= 14 + disclaimerLines.length * 10 + 24;

  // ---- Signature line ----
  text("Provider Signature: ____________________________   Date: ____________   Credentials: ____________", MARGIN, y, {
    size: 7.5,
    color: DARK,
  });
  y -= 30;

  // ---- Footer ----
  page.drawRectangle({ x: MARGIN, y: y - 18, width: WIDTH, height: 18, color: TEAL });
  text("ProEd Consulting & Staffing  ·  West Covina, California  ·  info@proedcs.com  ·  +1-626-771-3704", MARGIN + 8, y - 12, {
    size: 7,
    color: WHITE,
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `ProEdCS-EM-Level-${Date.now()}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes) as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
