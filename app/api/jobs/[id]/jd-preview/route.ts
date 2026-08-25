import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN is not configured." },
        { status: 500 }
      );
    }

    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        title: true,
        jdBlobPath: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.jdBlobPath) {
      return NextResponse.json(
        { error: "This job does not have a PDF JD." },
        { status: 404 }
      );
    }

    const result = await get(job.jdBlobPath, {
      access: "private",
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json(
        { error: "JD PDF blob not found." },
        { status: 404 }
      );
    }

    const filename = job.jdBlobPath.split("/").pop() || "job-description.pdf";

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType || "application/pdf",
        "Content-Length": String(result.blob.size),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error previewing JD PDF:", error);
    return NextResponse.json(
      { error: "Failed to preview JD PDF" },
      { status: 500 }
    );
  }
}
