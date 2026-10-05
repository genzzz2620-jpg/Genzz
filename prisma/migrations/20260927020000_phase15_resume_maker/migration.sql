CREATE TABLE "ResumeDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceResumeId" TEXT,
    "title" TEXT NOT NULL,
    "targetJobTitle" TEXT NOT NULL DEFAULT '',
    "targetCompany" TEXT NOT NULL DEFAULT '',
    "jobDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResumeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResumeDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResumeDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResumeDocument_userId_updatedAt_idx" ON "ResumeDocument"("userId", "updatedAt");
CREATE UNIQUE INDEX "ResumeDocumentVersion_documentId_version_key" ON "ResumeDocumentVersion"("documentId", "version");
CREATE INDEX "ResumeDocumentVersion_documentId_createdAt_idx" ON "ResumeDocumentVersion"("documentId", "createdAt");

ALTER TABLE "ResumeDocument" ADD CONSTRAINT "ResumeDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeDocument" ADD CONSTRAINT "ResumeDocument_sourceResumeId_fkey" FOREIGN KEY ("sourceResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResumeDocumentVersion" ADD CONSTRAINT "ResumeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ResumeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
