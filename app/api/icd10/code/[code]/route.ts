import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Per-code "pop" instructions for the ICD-10 coding screen.
 *
 * GET /api/icd10/code/E11.9
 *
 * Returns the Includes / Excludes1 / Excludes2 / inclusion-term /
 * "code first" / "use additional code" notes CMS attaches directly to a
 * single ICD-10-CM code, pulled from Icd10TabularEntry (populated by
 * scripts/cms-data/parse-icd10-tabular-xml.ts).
 *
 * Any signed-in user can read this — it's reference material, not
 * something that needs role gating the way admin routes do.
 */

// Other parts of the app (e.g. the ICD-10 Alphabetic Index search) store
// codes without the decimal point ("E119"), while Icd10TabularEntry stores
// them in the normal "E11.9" display format. Normalize whatever comes in —
// strip anything that isn't a letter/digit, then reinsert the decimal
// after the 3rd character — so a lookup works regardless of which format
// the caller happens to send.
function normalizeIcd10Code(raw: string): string {
  const stripped = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (stripped.length <= 3) return stripped;
  return `${stripped.slice(0, 3)}.${stripped.slice(3)}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { code: rawCode } = await params;
  const code = normalizeIcd10Code(decodeURIComponent(rawCode));

  const entry = await db.icd10TabularEntry.findUnique({
    where: { code },
    select: {
      code: true,
      description: true,
      chapterName: true,
      sectionName: true,
      categoryCode: true,
      includesNotes: true,
      excludes1Notes: true,
      excludes2Notes: true,
      inclusionTerms: true,
      codeFirstNotes: true,
      useAddlNotes: true,
      sevenChrNote: true,
      sourceYear: true,
    },
  });

  if (!entry) {
    return NextResponse.json(
      { error: `No ICD-10 data found for code "${code}".` },
      { status: 404 }
    );
  }

  // Whether there's actually anything worth popping up — lets the UI decide
  // not to show a "Notes" trigger at all for a code with nothing attached.
  const hasNotes = [
    entry.includesNotes,
    entry.excludes1Notes,
    entry.excludes2Notes,
    entry.inclusionTerms,
    entry.codeFirstNotes,
    entry.useAddlNotes,
    entry.sevenChrNote,
  ].some((v) => (Array.isArray(v) ? v.length > 0 : !!v));

  return NextResponse.json({ ...entry, hasNotes });
}