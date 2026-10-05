CREATE TYPE "NotificationType" AS ENUM ('INTERVIEW_COMPLETED', 'FEEDBACK_READY', 'PREPARATION_TASK', 'PREPARATION_PLAN_UPDATED', 'RESUME_PROCESSED', 'RESUME_PROCESSING_FAILED', 'DESKTOP_CONNECTED', 'DESKTOP_DISCONNECTED', 'SUBSCRIPTION_UPDATED', 'PAYMENT_STATUS', 'SECURITY_EVENT', 'SYSTEM_NOTIFICATION');
CREATE TYPE "NotificationCategory" AS ENUM ('INTERVIEW', 'PREPARATION', 'RESUME', 'DESKTOP', 'SUBSCRIPTION', 'SECURITY', 'SYSTEM');
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "readAt" TIMESTAMP(3),
  "actionUrl" VARCHAR(300),
  "eventKey" VARCHAR(200),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "interview" BOOLEAN NOT NULL DEFAULT true,
  "preparation" BOOLEAN NOT NULL DEFAULT true,
  "resume" BOOLEAN NOT NULL DEFAULT true,
  "desktop" BOOLEAN NOT NULL DEFAULT true,
  "subscription" BOOLEAN NOT NULL DEFAULT true,
  "security" BOOLEAN NOT NULL DEFAULT true,
  "system" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_userId_eventKey_key" ON "Notification"("userId", "eventKey");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
