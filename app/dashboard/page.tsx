"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MainLayout from "../components/MainLayout";
import {
  fetchPendingCandidates,
  fetchTrackerCandidates,
} from "@/lib/api/candidates";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/pipeline/stages";
import { serializeCandidateJob } from "@/lib/jobs/serialize";

interface JobSummary {
  id: string;
  title: string;
  candidates: { matchScore: number | null }[];
}

interface TrackerCandidate {
  id: string;
  fullName: string | null;
  pipelineStatus: PipelineStage;
  scheduledAt: string | null;
  assignees: { name: string; email: string }[];
  jobs: any[];
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  "Pre-Screen Pending": "bg-blue-100 text-blue-800",
  "First Interview": "bg-purple-100 text-purple-800",
  Offer: "bg-amber-100 text-amber-800",
  Hired: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-black/10 rounded-lg p-5">
      <p className="text-sm font-medium text-black/60">{label}</p>
      <p className="text-3xl font-bold text-black mt-1">{value}</p>
      {hint ? <p className="text-xs text-black/40 mt-1">{hint}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [trackerCandidates, setTrackerCandidates] = useState<
    TrackerCandidate[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [jobsRes, pending, tracker] = await Promise.all([
          fetch("/api/jobs").then((res) => {
            if (!res.ok) throw new Error("Failed to fetch jobs");
            return res.json();
          }),
          fetchPendingCandidates(),
          fetchTrackerCandidates(),
        ]);
        if (!mounted) return;
        setJobs(jobsRes);
        setPendingCount(Array.isArray(pending) ? pending.length : 0);
        setTrackerCandidates(tracker);
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) counts[stage] = 0;
    for (const candidate of trackerCandidates) {
      counts[candidate.pipelineStatus] = (counts[candidate.pipelineStatus] || 0) + 1;
    }
    return counts;
  }, [trackerCandidates]);

  const activeInPipeline = trackerCandidates.filter(
    (c) => c.pipelineStatus !== "Hired" && c.pipelineStatus !== "Rejected"
  ).length;

  const avgMatchScore = useMemo(() => {
    const scores = jobs
      .flatMap((job) => job.candidates.map((c) => c.matchScore))
      .filter((score): score is number => typeof score === "number");
    if (!scores.length) return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }, [jobs]);

  const upcomingInterviews = useMemo(() => {
    const now = Date.now();
    return trackerCandidates
      .filter((c) => c.scheduledAt && new Date(c.scheduledAt).getTime() >= now)
      .map((c) => {
        const bestMatch = c.jobs?.[0] ? serializeCandidateJob(c.jobs[0]) : null;
        return {
          id: c.id,
          name: c.fullName || "Unknown",
          stage: c.pipelineStatus,
          scheduledAt: c.scheduledAt as string,
          position: bestMatch?.job?.title || "Unknown",
        };
      })
      .sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
      .slice(0, 5);
  }, [trackerCandidates]);

  const topJobs = useMemo(() => {
    return [...jobs]
      .map((job) => ({
        id: job.id,
        title: job.title,
        candidateCount: job.candidates.length,
      }))
      .sort((a, b) => b.candidateCount - a.candidateCount)
      .slice(0, 5);
  }, [jobs]);

  if (loading) {
    return (
      <MainLayout>
        <p className="text-black/60">Loading dashboard...</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">Dashboard</h1>
          <p className="text-black/60">
            Overview of open jobs, candidate pipeline, and upcoming interviews.
          </p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Open Jobs" value={jobs.length} />
          <StatCard
            label="Pending Review"
            value={pendingCount}
            hint="Awaiting HR approval on the Jobs page"
          />
          <StatCard
            label="Active in Pipeline"
            value={activeInPipeline}
            hint="Excludes Hired / Rejected"
          />
          <StatCard
            label="Avg. AI Match Score"
            value={avgMatchScore !== null ? avgMatchScore : "—"}
            hint="Across all job/candidate matches"
          />
        </div>

        {/* Pipeline breakdown */}
        <div className="bg-white border border-black/10 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-black mb-4">
            Pipeline by Stage
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {PIPELINE_STAGES.map((stage) => (
              <div
                key={stage}
                className={`rounded-lg p-3 text-center ${STAGE_COLORS[stage]}`}
              >
                <p className="text-2xl font-bold">{stageCounts[stage] ?? 0}</p>
                <p className="text-xs font-medium mt-1">{stage}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming interviews */}
          <div className="bg-white border border-black/10 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-black">
                Upcoming Interviews
              </h2>
              <Link
                href="/interview-schedule"
                className="text-sm text-mainYellow font-semibold hover:underline"
              >
                View all →
              </Link>
            </div>
            {upcomingInterviews.length === 0 ? (
              <p className="text-sm text-black/40">No upcoming interviews scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingInterviews.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between border-b border-black/5 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-black">{item.name}</p>
                      <p className="text-xs text-black/50">
                        {item.position} · {item.stage}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-black/70 text-right">
                      {new Date(item.scheduledAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top jobs by candidate volume */}
          <div className="bg-white border border-black/10 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-black">
                Jobs with Most Candidates
              </h2>
              <Link
                href="/job"
                className="text-sm text-mainYellow font-semibold hover:underline"
              >
                View all →
              </Link>
            </div>
            {topJobs.length === 0 ? (
              <p className="text-sm text-black/40">No jobs created yet.</p>
            ) : (
              <ul className="space-y-3">
                {topJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between border-b border-black/5 pb-3 last:border-b-0 last:pb-0"
                  >
                    <p className="text-sm font-semibold text-black">{job.title}</p>
                    <span className="text-xs font-medium bg-black/5 text-black/70 rounded-full px-2 py-1">
                      {job.candidateCount} candidates
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
