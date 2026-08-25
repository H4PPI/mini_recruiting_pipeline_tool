"use client";

import MainLayout from "../components/MainLayout";
import Link from "next/link";
import { useState, useEffect } from "react";
import JobForm from "../components/jobs/JobForm";
import JobList from "../components/jobs/JobList";
import Button from "../components/ui/Button";
import type { CandidateJob, Skill, Job } from "../types/jobs";
import { approveCandidate, fetchPendingCandidates } from "@/lib/api/candidates";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showFullJd, setShowFullJd] = useState(false);
  const [approvedCandidateIds, setApprovedCandidateIds] = useState<string[]>([]);
  const [candidateMatches, setCandidateMatches] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [syncingResumes, setSyncingResumes] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [approvedStatus, setApprovedStatus] = useState<{
    candidateName: string;
  } | null>(null);

  const loadJobs = () => {
    setLoading(true);
    return fetch("/api/jobs")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch jobs");
        return response.json() as Promise<Job[]>;
      })
      .then((data) => {
        setJobs(data);
        return data;
      })
      .catch((error) => {
        console.error("Error fetching jobs:", error);
        return [] as Job[];
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleSyncResumes = async () => {
    setSyncingResumes(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/trigger-etl", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to sync resumes");
      }
      const { processed, skipped, failed, totalFound } = data.summary ?? {};
      setSyncResult({
        type: failed > 0 ? "error" : "success",
        message: `Found ${totalFound ?? 0} resumes — processed ${processed ?? 0}, skipped ${skipped ?? 0}, failed ${failed ?? 0}.`,
      });

      // Refresh jobs (candidate match counts) and the currently selected job's
      // candidate list so newly ingested resumes show up immediately.
      const updatedJobs = await loadJobs();
      if (selectedJob) {
        const refreshedSelected = updatedJobs.find((j) => j.id === selectedJob.id);
        if (refreshedSelected) setSelectedJob(refreshedSelected);
      }
    } catch (error) {
      console.error("Error syncing resumes:", error);
      setSyncResult({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to sync resumes",
      });
    } finally {
      setSyncingResumes(false);
    }
  };

  const handleRematch = async () => {
    if (!selectedJob) return;
    setRematching(true);
    setRematchResult(null);
    try {
      const res = await fetch(`/api/jobs/${selectedJob.id}/rematch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to re-run matching");
      }
      const { totalCandidates, matched, failed } = data.summary ?? {};
      setRematchResult({
        type: failed > 0 ? "error" : "success",
        message: `Re-evaluated ${matched ?? 0}/${totalCandidates ?? 0} candidates against this JD (${failed ?? 0} failed).`,
      });

      if (data.job) {
        setSelectedJob(data.job);
        setJobs((currentJobs) =>
          currentJobs.map((job) => (job.id === data.job.id ? data.job : job))
        );
      }
    } catch (error) {
      console.error("Error re-running matching:", error);
      setRematchResult({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to re-run matching",
      });
    } finally {
      setRematching(false);
    }
  };

  const handleJobAdded = (newJob: Job) => {
    setJobs([newJob, ...jobs]);
    setSelectedJob(newJob);
    setShowJobForm(false);
    setShowFullJd(false);
  };

  const handleJobDeleted = (jobId: string) => {
    setJobs(jobs.filter((job) => job.id !== jobId));
    setSelectedJob(null);
    setEditingJob(null);
    setShowFullJd(false);
  };

  const handleJobSelected = (job: Job) => {
    setSelectedJob(job);
    setEditingJob(null);
    setShowFullJd(false);
    setRematchResult(null);
  };

  const handleJobUpdated = (updatedJob: Job) => {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === updatedJob.id ? updatedJob : job))
    );
    setSelectedJob(updatedJob);
    setEditingJob(null);
    setShowFullJd(true);
  };

  const handleCandidateApproved = (candidateJobId: string) => {
    const cj = candidateMatches.find((c) => c.id === candidateJobId);
    const candidateId = cj?.candidate?.id;

    // Optimistically remove the candidate from the Jobs page — once approved
    // they belong on the Application Tracker board instead.
    setApprovedCandidateIds((currentIds) =>
      currentIds.includes(candidateJobId)
        ? currentIds
        : [...currentIds, candidateJobId]
    );

    if (!candidateId) return;
    approveCandidate(candidateId, candidateJobId)
      .then(() => {
        setApprovedStatus({
          candidateName: cj?.candidate?.fullName || "Candidate",
        });
      })
      .catch((err) => {
        console.error("Approve API failed", err);
      });
  };

  useEffect(() => {
    if (!selectedJob) return;
    let mounted = true;
    const jobId = selectedJob.id;
    async function loadJobCandidates() {
      try {
        setLoadingCandidates(true);
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Failed to fetch job details");
        const data = await res.json();
        if (!mounted) return;
        let list = data.candidates ?? [];
        if (!list || list.length === 0) {
          // fallback: load candidates still awaiting HR review
          try {
            list = (await fetchPendingCandidates()).map((c: any) => ({
              id: `cj-${c.id}`,
              matchScore: 0,
              status: "hr_review",
              candidate: c,
            }));
          } catch (e) {
            console.error("Fallback load candidates failed:", e);
          }
        }
        setCandidateMatches(list);
      } catch (err) {
        console.error("Error loading job candidates:", err);
        setCandidateMatches([]);
      } finally {
        setLoadingCandidates(false);
      }
    }

    loadJobCandidates();
    return () => {
      mounted = false;
    };
  }, [selectedJob]);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Jobs</h1>
            <p className="text-black/60">
              Manage job positions and view matched candidates
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleSyncResumes}
              disabled={syncingResumes}
              className="px-6"
            >
              {syncingResumes ? "Syncing..." : "Sync Resumes (ETL)"}
            </Button>
            <Button
              onClick={() => {
                setShowJobForm(!showJobForm);
                setEditingJob(null);
              }}
              className="px-6"
            >
              {showJobForm ? "Cancel" : "+ Add Job"}
            </Button>
          </div>
        </div>

        {syncResult && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              syncResult.type === "success"
                ? "border-mainYellow bg-mainYellow/10 text-black/80"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {syncResult.message}
          </div>
        )}

        {/* Job Form */}
        {showJobForm && (
          <div className="mb-8">
            <JobForm
              onJobAdded={handleJobAdded}
              onCancel={() => setShowJobForm(false)}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jobs List */}
          <div className="lg:col-span-1">
            <JobList
              jobs={jobs}
              loading={loading}
              selectedJob={selectedJob}
              onSelectJob={handleJobSelected}
              onJobDeleted={handleJobDeleted}
            />
          </div>

          {/* Job Details and Candidates */}
          <div className="lg:col-span-2">
            {selectedJob ? (
              <div className="space-y-6">
                {(() => {
                  const displayCandidates = (
                    selectedJob.candidates.length > 0
                      ? selectedJob.candidates
                      : candidateMatches
                  ).filter(
                    (candidateJob) => !approvedCandidateIds.includes(candidateJob.id)
                  );

                  return (
                    <>
                {rematchResult && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      rematchResult.type === "success"
                        ? "border-mainYellow bg-mainYellow/10 text-black/80"
                        : "border-red-300 bg-red-50 text-red-700"
                    }`}
                  >
                    {rematchResult.message}
                  </div>
                )}
                {/* Job Details */}
                {editingJob ? (
                  <JobForm
                    editingJob={editingJob}
                    onJobAdded={handleJobAdded}
                    onJobUpdated={handleJobUpdated}
                    onCancel={() => setEditingJob(null)}
                  />
                ) : (
                  <div className="bg-white border border-black/10 rounded-lg p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-black mb-2">
                          {selectedJob.title}
                        </h2>
                        {selectedJob.description && (
                          <p className="text-black/70">
                            {selectedJob.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:w-auto">
                        <Button
                          variant="secondary"
                          onClick={handleRematch}
                          disabled={rematching}
                          className="sm:w-auto"
                        >
                          {rematching ? "Matching..." : "Re-run Matching"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setEditingJob(selectedJob)}
                          className="sm:w-auto"
                        >
                          Edit JD
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="text-sm font-semibold text-black/70">
                          Job Description
                        </h3>
                        {selectedJob.jdText && selectedJob.jdText.length > 500 && (
                          <Button
                            variant="link"
                            onClick={() => setShowFullJd(!showFullJd)}
                          >
                            {showFullJd ? "Show less" : "View full JD"}
                          </Button>
                        )}
                      </div>
                      <div
                        className={`bg-black/5 p-4 rounded-lg overflow-y-auto ${
                          showFullJd ? "max-h-[560px]" : "max-h-64"
                        }`}
                      >
                        {selectedJob.jdText ? (
                          <p className="text-sm text-black/70 whitespace-pre-wrap">
                            {showFullJd || selectedJob.jdText.length <= 500
                              ? selectedJob.jdText
                              : `${selectedJob.jdText.substring(0, 500)}...`}
                          </p>
                        ) : selectedJob.jdBlobPath ? (
                          <p className="text-sm text-black/70">
                            PDF JD stored in Blob: {selectedJob.jdBlobPath}
                          </p>
                        ) : (
                          <p className="text-sm text-black/50">
                            No job description has been added yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidates Section */}
                <div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-black">
                        Matched Candidates ({displayCandidates.length})
                      </h3>
                      <p className="text-sm text-black/50">
                        {selectedJob.candidates.length > 0
                          ? "Sorted by AI match score from processed candidates."
                          : "Mock AI processed candidates for UI development."}
                      </p>
                    </div>
                    <div className="text-sm text-black/60">
                      {approvedCandidateIds.length} approved for tracker
                    </div>
                  </div>

                  <div className="space-y-4">
                      {displayCandidates.map((candidateJob) => (
                        <CandidateCard
                          key={candidateJob.id}
                          candidateJob={candidateJob}
                          onApprove={handleCandidateApproved}
                        />
                      ))}
                    </div>
                </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-black/5 border border-black/10 rounded-lg p-12 text-center">
                <p className="text-black/60 mb-2">Select a job to view details</p>
                <p className="text-black/40 text-sm">
                  Choose a job from the list to see matched candidates
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {approvedStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-lg font-bold text-black mb-1">Approved!</h3>
            <p className="text-sm text-black/60 mb-6">
              {approvedStatus.candidateName} has been moved to the Application
              Tracker pipeline.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setApprovedStatus(null)}
              >
                Stay here
              </Button>
              <Link href="/application-tracker" className="flex-1">
                <Button size="sm" className="w-full">
                  Go to Tracker
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

interface CandidateCardProps {
  candidateJob: CandidateJob;
  onApprove: (candidateJobId: string) => void;
}

function CandidateCard({ candidateJob, onApprove }: CandidateCardProps) {
  const candidate = candidateJob.candidate;
  const matchScore = candidateJob.matchScore || 0;
  const matchPercentage = Math.round(matchScore * 100);
  const scoreBreakdown = candidateJob.scoreBreakdown;
  const isApproved = candidateJob.status === "approved";

  // Parse skills array
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const experience = Array.isArray(candidate.experience)
    ? candidate.experience
    : [];

  return (
    <div className="bg-white border border-black/10 rounded-lg p-6 hover:border-mainYellow transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-bold text-black">
            {candidate.fullName || "Anonymous Candidate"}
          </h4>
          <p className="text-sm text-black/60">{candidate.source}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-mainYellow">
            {matchPercentage}%
          </div>
          <div className="text-xs text-black/60">Match</div>
          <div
            className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${
              isApproved
                ? "bg-mainYellow text-black"
                : "bg-black/10 text-black/60"
            }`}
          >
            {isApproved ? "Approved" : "HR Review"}
          </div>
        </div>
      </div>

      {/* Match Score Bar */}
      <div className="w-full bg-black/10 h-2 rounded-full mb-4 overflow-hidden">
        <div
          className="bg-mainYellow h-full transition-all"
          style={{ width: `${matchPercentage}%` }}
        />
      </div>

      {scoreBreakdown && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <ScoreMetric label="Skills" value={scoreBreakdown.skillsFit} />
          <ScoreMetric label="Experience" value={scoreBreakdown.experienceFit} />
          <ScoreMetric
            label="Communication"
            value={scoreBreakdown.communicationFit}
          />
        </div>
      )}

      {candidateJob.shortlistReason && (
        <div className="mb-4 border-l-4 border-mainYellow bg-mainYellow/10 px-3 py-2">
          <p className="text-xs font-semibold text-black/70 mb-1">
            Shortlist reason
          </p>
          <p className="text-sm text-black/70">{candidateJob.shortlistReason}</p>
        </div>
      )}

      {/* Contact Info */}
      {(candidate.email || candidate.phone) && (
        <div className="mb-4 space-y-1">
          {candidate.email && (
            <p className="text-sm text-black/70">
              <span className="font-semibold">Email:</span> {candidate.email}
            </p>
          )}
          {candidate.phone && (
            <p className="text-sm text-black/70">
              <span className="font-semibold">Phone:</span> {candidate.phone}
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      {candidate.summary && (
        <div className="mb-4">
          <p className="text-sm text-black/70 line-clamp-2">
            {candidate.summary}
          </p>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-black/60 mb-2">Skills</p>
          <div className="flex flex-wrap gap-2">
            {skills.slice(0, 5).map((skill: Skill, idx: number) => (
              <span
                key={idx}
                className="inline-block px-3 py-1 bg-black/10 text-black text-xs rounded-full"
              >
                {typeof skill === "string" ? skill : skill.name}
              </span>
            ))}
            {skills.length > 5 && (
              <span className="inline-block px-3 py-1 text-black/60 text-xs">
                +{skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-black/60 mb-2">
            Experience
          </p>
          <p className="text-sm text-black/70">
            {experience.length} position
            {experience.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* AI Evaluation */}
      {candidateJob.aiEvaluation && (
        <div className="mb-4 p-3 bg-black/5 rounded-lg">
          <p className="text-xs font-semibold text-black/60 mb-2">
            AI Evaluation
          </p>
          <p className="text-sm text-black/70">
            {candidateJob.aiEvaluation.substring(0, 150)}
            {candidateJob.aiEvaluation.length > 150 && "..."}
          </p>
        </div>
      )}

      {(candidateJob.strengths?.length || candidateJob.followUpQuestions?.length) && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {candidateJob.strengths?.length ? (
            <InsightList title="Strengths" items={candidateJob.strengths} />
          ) : null}
          {candidateJob.followUpQuestions?.length ? (
            <InsightList
              title="Prescreen questions"
              items={candidateJob.followUpQuestions}
            />
          ) : null}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-black/10">
          <a
            href={`/api/candidates/${candidate.id}/resume`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 px-3 py-2 bg-white border border-black text-black rounded font-semibold hover:bg-yellow-500 transition-colors text-sm text-center"
          >
            Open Resume
          </a>
        {/* <Button variant="secondary" size="sm" className="flex-1">
          Details
        </Button> */}
        <Button
          size="sm"
          className="flex-1"
          disabled={isApproved}
          onClick={() => onApprove(candidateJob.id)}
        >
          {isApproved ? "Ready for Tracker" : "Approve"}
        </Button>
      </div>
    </div>
  );
}

interface ScoreMetricProps {
  label: string;
  value: number;
}

function ScoreMetric({ label, value }: ScoreMetricProps) {
  return (
    <div className="bg-black/5 rounded p-3">
      <p className="text-xs font-semibold text-black/60 mb-1">{label}</p>
      <p className="text-lg font-bold text-black">{value}/10</p>
    </div>
  );
}

interface InsightListProps {
  title: string;
  items: string[];
}

function InsightList({ title, items }: InsightListProps) {
  return (
    <div className="bg-black/5 rounded p-3">
      <p className="text-xs font-semibold text-black/60 mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm text-black/70">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
