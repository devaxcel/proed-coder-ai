import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin can edit Legal & Disclaimers content" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const status = body.status === "PENDING_LICENSE" ? "PENDING_LICENSE" : "ACTIVE";

  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const section = await db.legalSection.update({
    where: { id: params.id },
    data: {
      title,
      content,
      status,
      updatedBy: (session.user as { email?: string } | undefined)?.email ?? null,
    },
  });

  return NextResponse.json({ section });
}
