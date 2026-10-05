ALTER TABLE "InterviewSession" ADD COLUMN "isSimulator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InterviewSession" ADD COLUMN "simulatorInterviewType" TEXT;
ALTER TABLE "InterviewSession" ADD COLUMN "simulatorDifficulty" TEXT;
ALTER TABLE "InterviewSession" ADD COLUMN "simulatorQuestionLimit" INTEGER;
ALTER TABLE "InterviewSession" ADD COLUMN "simulatorState" JSONB;
ALTER TABLE "InterviewSession" ADD COLUMN "simulatorFeedback" JSONB;
ALTER TABLE "InterviewAnswer" ADD COLUMN "simulatorQuestionNumber" INTEGER;
CREATE UNIQUE INDEX "InterviewAnswer_sessionId_simulatorQuestionNumber_key" ON "InterviewAnswer"("sessionId", "simulatorQuestionNumber");
CREATE INDEX "InterviewSession_userId_isSimulator_createdAt_idx" ON "InterviewSession"("userId", "isSimulator", "createdAt");
