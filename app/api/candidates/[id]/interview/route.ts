import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createGoogleMeetEvent, deleteGoogleMeetEvent } from "@/lib/google/calendar";

/**
 * POST /api/candidates/[id]/interview
 *
 * Schedules (or reschedules) an interview/offer-call for a candidate:
 * auto-creates a Google Calendar event with a Google Meet link and invites
 * the given attendee emails, then persists the schedule + meeting details
 * on the candidate row.
 *
 * Body: {
 *   scheduledAt: string;      // ISO datetime
 *   attendees: string[];      // attendee email addresses
 *   stage?: string;           // label used in the event title, e.g. "First Interview"
 *   description?: string;
 *   durationMinutes?: number; // defaults to 30
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      scheduledAt,
      attendees,
      stage,
      description,
      durationMinutes,
    } = body as {
      scheduledAt?: string;
      attendees?: string[];
      stage?: string;
      description?: string;
      durationMinutes?: number;
    };

    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledAt" },
        { status: 400 }
      );
    }

    const emailRe = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    const attendeeEmails = Array.isArray(attendees)
      ? attendees.filter((a) => typeof a === "string" && emailRe.test(a.trim()))
      : [];

    if (attendeeEmails.length === 0) {
      return NextResponse.json(
        { error: "At least one valid attendee email is required" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { fullName: true, googleEventId: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // If a meeting already exists for this candidate (rescheduling), remove
    // the old calendar event before creating the new one.
    if (candidate.googleEventId) {
      await deleteGoogleMeetEvent(candidate.googleEventId);
    }

    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + (durationMinutes || 30) * 60_000);
    const stageLabel = stage || "Interview";

    const meeting = await createGoogleMeetEvent({
      summary: `${stageLabel}: ${candidate.fullName || "Candidate"}`,
      description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      attendeeEmails,
    });

    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        scheduledAt: start,
        interviewAttendees: attendeeEmails,
        googleEventId: meeting.eventId,
        googleMeetLink: meeting.meetLink,
      },
    });

    return NextResponse.json({ ok: true, candidate: updated, meeting });
  } catch (err) {
    console.error("Error scheduling interview:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/candidates/[id]/interview
 *
 * Cancels a candidate's currently scheduled interview/offer-call: deletes
 * the Google Calendar event (if one exists) and clears the schedule fields
 * on the candidate row so it goes back to "awaiting scheduling". The
 * candidate can then be rescheduled via POST as usual.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { googleEventId: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    if (candidate.googleEventId) {
      await deleteGoogleMeetEvent(candidate.googleEventId);
    }

    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        scheduledAt: null,
        interviewAttendees: [],
        googleEventId: null,
        googleMeetLink: null,
      },
    });

    return NextResponse.json({ ok: true, candidate: updated });
  } catch (err) {
    console.error("Error cancelling interview:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
