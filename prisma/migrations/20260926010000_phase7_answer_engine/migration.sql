-- CreateEnum
CREATE TYPE "AnswerVersionAction" AS ENUM ('INITIAL', 'REGENERATE', 'SHORTER', 'LONGER', 'SIMPLIFY', 'TECHNICAL', 'FORMAL', 'CONVERSATIONAL', 'BULLET', 'SCRIPT', 'STAR', 'EDIT');

-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN "technicalDepth" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "InterviewAnswer" ADD COLUMN "analysisJson" JSONB;

-- CreateTable
CREATE TABLE "AnswerVersion" (
    "id" TEXT NOT NULL,
    "interviewAnswerId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "action" "AnswerVersionAction" NOT NULL,
    "validationWarnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnswerVersion_interviewAnswerId_versionNumber_key" ON "AnswerVersion"("interviewAnswerId", "versionNumber");
CREATE INDEX "AIUsage_userId_createdAt_idx" ON "AIUsage"("userId", "createdAt");
CREATE INDEX "AIUsage_sessionId_createdAt_idx" ON "AIUsage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_interviewAnswerId_fkey" FOREIGN KEY ("interviewAnswerId") REFERENCES "InterviewAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
