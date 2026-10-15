/**
 * Session shaping shared by the full auth instance (lib/auth.ts) and the
 * edge-safe one used by middleware (lib/auth.edge.ts).
 * MUST stay free of Node-only imports (node:crypto, bcrypt, Prisma) — middleware runs on the Edge runtime.
 */
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

export function shapeSession({ session, token }: { session: Session; token: JWT }): Session {
  if (session.user) {
    (session.user as { role?: string }).role = token.role as string | undefined;
    (session.user as { id?: string }).id = token.uid as string | undefined;
    (session.user as { mfaPending?: boolean }).mfaPending = token.mfaPending === true;
    (session.user as { mfaV?: boolean }).mfaV = token.mfaV === true;
    (session.user as { mfaOffUntil?: number }).mfaOffUntil = typeof token.mfaOffUntil === "number" ? token.mfaOffUntil : undefined;
    (session.user as { allowedCapabilities?: string[] }).allowedCapabilities =
      (token.allowedCapabilities as string[] | undefined) ?? [];
  }
  return session;
}
