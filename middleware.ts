import { edgeAuth as auth } from "@/lib/auth.edge";
import { resolveCapabilityKey } from "@/lib/permissions";
import { isMfaEnforced } from "@/lib/mfa-config";

export default auth((req) => {
  // If not signed in, redirect to /login with return URL
  if (!req.auth) {
    const callbackUrl = req.nextUrl.pathname + req.nextUrl.search;
    const loginUrl = new URL(
      `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      req.nextUrl.origin
    );
    return Response.redirect(loginUrl);
  }

  // Two-factor authentication gate (only when MFA enforcement is switched on).
  //  - Fully verified sessions carry mfaV.
  //  - Sessions started while an Admin had 2FA switched off carry mfaOffUntil (epoch seconds) and are honoured until then.
  //  - Anything else (older sessions, expired "2FA off" sessions) is sent to sign in again.
  if (isMfaEnforced()) {
    const p = req.nextUrl.pathname;
    const u = req.auth.user as { mfaV?: boolean; mfaOffUntil?: number } | undefined;
    const offOk = typeof u?.mfaOffUntil === "number" && u.mfaOffUntil * 1000 > Date.now();
    if (!u?.mfaV && !offOk && p !== "/api/mfa/relogin") {
      if (p.startsWith("/api/")) {
        return Response.json({ error: "Please sign in again." }, { status: 401 });
      }
      return Response.redirect(new URL("/api/mfa/relogin", req.nextUrl.origin));
    }
  }

  // Configurable per-role tab/route access. Admin's allowedCapabilities
  // always contains everything (resolved in lib/auth.ts), so this never
  // blocks an Admin. For other roles, a path with no configured
  // restriction (resolveCapabilityKey returns null) passes through
  // unblocked — only paths matching a KNOWN capability are gated.
  const capabilityKey = resolveCapabilityKey(req.nextUrl.pathname);
  if (capabilityKey) {
    const allowed = ((req.auth.user as { allowedCapabilities?: string[] } | undefined)?.allowedCapabilities) ?? [];
    if (!allowed.includes(capabilityKey)) {
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return Response.json({ error: "You do not have access to this section." }, { status: 403 });
      }
      const unauthorizedUrl = new URL("/unauthorized", req.nextUrl.origin);
      return Response.redirect(unauthorizedUrl);
    }
  }
});

/**
 * Public paths (skip auth):
 *   - /login  (login page itself)
 *   - /api/auth/**  (NextAuth handlers)
 *   - /api/health   (uptime monitoring)
 *   - /_next/**     (Next.js static assets)
 *   - favicon/manifest/robots
 */
export const config = {
  matcher: [
    "/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)",
  ],
};
