import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";
import {
  deleteJobDescriptionPdf,
  isPdfFile,
  uploadJobDescriptionPdf,
} from "@/lib/jobs/jd-storage";
import { evaluateCandidateAgainstJD } from "@/lib/etl/ai-screener";
import { PENDING_REVIEW_STATUS } from "@/lib/pipeline/stages";

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        candidates: {
          // Candidates already approved into the Application Tracker pipeline
          // should no longer appear on the Jobs page.
          where: { candidate: { pipelineStatus: PENDING_REVIEW_STATUS } },
          include: {
            candidate: true,
          },
          orderBy: {
            matchScore: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let uploadedJdBlobPath: string | null = null;

  try {
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const jdText = formData.get("jdText");
    const jdFile = formData.get("jdFile");

    if (!title) {
      return NextResponse.json(
        { error: "Job title is required" },
        { status: 400 }
      );
    }

    const plainJdText = typeof jdText === "string" ? jdText.trim() : "";
    const hasPdfJd = isPdfFile(jdFile);

    if (!plainJdText && !hasPdfJd) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    const jdBlobPath = hasPdfJd
      ? await uploadJobDescriptionPdf(jdFile, jobId)
      : null;
    uploadedJdBlobPath = jdBlobPath;

    const job = await prisma.job.create({
      data: {
        id: jobId,
        title,
        description: description || null,
        jdBlobPath,
        jdText: hasPdfJd ? null : plainJdText,
      },
      include: {
        candidates: {
          include: {
            candidate: true,
          },
        },
      },
    });

    // After creating the job, evaluate existing candidates using the masked
    // draft resume (stored in blob) against this JD and create CandidateJob
    // entries with match scores so the jobs page can show AI-ranked candidates.
    const jdForAi = hasPdfJd && jdBlobPath ? null : plainJdText;

    if (jdForAi || jdBlobPath) {
      // Fetch all candidates that have a draftResumeBlobPath
      const candidates = await prisma.candidate.findMany({
        where: { draftResumeBlobPath: { not: null } },
        select: { id: true, draftResumeBlobPath: true },
      });

      for (const c of candidates) {
        try {
          // Read masked draft text from blob store (server-side)
          const draft = await get(c.draftResumeBlobPath! , { access: "private" });
          if (!draft) {
            console.error("Draft resume blob not found:", c.draftResumeBlobPath);
            continue;
          }
          const draftText = await new Response(draft.stream).text();

          // If JD is a PDF blob, try to fetch text from it; otherwise use pasted text
          let jdTextForEval = plainJdText;
          if (!plainJdText && jdBlobPath) {
            const jdBlob = await get(jdBlobPath, { access: "private" });
            if (!jdBlob) {
              console.error("JD blob not found:", jdBlobPath);
              continue;
            }
            jdTextForEval = await new Response(jdBlob.stream).text();
          }

          const { matchScore, matchDetails, aiEvaluation } = await evaluateCandidateAgainstJD(
            draftText,
            jdTextForEval || ""
          );

          // Upsert CandidateJob linking candidate to this job
          await prisma.candidateJob.upsert({
            where: { candidateId_jobId: { candidateId: c.id, jobId: job.id } },
            create: {
              candidateId: c.id,
              jobId: job.id,
              matchScore,
              matchDetails: matchDetails as any,
              aiEvaluation,
            },
            update: {
              matchScore,
              matchDetails: matchDetails as any,
              aiEvaluation,
            },
          });
        } catch (err) {
          console.error("Error evaluating candidate for job:", err);
        }
      }
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    await deleteJobDescriptionPdf(uploadedJdBlobPath);
    console.error("Error creating job:", error);
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }
}
