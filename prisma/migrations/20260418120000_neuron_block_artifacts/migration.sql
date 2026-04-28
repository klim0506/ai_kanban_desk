-- SQLite: блок Нейрона и вложения к задачам
ALTER TABLE "Task" ADD COLUMN "neuronBlock" TEXT NOT NULL DEFAULT 'CHAT';
ALTER TABLE "Task" ADD COLUMN "artifacts" TEXT;
