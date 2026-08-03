-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "identity" TEXT,
    "wakeTime" TEXT,
    "sleepTime" TEXT,
    "availableSlots" TEXT,
    "fixedBlocks" TEXT,
    "peakEnergy" TEXT,
    "lowEnergy" TEXT,
    "preferences" TEXT,
    "longTermGoals" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stateType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "impactLevel" TEXT,
    "impactHint" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user',
    "confidence" REAL NOT NULL DEFAULT 0.9,
    "decisionWeight" REAL NOT NULL DEFAULT 0.5,
    "evidence" TEXT,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scope" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "source" TEXT NOT NULL DEFAULT 'system',
    "confidence" REAL NOT NULL DEFAULT 0.7,
    "evidence" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "supersededBy" TEXT,
    "validUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agent_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_feedbacks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agentAction" TEXT NOT NULL,
    "agentSuggestion" TEXT NOT NULL,
    "userResponse" TEXT NOT NULL,
    "userModification" TEXT,
    "modifiedField" TEXT,
    "originalValue" TEXT,
    "userValue" TEXT,
    "taskId" TEXT,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "decision_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionDetail" TEXT NOT NULL,
    "contextUsed" TEXT,
    "reasoning" TEXT,
    "userAccepted" BOOLEAN,
    "userFeedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_states_userId_stateType_idx" ON "user_states"("userId", "stateType");

-- CreateIndex
CREATE INDEX "user_states_userId_validUntil_idx" ON "user_states"("userId", "validUntil");

-- CreateIndex
CREATE INDEX "agent_memories_userId_memoryType_active_idx" ON "agent_memories"("userId", "memoryType", "active");

-- CreateIndex
CREATE INDEX "agent_memories_userId_scope_idx" ON "agent_memories"("userId", "scope");

-- CreateIndex
CREATE INDEX "agent_feedbacks_userId_agentAction_idx" ON "agent_feedbacks"("userId", "agentAction");

-- CreateIndex
CREATE INDEX "agent_feedbacks_userId_userResponse_idx" ON "agent_feedbacks"("userId", "userResponse");

-- CreateIndex
CREATE INDEX "agent_feedbacks_taskId_idx" ON "agent_feedbacks"("taskId");

-- CreateIndex
CREATE INDEX "decision_logs_userId_createdAt_idx" ON "decision_logs"("userId", "createdAt");
