import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  icdCodes: z.string().optional().default(""),
  condition: z.string().optional().default(""),
  dos: z.string().optional().default(""),
  npi: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  checked: z.record(z.boolean()).optional().default({}),
});

const MONITORED = [
  "Vital signs reviewed (BP, weight, O2 sat, HR)",
  "Symptom frequency/severity documented",
  "Disease progression assessed",
  "Functional status/ADL impact noted",
  "Complications or new symptoms identified",
].map((label, i) => ({ id: `m${i + 1}`, label }));

const EVALUATED = [
  "Lab results reviewed & interpreted",
  "Imaging/diagnostic studies reviewed",
  "Medication efficacy assessed",
  "Side effects/tolerance evaluated",
  "Specialist reports reviewed",
].map((label, i) => ({ id: `e${i + 1}`, label }));

const ASSESSED = [
  "Condition status: Stable / Improving / Worsening",
  "Acute vs. chronic distinction documented",
  "Comorbidity interactions addressed",
  "Risk stratification noted",
  "Patient education/counseling addressed",
].map((label, i) => ({ id: `a${i + 1}`, label }));

const TREATED = [
  "Current medications listed with dosage",
  "New Rx or dosage change documented",
  "Referrals ordered or pending",
  "Procedures/interventions performed",
  "Follow-up plan & frequency specified",
].map((label, i) => ({ id: `t${i + 1}`, label }));

const QUICK_REF = [
  { hcc: "Diabetes w/ Complications (HCC 18/19)", codes: "E11.65, E11.40, E11.51, E11.319", must: "A1c value, insulin/oral med, complication, current management plan" },
  { hcc: "Congestive Heart Failure (HCC 85/86)", codes: "I50.20, I50.30, I50.40, I50.9", must: "EF%, NYHA class, diuretic/ARNI/BB, BNP/echo, fluid status" },
  { hcc: "CKD Stage 3–5 (HCC 136/137)", codes: "N18.3, N18.4, N18.5, N18.6", must: "eGFR value & trend, BMP reviewed, proteinuria, nephrology consult" },
  { hcc: "COPD/Asthma (HCC 111)", codes: "J44.0, J44.1, J45.50, J45.51", must: "Spirometry/FEV1, inhaler regimen, exacerbation frequency, O2 sat" },
  { hcc: "Vascular Disease (HCC 108/107)", codes: "I25.10, I70.213, I73.9, I71.4", must: "Statin therapy, antiplatelet use, imaging date, revascularization hx" },
];

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { icdCodes, condition, dos, npi, notes, checked } = parsed.data;

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

  const TEAL = rgb(0.059, 0.431, 0.467); // #0F6E77
  const TEAL_DARK = rgb(0.039, 0.333, 0.361); // #0A555C
  const TEAL_LIGHT = rgb(0.902, 0.957, 0.961); // #E6F4F5
  const WHITE = rgb(1, 1, 1);
  const DARK = rgb(0.122, 0.161, 0.216); // #1F2937
  const GRAY = rgb(0.42, 0.447, 0.502);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const MARGIN = 36;
  const WIDTH = 612 - MARGIN * 2;
  let y = 792 - MARGIN;

  function text(
    str: string,
    x: number,
    yPos: number,
    opts: { size?: number; bold?: boolean; italic?: boolean; color?: unknown; maxWidth?: number } = {}
  ) {
    const useFont = opts.bold ? fontBold : opts.italic ? fontItalic : font;
    const size = opts.size ?? 9;
    page.drawText(str, { x, y: yPos, size, font: useFont, color: opts.color ?? DARK });
  }

  function checkbox(x: number, yPos: number, isChecked: boolean) {
    const s = 8;
    page.drawRectangle({ x, y: yPos, width: s, height: s, borderColor: TEAL_DARK, borderWidth: 1, color: isChecked ? TEAL : WHITE });
    if (isChecked) {
      page.drawLine({ start: { x: x + 1.5, y: yPos + 4 }, end: { x: x + 3.2, y: yPos + 1.5 }, thickness: 1.2, color: WHITE });
      page.drawLine({ start: { x: x + 3.2, y: yPos + 1.5 }, end: { x: x + 6.5, y: yPos + 6.5 }, thickness: 1.2, color: WHITE });
    }
  }

  // ---- Header bar ----
  page.drawRectangle({ x: MARGIN, y: y - 46, width: WIDTH, height: 46, color: TEAL });
  text("MEAT Documentation Checklist", MARGIN + 12, y - 20, { size: 16, bold: true, color: WHITE });
  text("HCC Risk Adjustment Coding — Applicable to All Chronic Conditions", MARGIN + 12, y - 36, { size: 9, color: WHITE });
  text("proed", MARGIN + WIDTH - 60, y - 22, { size: 14, italic: true, color: WHITE });
  y -= 58;

  text(
    "Each chronic condition documented must demonstrate active management via MEAT criteria.",
    MARGIN,
    y,
    { size: 8, italic: true, color: GRAY }
  );
  y -= 18;

  // ---- Header fields ----
  page.drawRectangle({ x: MARGIN, y: y - 34, width: WIDTH, height: 34, color: TEAL_LIGHT });
  text("Date of Service:", MARGIN + 8, y - 12, { size: 8, bold: true, color: TEAL_DARK });
  text(dos || "____________", MARGIN + 90, y - 12, { size: 8, color: DARK });
  text("Provider NPI:", MARGIN + 220, y - 12, { size: 8, bold: true, color: TEAL_DARK });
  text(npi || "____________", MARGIN + 290, y - 12, { size: 8, color: DARK });
  text("ICD-10 Code(s):", MARGIN + 8, y - 26, { size: 8, bold: true, color: TEAL_DARK });
  text(icdCodes || "____________", MARGIN + 90, y - 26, { size: 8, color: DARK });
  text("Condition/Dx:", MARGIN + 220, y - 26, { size: 8, bold: true, color: TEAL_DARK });
  text(condition || "____________", MARGIN + 290, y - 26, { size: 8, color: DARK });
  y -= 46;

  // ---- MEAT 2x2 grid ----
  const colW = (WIDTH - 10) / 2;
  const quadrants: Array<{ letter: string; title: string; items: { id: string; label: string }[] }> = [
    { letter: "M", title: "MONITORED", items: MONITORED },
    { letter: "E", title: "EVALUATED", items: EVALUATED },
    { letter: "A", title: "ASSESSED/ADDRESSED", items: ASSESSED },
    { letter: "T", title: "TREATED", items: TREATED },
  ];

  const quadHeaderH = 16;
  const quadItemH = 13;
  const quadBodyH = quadItemH * 5 + 10;
  const quadTotalH = quadHeaderH + quadBodyH;

  for (let row = 0; row < 2; row++) {
    const rowY = y - row * (quadTotalH + 8);
    for (let col = 0; col < 2; col++) {
      const q = quadrants[row * 2 + col];
      const qx = MARGIN + col * (colW + 10);
      // Header
      page.drawRectangle({ x: qx, y: rowY - quadHeaderH, width: colW, height: quadHeaderH, color: TEAL });
      text(`${q.letter}  ${q.title}`, qx + 6, rowY - 12, { size: 8.5, bold: true, color: WHITE });
      // Body
      page.drawRectangle({ x: qx, y: rowY - quadTotalH, width: colW, height: quadBodyH, borderColor: TEAL, borderWidth: 1, color: WHITE });
      q.items.forEach((it, i) => {
        const iy = rowY - quadHeaderH - 12 - i * quadItemH;
        checkbox(qx + 6, iy - 2, !!checked[it.id]);
        text(it.label, qx + 18, iy, { size: 7, color: DARK });
      });
    }
  }
  y -= 2 * (quadTotalH + 8) - 8;

  // ---- Quick reference table ----
  page.drawRectangle({ x: MARGIN, y: y - 16, width: WIDTH, height: 16, color: TEAL });
  text("COMMON HCC QUICK REFERENCE — Documentation Must-Haves", MARGIN + 6, y - 11, { size: 8.5, bold: true, color: WHITE });
  y -= 16;

  const col1 = MARGIN;
  const col2 = MARGIN + 150;
  const col3 = MARGIN + 260;
  const rowH = 22;

  QUICK_REF.forEach((row, i) => {
    const ry = y - i * rowH;
    page.drawRectangle({ x: MARGIN, y: ry - rowH, width: WIDTH, height: rowH, color: i % 2 === 0 ? TEAL_LIGHT : WHITE });
    text(row.hcc, col1 + 4, ry - 10, { size: 6.8, bold: true, color: DARK });
    text(row.codes, col2 + 4, ry - 10, { size: 6.8, color: DARK });
    text(row.must, col3 + 4, ry - 8, { size: 6.3, color: DARK });
    text(row.must.length > 78 ? "" : "", col3 + 4, ry - 17, { size: 6.3, color: DARK });
  });
  y -= QUICK_REF.length * rowH + 14;

  // ---- Provider notes ----
  if (notes) {
    text("Provider Notes / Additional Documentation:", MARGIN, y, { size: 8, bold: true, color: TEAL_DARK });
    y -= 12;
    text(notes.slice(0, 200), MARGIN, y, { size: 8, color: DARK });
    y -= 20;
  }

  // ---- Attestation ----
  page.drawRectangle({ x: MARGIN, y: y - 34, width: WIDTH, height: 34, borderColor: TEAL, borderWidth: 1, color: WHITE });
  text(
    "Attestation: I certify that the above documentation reflects my clinical assessment",
    MARGIN + 6,
    y - 12,
    { size: 7.5, bold: true, color: TEAL_DARK }
  );
  text("and active management of the listed chronic condition(s).", MARGIN + 6, y - 22, { size: 7.5, color: DARK });
  y -= 44;

  text("Provider Signature: ____________________   Date: __________   Credentials: __________", MARGIN, y, {
    size: 7.5,
    color: DARK,
  });
  y -= 24;

  // ---- Footer ----
  page.drawRectangle({ x: MARGIN, y: y - 18, width: WIDTH, height: 18, color: TEAL });
  text("ProEd Consulting & Staffing  ·  West Covina, California  ·  info@proedcs.com  ·  +1-626-771-3704", MARGIN + 8, y - 12, {
    size: 7,
    color: WHITE,
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `ProEdCS-MEAT-HCC-Checklist-${Date.now()}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes) as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
