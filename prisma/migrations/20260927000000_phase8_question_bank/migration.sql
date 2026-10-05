-- AlterTable
ALTER TABLE "QuestionBankItem"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "subcategory" TEXT,
  ADD COLUMN "experienceLevel" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "explanation" TEXT,
  ADD COLUMN "isAiGenerated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "InterviewAnswer" ADD COLUMN "questionBankItemId" TEXT;
ALTER TABLE "AIUsage" ALTER COLUMN "sessionId" DROP NOT NULL;
ALTER TABLE "AIUsage" ADD COLUMN "feature" TEXT NOT NULL DEFAULT 'INTERVIEW_ANSWER';

-- CreateTable
CREATE TABLE "QuestionFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionFavorite_userId_questionId_key" ON "QuestionFavorite"("userId", "questionId");
CREATE INDEX "QuestionFavorite_userId_createdAt_idx" ON "QuestionFavorite"("userId", "createdAt");
CREATE INDEX "QuestionBankItem_userId_createdAt_idx" ON "QuestionBankItem"("userId", "createdAt");
CREATE INDEX "QuestionBankItem_category_idx" ON "QuestionBankItem"("category");
CREATE INDEX "QuestionBankItem_difficulty_idx" ON "QuestionBankItem"("difficulty");
CREATE INDEX "QuestionBankItem_company_idx" ON "QuestionBankItem"("company");
CREATE INDEX "QuestionBankItem_jobRole_idx" ON "QuestionBankItem"("jobRole");
CREATE INDEX "QuestionBankItem_createdAt_idx" ON "QuestionBankItem"("createdAt");
CREATE INDEX "InterviewAnswer_sessionId_createdAt_idx" ON "InterviewAnswer"("sessionId", "createdAt");
CREATE INDEX "InterviewAnswer_questionBankItemId_idx" ON "InterviewAnswer"("questionBankItemId");

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionFavorite" ADD CONSTRAINT "QuestionFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionFavorite" ADD CONSTRAINT "QuestionFavorite_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewAnswer" ADD CONSTRAINT "InterviewAnswer_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
