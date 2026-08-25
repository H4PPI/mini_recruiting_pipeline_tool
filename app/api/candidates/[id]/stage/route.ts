import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPipelineStage } from "@/lib/pipeline/stages";

/**
 * PATCH /api/candidates/[id]/stage
 *
 * Updates a candidate's `pipelineStatus` when they're moved between
 * Application Tracker stages (e.g. via drag & drop).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const { stage } = body as { stage?: string };

    if (!isPipelineStage(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: { pipelineStatus: stage },
    });

    return NextResponse.json({ ok: true, candidate });
  } catch (err) {
    console.error("Error updating candidate stage:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
