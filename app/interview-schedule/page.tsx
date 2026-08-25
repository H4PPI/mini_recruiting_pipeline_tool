"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/MainLayout";
import { fetchTrackerCandidates } from "@/lib/api/candidates";
import type { PipelineStage } from "@/lib/pipeline/stages";
import { serializeCandidateJob } from "@/lib/jobs/serialize";

interface ScheduledCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  stage: PipelineStage;
  scheduledAt: string;
  assignees: { name: string; email: string }[];
  googleMeetLink: string | null;
  interviewAttendees: string[];
}

// Stages that carry a scheduled date/time (kept in sync with the
// Application Tracker page's SCHEDULABLE_STAGES).
const SCHEDULABLE_STAGES: PipelineStage[] = [
  "Pre-Screen Pending",
  "First Interview",
  "Offer",
];

export default function InterviewSchedulePage() {
  const [items, setItems] = useState<ScheduledCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<PipelineStage | "All">("All");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchTrackerCandidates();
        if (!mounted) return;

        const mapped: ScheduledCandidate[] = data
          .filter(
            (c: any) =>
              c.scheduledAt &&
              SCHEDULABLE_STAGES.includes(c.pipelineStatus as PipelineStage)
          )
          .map((c: any) => {
            const jobMatches = Array.isArray(c.jobs) ? c.jobs : [];
            const bestMatch = jobMatches[0]
              ? serializeCandidateJob(jobMatches[0])
              : null;
            return {
              id: c.id,
              name: c.fullName || "",
              email: c.email || "",
              phone: c.phone || "",
              position: bestMatch?.job?.title || "Unknown",
              stage: c.pipelineStatus as PipelineStage,
              scheduledAt: c.scheduledAt,
              assignees: c.assignees || [],
              googleMeetLink: c.googleMeetLink || null,
              interviewAttendees: Array.isArray(c.interviewAttendees)
                ? c.interviewAttendees
                : [],
            };
          })
          .sort(
            (a: ScheduledCandidate, b: ScheduledCandidate) =>
              new Date(a.scheduledAt).getTime() -
              new Date(b.scheduledAt).getTime()
          );

        setItems(mapped);
      } catch (err) {
        console.error("Error loading interview schedule:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredItems = items.filter(
    (item) => stageFilter === "All" || item.stage === stageFilter
  );

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ScheduledCandidate[]>();
    for (const item of filteredItems) {
      const dateKey = new Date(item.scheduledAt).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const bucket = groups.get(dateKey) || [];
      bucket.push(item);
      groups.set(dateKey, bucket);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">
            Interview Schedule
          </h1>
          <p className="text-black/60">
            Upcoming pre-screen calls, first interviews, and offer discussions
            scheduled from the Application Tracker.
          </p>
        </div>

        <div className="bg-white border border-black/10 rounded-lg p-4">
          <label className="block text-sm font-semibold text-black mb-2">
            Stage
          </label>
          <select
            value={stageFilter}
            onChange={(e) =>
              setStageFilter(e.target.value as PipelineStage | "All")
            }
            className="w-full max-w-xs px-3 py-2 border border-black/20 rounded-lg bg-white text-sm text-black focus:outline-none focus:border-mainYellow"
          >
            <option value="All">All</option>
            {SCHEDULABLE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-black/60">Loading schedule...</p>
        ) : groupedByDate.length === 0 ? (
          <div className="bg-white border border-black/10 rounded-lg p-6 text-center text-sm text-black/60">
            No scheduled interviews yet. Set a date/time on a candidate card
            in the Application Tracker to see it here.
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByDate.map(([dateLabel, dayItems]) => (
              <div key={dateLabel}>
                <h2 className="text-sm font-bold text-black/70 mb-3">
                  {dateLabel}
                </h2>
                <div className="space-y-3">
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-black/10 rounded-lg p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold text-black">{item.name}</p>
                        <p className="text-xs text-black/60">
                          {item.position}
                        </p>
                        <p className="text-xs text-black/60">
                          {item.email} {item.phone && `• ${item.phone}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 sm:items-end">
                        <span className="inline-block px-3 py-1 rounded-full bg-mainYellow text-black text-xs font-semibold w-fit">
                          {item.stage}
                        </span>
                        <span className="text-sm font-semibold text-black">
                          {new Date(item.scheduledAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {item.assignees.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {item.assignees.map((a) => (
                              <span
                                key={a.email}
                                className="text-xs text-black/60"
                              >
                                {a.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.googleMeetLink && (
                          <a
                            href={item.googleMeetLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Join Google Meet →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
