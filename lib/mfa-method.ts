/**
 * Which second factor the whole app uses — chosen by an Admin (Admin > Sign-in Security).
 *   AUTHENTICATOR — authenticator app (TOTP) + backup codes      (default, the original behaviour)
 *   EMAIL         — 6-digit code emailed to the user's account address
 * Node-only (reads the database) — never import from middleware.
 */
import { db } from "./db";

export type MfaMethod = "AUTHENTICATOR" | "EMAIL";
export const MFA_METHOD_KEY = "mfaMethod";

export async function getMfaMethod(): Promise<MfaMethod> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: MFA_METHOD_KEY } });
    return row?.value === "EMAIL" ? "EMAIL" : "AUTHENTICATOR";
  } catch {
    // Settings table unavailable → fall back to the original behaviour rather than blocking sign-in.
    return "AUTHENTICATOR";
  }
}

export async function setMfaMethod(method: MfaMethod, updatedBy: string | null) {
  await db.appSetting.upsert({
    where: { key: MFA_METHOD_KEY },
    create: { key: MFA_METHOD_KEY, value: method, updatedBy },
    update: { value: method, updatedBy },
  });
}
