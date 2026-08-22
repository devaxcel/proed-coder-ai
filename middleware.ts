import { auth } from "@/lib/auth";

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
