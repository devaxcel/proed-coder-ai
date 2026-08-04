/**
 * NextAuth v5 configuration.
 *
 * MVP: single shared team password (Credentials provider).
 * Phase 5.2 (later): swap to email magic link via Resend for real multi-user.
 *
 * The Credentials provider requires JWT session strategy (not database),
 * which is actually ideal for Vercel serverless — no session table roundtrip.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "team",
      credentials: {
        password: { label: "Team password", type: "password" },
      },
      async authorize(credentials) {
        const password = credentials?.password;
        if (typeof password !== "string") return null;
        const expected = process.env.APP_PASSWORD;
        if (!expected) {
          console.warn("APP_PASSWORD not set — refusing to authenticate.");
          return null;
        }
        if (password !== expected) return null;
        return {
          id: "team",
          name: "ProEd Team",
          email: "team@proedcs.com",
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 }, // 30 days
  pages: { signIn: "/login" },
  trustHost: true,
});
