export interface CandidateSkill {
  name?: string;
}

export type Skill = string | CandidateSkill;

export interface Candidate {
  id: string;
  source: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: Skill[];
  experience: unknown[];
  summary?: string | null;
}

export interface CandidateJob {
  id: string;
  candidate: Candidate;
  matchScore?: number | null;
  status?: "hr_review" | "approved" | "rejected";
  aiEvaluation?: string | null;
  scoreBreakdown?: {
    skillsFit: number;
    experienceFit: number;
    communicationFit: number;
  };
  strengths?: string[];
  followUpQuestions?: string[];
  shortlistReason?: string;
}

export interface Job {
  id: string;
  title: string;
  description?: string | null;
  jdBlobPath?: string | null;
  jdText?: string | null;
  candidates: CandidateJob[];
  createdAt: string;
  updatedAt: string;
}
