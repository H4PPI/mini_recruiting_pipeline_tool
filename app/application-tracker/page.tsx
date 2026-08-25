"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import MainLayout from "../components/MainLayout";
import Button from "../components/ui/Button";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/pipeline/stages";
import {
  fetchTrackerCandidates,
  updateCandidateStage,
  updateCandidateAssignees,
} from "@/lib/api/candidates";
import { serializeCandidateJob } from "@/lib/jobs/serialize";

type Stage = PipelineStage;

type Source = "LinkedIn" | "JobsDB" | "JobThai" | "Referral";

interface ScoreBreakdown {
  skillsFit: number;
  experienceFit: number;
  communicationFit: number;
}

interface Applicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  source: Source;
  stage: Stage;
  appliedAt: string;
  matchScore: number;
  owner: string;
  nextAction: string;
  assignees?: { name: string; email: string }[];
  // Extra detail fields shown in the candidate detail modal (mirrors the
  // Jobs page candidate card). These may be absent depending on the data
  // source, so all consumers must handle undefined gracefully.
  scoreBreakdown?: ScoreBreakdown;
  shortlistReason?: string;
  summary?: string;
  skills?: (string | { name: string })[];
  experience?: unknown[];
  aiEvaluation?: string;
  strengths?: string[];
  followUpQuestions?: string[];
  candidateId?: string;
}

const stages: Stage[] = [...PIPELINE_STAGES];

// applicants are loaded from the database during runtime

// Mock HR users for assignment UI (shared across tracker views)
const HR_USERS = [
  { name: "Naree Chai", email: "naree.chai@hotelplus.co" },
  { name: "Korn Poon", email: "korn.poon@hotelplus.co" },
  { name: "Mali Ratan", email: "mali.ratan@hotelplus.co" },
];

export default function ApplicationTrackerPage() {
  const [rows, setRows] = useState<Applicant[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [positionFilter, setPositionFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState<Source | "All">("All");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);

  const positions = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((row) => row.position)))],
    [rows]
  );

  const filteredRows = rows.filter((row) => {
    return (
      (stageFilter === "All" || row.stage === stageFilter) &&
      (positionFilter === "All" || row.position === positionFilter) &&
      (sourceFilter === "All" || row.source === sourceFilter)
    );
  });
  
  useEffect(() => {
    let mounted = true;
    async function loadCandidates() {
      try {
        setLoadingRows(true);
        // Only candidates HR has approved into the tracker pipeline show up here.
        const data = await fetchTrackerCandidates();
        if (!mounted) return;
        // Map DB candidate shape to Applicant interface. Candidates come
        // with their related `jobs` (CandidateJob rows, each with the raw
        // AI `matchDetails` JSON + the linked `job`); we surface the
        // best-scoring match's details for the tracker card/modal.
        const mapped = data.map((c: any) => {
          const jobMatches = Array.isArray(c.jobs) ? c.jobs : [];
          const bestMatch = jobMatches[0]
            ? serializeCandidateJob(jobMatches[0])
            : null;

          return {
            id: c.id,
            name: c.fullName || "",
            email: c.email || "",
            phone: c.phone || "",
            position: bestMatch?.job?.title || c.position || "Unknown",
            source: (c.source as any) || "Referral",
            stage: (c.pipelineStatus as Stage) ?? PIPELINE_STAGES[0],
            appliedAt: c.ingestedAt ? new Date(c.ingestedAt).toLocaleDateString() : "",
            matchScore: Math.round((bestMatch?.matchScore ?? 0) * 100),
            owner: "",
            nextAction: "",
            assignees: c.assignees || [],
            scoreBreakdown: bestMatch?.scoreBreakdown,
            shortlistReason: bestMatch?.shortlistReason,
            summary: c.summary || undefined,
            skills: Array.isArray(c.skills) ? c.skills : [],
            experience: Array.isArray(c.experience) ? c.experience : [],
            aiEvaluation: bestMatch?.aiEvaluation || undefined,
            strengths: bestMatch?.strengths || [],
            followUpQuestions: bestMatch?.followUpQuestions || [],
            candidateId: c.id,
          };
        });
        setRows(mapped);
      } catch (err) {
        console.error("Error loading candidates:", err);
      } finally {
        setLoadingRows(false);
      }
    }

    loadCandidates();
    return () => {
      mounted = false;
    };
  }, []);

  const activeCount = rows.filter(
    (row) => row.stage !== "Hired" && row.stage !== "Rejected"
  ).length;
  const interviewCount = rows.filter(
    (row) => row.stage === "Pre-Screen Pending" || row.stage === "First Interview"
  ).length;
  const offerCount = rows.filter((row) => row.stage === "Offer").length;

  const updateStage = (applicantId: string, stage: Stage) => {
    // Optimistically update the board, then persist the new stage.
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === applicantId ? { ...row, stage } : row
      )
    );

    updateCandidateStage(applicantId, stage).catch((err) => {
      console.error("Failed to persist candidate stage:", err);
    });
  };

  const updateAssignees = (
    applicantId: string,
    assignees: { name: string; email: string }[]
  ) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === applicantId ? { ...row, assignees } : row
      )
    );

    updateCandidateAssignees(applicantId, assignees).catch((err) => {
      console.error("Failed to persist candidate assignees:", err);
    });
  };

  const selectedApplicant = rows.find((row) => row.id === selectedApplicantId) || null;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">
              Application Tracker
            </h1>
            <p className="text-black/60">
              Track HR-approved candidates through the hiring pipeline.
            </p>
          </div>
          <Button className="lg:w-auto">+ Add Applicant</Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile label="Active candidates" value={activeCount} />
          <SummaryTile label="Interview pipeline" value={interviewCount} />
          <SummaryTile label="Offer stage" value={offerCount} />
        </div>

        <div className="bg-white border border-black/10 rounded-lg p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SelectFilter
              label="Stage"
              value={stageFilter}
              options={["All", ...stages]}
              onChange={(value) => setStageFilter(value as Stage | "All")}
            />
            <SelectFilter
              label="Position"
              value={positionFilter}
              options={positions}
              onChange={setPositionFilter}
            />
            <SelectFilter
              label="Source"
              value={sourceFilter}
              options={["All", "LinkedIn", "JobsDB", "JobThai", "Referral"]}
              onChange={(value) => setSourceFilter(value as Source | "All")}
            />
            <div>
              <label className="block text-sm font-semibold text-black mb-2">
                View
              </label>
              <div className="grid grid-cols-2 border border-black/20 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("board")}
                  className={`px-3 py-2 text-sm font-semibold transition-colors ${
                    viewMode === "board"
                      ? "bg-mainYellow text-black"
                      : "text-black/60 hover:bg-black/5"
                  }`}
                >
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2 text-sm font-semibold transition-colors ${
                    viewMode === "list"
                      ? "bg-mainYellow text-black"
                      : "text-black/60 hover:bg-black/5"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>

        {viewMode === "board" ? (
          <PipelineBoard
            applicants={filteredRows}
            onStageChange={updateStage}
            onAssigneesChange={updateAssignees}
            onOpenDetail={setSelectedApplicantId}
          />
        ) : (
          <ApplicantTable
            applicants={filteredRows}
            onStageChange={updateStage}
            onOpenDetail={setSelectedApplicantId}
          />
        )}
      </div>

      {selectedApplicant && (
        <CandidateDetailModal
          applicant={selectedApplicant}
          onClose={() => setSelectedApplicantId(null)}
          onAssigneesChange={updateAssignees}
        />
      )}
    </MainLayout>
  );
}

interface SummaryTileProps {
  label: string;
  value: number;
}

function SummaryTile({ label, value }: SummaryTileProps) {
  return (
    <div className="bg-white border border-black/10 rounded-lg p-4">
      <p className="text-sm font-semibold text-black/60 mb-2">{label}</p>
      <p className="text-3xl font-bold text-black">{value}</p>
    </div>
  );
}

interface SelectFilterProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function SelectFilter({ label, value, options, onChange }: SelectFilterProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-black mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-black/20 rounded-lg bg-white text-sm text-black focus:outline-none focus:border-mainYellow"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

interface TrackerViewProps {
  applicants: Applicant[];
  onStageChange: (applicantId: string, stage: Stage) => void;
  onAssigneesChange?: (
    applicantId: string,
    assignees: { name: string; email: string }[]
  ) => void;
  onOpenDetail: (applicantId: string) => void;
}

function PipelineBoard({
  applicants,
  onStageChange,
  onAssigneesChange,
  onOpenDetail,
}: TrackerViewProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[2000px] grid-cols-7 gap-3">
        {stages.map((stage) => {
          const stageApplicants = applicants.filter((row) => row.stage === stage);
          return (
            <div
              key={stage}
              className="bg-black/[0.03] border border-black/10 rounded-lg p-3 max-h-[640px] overflow-y-auto min-w-[260px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/applicant-id");
                if (id) onStageChange(id, stage);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-black">{stage}</h2>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-black/60">
                  {stageApplicants.length}
                </span>
              </div>
              <div className="space-y-3">
                {stageApplicants.map((applicant) => (
                  <ApplicantCard
                    key={applicant.id}
                    applicant={applicant}
                    onStageChange={onStageChange}
                    onAssigneesChange={onAssigneesChange}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ApplicantCardProps {
  applicant: Applicant;
  onStageChange: (applicantId: string, stage: Stage) => void;
  onAssigneesChange?: (
    applicantId: string,
    assignees: { name: string; email: string }[]
  ) => void;
  onOpenDetail: (applicantId: string) => void;
}

function ApplicantCard({
  applicant,
  onStageChange,
  onAssigneesChange,
  onOpenDetail,
}: ApplicantCardProps) {
  const assignees = applicant.assignees || [];

  return (
    <div
      className="bg-white border border-black/10 rounded-lg p-3 cursor-pointer hover:border-mainYellow transition-colors"
      draggable
      onClick={() => onOpenDetail(applicant.id)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/applicant-id", applicant.id);
        // set effect allowed
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        /* no-op for now */
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-bold text-black text-sm">{applicant.name}</h3>
          <p className="text-xs text-black/60">{applicant.position}</p>
        </div>
        <span className="text-sm font-bold text-mainYellow">
          {applicant.matchScore}%
        </span>
      </div>
      <div className="space-y-1 mb-3 text-xs text-black/60">
        <p>{applicant.source}</p>
        <p>{applicant.appliedAt}</p>
        <p>{applicant.owner}</p>
      </div>

      {/* Assignees summary (read-only preview — edit via detail modal) */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-black/60 mb-2">Assigned HR</p>
        <div className="flex flex-wrap gap-2">
          {assignees.length === 0 ? (
            <span className="text-xs text-black/50 italic">No HR assigned</span>
          ) : (
            assignees.map((a) => (
              <span
                key={a.email}
                className="inline-flex items-center px-3 py-1 bg-mainYellow text-black text-xs rounded-full font-medium"
              >
                {a.name}
              </span>
            ))
          )}
        </div>
      </div>
      <p className="mb-3 rounded bg-black/5 p-2 text-xs text-black/70">
        {applicant.nextAction}
      </p>
      <select
        value={applicant.stage}
        onClick={(e) => e.stopPropagation()}
        onChange={(event) =>
          onStageChange(applicant.id, event.target.value as Stage)
        }
        className="w-full rounded border border-black/20 bg-white px-2 py-2 text-xs text-black focus:outline-none focus:border-mainYellow"
      >
        {stages.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>
    </div>
  );
}

interface CandidateDetailModalProps {
  applicant: Applicant;
  onClose: () => void;
  onAssigneesChange: (
    applicantId: string,
    assignees: { name: string; email: string }[]
  ) => void;
}

function CandidateDetailModal({
  applicant,
  onClose,
  onAssigneesChange,
}: CandidateDetailModalProps) {
  const assignees = applicant.assignees || [];
  const scoreBreakdown = applicant.scoreBreakdown;
  const skills = Array.isArray(applicant.skills) ? applicant.skills : [];
  const experience = Array.isArray(applicant.experience) ? applicant.experience : [];

  function toggleAssignee(user: { name: string; email: string }) {
    const exists = assignees.find((a) => a.email === user.email);
    const next = exists
      ? assignees.filter((a) => a.email !== user.email)
      : [...assignees, user];
    onAssigneesChange(applicant.id, next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-black">{applicant.name}</h2>
            <p className="text-sm text-black/60">{applicant.position}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-mainYellow">
              {applicant.matchScore}%
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-black/50 hover:text-black text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
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

        {applicant.shortlistReason && (
          <div className="mb-4 border-l-4 border-mainYellow bg-mainYellow/10 px-3 py-2">
            <p className="text-xs font-semibold text-black/70 mb-1">
              Shortlist reason
            </p>
            <p className="text-sm text-black/70">{applicant.shortlistReason}</p>
          </div>
        )}

        {(applicant.email || applicant.phone) && (
          <div className="mb-4 space-y-1">
            {applicant.email && (
              <p className="text-sm text-black/70">
                <span className="font-semibold">Email:</span> {applicant.email}
              </p>
            )}
            {applicant.phone && (
              <p className="text-sm text-black/70">
                <span className="font-semibold">Phone:</span> {applicant.phone}
              </p>
            )}
          </div>
        )}

        {applicant.summary && (
          <div className="mb-4">
            <p className="text-sm text-black/70">{applicant.summary}</p>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-black/60 mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-block px-3 py-1 bg-black/10 text-black text-xs rounded-full"
                >
                  {typeof skill === "string" ? skill : skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {experience.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-black/60 mb-2">Experience</p>
            <p className="text-sm text-black/70">
              {experience.length} position{experience.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {applicant.aiEvaluation && (
          <div className="mb-4 p-3 bg-black/5 rounded-lg">
            <p className="text-xs font-semibold text-black/60 mb-2">
              AI Evaluation
            </p>
            <p className="text-sm text-black/70">{applicant.aiEvaluation}</p>
          </div>
        )}

        {(applicant.strengths?.length || applicant.followUpQuestions?.length) && (
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {applicant.strengths?.length ? (
              <InsightList title="Strengths" items={applicant.strengths} />
            ) : null}
            {applicant.followUpQuestions?.length ? (
              <InsightList
                title="Prescreen questions"
                items={applicant.followUpQuestions}
              />
            ) : null}
          </div>
        )}

        {/* Assignee field */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-black/60 mb-2">
            Assign to HR
          </label>
          <div className="space-y-2">
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {assignees.map((a) => (
                  <span
                    key={a.email}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-mainYellow text-black text-xs rounded-full font-medium"
                  >
                    {a.name}
                    <button
                      type="button"
                      onClick={() => toggleAssignee(a)}
                      className="ml-1 hover:opacity-70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <HrMultiSelect assignees={assignees} onToggle={toggleAssignee} />
            {assignees.length === 0 && (
              <p className="text-xs text-black/50 italic">No HR assigned</p>
            )}
          </div>
        </div>

        {applicant.candidateId && (
          <div className="pt-4 border-t border-black/10">
            <a
              href={`/api/candidates/${applicant.candidateId}/resume`}
              target="_blank"
              rel="noreferrer"
              className="inline-block px-3 py-2 bg-mainYellow text-black rounded font-semibold hover:bg-yellow-500 transition-colors text-sm"
            >
              Open Resume
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicantTable({ applicants, onStageChange, onOpenDetail }: TrackerViewProps) {
  return (
    <div className="bg-white border border-black/10 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-left">
          <thead className="bg-black/[0.03] border-b border-black/10">
            <tr>
              <TableHead>Candidate</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Next action</TableHead>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant) => (
              <tr
                key={applicant.id}
                className="border-b border-black/10 cursor-pointer hover:bg-black/[0.02]"
                onClick={() => onOpenDetail(applicant.id)}
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-black">{applicant.name}</p>
                  <p className="text-xs text-black/60">{applicant.email}</p>
                  <p className="text-xs text-black/60">{applicant.phone}</p>
                </td>
                <td className="px-4 py-3 text-sm text-black/70">
                  {applicant.position}
                </td>
                <td className="px-4 py-3 text-sm text-black/70">
                  {applicant.source}
                </td>
                <td className="px-4 py-3 text-sm text-black/70">
                  {applicant.appliedAt}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-mainYellow">
                  {applicant.matchScore}%
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={applicant.stage}
                    onChange={(event) =>
                      onStageChange(applicant.id, event.target.value as Stage)
                    }
                    className="w-full rounded border border-black/20 bg-white px-2 py-2 text-sm text-black focus:outline-none focus:border-mainYellow"
                  >
                    {stages.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-sm text-black/70">
                  {applicant.nextAction}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TableHeadProps {
  children: React.ReactNode;
}

function TableHead({ children }: TableHeadProps) {
  return (
    <th className="px-4 py-3 text-xs font-bold uppercase text-black/60">
      {children}
    </th>
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

interface HrMultiSelectProps {
  assignees: { name: string; email: string }[];
  onToggle: (user: { name: string; email: string }) => void;
}

function HrMultiSelect({ assignees, onToggle }: HrMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedEmails = new Set(assignees.map((a) => a.email));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded border border-black/20 bg-white px-3 py-2 text-sm text-black hover:border-mainYellow focus:outline-none focus:border-mainYellow"
      >
        <span className="text-black/70">
          {assignees.length > 0
            ? `${assignees.length} HR selected`
            : "Select HR..."}
        </span>
        <span className="text-black/40">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded border border-black/20 bg-white shadow-lg max-h-48 overflow-y-auto">
          {HR_USERS.map((u) => {
            const checked = selectedEmails.has(u.email);
            return (
              <label
                key={u.email}
                className="flex items-center gap-2 px-3 py-2 text-sm text-black hover:bg-black/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(u)}
                  className="accent-mainYellow"
                />
                <span>
                  {u.name}{" "}
                  <span className="text-black/40 text-xs">({u.email})</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
