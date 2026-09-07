import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowedCapabilities = (session?.user as { allowedCapabilities?: string[] } | undefined)?.allowedCapabilities ?? [];
  const canEdit = role === "ADMIN" || allowedCapabilities.includes("edit-legal");
  if (!session || !canEdit) {
    return NextResponse.json({ error: "You do not have permission to edit Legal & Disclaimers content" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const status = body.status === "PENDING_LICENSE" ? "PENDING_LICENSE" : "ACTIVE";

  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const section = await db.legalSection.update({
    where: { id },
    data: {
      title,
      content,
      status,
      updatedBy: (session.user as { email?: string } | undefined)?.email ?? null,
    },
  });

  return NextResponse.json({ section });
}
