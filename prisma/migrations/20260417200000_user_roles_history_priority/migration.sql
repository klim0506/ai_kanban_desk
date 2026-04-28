-- Add user role and color
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#93c5fd';

-- Add task priority and difficulty
ALTER TABLE "Task" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Task" ADD COLUMN "difficulty" INTEGER NOT NULL DEFAULT 2;

-- Change default column to SPRINT_BACKLOG (SQLite cannot alter default; handled in app layer)

-- Create TaskHistory
CREATE TABLE "TaskHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TaskHistory_taskId_idx" ON "TaskHistory"("taskId");
