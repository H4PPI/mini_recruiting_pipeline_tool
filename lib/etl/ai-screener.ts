// ─── System prompt (per product spec) ─────────────────────────────────────────
// ตำแหน่งที่พิจารณาถูกส่งมาจาก JD จริง แต่ยังคง fallback เป็น Fullstack developer
// เมื่อไม่มี JD ระบุไว้ (ใช้กับ candidate-level screening ทั่วไปใน cron ETL)
const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยคัดกรองเรซูเม่ของทีม HR ในประเทศไทย ตำแหน่งที่พิจารณาคือ {{POSITION}}

กฎที่ห้ามละเมิด:
1. ห้ามเดาข้อมูลที่ไม่มีอยู่ในเรซูเม่หรือ JD หากไม่พบข้อมูลที่ต้องใช้ ให้ตอบว่า "UNKNOWN"
2. evidence ต้องคัดลอกจากเรซูเม่ตรงๆ ไม่เกิน 8 คำ
3. ถ้าเกณฑ์ใดต้องใช้ข้อมูลที่ไม่มีในเรซูเม่ ให้ใส่ค่านั้นเป็น "UNKNOWN"
4. ให้ตีความคำที่มีความหมายเดียวกัน (synonyms) ว่าตรงกัน เช่น "React.js" กับ "ReactJS"
5. ทุกฟิลด์ข้อความ (reasoning, evidence, summary) ห้ามเกิน 1 ประโยคสั้นๆ
6. ให้คะแนน 0-10 สำหรับแต่ละด้าน อย่าให้คะแนนเฟ้อ (ให้คะแนนตามหลักฐานจริงเท่านั้น)`;

const DEFAULT_POSITION = "Fullstack developer";

interface CriterionResult {
  score: number; // 0-10
  reasoning: string; // <= 1 short sentence
  evidence: string; // verbatim from resume, <= 8 words, or "UNKNOWN"
}

interface MatchDetails {
  skillsFit: CriterionResult;
  experienceFit: CriterionResult;
  cultureFit: CriterionResult;
  strengths: string[];
  followUpQuestions: string[];
  shortlistReason: string;
}

interface ScreenerResult {
  matchScore: number; // 0..1 (normalized average of the 3 criteria / 10)
  matchDetails: MatchDetails;
  aiEvaluation: string;
}

// Gemini `responseSchema` fragment (OpenAPI-subset) shared by the 3 criteria
// so the model is constrained to return valid, strictly-typed JSON instead of
// free-form prose/markdown that our parser can't reliably read.
const CRITERION_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "NUMBER" },
    reasoning: { type: "STRING" },
    evidence: { type: "STRING" },
  },
  required: ["score", "reasoning", "evidence"],
};

function buildSystemPrompt(position: string) {
  return SYSTEM_PROMPT.replace("{{POSITION}}", position || DEFAULT_POSITION);
}

/** Strip ```json ... ``` / ``` ... ``` code fences some models wrap JSON in. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function emptyCriterion(reason: string): CriterionResult {
  return { score: 0, reasoning: reason, evidence: "UNKNOWN" };
}

function mockMatchDetails(maskedText: string): MatchDetails {
  const score = Math.min(9, Math.max(1, Math.round((maskedText.length % 100) / 10)));
  return {
    skillsFit: { score, reasoning: "Mock evaluation, no API key configured", evidence: "UNKNOWN" },
    experienceFit: { score, reasoning: "Mock evaluation, no API key configured", evidence: "UNKNOWN" },
    cultureFit: { score, reasoning: "Mock evaluation, no API key configured", evidence: "UNKNOWN" },
    strengths: [],
    followUpQuestions: [],
    shortlistReason: "Mocked score (no GEMINI_API_KEY set)",
  };
}

/**
 * Calls Gemini (or returns a mock) to evaluate a masked resume against a JD,
 * using the HR screening system prompt and criteria defined in the product spec:
 *  - skills fit / experience fit / culture-communication fit (0-10 each)
 *  - short reasoning + verbatim evidence (<=8 words) per criterion
 *  - strengths flags + prescreen follow-up questions
 *  - shortlist reasoning summary for HR
 *
 * Expects maskedText (PII removed) and jdText (plain text, already normalized).
 * `position` is derived from the job title when available.
 */
export async function evaluateCandidateAgainstJD(
  maskedText: string,
  jdText: string,
  position: string = DEFAULT_POSITION
): Promise<ScreenerResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // If no key provided, return a deterministic mock result for development
  if (!apiKey) {
    const matchDetails = mockMatchDetails(maskedText);
    const avg =
      (matchDetails.skillsFit.score + matchDetails.experienceFit.score + matchDetails.cultureFit.score) / 30;
    return {
      matchScore: avg,
      matchDetails,
      aiEvaluation: `Mock evaluation: score=${Math.round(avg * 100)}%`,
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(position);

    const userPrompt =
      `Job Description:\n${jdText || "UNKNOWN"}\n\nResume (PII redacted):\n${maskedText}\n\n` +
      `ประเมินผู้สมัครตามเกณฑ์ 3 ด้าน (skills fit, experience fit, culture/communication fit) แต่ละด้านให้คะแนน 0-10 พร้อม reasoning สั้นๆ ` +
      `และ evidence ที่คัดลอกจากเรซูเม่ตรงๆ ไม่เกิน 8 คำ (หรือ "UNKNOWN" ถ้าไม่มีข้อมูล) ` +
      `นอกจากนี้ให้ระบุ strengths (จุดแข็ง) เป็น array ของข้อความสั้นๆ, followUpQuestions (คำถามที่ควรถามเพิ่มในการโทรสัมภาษณ์ครั้งแรก) เป็น array, ` +
      `และ shortlistReason (เหตุผลสั้นๆ ว่าทำไมผู้สมัครถึงเหมาะหรือไม่เหมาะ)\n\n` +
      `ตอบกลับเป็น JSON เท่านั้นตาม schema:\n` +
      `{\n` +
      `  "skillsFit": { "score": 0-10, "reasoning": string, "evidence": string },\n` +
      `  "experienceFit": { "score": 0-10, "reasoning": string, "evidence": string },\n` +
      `  "cultureFit": { "score": 0-10, "reasoning": string, "evidence": string },\n` +
      `  "strengths": string[],\n` +
      `  "followUpQuestions": string[],\n` +
      `  "shortlistReason": string\n` +
      `}`;

    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            // The model spends a chunk of its output budget on internal
            // "thinking" tokens before writing the actual answer, so give it
            // plenty of headroom — 600 was too low and caused truncated,
            // non-JSON output that fell back to the mock scorer.
            maxOutputTokens: 4096,
            temperature: 0.2,
            // Force strict JSON output (no markdown fences / prose) so we
            // don't have to rely on best-effort parsing of free-form text.
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                skillsFit: CRITERION_SCHEMA,
                experienceFit: CRITERION_SCHEMA,
                cultureFit: CRITERION_SCHEMA,
                strengths: { type: "ARRAY", items: { type: "STRING" } },
                followUpQuestions: { type: "ARRAY", items: { type: "STRING" } },
                shortlistReason: { type: "STRING" },
              },
              required: [
                "skillsFit",
                "experienceFit",
                "cultureFit",
                "strengths",
                "followUpQuestions",
                "shortlistReason",
              ],
            },
          },
        }),
      }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`AI request failed: ${resp.status} ${txt}`);
    }

    const data = await resp.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Try to parse JSON from the model output (with responseMimeType:
    // "application/json" this should be strict JSON already, but we still
    // defensively strip markdown code fences and fall back to extracting a
    // JSON substring in case the model or API version doesn't honor it).
    let parsed: any;
    try {
      parsed = JSON.parse(stripCodeFences(content));
    } catch (_) {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch (_2) {
          parsed = undefined;
        }
      }
    }

    if (!parsed) {
      const matchDetails = mockMatchDetails(maskedText);
      return {
        matchScore: 0.5,
        matchDetails,
        aiEvaluation: String(content).slice(0, 1000),
      };
    }

    const normalizeCriterion = (raw: any, fallbackReason: string): CriterionResult => {
      if (!raw || typeof raw !== "object") return emptyCriterion(fallbackReason);
      const score = Number(raw.score);
      return {
        score: Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0,
        reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "UNKNOWN",
        evidence: typeof raw.evidence === "string" ? raw.evidence : "UNKNOWN",
      };
    };

    const matchDetails: MatchDetails = {
      skillsFit: normalizeCriterion(parsed.skillsFit, "UNKNOWN"),
      experienceFit: normalizeCriterion(parsed.experienceFit, "UNKNOWN"),
      cultureFit: normalizeCriterion(parsed.cultureFit, "UNKNOWN"),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.filter((s: unknown) => typeof s === "string")
        : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions)
        ? parsed.followUpQuestions.filter((s: unknown) => typeof s === "string")
        : [],
      shortlistReason: typeof parsed.shortlistReason === "string" ? parsed.shortlistReason : "UNKNOWN",
    };

    const avg = Math.max(
      0,
      Math.min(
        1,
        (matchDetails.skillsFit.score + matchDetails.experienceFit.score + matchDetails.cultureFit.score) / 30
      )
    );

    return {
      matchScore: avg,
      matchDetails,
      aiEvaluation: matchDetails.shortlistReason,
    };
  } catch (err) {
    console.error("evaluateCandidateAgainstJD error:", err);
    const matchDetails: MatchDetails = {
      skillsFit: emptyCriterion("Error during AI evaluation"),
      experienceFit: emptyCriterion("Error during AI evaluation"),
      cultureFit: emptyCriterion("Error during AI evaluation"),
      strengths: [],
      followUpQuestions: [],
      shortlistReason: "Error during AI evaluation",
    };
    return {
      matchScore: 0,
      matchDetails,
      aiEvaluation: "Error during AI evaluation",
    };
  }
}
