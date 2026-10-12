/**
 * Edge-safe NextAuth instance for middleware.
 *
 * Middleware only needs to READ the signed session cookie, never to sign anyone in,
 * so it gets a provider-less instance with the same secret and session shaping.
 * Keeping the sign-in code (bcrypt, Prisma, node:crypto TOTP) out of this file is what
 * lets the middleware deploy to the Edge runtime.
 */
import NextAuth from "next-auth";
import { shapeSession } from "./auth-shared";
import { SESSION_MAX_AGE_SECONDS } from "./mfa-config";

export const { auth: edgeAuth } = NextAuth({
  providers: [],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    async session(params) {
      return shapeSession(params as Parameters<typeof shapeSession>[0]);
    },
  },
});
