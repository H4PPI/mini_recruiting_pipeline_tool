import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { evaluateCandidateAgainstJD } from "@/lib/etl/ai-screener";
import { serializeJobWithCandidates } from "@/lib/jobs/serialize";

/**
 * POST /api/jobs/[id]/rematch
 *
 * Re-runs the AI screener for every candidate that has a draft resume
 * against this job's JD, refreshing matchScore / matchDetails / aiEvaluation.
 * Useful for testing the AI screener (e.g. after adding GEMINI_API_KEY)
 * without re-ingesting resumes via the ETL pipeline.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, title: true, jdText: true, jdBlobPath: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let jdTextForEval = job.jdText ?? "";
    if (!jdTextForEval && job.jdBlobPath) {
      const jdBlob = await get(job.jdBlobPath, { access: "private" });
      if (jdBlob) {
        jdTextForEval = await new Response(jdBlob.stream).text();
      }
    }

    const candidates = await prisma.candidate.findMany({
      where: { draftResumeBlobPath: { not: null } },
      select: { id: true, draftResumeBlobPath: true },
    });

    let matched = 0;
    let failed = 0;
    const errors: { candidateId: string; error: string }[] = [];

    for (const candidate of candidates) {
      try {
        const draft = await get(candidate.draftResumeBlobPath!, { access: "private" });
        if (!draft) throw new Error("Draft resume blob not found");
        const draftText = await new Response(draft.stream).text();

        const { matchScore, matchDetails, aiEvaluation } = await evaluateCandidateAgainstJD(
          draftText,
          jdTextForEval,
          job.title
        );

        await prisma.candidateJob.upsert({
          where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
          create: {
            candidateId: candidate.id,
            jobId: job.id,
            matchScore,
            matchDetails: matchDetails as unknown as Prisma.InputJsonValue,
            aiEvaluation,
          },
          update: {
            matchScore,
            matchDetails: matchDetails as unknown as Prisma.InputJsonValue,
            aiEvaluation,
          },
        });

        matched++;
      } catch (err) {
        failed++;
        errors.push({
          candidateId: candidate.id,
          error: err instanceof Error ? err.message : String(err),
        });
        console.error(`Rematch failed for candidate ${candidate.id}:`, err);
      }
    }

    const refreshedJob = await prisma.job.findUnique({
      where: { id: job.id },
      include: {
        candidates: {
          include: {
            candidate: true,
          },
          orderBy: {
            matchScore: "desc",
          },
        },
      },
    });

    return NextResponse.json({
      summary: { totalCandidates: candidates.length, matched, failed },
      ...(errors.length > 0 && { errors }),
      job: refreshedJob ? serializeJobWithCandidates(refreshedJob) : null,
    });
  } catch (error) {
    console.error("Error re-running matching for job:", error);
    return NextResponse.json(
      { error: "Failed to re-run matching" },
      { status: 500 }
    );
  }
}
