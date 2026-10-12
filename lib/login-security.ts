import { db } from "./db";
import { MAX_FAILED_LOGINS, LOCKOUT_MINUTES } from "./mfa-config";

/** Best-effort audit trail (never blocks or breaks sign-in). */
export async function audit(action: string, userId: string | null, payload: Record<string, unknown> = {}) {
  try {
    await db.auditLog.create({ data: { action, userId, payload: payload as object } });
  } catch {
    /* ignore */
  }
}

export function isLocked(user: { lockedUntil: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
}

export function lockMinutesLeft(user: { lockedUntil: Date | null }): number {
  return user.lockedUntil ? Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)) : 0;
}

/** Count a failed password/code attempt; lock the account after MAX_FAILED_LOGINS. */
export async function registerFailure(userId: string, reason: string) {
  const u = await db.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });
  if (u.failedLoginCount >= MAX_FAILED_LOGINS) {
    await db.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60000), failedLoginCount: 0 },
    });
    await audit("account_locked", userId, { reason, minutes: LOCKOUT_MINUTES });
  } else {
    await audit("login_failed", userId, { reason, count: u.failedLoginCount });
  }
}

export async function clearFailures(userId: string) {
  await db.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
}
