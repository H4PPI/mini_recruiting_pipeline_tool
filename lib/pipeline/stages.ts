/**
 * Shared application-tracker pipeline stages.
 *
 * `Candidate.pipelineStatus` starts out as "pending" while a candidate is
 * still being reviewed on the Jobs page. Once HR approves a candidate they
 * move into the tracker pipeline and `pipelineStatus` becomes one of the
 * values below.
 */
export const PIPELINE_STAGES = [
  "Pre-Screen Pending",
  "First Interview",
  "Offer",
  "Hired",
  "Rejected",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Status used before a candidate has been approved into the tracker pipeline. */
export const PENDING_REVIEW_STATUS = "pending";

/** Status a candidate is moved to when HR approves them from the Jobs page. */
export const INITIAL_PIPELINE_STAGE: PipelineStage = "Pre-Screen Pending";

export function isPipelineStage(value: unknown): value is PipelineStage {
  return PIPELINE_STAGES.includes(value as PipelineStage);
}
