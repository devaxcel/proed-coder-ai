import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateFormADocx } from "@/lib/query-form-a-docx";
import type { FormAOutput, QueryFormHeaderInputs } from "@/lib/query-form-prompts";

export const runtime = "nodejs";

const Body = z.object({
  form: z.any(),
  header: z.any().optional(),
  citationsUsed: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const form = parsed.data.form as FormAOutput;
  const header = (parsed.data.header ?? {}) as QueryFormHeaderInputs;

  if (!form || typeof form !== "object" || !("clarification_question" in form)) {
    return NextResponse.json(
      { error: "Missing structured Form A data. Generate the query first." },
      { status: 400 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = await generateFormADocx({
      form,
      header,
      createdAt: new Date(),
      citationsUsed: parsed.data.citationsUsed,
    });
  } catch (e) {
    console.error("DOCX generation failed:", e);
    return NextResponse.json({ error: "DOCX generation failed" }, { status: 500 });
  }

  const filenameSafe = (form.query_id_suggestion || `Query-${Date.now()}`)
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
  const filename = `ProEdCS-FormA-${filenameSafe}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
