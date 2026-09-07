import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function requireStaff() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "CLIENT") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Only ProEd staff can edit Compliance documents" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const visibility = body.visibility === "CLIENT_VISIBLE" ? "CLIENT_VISIBLE" : "INTERNAL";

  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const doc = await db.complianceDocument.update({
    where: { id },
    data: { title, content, visibility },
  });

  return NextResponse.json({ doc });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Only ProEd staff can delete Compliance documents" }, { status: 403 });
  }

  const { id } = await params;
  await db.complianceDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
