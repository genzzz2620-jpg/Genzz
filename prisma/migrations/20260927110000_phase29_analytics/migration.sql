ALTER TABLE "InterviewSession"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "durationSeconds" INTEGER;

CREATE INDEX "InterviewSession_userId_createdAt_idx" ON "InterviewSession"("userId", "createdAt");
CREATE INDEX "InterviewSession_userId_status_startedAt_idx" ON "InterviewSession"("userId", "status", "startedAt");
CREATE INDEX "InterviewSession_userId_jobTitle_startedAt_idx" ON "InterviewSession"("userId", "jobTitle", "startedAt");
CREATE INDEX "InterviewSession_userId_company_startedAt_idx" ON "InterviewSession"("userId", "company", "startedAt");
CREATE INDEX "InterviewAnswer_sessionId_questionType_createdAt_idx" ON "InterviewAnswer"("sessionId", "questionType", "createdAt");
