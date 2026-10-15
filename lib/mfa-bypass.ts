/**
 * Admin "turn 2FA off" switch (Admin > Sign-in Security).
 *   24h        — second factor is skipped for 24 hours, then switches itself back on (checked on every read, no timer needed)
 *   permanent  — skipped until an Admin turns it back on
 * Stored as one AppSetting row (key mfaBypass). Any read problem counts as "not bypassed" (secure default).
 * Node-only (reads the database) — never import from middleware.
 */
import { db } from "./db";
import { SESSION_MAX_AGE_SECONDS } from "./mfa-config";

export const MFA_BYPASS_KEY = "mfaBypass";
export const BYPASS_HOURS = 24;

export type BypassMode = "24h" | "permanent";
export type Bypass =
  | { active: false }
  | { active: true; mode: BypassMode; until: Date | null; since: string | null; by: string | null };

export async function getBypass(): Promise<Bypass> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: MFA_BYPASS_KEY } });
    if (!row) return { active: false };
    const v = JSON.parse(row.value) as { mode?: string; until?: string | null; since?: string; by?: string | null };
    if (v.mode === "permanent") return { active: true, mode: "permanent", until: null, since: v.since ?? null, by: v.by ?? null };
    if (v.mode === "24h") {
      const until = v.until ? new Date(v.until) : null;
      if (!until || isNaN(until.getTime()) || until.getTime() <= Date.now()) return { active: false }; // expired → 2FA is back on
      return { active: true, mode: "24h", until, since: v.since ?? null, by: v.by ?? null };
    }
    return { active: false };
  } catch {
    return { active: false };
  }
}

/** mode null = turn 2FA back on now. */
export async function setBypass(mode: BypassMode | null, by: string | null) {
  if (mode === null) {
    await db.appSetting.deleteMany({ where: { key: MFA_BYPASS_KEY } });
    return;
  }
  const now = new Date();
  const value = JSON.stringify({
    mode,
    until: mode === "24h" ? new Date(now.getTime() + BYPASS_HOURS * 3600_000).toISOString() : null,
    since: now.toISOString(),
    by,
  });
  await db.appSetting.upsert({
    where: { key: MFA_BYPASS_KEY },
    create: { key: MFA_BYPASS_KEY, value, updatedBy: by },
    update: { value, updatedBy: by },
  });
}

/**
 * Sessions created while 2FA is off carry an expiry (epoch seconds) that the middleware honours without a database lookup.
 * It never outlasts the bypass window, and never outlasts the normal session lifetime.
 */
export function offSessionUntil(b: Extract<Bypass, { active: true }>): number {
  const cap = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const end = b.until ? Math.min(b.until.getTime(), cap) : cap;
  return Math.floor(end / 1000);
}
