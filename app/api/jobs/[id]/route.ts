import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  deleteJobDescriptionPdf,
  isPdfFile,
  uploadJobDescriptionPdf,
} from "@/lib/jobs/jd-storage";
import { prisma } from "@/lib/db";
import { PENDING_REVIEW_STATUS } from "@/lib/pipeline/stages";
import { serializeJobWithCandidates } from "@/lib/jobs/serialize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id },
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
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(serializeJobWithCandidates(job));
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const jdText = formData.get("jdText");
    const jdFile = formData.get("jdFile");

    const updateData: Prisma.JobUpdateInput = {};
    const existingJob = await prisma.job.findUnique({
      where: { id },
      select: { jdBlobPath: true },
    });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;

    let shouldDeleteOldPdf = false;

    if (isPdfFile(jdFile)) {
      updateData.jdBlobPath = await uploadJobDescriptionPdf(jdFile, id);
      updateData.jdText = null;
      shouldDeleteOldPdf =
        Boolean(existingJob.jdBlobPath) &&
        existingJob.jdBlobPath !== updateData.jdBlobPath;
    } else if (typeof jdText === "string") {
      updateData.jdText = jdText.trim() || null;
      updateData.jdBlobPath = null;
      shouldDeleteOldPdf = Boolean(existingJob.jdBlobPath);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const job = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        candidates: {
          include: {
            candidate: true,
          },
        },
      },
    });

    if (shouldDeleteOldPdf) {
      try {
        await deleteJobDescriptionPdf(existingJob.jdBlobPath);
      } catch (deleteError) {
        console.error("Error deleting old JD PDF:", deleteError);
      }
    }

    return NextResponse.json(serializeJobWithCandidates(job));
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.job.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { error: "Failed to delete job" },
      { status: 500 }
    );
  }
}
