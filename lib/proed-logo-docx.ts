/**
 * Shared helper for embedding the real ProEd logo image into DOCX exports.
 * Reads public/proed-logo.png from disk and returns a docx ImageRun.
 *
 * Usage in any DOCX generator (after dynamically importing "docx"):
 *
 *   const logoRun = await getLogoImageRun(docxLib);
 *   children.push(new Paragraph({ children: [logoRun], spacing: { after: 160 } }));
 */

import { readFile } from "fs/promises";
import path from "path";

// Original file is 2218×813px — keep this ratio (~2.729:1) at any size.
const LOGO_ASPECT_RATIO = 2218 / 813;
const DEFAULT_WIDTH = 190;
const DEFAULT_HEIGHT = Math.round(DEFAULT_WIDTH / LOGO_ASPECT_RATIO);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLogoImageRun(docxLib: any, widthPx: number = DEFAULT_WIDTH) {
  const { ImageRun } = docxLib;
  const heightPx = Math.round(widthPx / LOGO_ASPECT_RATIO);
  const logoPath = path.join(process.cwd(), "public", "proed-logo.png");
  const imageBuffer = await readFile(logoPath);

  return new ImageRun({
    data: imageBuffer,
    transformation: { width: widthPx, height: heightPx },
    type: "png",
  });
}

export { DEFAULT_WIDTH as LOGO_DEFAULT_WIDTH, DEFAULT_HEIGHT as LOGO_DEFAULT_HEIGHT };
