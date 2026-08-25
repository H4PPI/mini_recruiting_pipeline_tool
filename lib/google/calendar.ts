import { google } from "googleapis";

/**
 * Google Calendar integration used to auto-create a Google Meet-enabled
 * calendar event when a candidate is scheduled for an interview/offer call.
 *
 * Requires a Google Cloud service account with the Calendar API enabled and
 * (for a Workspace domain) domain-wide delegation if you want invites to be
 * sent from a real mailbox. Configure via env vars:
 *
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  (escape newlines as \n)
 *   GOOGLE_CALENDAR_ID                  (defaults to "primary")
 */

export interface CreateMeetingParams {
  summary: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  attendeeEmails: string[];
}

export interface CreateMeetingResult {
  eventId: string;
  meetLink: string | null;
  htmlLink: string | null;
}

function isGoogleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

function getAuthClient() {
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  );
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

/**
 * Creates a calendar event with an auto-generated Google Meet link and
 * invites the given attendees. Falls back to a mock result (no real Google
 * API call) when service account credentials aren't configured, so local
 * development works without Google Cloud setup.
 */
export async function createGoogleMeetEvent(
  params: CreateMeetingParams
): Promise<CreateMeetingResult> {
  if (!isGoogleCalendarConfigured()) {
    console.warn(
      "[google-calendar] GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY not set — returning mock meeting link."
    );
    return {
      eventId: `mock-${Date.now()}`,
      meetLink: "https://meet.google.com/mock-meeting-link",
      htmlLink: null,
    };
  }

  const auth = getAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  const res = await calendar.events.insert({
    calendarId,
    sendUpdates: "all",
    conferenceDataVersion: 1,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime },
      end: { dateTime: params.endTime },
      attendees: params.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const event = res.data;
  const meetEntry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video"
  );

  return {
    eventId: event.id || "",
    meetLink: meetEntry?.uri || event.hangoutLink || null,
    htmlLink: event.htmlLink || null,
  };
}

/** Deletes a previously-created calendar event (e.g. on reschedule/cancel). */
export async function deleteGoogleMeetEvent(eventId: string): Promise<void> {
  if (!isGoogleCalendarConfigured() || eventId.startsWith("mock-")) return;

  const auth = getAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  try {
    await calendar.events.delete({ calendarId, eventId, sendUpdates: "all" });
  } catch (err) {
    console.error("[google-calendar] Failed to delete event:", err);
  }
}
