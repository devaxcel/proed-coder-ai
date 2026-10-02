-- CreateEnum
CREATE TYPE "CodeSystem" AS ENUM ('ICD10CM', 'HCPCS', 'CPT');

-- CreateEnum
CREATE TYPE "ComplianceVisibility" AS ENUM ('INTERNAL', 'CLIENT_VISIBLE');

-- CreateEnum
CREATE TYPE "LegalSectionStatus" AS ENUM ('ACTIVE', 'PENDING_LICENSE');

-- CreateEnum
CREATE TYPE "QueryFormStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CODER', 'AUDITOR', 'CLIENT');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "ComplianceVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CovidVaccineCode" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "productLabel" TEXT NOT NULL,
    "cvxCode" TEXT NOT NULL,
    "cvxTermDesc" TEXT NOT NULL,
    "cvxShortDesc" TEXT NOT NULL,
    "virusStrain" TEXT,
    "ndcCodes" TEXT,
    "packaging" TEXT,
    "ageCohort" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CovidVaccineCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmeMueLimit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mueValue" INTEGER NOT NULL,
    "adjudicationIndicator" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmeMueLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmeposFeeSchedule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "modifier1" TEXT,
    "modifier2" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ceiling" DOUBLE PRECISION,
    "floor" DOUBLE PRECISION,
    "caNonRural" DOUBLE PRECISION,
    "caRural" DOUBLE PRECISION,
    "quarter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmeposFeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HcpcsCodeUpdate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "longDesc" TEXT NOT NULL,
    "shortDesc" TEXT,
    "actionCode" TEXT NOT NULL,
    "addDate" TEXT,
    "effectiveDate" TEXT,
    "termDate" TEXT,
    "quarter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HcpcsCodeUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Icd10RichDetail" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentCode" TEXT,
    "description" TEXT NOT NULL,
    "includes" TEXT[],
    "excludes1" TEXT[],
    "excludes2" TEXT[],
    "codeFirst" TEXT[],
    "useAdditionalCode" TEXT[],
    "codeAlso" TEXT[],
    "inclusionTerms" TEXT[],
    "sevenChrNote" TEXT[],
    "isCategory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Icd10RichDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Icd9Code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "longDesc" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL,
    "codeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Icd9Code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcdAlphabeticIndexEntry" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "code" TEXT,
    "seeRef" TEXT,
    "seeAlsoRef" TEXT,
    "letter" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IcdAlphabeticIndexEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcdHccMapping2024" (
    "id" TEXT NOT NULL,
    "icd10Code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "esrdV21" INTEGER,
    "esrdV24" INTEGER,
    "hccV22" INTEGER,
    "hccV24" INTEGER,
    "hccV28" INTEGER,
    "rxhccV05" INTEGER,
    "rxhccV08" INTEGER,
    "esrdV21Payment2024" BOOLEAN,
    "esrdV24Payment2024" BOOLEAN,
    "hccV22Payment2024" BOOLEAN,
    "hccV24Payment2024" BOOLEAN,
    "hccV28Payment2024" BOOLEAN,
    "rxhccV05Payment2024" BOOLEAN,
    "rxhccV08Payment2024" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcdHccMapping2024_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcdHccMapping2025" (
    "id" TEXT NOT NULL,
    "icd10Code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "esrdV21" INTEGER,
    "esrdV24" INTEGER,
    "hccV22" INTEGER,
    "hccV24" INTEGER,
    "hccV28" INTEGER,
    "rxhccV08" INTEGER,
    "esrdV21Payment2025" BOOLEAN,
    "esrdV24Payment2025" BOOLEAN,
    "hccV22Payment2025" BOOLEAN,
    "hccV24Payment2025" BOOLEAN,
    "hccV28Payment2025" BOOLEAN,
    "rxhccV08Payment2025" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcdHccMapping2025_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcdHccMapping2026" (
    "id" TEXT NOT NULL,
    "icd10Code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "esrdV21" INTEGER,
    "esrdV24" INTEGER,
    "hccV22" INTEGER,
    "hccV24" INTEGER,
    "hccV28" INTEGER,
    "rxhccV08" INTEGER,
    "esrdV21Payment2026" BOOLEAN,
    "esrdV24Payment2026" BOOLEAN,
    "hccV22Payment2026" BOOLEAN,
    "hccV24Payment2026" BOOLEAN,
    "hccV28Payment2026" BOOLEAN,
    "rxhccV08Payment2026" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcdHccMapping2026_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalSection" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "LegalSectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeSystem" "CodeSystem" NOT NULL,
    "description" TEXT NOT NULL,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "hccCategory" TEXT,
    "hccWeight" DOUBLE PRECISION,
    "hedisMeasure" TEXT,
    "codingNotes" TEXT,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "embedding" vector,

    CONSTRAINT "MedicalCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyChunk" (
    "id" TEXT NOT NULL,
    "policyDocId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,

    CONSTRAINT "PolicyChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryForm" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "scenario" TEXT NOT NULL,
    "draft" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "status" "QueryFormStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueryForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CODER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId" ASC);

-- CreateIndex
CREATE INDEX "ComplianceDocument_visibility_idx" ON "ComplianceDocument"("visibility" ASC);

-- CreateIndex
CREATE INDEX "CovidVaccineCode_cvxCode_idx" ON "CovidVaccineCode"("cvxCode" ASC);

-- CreateIndex
CREATE INDEX "DmeMueLimit_code_idx" ON "DmeMueLimit"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DmeMueLimit_code_key" ON "DmeMueLimit"("code" ASC);

-- CreateIndex
CREATE INDEX "DmeposFeeSchedule_code_idx" ON "DmeposFeeSchedule"("code" ASC);

-- CreateIndex
CREATE INDEX "DmeposFeeSchedule_quarter_idx" ON "DmeposFeeSchedule"("quarter" ASC);

-- CreateIndex
CREATE INDEX "HcpcsCodeUpdate_actionCode_idx" ON "HcpcsCodeUpdate"("actionCode" ASC);

-- CreateIndex
CREATE INDEX "HcpcsCodeUpdate_code_idx" ON "HcpcsCodeUpdate"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HcpcsCodeUpdate_code_quarter_key" ON "HcpcsCodeUpdate"("code" ASC, "quarter" ASC);

-- CreateIndex
CREATE INDEX "Icd10RichDetail_code_idx" ON "Icd10RichDetail"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Icd10RichDetail_code_key" ON "Icd10RichDetail"("code" ASC);

-- CreateIndex
CREATE INDEX "Icd10RichDetail_parentCode_idx" ON "Icd10RichDetail"("parentCode" ASC);

-- CreateIndex
CREATE INDEX "Icd9Code_codeType_idx" ON "Icd9Code"("codeType" ASC);

-- CreateIndex
CREATE INDEX "Icd9Code_code_idx" ON "Icd9Code"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Icd9Code_code_key" ON "Icd9Code"("code" ASC);

-- CreateIndex
CREATE INDEX "IcdAlphabeticIndexEntry_code_idx" ON "IcdAlphabeticIndexEntry"("code" ASC);

-- CreateIndex
CREATE INDEX "IcdAlphabeticIndexEntry_letter_idx" ON "IcdAlphabeticIndexEntry"("letter" ASC);

-- CreateIndex
CREATE INDEX "IcdAlphabeticIndexEntry_term_idx" ON "IcdAlphabeticIndexEntry"("term" ASC);

-- CreateIndex
CREATE INDEX "IcdHccMapping2024_hccV28_idx" ON "IcdHccMapping2024"("hccV28" ASC);

-- CreateIndex
CREATE INDEX "IcdHccMapping2024_icd10Code_idx" ON "IcdHccMapping2024"("icd10Code" ASC);

-- CreateIndex
CREATE INDEX "IcdHccMapping2025_hccV28_idx" ON "IcdHccMapping2025"("hccV28" ASC);

-- CreateIndex
CREATE INDEX "IcdHccMapping2025_icd10Code_idx" ON "IcdHccMapping2025"("icd10Code" ASC);

-- CreateIndex
CREATE INDEX "IcdHccMapping2026_hccV28_idx" ON "IcdHccMapping2026"("hccV28" ASC);

-- CreateIndex
CREATE INDEX "IcdHccMapping2026_icd10Code_idx" ON "IcdHccMapping2026"("icd10Code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LegalSection_sectionKey_key" ON "LegalSection"("sectionKey" ASC);

-- CreateIndex
CREATE INDEX "LegalSection_sortOrder_idx" ON "LegalSection"("sortOrder" ASC);

-- CreateIndex
CREATE INDEX "MedicalCode_codeSystem_idx" ON "MedicalCode"("codeSystem" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalCode_code_key" ON "MedicalCode"("code" ASC);

-- CreateIndex
CREATE INDEX "MedicalCode_hccCategory_idx" ON "MedicalCode"("hccCategory" ASC);

-- CreateIndex
CREATE INDEX "MedicalCode_hedisMeasure_idx" ON "MedicalCode"("hedisMeasure" ASC);

-- CreateIndex
CREATE INDEX "PolicyChunk_policyDocId_idx" ON "PolicyChunk"("policyDocId" ASC);

-- CreateIndex
CREATE INDEX "PolicyDocument_docType_idx" ON "PolicyDocument"("docType" ASC);

-- CreateIndex
CREATE INDEX "PolicyDocument_sourceName_idx" ON "PolicyDocument"("sourceName" ASC);

-- CreateIndex
CREATE INDEX "QueryForm_userId_idx" ON "QueryForm"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_capabilityKey_key" ON "RolePermission"("role" ASC, "capabilityKey" ASC);

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token" ASC);

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyChunk" ADD CONSTRAINT "PolicyChunk_policyDocId_fkey" FOREIGN KEY ("policyDocId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryForm" ADD CONSTRAINT "QueryForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

