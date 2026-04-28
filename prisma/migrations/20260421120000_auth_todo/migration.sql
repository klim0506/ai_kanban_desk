ALTER TABLE "User" ADD COLUMN "login" TEXT;
ALTER TABLE "User" ADD COLUMN "password" TEXT;

UPDATE "User"
SET "login" = lower(replace("name", " ", "")) || '_' || CAST("id" AS TEXT),
    "password" = '1234'
WHERE "login" IS NULL OR "password" IS NULL;

CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

CREATE TABLE "TodoItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
