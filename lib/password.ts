/**
 * Password hashing — bcryptjs is used deliberately over native `bcrypt`
 * because it's pure JavaScript with no compiled bindings, which matters
 * for Vercel's serverless functions (native bindings frequently fail to
 * build/run correctly there).
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
