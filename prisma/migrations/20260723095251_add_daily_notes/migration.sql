-- CreateTable
CREATE TABLE "daily_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "daily_notes_userId_date_idx" ON "daily_notes"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_notes_userId_date_key" ON "daily_notes"("userId", "date");
