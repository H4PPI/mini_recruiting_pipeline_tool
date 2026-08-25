import type { ParsedResume, WorkExperience, Education } from "./types";

// ─── Section heading patterns ─────────────────────────────────────────────────

const SECTION = {
  summary: /^(summary|objective|profile|about me|professional summary)/i,
  skills: /^(skills|technical skills|core competencies|competencies|technologies)/i,
  experience: /^(experience|work experience|employment|career history|professional experience)/i,
  education: /^(education|academic|qualifications|academic background)/i,
  languages: /^(languages|language skills|language proficiency)/i,
};

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?66|0)[\s\-]?[689]\d[\s\-]?\d{3}[\s\-]?\d{4}|(?:\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4}/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Split raw PDF text into non-empty trimmed lines. */
function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Detect which section a heading line belongs to.
 * Returns the section key or null.
 */
function detectSection(line: string): keyof typeof SECTION | null {
  for (const [key, re] of Object.entries(SECTION)) {
    if (re.test(line)) return key as keyof typeof SECTION;
  }
  return null;
}

/** Parse a loose comma/bullet/newline list of skills into an array. */
function parseSkillsList(lines: string[]): string[] {
  return lines
    .flatMap((l) => l.split(/[,;•|·]/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 60);
}

/** Very simple experience block parser — extracts title, company, period. */
function parseExperienceBlock(block: string[]): WorkExperience {
  // Heuristic: first line → title | company, second line → period, rest → description
  const title = block[0] ?? "";
  const period = block.find((l) => /\d{4}/.test(l) && /[-–—to]/.test(l)) ?? "";
  const company = block[1] && block[1] !== period ? block[1] : "";
  const description = block
    .filter((l) => l !== title && l !== company && l !== period)
    .join(" ");
  return { title, company, period, description };
}

/** Very simple education block parser. */
function parseEducationBlock(block: string[]): Education {
  const degree = block[0] ?? "";
  const period = block.find((l) => /\d{4}/.test(l)) ?? "";
  const institution = block[1] && block[1] !== period ? block[1] : "";
  return { degree, institution, period };
}

/**
 * Split a section's line array into sub-blocks separated by blank-ish lines
 * or lines that look like new entries (e.g. lines with a year range).
 */
function splitIntoBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isNewEntry =
      /\d{4}\s*[-–—]\s*(\d{4}|present|current)/i.test(line) ||
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line);
    if (isNewEntry && current.length) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parses raw PDF text into a normalized `ParsedResume` structure.
 *
 * The parser is heuristic / regex-based and works best with text-layer PDFs.
 * Scanned-only PDFs will produce mostly empty fields (text extraction itself
 * returns near-empty strings for those).
 */
export function parseResume(text: string): ParsedResume {
  const lines = toLines(text);

  // ── Personal info from raw text ──────────────────────────────────────────
  const emailMatch = text.match(EMAIL_RE);
  const phoneMatch = text.match(PHONE_RE);

  // Name heuristic: first non-empty line that is not an email / phone / URL
  const nameLine = lines.find(
    (l) =>
      !EMAIL_RE.test(l) &&
      !PHONE_RE.test(l) &&
      !/^https?:\/\//i.test(l) &&
      l.length < 80 &&
      l.length > 1
  );

  // ── Section bucketing ────────────────────────────────────────────────────
  const sections: Record<string, string[]> = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    languages: [],
  };
  let currentSection: keyof typeof sections | null = null;

  for (const line of lines) {
    const detected = detectSection(line);
    if (detected) {
      currentSection = detected;
      continue;
    }
    if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  // ── Build structured fields ──────────────────────────────────────────────
  const skills = parseSkillsList(sections.skills);

  const experience = splitIntoBlocks(sections.experience).map(parseExperienceBlock);

  const education = splitIntoBlocks(sections.education).map(parseEducationBlock);

  const languages = parseSkillsList(sections.languages);

  const summary = sections.summary.join(" ").trim();

  // Address: very naive — look for a line that starts with a number or
  // contains common Thai province names, but avoid phone-like strings.
  const addressLine =
    lines.find(
      (l) =>
        /^\d+\s+\w/.test(l) ||
        /\b(bangkok|กรุงเทพ|เชียงใหม่|chiang mai|นนทบุรี|nonthaburi)\b/i.test(l)
    ) ?? "";

  return {
    name: nameLine ?? "",
    email: emailMatch?.[0] ?? "",
    phone: phoneMatch?.[0] ?? "",
    address: addressLine,
    summary,
    skills,
    experience,
    education,
    languages,
  };
}
