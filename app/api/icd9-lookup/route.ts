import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const codeType = req.nextUrl.searchParams.get("type") ?? "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const pageSize = 25;

  if (!q) {
    return NextResponse.json({ results: [], total: 0, page, pageSize });
  }

  const where: Record<string, unknown> = {
    OR: [
      { code: { contains: q.replace(/\./g, ""), mode: "insensitive" as const } },
      { longDesc: { contains: q, mode: "insensitive" as const } },
    ],
  };
  if (codeType === "DX" || codeType === "SG") where.codeType = codeType;

  const [results, total] = await Promise.all([
    db.icd9Code.findMany({
      where,
      orderBy: { code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.icd9Code.count({ where }),
  ]);

  return NextResponse.json({ results, total, page, pageSize });
}
