import type { PipelineStage } from "@/lib/pipeline/stages";

/**
 * Client-side helpers for talking to the `/api/candidates` endpoints.
 * Keeping these calls in one place avoids scattering raw `fetch` logic
 * across page components.
 */

export async function fetchPendingCandidates() {
  const res = await fetch("/api/candidates");
  if (!res.ok) throw new Error("Failed to fetch candidates");
  return res.json();
}

export async function fetchTrackerCandidates() {
  const res = await fetch("/api/candidates?scope=tracker");
  if (!res.ok) throw new Error("Failed to fetch candidates");
  return res.json();
}

export async function approveCandidate(candidateId: string, candidateJobId: string) {
  const res = await fetch(`/api/candidates/${candidateId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateJobId }),
  });
  if (!res.ok) throw new Error("Failed to approve candidate");
  return res.json();
}

export async function updateCandidateStage(candidateId: string, stage: PipelineStage) {
  const res = await fetch(`/api/candidates/${candidateId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage }),
  });
  if (!res.ok) throw new Error("Failed to update candidate stage");
  return res.json();
}

export async function updateCandidateAssignees(
  candidateId: string,
  assignees: { name: string; email: string }[]
) {
  const res = await fetch(`/api/candidates/${candidateId}/assignees`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignees }),
  });
  if (!res.ok) throw new Error("Failed to update candidate assignees");
  return res.json();
}

export async function updateCandidateSchedule(
  candidateId: string,
  scheduledAt: string | null
) {
  const res = await fetch(`/api/candidates/${candidateId}/schedule`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt }),
  });
  if (!res.ok) throw new Error("Failed to update candidate schedule");
  return res.json();
}

export async function scheduleCandidateInterview(
  candidateId: string,
  payload: {
    scheduledAt: string;
    attendees: string[];
    stage?: string;
    description?: string;
    durationMinutes?: number;
  }
) {
  const res = await fetch(`/api/candidates/${candidateId}/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to schedule interview");
  }
  return res.json();
}
