import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "CLIENT") {
    return NextResponse.json({ error: "Only ProEd staff can delete Compliance documents" }, { status: 403 });
  }

  await db.complianceDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
