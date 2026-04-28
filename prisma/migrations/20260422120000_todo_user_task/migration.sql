ALTER TABLE "TodoItem" ADD COLUMN "userId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "TodoItem" ADD COLUMN "taskId" INTEGER REFERENCES "Task"("id") ON DELETE SET NULL;
CREATE INDEX "TodoItem_userId_idx" ON "TodoItem"("userId");
CREATE INDEX "TodoItem_taskId_idx" ON "TodoItem"("taskId");
