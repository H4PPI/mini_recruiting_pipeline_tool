-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "google_event_id" TEXT,
ADD COLUMN     "google_meet_link" TEXT,
ADD COLUMN     "interview_attendees" JSONB NOT NULL DEFAULT '[]';
