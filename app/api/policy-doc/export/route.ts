import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePolicyDocDocx } from "@/lib/policy-doc-docx";
import type { PolicyDocOutput } from "@/lib/policy-doc-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  policy: z.any(),
  references: z.array(z.any()).optional().default([]),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const policy = parsed.data.policy as PolicyDocOutput;
  const references = parsed.data.references as Array<{ n: number; source: string; docTitle: string; sourceUrl: string }>;

  if (!policy || typeof policy !== "object" || !Array.isArray(policy.sections)) {
    return NextResponse.json({ error: "Missing structured policy data. Generate the document first." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await generatePolicyDocDocx({ policy, references, createdAt: new Date() });
  } catch (e) {
    console.error("DOCX generation failed:", e);
    return NextResponse.json({ error: "DOCX generation failed" }, { status: 500 });
  }

  const filenameSafe = (policy.policy_number_suggestion || `Policy-${Date.now()}`).replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  const filename = `ProEdCS-Policy-${filenameSafe}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
