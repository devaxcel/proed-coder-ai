import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const SaveBody = z.object({
  id: z.string().optional(),
  scenario: z.string().min(1).max(4000),
  draft: z.string().min(1).max(20000),
  formType: z.string().optional(),
  formPayload: z.unknown().optional(),
  headerPayload: z.unknown().optional(),
  citations: z.array(z.unknown()).optional(),
  status: z.enum(["DRAFT", "APPROVED", "SENT", "ARCHIVED"]).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = SaveBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const input = parsed.data;

  // Merge structured form payload into the citations JSON blob so the existing
  // schema doesn't need new columns (backward compatible). History page can
  // read it back out if needed.
  const citationsBlob = {
    formType: input.formType ?? "A",
    formPayload: input.formPayload ?? null,
    headerPayload: input.headerPayload ?? null,
    citations: input.citations ?? [],
  };

  try {
    if (input.id) {
      const updated = await db.queryForm.update({
        where: { id: input.id },
        data: {
          scenario: input.scenario,
          draft: input.draft,
          citations: citationsBlob as Prisma.InputJsonValue,
          status: input.status ?? "DRAFT",
        },
      });
      return NextResponse.json({ id: updated.id, updated: true });
    }
    const created = await db.queryForm.create({
      data: {
        scenario: input.scenario,
        draft: input.draft,
        citations: citationsBlob as Prisma.InputJsonValue,
        status: input.status ?? "DRAFT",
      },
    });
    return NextResponse.json({ id: created.id, created: true });
  } catch (e) {
    console.error("Save failed:", e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
