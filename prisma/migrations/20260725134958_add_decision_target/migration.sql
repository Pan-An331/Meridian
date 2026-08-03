-- AlterTable
ALTER TABLE "agent_feedbacks" ADD COLUMN "decisionLogId" TEXT;

-- AlterTable
ALTER TABLE "decision_logs" ADD COLUMN "reason" TEXT;
ALTER TABLE "decision_logs" ADD COLUMN "targetId" TEXT;

-- CreateIndex
CREATE INDEX "decision_logs_targetId_idx" ON "decision_logs"("targetId");
