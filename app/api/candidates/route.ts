import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PENDING_REVIEW_STATUS, PIPELINE_STAGES } from "@/lib/pipeline/stages";

/**
 * GET /api/candidates
 *
 * By default returns only candidates still awaiting HR review (used by the
 * Jobs page). Pass `?scope=tracker` to instead return candidates that have
 * been approved into the Application Tracker pipeline.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get("scope");
    const where =
      scope === "tracker"
        ? { pipelineStatus: { in: [...PIPELINE_STAGES] } }
        : { pipelineStatus: PENDING_REVIEW_STATUS };

    const rows = await prisma.candidate.findMany({
      where,
      orderBy: { ingestedAt: "desc" },
      include: {
        jobs: {
          include: { job: true },
          orderBy: { matchScore: "desc" },
        },
      },
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Error fetching candidates:", err);
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}
