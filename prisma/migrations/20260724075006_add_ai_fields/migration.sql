-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" TEXT NOT NULL DEFAULT 'inbox',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "startTime" DATETIME,
    "endTime" DATETIME,
    "deadline" DATETIME,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "temperature" TEXT NOT NULL DEFAULT 'normal',
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "snoozeUntil" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "complexity" TEXT,
    "riskLevel" TEXT,
    "dependencies" TEXT,
    "scheduleAdvice" TEXT,
    "phaseOrder" INTEGER NOT NULL DEFAULT 0,
    "cognitiveLoad" TEXT,
    "schedulingHint" TEXT,
    CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("actualMinutes", "completedAt", "createdAt", "deadline", "description", "endTime", "estimatedMinutes", "id", "importance", "parentId", "snoozeUntil", "sortOrder", "startTime", "status", "tags", "taskType", "temperature", "title", "updatedAt", "userId") SELECT "actualMinutes", "completedAt", "createdAt", "deadline", "description", "endTime", "estimatedMinutes", "id", "importance", "parentId", "snoozeUntil", "sortOrder", "startTime", "status", "tags", "taskType", "temperature", "title", "updatedAt", "userId" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");
CREATE INDEX "tasks_userId_taskType_idx" ON "tasks"("userId", "taskType");
CREATE INDEX "tasks_userId_deadline_idx" ON "tasks"("userId", "deadline");
CREATE INDEX "tasks_userId_snoozeUntil_idx" ON "tasks"("userId", "snoozeUntil");
CREATE INDEX "tasks_userId_completedAt_idx" ON "tasks"("userId", "completedAt");
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
