/**
 * MFA on/off switch — kept free of Node-only imports so middleware can use it.
 *
 * Enforcement requires BOTH settings, so deploying this code can never lock
 * anyone out by accident:
 *   MFA_ENCRYPTION_KEY — encrypts authenticator secrets in the database
 *   MFA_ENFORCEMENT=on — turns the requirement on for everyone
 * Until both are set, sign-in behaves exactly as before.
 */
export function isMfaEnforced(): boolean {
  return process.env.MFA_ENFORCEMENT === "on" && !!process.env.MFA_ENCRYPTION_KEY;
}

/** Minutes of inactivity before automatic logoff (client-side timer). */
export const IDLE_TIMEOUT_MINUTES = Math.max(5, parseInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MIN ?? "30", 10) || 30);

/** Absolute session lifetime (seconds). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
