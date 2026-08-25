-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "source_blob_path" TEXT NOT NULL,
    "full_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "experience" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "languages" JSONB NOT NULL DEFAULT '[]',
    "masked_text" TEXT,
    "draft_resume_blob_path" TEXT,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pipeline_status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_run_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_status" TEXT NOT NULL,
    "total_found" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error_details" JSONB NOT NULL DEFAULT '[]',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "etl_run_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidates_source_blob_path_key" ON "candidates"("source_blob_path");
