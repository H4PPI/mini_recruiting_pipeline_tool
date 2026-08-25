import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { INITIAL_PIPELINE_STAGE } from "@/lib/pipeline/stages";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const { candidateJobId } = body as { candidateJobId?: string };

    // Move candidate into the Application Tracker pipeline.
    await prisma.candidate.updateMany({
      where: { id: candidateId },
      data: { pipelineStatus: INITIAL_PIPELINE_STAGE },
    });

    // If candidateJobId provided, mark that CandidateJob as approved
    if (candidateJobId) {
      await prisma.candidateJob.updateMany({
        where: { id: candidateJobId },
        data: { status: "approved" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error approving candidate:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
