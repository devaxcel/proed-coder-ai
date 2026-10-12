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
  //  - Signed in with password but NOT yet enrolled  -> may only reach /mfa/setup + /api/mfa/*
  //  - Session created before MFA was enforced (no mfaV flag) -> sent to sign in again
  if (isMfaEnforced()) {
    const p = req.nextUrl.pathname;
    const u = req.auth.user as { mfaPending?: boolean; mfaV?: boolean } | undefined;
    const isMfaPath = p === "/mfa/setup" || p.startsWith("/api/mfa/");
    if (u?.mfaPending) {
      if (!isMfaPath) {
        if (p.startsWith("/api/")) {
          return Response.json({ error: "Set up your authenticator app to continue." }, { status: 403 });
        }
        return Response.redirect(new URL("/mfa/setup", req.nextUrl.origin));
      }
      return; // pending users stop here: nothing else is reachable
    }
    if (!u?.mfaV && p !== "/api/mfa/relogin") {
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
