/**
 * NextAuth v5 configuration — Phase 5.3: per-user accounts with roles.
 *
 * REPLACES the earlier shared-team-password approach. Each user now has
 * their own email + password, stored (hashed) in the User table, with a
 * role (ADMIN / CODER / AUDITOR) attached to their session.
 *
 * Users are created via the CLI script: scripts/create-user.ts
 * There is no public self-signup — an admin creates accounts.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import { checkPassword, verifySecondFactor } from "./login-flow";
import { audit, clearFailures, registerFailure } from "./login-security";
import { isMfaEnforced, SESSION_MAX_AGE_SECONDS } from "./mfa-config";
import { ALL_CAPABILITY_KEYS } from "./permissions";

async function getAllowedCapabilities(role: string): Promise<string[]> {
  // Admin always has full access, hardcoded — never governed by the
  // configurable table, so an Admin can never accidentally lock
  // themselves out by misconfiguring permissions.
  if (role === "ADMIN") return ALL_CAPABILITY_KEYS;

  const rows = await db.rolePermission.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { role: role as any, allowed: true },
    select: { capabilityKey: true },
  });
  return rows.map((r) => r.capabilityKey);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Authenticator code", type: "text" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const code = typeof credentials?.code === "string" ? credentials.code : "";

        // 1. Password (with lockout after repeated failures)
        const check = await checkPassword(email, password);
        if (check.state !== "ok") return null;
        const user = check.user;

        // 2. Second factor — only when MFA enforcement is on
        let mfaPending = false;
        let mfaV = false;
        if (isMfaEnforced()) {
          if (user.mfaEnabled && user.mfaSecretEnc) {
            const ok = await verifySecondFactor(user, code);
            if (!ok) {
              await registerFailure(user.id, "mfa_code");
              return null;
            }
            mfaV = true;
          } else {
            // Not enrolled yet: signed in only far enough to reach /mfa/setup.
            mfaPending = true;
          }
        }

        await clearFailures(user.id);
        await audit("login_success", user.id, { mfa: mfaV ? "verified" : mfaPending ? "enrollment_required" : "not_enforced" });

        return {
          id: user.id,
          name: user.name ?? user.email,
          email: user.email,
          role: user.role,
          mfaPending,
          mfaV,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS }, // 8 h absolute; idle logoff is enforced in the UI (IdleLogout)
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, `user` is populated — carry role/id onto the token,
      // and resolve+embed their allowed capabilities at this point.
      // NOTE: if Admin changes a role's permissions later, users of that
      // role who are already signed in will see the change take effect
      // the next time they sign in (JWTs aren't re-resolved mid-session).
      if (user) {
        const role = (user as { role?: string }).role;
        token.role = role;
        token.uid = user.id;
        token.mfaPending = (user as { mfaPending?: boolean }).mfaPending === true;
        token.mfaV = (user as { mfaV?: boolean }).mfaV === true;
        token.allowedCapabilities = role ? await getAllowedCapabilities(role) : [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string | undefined;
        (session.user as { id?: string }).id = token.uid as string | undefined;
        (session.user as { mfaPending?: boolean }).mfaPending = token.mfaPending === true;
        (session.user as { mfaV?: boolean }).mfaV = token.mfaV === true;
        (session.user as { allowedCapabilities?: string[] }).allowedCapabilities = (token.allowedCapabilities as string[] | undefined) ?? [];
      }
      return session;
    },
  },
});
