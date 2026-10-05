ALTER TABLE "Subscription"
    ADD COLUMN "provider" TEXT,
    ADD COLUMN "providerCustomerId" TEXT,
    ADD COLUMN "providerSubscriptionId" TEXT,
    ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
    ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
    ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");
CREATE INDEX "Subscription_userId_createdAt_idx" ON "Subscription"("userId", "createdAt");
CREATE INDEX "Subscription_providerCustomerId_idx" ON "Subscription"("providerCustomerId");
