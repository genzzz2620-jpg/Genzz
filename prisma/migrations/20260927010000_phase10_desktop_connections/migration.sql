CREATE TABLE "DesktopConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesktopConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopConnection_codeHash_key" ON "DesktopConnection"("codeHash");
CREATE UNIQUE INDEX "DesktopConnection_tokenHash_key" ON "DesktopConnection"("tokenHash");
CREATE INDEX "DesktopConnection_userId_sessionId_revokedAt_idx" ON "DesktopConnection"("userId", "sessionId", "revokedAt");
CREATE INDEX "DesktopConnection_codeExpiresAt_idx" ON "DesktopConnection"("codeExpiresAt");
CREATE INDEX "DesktopConnection_tokenExpiresAt_idx" ON "DesktopConnection"("tokenExpiresAt");
ALTER TABLE "DesktopConnection" ADD CONSTRAINT "DesktopConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesktopConnection" ADD CONSTRAINT "DesktopConnection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
