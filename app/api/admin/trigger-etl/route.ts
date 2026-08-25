import { NextResponse } from "next/server";
import { runResumeEtlPipeline } from "@/app/api/cron/etl-resumes/route";

/**
 * POST /api/admin/trigger-etl
 *
 * HR-triggered manual sync — lets the Jobs page kick off the same resume
 * ingestion pipeline that the daily Vercel Cron job runs, without needing
 * the CRON_SECRET (this route is meant to be called from within the app).
 */
export async function POST() {
  try {
    const result = await runResumeEtlPipeline();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Manual ETL trigger failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ETL pipeline failed" },
      { status: 500 }
    );
  }
}
