/**
 * Create or update a user account.
 *
 * Usage:
 *   npm run create-user -- <email> <password> <role> [name]
 *
 * Example:
 *   npm run create-user -- lupita@proedcs.com "StrongPass123!" ADMIN "Lupita De La Torre"
 *   npm run create-user -- coder1@proedcs.com "AnotherPass456!" CODER "Jane Coder"
 *
 * Roles: ADMIN | CODER | AUDITOR
 *
 * Running this again for an existing email UPDATES that user's password/
 * role/name rather than creating a duplicate — safe to re-run.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  const [, , email, password, role, ...nameParts] = process.argv;
  const name = nameParts.join(" ") || undefined;

  if (!email || !password || !role) {
    console.error(
      "\nUsage: npm run create-user -- <email> <password> <role> [name]\n" +
        'Example: npm run create-user -- lupita@proedcs.com "StrongPass123!" ADMIN "Lupita De La Torre"\n\n' +
        "Roles: ADMIN | CODER | AUDITOR\n"
    );
    process.exit(1);
  }

  const validRoles = ["ADMIN", "CODER", "AUDITOR"];
  if (!validRoles.includes(role.toUpperCase())) {
    console.error(`Invalid role "${role}". Must be one of: ${validRoles.join(", ")}`);
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await db.user.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      role: role.toUpperCase() as "ADMIN" | "CODER" | "AUDITOR",
      ...(name ? { name } : {}),
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      role: role.toUpperCase() as "ADMIN" | "CODER" | "AUDITOR",
      name,
    },
  });

  console.log(`\n✅ User ready:`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role:  ${user.role}`);
  console.log(`   Name:  ${user.name ?? "(not set)"}`);
  console.log(`\nThey can now log in at /login with this email + password.\n`);
}

main()
  .catch((e) => {
    console.error("\n❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
