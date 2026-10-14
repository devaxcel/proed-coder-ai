-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailOtpHash" TEXT,
ADD COLUMN "emailOtpExpires" TIMESTAMP(3),
ADD COLUMN "emailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailOtpSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
