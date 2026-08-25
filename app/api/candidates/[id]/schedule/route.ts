import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/candidates/[id]/schedule
 *
 * Updates the scheduled date/time for a candidate's current pipeline stage
 * (Pre-Screen Call, First Interview, Offer discussion).
 * Body: { scheduledAt: string | null } (ISO datetime string, or null to clear)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const { scheduledAt } = body as { scheduledAt?: string | null };

    if (scheduledAt !== null && typeof scheduledAt !== "string") {
      return NextResponse.json(
        { error: "Invalid scheduledAt" },
        { status: 400 }
      );
    }

    const parsedDate = scheduledAt ? new Date(scheduledAt) : null;
    if (parsedDate && Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledAt" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: { scheduledAt: parsedDate },
    });

    return NextResponse.json({ ok: true, candidate });
  } catch (err) {
    console.error("Error updating candidate schedule:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
