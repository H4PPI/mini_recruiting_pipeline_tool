"use client";

import { useMemo, useState, useEffect } from "react";
import MainLayout from "../components/MainLayout";
import Button from "../components/ui/Button";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/pipeline/stages";
import { fetchTrackerCandidates, updateCandidateStage } from "@/lib/api/candidates";

type Stage = PipelineStage;

type Source = "LinkedIn" | "JobsDB" | "JobThai" | "Referral";

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
}

const stages: Stage[] = [...PIPELINE_STAGES];

// applicants are loaded from the database during runtime

export default function ApplicationTrackerPage() {
  const [rows, setRows] = useState<Applicant[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [positionFilter, setPositionFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState<Source | "All">("All");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

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
        // Map DB candidate shape to Applicant interface
        const mapped = data.map((c: any) => ({
          id: c.id,
          name: c.fullName || "",
          email: c.email || "",
          phone: c.phone || "",
          position: c.position || "Unknown",
          source: (c.source as any) || "Referral",
          stage: (c.pipelineStatus as Stage) ?? PIPELINE_STAGES[0],
          appliedAt: c.ingestedAt ? new Date(c.ingestedAt).toLocaleDateString() : "",
          matchScore: 0,
          owner: "",
          nextAction: "",
        }));
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
          <PipelineBoard applicants={filteredRows} onStageChange={updateStage} />
        ) : (
          <ApplicantTable applicants={filteredRows} onStageChange={updateStage} />
        )}
      </div>
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
}

function PipelineBoard({ applicants, onStageChange }: TrackerViewProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1680px] grid-cols-7 gap-3">
        {stages.map((stage) => {
          const stageApplicants = applicants.filter((row) => row.stage === stage);
          return (
            <div
              key={stage}
              className="bg-black/[0.03] border border-black/10 rounded-lg p-3 max-h-[640px] overflow-y-auto"
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
}

function ApplicantCard({ applicant, onStageChange }: ApplicantCardProps) {
  return (
    <div
      className="bg-white border border-black/10 rounded-lg p-3"
      draggable
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
      <p className="mb-3 rounded bg-black/5 p-2 text-xs text-black/70">
        {applicant.nextAction}
      </p>
      <select
        value={applicant.stage}
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

function ApplicantTable({ applicants, onStageChange }: TrackerViewProps) {
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
              <tr key={applicant.id} className="border-b border-black/10">
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
                <td className="px-4 py-3">
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
