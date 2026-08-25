-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "ai_details" JSONB,
ADD COLUMN     "ai_score" DOUBLE PRECISION,
ADD COLUMN     "ai_summary" TEXT,
ADD COLUMN     "raw_resume_blob_path" TEXT,
ADD COLUMN     "raw_text" TEXT;
