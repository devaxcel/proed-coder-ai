-- CreateTable
CREATE TABLE "Icd10TabularEntry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapterName" TEXT,
    "sectionName" TEXT,
    "categoryCode" TEXT,
    "includesNotes" JSONB,
    "excludes1Notes" JSONB,
    "excludes2Notes" JSONB,
    "inclusionTerms" JSONB,
    "codeFirstNotes" JSONB,
    "useAddlNotes" JSONB,
    "sevenChrNote" TEXT,
    "sourceYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Icd10TabularEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Icd10TabularEntry_code_key" ON "Icd10TabularEntry"("code");

-- CreateIndex
CREATE INDEX "Icd10TabularEntry_chapterName_idx" ON "Icd10TabularEntry"("chapterName");

-- CreateIndex
CREATE INDEX "Icd10TabularEntry_categoryCode_idx" ON "Icd10TabularEntry"("categoryCode");

-- CreateTable
CREATE TABLE "Icd10SectionNote" (
    "id" TEXT NOT NULL,
    "chapterName" TEXT NOT NULL,
    "sectionName" TEXT,
    "noteType" TEXT NOT NULL,
    "noteText" TEXT NOT NULL,
    "sourceYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Icd10SectionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Icd10SectionNote_chapterName_sectionName_idx" ON "Icd10SectionNote"("chapterName", "sectionName");

-- CreateTable
CREATE TABLE "HcpcsLevelIIEntry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL,
    "longDesc" TEXT,
    "coverageCode" TEXT,
    "actionCode" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "quarter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HcpcsLevelIIEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HcpcsLevelIIEntry_code_key" ON "HcpcsLevelIIEntry"("code");

-- CreateIndex
CREATE INDEX "HcpcsLevelIIEntry_quarter_idx" ON "HcpcsLevelIIEntry"("quarter");
