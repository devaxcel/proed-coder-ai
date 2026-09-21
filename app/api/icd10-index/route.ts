import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const pageSize = 25;

  if (!q) {
    return NextResponse.json({ results: [], total: 0, page, pageSize });
  }

  const where = {
    OR: [
      { term: { contains: q, mode: "insensitive" as const } },
      { fullPath: { contains: q, mode: "insensitive" as const } },
      { code: { contains: q.replace(/\./g, ""), mode: "insensitive" as const } },
    ],
  };

  const [results, total] = await Promise.all([
    db.icdAlphabeticIndexEntry.findMany({
      where,
      orderBy: [{ letter: "asc" }, { fullPath: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.icdAlphabeticIndexEntry.count({ where }),
  ]);

  return NextResponse.json({ results, total, page, pageSize });
}
