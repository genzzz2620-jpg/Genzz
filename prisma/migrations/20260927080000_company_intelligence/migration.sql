CREATE TABLE "CompanyResearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "companyName" TEXT,
    "targetRole" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "location" TEXT,
    "jobDescription" TEXT NOT NULL DEFAULT '',
    "publicInformation" TEXT NOT NULL DEFAULT '',
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "aiModel" TEXT NOT NULL,
    "analysis" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyResearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyResearch_userId_updatedAt_idx" ON "CompanyResearch"("userId", "updatedAt");
CREATE INDEX "CompanyResearch_userId_companyName_targetRole_idx" ON "CompanyResearch"("userId", "companyName", "targetRole");
ALTER TABLE "CompanyResearch" ADD CONSTRAINT "CompanyResearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyResearch" ADD CONSTRAINT "CompanyResearch_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
