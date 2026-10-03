import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Per-section "pop" instructions for the ICD-10 coding screen.
 *
 * GET /api/icd10/section?chapter=Endocrine%2C+nutritional+and+metabolic+diseases&section=Diabetes+mellitus+(E08-E13)
 *
 * Returns the broader notes CMS attaches at the chapter or section level
 * (not to one specific code), pulled from Icd10SectionNote. `section` is
 * optional — omit it to get every note CMS attaches to the whole chapter.
 *
 * Use this when a user opens a section as a whole (e.g. browsing "Diabetes
 * mellitus (E08-E13)"), as opposed to the per-code endpoint
 * (/api/icd10/code/[code]) used when they're looking at one specific code.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chapterName = searchParams.get("chapter")?.trim();
  const sectionName = searchParams.get("section")?.trim();

  if (!chapterName) {
    return NextResponse.json(
      { error: "Missing required query param: chapter" },
      { status: 400 }
    );
  }

  const notes = await db.icd10SectionNote.findMany({
    where: {
      chapterName,
      // When a section is given, return notes scoped to that section PLUS
      // chapter-wide notes (sectionName: null) — a coder looking at one
      // section should see both. Omit `section` entirely to get every note
      // for the whole chapter.
      ...(sectionName ? { OR: [{ sectionName }, { sectionName: null }] } : {}),
    },
    select: {
      id: true,
      chapterName: true,
      sectionName: true,
      noteType: true,
      noteText: true,
    },
    orderBy: [{ sectionName: "asc" }, { noteType: "asc" }],
  });

  return NextResponse.json({ chapterName, sectionName: sectionName ?? null, notes });
}
