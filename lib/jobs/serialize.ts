/**
 * Maps a Prisma `CandidateJob` row (with raw `matchDetails` JSON produced by
 * the AI screener) into the shape the Jobs UI expects: a flattened
 * `scoreBreakdown` (0-10 per criterion), `strengths`, `followUpQuestions`
 * and `shortlistReason`.
 */
export function serializeCandidateJob(candidateJob: any) {
  const details = candidateJob.matchDetails as
    | {
        skillsFit?: { score?: number; reasoning?: string; evidence?: string };
        experienceFit?: { score?: number; reasoning?: string; evidence?: string };
        cultureFit?: { score?: number; reasoning?: string; evidence?: string };
        strengths?: string[];
        followUpQuestions?: string[];
        shortlistReason?: string;
      }
    | null
    | undefined;

  if (!details) {
    return candidateJob;
  }

  return {
    ...candidateJob,
    scoreBreakdown:
      details.skillsFit || details.experienceFit || details.cultureFit
        ? {
            skillsFit: details.skillsFit?.score ?? 0,
            experienceFit: details.experienceFit?.score ?? 0,
            communicationFit: details.cultureFit?.score ?? 0,
          }
        : undefined,
    strengths: details.strengths ?? [],
    followUpQuestions: details.followUpQuestions ?? [],
    shortlistReason: details.shortlistReason,
  };
}

export function serializeJobWithCandidates<T extends { candidates: any[] }>(job: T) {
  return {
    ...job,
    candidates: job.candidates.map(serializeCandidateJob),
  };
}
