import type { CandidateJob } from "@/app/types/jobs";

export const mockProcessedCandidates: CandidateJob[] = [
  {
    id: "mock-candidate-job-1",
    matchScore: 0.92,
    status: "hr_review",
    aiEvaluation:
      "Strong shortlist candidate. Their recent work maps closely to the JD, especially React, API integration, and cross-functional delivery.",
    scoreBreakdown: {
      skillsFit: 9,
      experienceFit: 9,
      communicationFit: 8,
    },
    strengths: [
      "React and Next.js production experience",
      "Owns API integration end-to-end",
      "Clear stakeholder communication",
    ],
    followUpQuestions: [
      "Ask about scaling frontend state across complex workflows.",
      "Confirm depth of backend ownership beyond API consumption.",
    ],
    shortlistReason:
      "Best fit for a fullstack product role that needs fast UI delivery and practical backend collaboration.",
    candidate: {
      id: "mock-candidate-1",
      source: "LinkedIn",
      fullName: "Narin Phatthana",
      email: "narin@example.com",
      phone: "+66 81 234 5678",
      skills: ["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL"],
      experience: [
        { title: "Senior Frontend Engineer", years: 3 },
        { title: "Fullstack Engineer", years: 2 },
      ],
      summary:
        "Fullstack-leaning frontend engineer with strong product delivery experience in SaaS and internal workflow tools.",
    },
  },
  {
    id: "mock-candidate-job-2",
    matchScore: 0.84,
    status: "hr_review",
    aiEvaluation:
      "Good technical match with strong backend grounding. Frontend experience is enough for the JD, but needs validation in prescreen.",
    scoreBreakdown: {
      skillsFit: 8,
      experienceFit: 8,
      communicationFit: 7,
    },
    strengths: [
      "Backend API and database design",
      "Prisma/Postgres familiarity",
      "Comfortable with integration-heavy work",
    ],
    followUpQuestions: [
      "Ask for examples of React component architecture.",
      "Check English communication comfort for manager interviews.",
    ],
    shortlistReason:
      "Solid backup shortlist candidate for a role with heavier backend or data pipeline responsibility.",
    candidate: {
      id: "mock-candidate-2",
      source: "JobsDB",
      fullName: "Mali Srisawat",
      email: "mali@example.com",
      phone: "+66 89 111 2233",
      skills: ["Node.js", "Prisma", "PostgreSQL", "React", "REST API"],
      experience: [
        { title: "Backend Engineer", years: 4 },
        { title: "Software Engineer", years: 1 },
      ],
      summary:
        "Backend-focused engineer with practical frontend experience and strong operational system background.",
    },
  },
  {
    id: "mock-candidate-job-3",
    matchScore: 0.76,
    status: "hr_review",
    aiEvaluation:
      "Promising candidate with good frontend fundamentals. Experience fit is moderate because recent projects are smaller in scope.",
    scoreBreakdown: {
      skillsFit: 8,
      experienceFit: 6,
      communicationFit: 8,
    },
    strengths: [
      "Clean UI implementation",
      "Good learning velocity",
      "Strong documentation habits",
    ],
    followUpQuestions: [
      "Ask about handling ambiguous requirements.",
      "Validate experience with production incidents or ownership.",
    ],
    shortlistReason:
      "Worth reviewing for mid-level pipeline or roles with room for structured ramp-up.",
    candidate: {
      id: "mock-candidate-3",
      source: "Referral",
      fullName: "Krit Anan",
      email: "krit@example.com",
      phone: "+66 92 987 6543",
      skills: ["React", "Tailwind", "TypeScript", "Figma", "Git"],
      experience: [{ title: "Frontend Developer", years: 3 }],
      summary:
        "Frontend developer with polished UI execution and strong collaboration with design teams.",
    },
  },
];
