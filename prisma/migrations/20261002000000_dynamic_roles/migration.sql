-- Dynamic roles: replace the hardcoded UserRole enum with a Role table
-- that the Admin > Roles page can add/rename/delete rows from.
--
-- Safe-order steps: create Role table + seed it BEFORE converting the
-- enum columns to text, so there's never a moment where User.role or
-- RolePermission.role point at a role that doesn't exist in Role yet.

-- 1. Create the Role table.
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");
CREATE INDEX "Role_key_idx" ON "Role"("key");

-- 2. Seed the 4 roles that already exist today, carrying over the exact
--    same key strings the UserRole enum used — no existing User or
--    RolePermission row changes meaning. ADMIN is marked isSystem so the
--    app and the Admin UI both refuse to delete or rename it.
INSERT INTO "Role" ("id", "key", "label", "isSystem", "createdAt", "updatedAt") VALUES
    (gen_random_uuid()::text, 'ADMIN',   'Admin',    true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'CODER',   'Coder',    false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'AUDITOR', 'Auditor',  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'CLIENT',  'Client',   false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Convert User.role from the UserRole enum to plain text. The enum's
--    text representation is identical to the values already in Role.key
--    (ADMIN/CODER/AUDITOR/CLIENT), so this is a direct, lossless cast.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CODER';

-- 4. Same conversion for RolePermission.role.
ALTER TABLE "RolePermission" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;

-- 5. Drop the now-unused enum type.
DROP TYPE "UserRole";
