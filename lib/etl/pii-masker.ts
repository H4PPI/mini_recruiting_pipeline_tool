import type { MaskedResult, PIITokens } from "./types";

// ─── Regex patterns ────────────────────────────────────────────────────────────

/** RFC-5321 simplified email pattern */
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/**
 * Thai mobile (08x/09x/06x) and basic international phone numbers.
 * Allows optional spaces and dashes between digit groups.
 */
const PHONE_RE =
  /(?:\+?66|0)[\s\-]?[689]\d[\s\-]?\d{3}[\s\-]?\d{4}|(?:\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4}/g;

/** Thai national ID (13 consecutive digits) */
const NATIONAL_ID_RE = /\b\d{13}\b/g;

/** Passport-style alphanumeric (e.g. AA1234567) */
const PASSPORT_RE = /\b[A-Z]{1,2}\d{7,8}\b/g;

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Replaces PII in `text` with placeholder tokens.
 *
 * - Emails   → [EMAIL_0], [EMAIL_1], …
 * - Phones   → [PHONE_0], [PHONE_1], …
 * - Names    → [CANDIDATE_NAME]  (each distinct word of `candidateName`)
 * - ID / passport numbers → [ID_NUMBER]
 *
 * The returned `tokens` object contains the original values so they can be
 * stored separately for HR access without re-sending to AI.
 */
export function maskPII(text: string, candidateName?: string): MaskedResult {
  const tokens: PIITokens = { names: [], emails: [], phones: [] };
  let masked = text;

  // 1. Emails
  const emailMatches = [...masked.matchAll(EMAIL_RE)].map((m) => m[0]);
  tokens.emails = [...new Set(emailMatches)];
  let eIdx = 0;
  masked = masked.replace(EMAIL_RE, () => `[EMAIL_${eIdx++}]`);

  // 2. Phone numbers
  const phoneMatches = [...masked.matchAll(PHONE_RE)].map((m) => m[0]);
  tokens.phones = [...new Set(phoneMatches)];
  let pIdx = 0;
  masked = masked.replace(PHONE_RE, () => `[PHONE_${pIdx++}]`);

  // 3. Candidate name (each word ≥ 2 chars to avoid removing short prepositions
  //    that happen to appear in job titles, etc.)
  if (candidateName) {
    tokens.names.push(candidateName);
    const words = candidateName
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 2);
    for (const word of words) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      masked = masked.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[CANDIDATE_NAME]");
    }
  }

  // 4. National ID & passport numbers
  masked = masked.replace(NATIONAL_ID_RE, "[ID_NUMBER]");
  masked = masked.replace(PASSPORT_RE, "[PASSPORT_NUMBER]");

  return { maskedText: masked, tokens };
}
