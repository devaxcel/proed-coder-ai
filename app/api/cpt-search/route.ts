import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Searches the existing MedicalCode table, filtered to codeSystem = "CPT".
// No new schema/migration needed — CPT was already one of the three
// CodeSystem enum values this table was built to hold.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const results = await db.medicalCode.findMany({
    where: {
      codeSystem: "CPT",
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      code: true,
      description: true,
      isBillable: true,
      hccCategory: true,
      hedisMeasure: true,
      codingNotes: true,
    },
    orderBy: { code: "asc" },
    take: 50,
  });

  return NextResponse.json({ results });
}
