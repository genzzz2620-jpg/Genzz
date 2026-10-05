CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'SESSION_RESERVATION', 'SESSION_CONSUMPTION', 'REFUND', 'FREE_SESSION', 'ADJUSTMENT');

ALTER TABLE "InterviewSession"
  ADD COLUMN "creditUnits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "freePractice" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "practiceExpiresAt" TIMESTAMP(3);

CREATE TABLE "CreditAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balanceUnits" INTEGER NOT NULL DEFAULT 0,
  "reservedUnits" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "CreditTransactionType" NOT NULL,
  "amountUnits" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sessionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditReservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "amountUnits" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditCheckout" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerCheckoutId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "amountUnits" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CreditCheckout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditAccount_userId_key" ON "CreditAccount"("userId");
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX "CreditTransaction_sessionId_type_idx" ON "CreditTransaction"("sessionId", "type");
CREATE UNIQUE INDEX "CreditReservation_sessionId_key" ON "CreditReservation"("sessionId");
CREATE UNIQUE INDEX "CreditReservation_idempotencyKey_key" ON "CreditReservation"("idempotencyKey");
CREATE INDEX "CreditReservation_userId_status_createdAt_idx" ON "CreditReservation"("userId", "status", "createdAt");
CREATE UNIQUE INDEX "CreditCheckout_providerCheckoutId_key" ON "CreditCheckout"("providerCheckoutId");
CREATE INDEX "CreditCheckout_userId_createdAt_idx" ON "CreditCheckout"("userId", "createdAt");
CREATE INDEX "BillingWebhookEvent_createdAt_idx" ON "BillingWebhookEvent"("createdAt");

ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditCheckout" ADD CONSTRAINT "CreditCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
