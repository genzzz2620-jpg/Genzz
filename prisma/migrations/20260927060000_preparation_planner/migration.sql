CREATE TYPE "PreparationTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

CREATE TABLE "PreparationPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetCompany" TEXT,
    "experienceLevel" TEXT NOT NULL,
    "jobDescription" TEXT,
    "resumeId" TEXT,
    "durationDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "overview" TEXT NOT NULL DEFAULT '',
    "focusAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "technicalTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "behavioralTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "resumeTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PreparationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreparationTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" "PreparationTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 20,
    "relatedQuestionId" TEXT,
    "relatedSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PreparationTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PreparationPlan_userId_status_updatedAt_idx" ON "PreparationPlan"("userId", "status", "updatedAt");
CREATE INDEX "PreparationTask_userId_scheduledDate_status_idx" ON "PreparationTask"("userId", "scheduledDate", "status");
CREATE INDEX "PreparationTask_planId_scheduledDate_idx" ON "PreparationTask"("planId", "scheduledDate");
ALTER TABLE "PreparationPlan" ADD CONSTRAINT "PreparationPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PreparationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_relatedQuestionId_fkey" FOREIGN KEY ("relatedQuestionId") REFERENCES "QuestionBankItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_relatedSessionId_fkey" FOREIGN KEY ("relatedSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
