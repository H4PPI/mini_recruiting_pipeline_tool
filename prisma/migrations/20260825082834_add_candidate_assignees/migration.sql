-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "assignees" JSONB NOT NULL DEFAULT '[]';
