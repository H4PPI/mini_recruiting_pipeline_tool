import { PDFParse } from "pdf-parse";

/**
 * Extracts raw plain text from a PDF buffer.
 * Returns an empty string if the PDF has no extractable text (e.g. scanned image).
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text ?? "";
}

/**
 * Normalize extracted text for JD parsing:
 * - Normalize newlines
 * - Remove common hyphenation at line endings
 * - Collapse multiple spaces
 * - Trim
 */
export function normalizeJdText(text: string): string {
  if (!text) return "";
  // Normalize CRLF
  let t = text.replace(/\r\n?/g, "\n");
  // Remove hyphenation at line breaks (e.g., some-\nthing -> something)
  t = t.replace(/-\n\s*/g, "");
  // Join lines that are likely part of the same paragraph: if a line does not
  // end with punctuation, and the next line starts with lowercase Thai/Latin
  t = t.split("\n").reduce((acc: string[], line, idx, arr) => {
    const next = arr[idx + 1] || "";
    const endsWithPunct = /[\.\?!\u0E2F\u0E4F\u0E46]$/.test(line.trim());
    const nextStartsUpper = /^\s*[A-Z\u0E00-\u0E7F]/.test(next);
    if (!endsWithPunct && next && !nextStartsUpper) {
      // join with space
      acc.push((acc.pop() || "") + (acc.length ? " " : "") + line.trim());
    } else {
      acc.push(line.trim());
    }
    return acc;
  }, []).join("\n");

  // Remove repeated headers/footers: heuristic - remove lines that repeat >1 times
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const freq = new Map<string, number>();
  for (const l of lines) freq.set(l, (freq.get(l) || 0) + 1);
  const cleaned = lines.filter((l) => (freq.get(l) || 0) <= 2).join("\n");

  // Collapse multiple spaces
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/**
 * Parse job description text into sections by known headers (Thai examples provided).
 * Returns an object mapping header keys to content; unknown sections go into `other`.
 * The caller should run `normalizeJdText` first.
 */
export function parseJobDescriptionToJson(text: string, headers?: {
  mustHeader?: string;
  niceHeader?: string;
  stopHeader?: string;
}): Record<string, string | null> {
  const defaultHeaders = {
    mustHeader: "คุณสมบัติที่ต้องการ",
    niceHeader: "จะได้รับการพิจารณาเป็นพิเศษ",
    stopHeader: "หน้าที่ความรับผิดชอบ",
  };
  const cfg = { ...defaultHeaders, ...(headers || {}) };

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const result: Record<string, string | null> = {
    title: null,
    description: null,
    responsibilities: null,
    mustHave: null,
    niceToHave: null,
    other: null,
  };

  let current: string[] = [];
  let section = 'description';

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const lower = l.toLowerCase();

    if (i === 0 && lines.length > 1) {
      // First non-empty line treat as title if short
      if (l.length < 120) {
        result.title = l;
        continue;
      }
    }

    if (l.includes(cfg.stopHeader) || /หน้าที่|responsibilit/i.test(l)) {
      // responsibilities
      if (current.length) {
        result[section] = (result[section] || '') + '\n' + current.join('\n');
        current = [];
      }
      section = 'responsibilities';
      continue;
    }

    if (l.includes(cfg.mustHeader) || /คุณสมบัติ|คุณสมบัติที่ต้องการ/i.test(l)) {
      if (current.length) {
        result[section] = (result[section] || '') + '\n' + current.join('\n');
        current = [];
      }
      section = 'mustHave';
      continue;
    }

    if (l.includes(cfg.niceHeader) || /พิจารณาเป็นพิเศษ|จะได้รับการพิจารณาเป็นพิเศษ/i.test(l)) {
      if (current.length) {
        result[section] = (result[section] || '') + '\n' + current.join('\n');
        current = [];
      }
      section = 'niceToHave';
      continue;
    }

    current.push(l);
  }

  if (current.length) {
    result[section] = (result[section] || '') + '\n' + current.join('\n');
  }

  // Consolidate and trim
  for (const k of Object.keys(result)) {
    if (typeof result[k] === 'string') {
      result[k] = (result[k] as string).trim() || null;
    }
  }

  // If description empty, set to null
  if (!result.description) result.description = result.other || null;

  return result;
}
