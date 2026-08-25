"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";
import type { Job } from "@/app/types/jobs";

interface JobListProps {
  jobs: Job[];
  loading: boolean;
  selectedJob: Job | null;
  onSelectJob: (job: Job) => void;
  onJobDeleted: (jobId: string) => void;
}

export default function JobList({
  jobs,
  loading,
  selectedJob,
  onSelectJob,
  onJobDeleted,
}: JobListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this job?")) {
      return;
    }

    setDeletingId(jobId);

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete job");
      }

      onJobDeleted(jobId);
    } catch (error) {
      console.error("Error deleting job:", error);
      alert("Failed to delete job");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white border border-black/10 rounded-lg overflow-hidden h-fit sticky top-6">
      <div className="p-4 border-b border-black/10">
        <h2 className="text-lg font-bold text-black">
          Jobs ({jobs.length})
        </h2>
      </div>

      {loading ? (
        <div className="p-4 text-center text-black/60">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-black/60 mb-2">No jobs yet</p>
          <p className="text-black/40 text-sm">
            Create a job to get started
          </p>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => onSelectJob(job)}
              className={`p-4 border-b border-black/10 cursor-pointer transition-colors ${
                selectedJob?.id === job.id
                  ? "bg-mainYellow/20 border-l-4 border-l-mainYellow"
                  : "hover:bg-black/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-black flex-1 line-clamp-2">
                  {job.title}
                </h3>
                <Button
                  variant="icon"
                  onClick={(e) => handleDelete(job.id, e)}
                  disabled={deletingId === job.id}
                  title="Delete job"
                >
                  ✕
                </Button>
              </div>

              <p className="text-xs text-black/60 mb-2">
                {(job.candidates?.length ?? 0)} candidate
                {(job.candidates?.length ?? 0) !== 1 ? "s" : ""}
              </p>

              <p className="text-xs text-black/50">
                {new Date(job.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
