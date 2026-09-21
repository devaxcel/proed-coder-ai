import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const results = await db.covidVaccineCode.findMany({
    where: q
      ? {
          OR: [
            { manufacturer: { contains: q, mode: "insensitive" } },
            { productLabel: { contains: q, mode: "insensitive" } },
            { cvxCode: { contains: q, mode: "insensitive" } },
            { cvxTermDesc: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { manufacturer: "asc" },
  });

  return NextResponse.json({ results });
}
