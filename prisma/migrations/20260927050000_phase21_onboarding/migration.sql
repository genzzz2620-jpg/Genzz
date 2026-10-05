CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "User"
  ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "targetRole" TEXT,
  ADD COLUMN "experienceLevel" TEXT,
  ADD COLUMN "preferredLanguage" TEXT,
  ADD COLUMN "preferredAnswerFormat" TEXT,
  ADD COLUMN "preferredAIProvider" TEXT;
