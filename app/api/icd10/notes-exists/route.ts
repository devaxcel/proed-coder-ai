import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Batch "which of these codes actually have CMS notes attached" check.
 *
 * POST /api/icd10/notes-exists   body: { codes: string[] }
 * ->   { withNotes: string[] }   (subset of the input codes that have at
 *                                 least one Includes/Excludes/instructional
 *                                 note attached)
 *
 * Used by the ICD-10 Index Search page to decide, BEFORE rendering, which
 * results should even get a "Notes" button — so a code with nothing
 * attached never shows a button at all, instead of showing one that opens
 * and then immediately closes once the per-code fetch comes back empty.
 * See components/Icd10NotesPopup.tsx for the matching client-side fix.
 */

// Same normalization as /api/icd10/code/[code] — some parts of the app
// (the Alphabetic Index search) store codes without the decimal point
// ("E119"), while Icd10TabularEntry stores "E11.9".
function normalizeIcd10Code(raw: string): string {
  const stripped = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (stripped.length <= 3) return stripped;
  return `${stripped.slice(0, 3)}.${stripped.slice(3)}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { codes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.codes) || body.codes.some((c) => typeof c !== "string")) {
    return NextResponse.json({ error: "Expected { codes: string[] }" }, { status: 400 });
  }

  const rawCodes = body.codes as string[];
  if (rawCodes.length > 200) {
    return NextResponse.json(
      { error: "Too many codes in one request (max 200)." },
      { status: 400 }
    );
  }

  // Map normalized code -> the ORIGINAL string the caller sent, so the
  // response can echo back whichever format the caller is using and it can
  // match against its own list without having to normalize anything itself.
  const normalizedToOriginal = new Map<string, string>();
  for (const raw of rawCodes) {
    normalizedToOriginal.set(normalizeIcd10Code(raw), raw);
  }
  const normalizedCodes = [...normalizedToOriginal.keys()];

  if (normalizedCodes.length === 0) {
    return NextResponse.json({ withNotes: [] });
  }

  const entries = await db.icd10TabularEntry.findMany({
    where: { code: { in: normalizedCodes } },
    select: {
      code: true,
      includesNotes: true,
      excludes1Notes: true,
      excludes2Notes: true,
      inclusionTerms: true,
      codeFirstNotes: true,
      useAddlNotes: true,
      sevenChrNote: true,
    },
  });

  const withNotes: string[] = [];
  for (const entry of entries) {
    const hasNotes = [
      entry.includesNotes,
      entry.excludes1Notes,
      entry.excludes2Notes,
      entry.inclusionTerms,
      entry.codeFirstNotes,
      entry.useAddlNotes,
      entry.sevenChrNote,
    ].some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
    if (hasNotes) {
      withNotes.push(normalizedToOriginal.get(entry.code) ?? entry.code);
    }
  }

  return NextResponse.json({ withNotes });
}
