export type ResumeSource = "jobsdb" | "jobthai" | "jobbkk" | "linkedin" | "referral";

export interface WorkExperience {
  title: string;
  company: string;
  period: string;
  description: string;
}

export interface Education {
  degree: string;
  institution: string;
  period: string;
}

/** Structured resume with all fields intact — HR-only. */
export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  address: string;
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  languages: string[];
}

/** PII tokens discovered during masking. */
export interface PIITokens {
  names: string[];
  emails: string[];
  phones: string[];
}

/** Result of the PII masker: safe text + what was replaced. */
export interface MaskedResult {
  maskedText: string;
  tokens: PIITokens;
}

/** A fully processed draft resume record stored in Postgres. */
export interface CandidateDraft {
  id: string;
  source: ResumeSource;
  sourceBlobPath: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  summary: string;
  languages: string[];
  /** Masked text — safe to send to AI. */
  maskedText: string;
  draftResumeBlobPath: string;
  ingestedAt: string;
  pipelineStatus: "pending" | "ai_queued" | "ai_processed" | "hr_review" | "approved" | "rejected";
}
