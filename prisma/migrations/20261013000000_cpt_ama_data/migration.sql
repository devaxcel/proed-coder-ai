-- CreateTable
CREATE TABLE "CptCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "longDesc" TEXT NOT NULL,
    "mediumDesc" TEXT,
    "shortDesc" TEXT,
    "consumerDesc" TEXT,
    "descEffective" TEXT,
    "testName" TEXT,
    "labName" TEXT,
    "manufacturer" TEXT,
    "releaseName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CptCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CptDeletedCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "yearDeleted" INTEGER NOT NULL,
    "descriptor" TEXT NOT NULL,

    CONSTRAINT "CptDeletedCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CptModifier" (
    "id" TEXT NOT NULL,
    "modifier" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "section" TEXT,

    CONSTRAINT "CptModifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CptCode_code_year_key" ON "CptCode"("code", "year");
CREATE INDEX "CptCode_code_idx" ON "CptCode"("code");
CREATE INDEX "CptCode_year_category_idx" ON "CptCode"("year", "category");
CREATE UNIQUE INDEX "CptDeletedCode_code_yearDeleted_key" ON "CptDeletedCode"("code", "yearDeleted");
CREATE INDEX "CptDeletedCode_code_idx" ON "CptDeletedCode"("code");
CREATE UNIQUE INDEX "CptModifier_modifier_year_key" ON "CptModifier"("modifier", "year");
