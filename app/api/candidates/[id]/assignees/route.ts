import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/candidates/[id]/assignees
 *
 * Updates the HR users assigned to a candidate in the Application Tracker.
 * Body: { assignees: { name: string; email: string }[] }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const { assignees } = body as {
      assignees?: { name: string; email: string }[];
    };

    if (
      !Array.isArray(assignees) ||
      !assignees.every(
        (a) =>
          a &&
          typeof a.name === "string" &&
          typeof a.email === "string"
      )
    ) {
      return NextResponse.json(
        { error: "Invalid assignees" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: { assignees },
    });

    return NextResponse.json({ ok: true, candidate });
  } catch (err) {
    console.error("Error updating candidate assignees:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
