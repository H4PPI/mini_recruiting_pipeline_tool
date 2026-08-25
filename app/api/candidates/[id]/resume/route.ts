import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { get } from "@vercel/blob";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const candidate = await prisma.candidate.findUnique({ where: { id }, select: { draftResumeBlobPath: true } });
    if (!candidate || !candidate.draftResumeBlobPath) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN not configured" }, { status: 500 });
    }

    const result = await get(candidate.draftResumeBlobPath, { access: "private" });
    if (!result) return NextResponse.json({ error: "Blob not found" }, { status: 404 });

    // Stream the blob back to the client with correct content type
    const headers: Record<string, string> = {
      "content-type": result.blob?.contentType || "text/plain",
      "cache-control": "no-store",
    };

    return new NextResponse(result.stream, { headers });
  } catch (err) {
    console.error("Error serving candidate resume:", err);
    return NextResponse.json({ error: "Failed to serve resume" }, { status: 500 });
  }
}
