import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const role = (session.user as { role?: string } | undefined)?.role;

  const sections = await db.legalSection.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ sections, canEdit: role === "ADMIN" });
}
