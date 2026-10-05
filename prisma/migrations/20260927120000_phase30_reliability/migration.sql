CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX "Resume_userId_createdAt_idx" ON "Resume"("userId", "createdAt");
CREATE INDEX "Resume_userId_processingStatus_createdAt_idx" ON "Resume"("userId", "processingStatus", "createdAt");
CREATE INDEX "Resume_processingStatus_updatedAt_idx" ON "Resume"("processingStatus", "updatedAt");
