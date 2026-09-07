import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const role = (session.user as { role?: string } | undefined)?.role;
  const isClient = role === "CLIENT";

  // CLIENT-role users only ever see CLIENT_VISIBLE documents. Every other
  // role (ProEd's own staff — Admin/Coder/Auditor) sees everything.
  const docs = await db.complianceDocument.findMany({
    where: isClient ? { visibility: "CLIENT_VISIBLE" } : undefined,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ docs, canEdit: !isClient });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "CLIENT") {
    return NextResponse.json({ error: "Only ProEd staff can create Compliance documents" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const visibility = body.visibility === "CLIENT_VISIBLE" ? "CLIENT_VISIBLE" : "INTERNAL";

  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const doc = await db.complianceDocument.create({
    data: {
      title,
      content,
      visibility,
      createdBy: (session.user as { email?: string } | undefined)?.email ?? null,
    },
  });

  return NextResponse.json({ doc });
}
