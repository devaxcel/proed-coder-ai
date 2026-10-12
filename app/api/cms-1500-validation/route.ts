import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkWithConventionRules } from "@/lib/icd10-with-convention-rules";
import { validateClaim, normDx, type Cms1500, type CodeLookups } from "@/lib/cms1500-rules";

export const runtime = "nodejs";

const line = z.object({
  dosFrom: z.string().max(10),
  dosTo: z.string().max(10),
  pos: z.string().max(2),
  emg: z.boolean(),
  procedure: z.string().max(10),
  modifiers: z.array(z.string().max(2)).max(8),
  dxPointers: z.string().max(12),
  charges: z.number().finite().min(0).max(10_000_000),
  units: z.number().finite().min(0).max(100000),
  renderingNpi: z.string().max(10),
});

const claimSchema = z.object({
  payerId: z.enum(["medicare-b", "medi-cal", "medicaid-other", "ma-commercial"]),
  box1: z.enum(["MEDICARE", "MEDICAID", "TRICARE", "CHAMPVA", "GROUP", "FECA", "OTHER"]),
  box1a: z.string().max(40), box2: z.string().max(80),
  box3Dob: z.string().max(10), box3Sex: z.enum(["M", "F", "X", ""]),
  box4: z.string().max(80), box5Address: z.string().max(120), box5City: z.string().max(60),
  box5State: z.string().max(2), box5Zip: z.string().max(10),
  box6: z.enum(["SELF", "SPOUSE", "CHILD", "OTHER", ""]),
  box10a: z.boolean(), box10b: z.boolean(), box10bState: z.string().max(2), box10c: z.boolean(),
  box11: z.string().max(40), box11d: z.boolean(),
  box12SignedOnFile: z.boolean(), box13SignedOnFile: z.boolean(),
  box14Date: z.string().max(10),
  box17Qualifier: z.enum(["", "DN", "DK", "DQ"]), box17Name: z.string().max(80), box17bNpi: z.string().max(10),
  box21: z.array(z.string().max(12)).max(14), box21Icd: z.enum(["0", "9", ""]),
  box22Code: z.string().max(3), box22OrigRef: z.string().max(40), box23: z.string().max(40),
  lines: z.array(line).max(12),
  box25: z.string().max(11), box25Type: z.enum(["EIN", "SSN"]), box26: z.string().max(40),
  box27AcceptAssignment: z.boolean(),
  box28: z.number().finite(), box29: z.number().finite(),
  box31SignedDate: z.string().max(10),
  box32Name: z.string().max(120), box32Npi: z.string().max(10),
  box33Name: z.string().max(120), box33Npi: z.string().max(10),
});

const bodySchema = z.object({
  claim: claimSchema,
  overrides: z.object({ timelyFilingDays: z.number().int().min(1).max(1000).optional() }).optional(),
});

// The DB stores ICD-10-CM codes WITHOUT the decimal point (E1140, not E11.40).
const undot = (c: string) => c.replace(/\./g, "").toUpperCase();

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid claim data", details: parsed.error.flatten() }, { status: 400 });
  }
  const claim = parsed.data.claim as Cms1500;

  const dxCodes = Array.from(new Set(claim.box21.map(normDx).filter(Boolean)));
  const hcpcsCodes = Array.from(
    new Set(claim.lines.map((l) => l.procedure.trim().toUpperCase()).filter((p) => /^[A-V][0-9]{4}$/.test(p)))
  );

  const lookups: CodeLookups = { icd10: {}, hcpcs: {} };
  try {
    const [dxRows, hcpcsRows, updates, mues] = await Promise.all([
      dxCodes.length
        ? db.medicalCode.findMany({ where: { codeSystem: "ICD10CM", code: { in: dxCodes.map(undot) } }, select: { code: true, isBillable: true, description: true } })
        : Promise.resolve([]),
      hcpcsCodes.length
        ? db.medicalCode.findMany({ where: { codeSystem: "HCPCS", code: { in: hcpcsCodes } }, select: { code: true, description: true } })
        : Promise.resolve([]),
      hcpcsCodes.length
        ? db.hcpcsCodeUpdate.findMany({ where: { code: { in: hcpcsCodes }, actionCode: "D" }, orderBy: { createdAt: "desc" } })
        : Promise.resolve([]),
      hcpcsCodes.length
        ? db.dmeMueLimit.findMany({ where: { code: { in: hcpcsCodes } } })
        : Promise.resolve([]),
    ]);
    for (const c of dxCodes) {
      const r = dxRows.find((x) => x.code === undot(c));
      lookups.icd10![c] = { exists: !!r, billable: r?.isBillable ?? false, description: r?.description };
    }
    for (const c of hcpcsCodes) {
      const r = hcpcsRows.find((x) => x.code === c);
      const u = updates.find((x) => x.code === c);
      const m = mues.find((x) => x.code === c);
      lookups.hcpcs![c] = {
        exists: !!r || !!u || !!m,
        description: r?.description,
        discontinued: u ? { termDate: u.termDate, quarter: u.quarter } : null,
        mue: m ? m.mueValue : null,
      };
    }
  } catch (e) {
    // DB unavailable: still run the deterministic rules, and say so.
    console.error("[cms-1500-validation] lookup failed", e);
    lookups.icd10 = undefined;
    lookups.hcpcs = undefined;
  }

  lookups.withConventionFlags = checkWithConventionRules(dxCodes).map((r) => ({
    title: r.label,
    guidance: `${r.guidance} (${r.citation})`,
  }));

  const result = validateClaim(claim, { overrides: parsed.data.overrides, lookups });
  return NextResponse.json({
    ...result,
    payer: { id: result.payer.id, name: result.payer.name, timelyFilingNote: result.payer.timelyFilingNote },
    codeLookupAvailable: !!lookups.icd10,
    cptNote: "CPT codes are format-checked only (AMA CPT license not loaded). HCPCS Level II and ICD-10-CM are checked against the app's code tables.",
    lookups: { icd10: lookups.icd10 ?? {}, hcpcs: lookups.hcpcs ?? {} },
  });
}
