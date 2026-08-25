interface ScreenerResult {
  matchScore: number; // 0..1
  matchDetails: any;
  aiEvaluation: string;
}

/**
 * Calls Gemini (or returns a mock) to evaluate a masked resume against a JD.
 * Expects maskedText (PII removed) and jdText (plain text).
 */
export async function evaluateCandidateAgainstJD(maskedText: string, jdText: string): Promise<ScreenerResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // If no key provided, return a deterministic mock score for development
  if (!apiKey) {
    const score = Math.min(0.95, Math.max(0.05, (maskedText.length % 100) / 100));
    return {
      matchScore: score,
      matchDetails: { reason: "mocked-score-no-key" },
      aiEvaluation: `Mock evaluation: score=${Math.round(score * 100)}%`,
    };
  }

  try {
    // Minimal request to the Gemini API (generateContent)
    const prompt = `You are an assistant that compares a candidate's resume to a job description and returns a JSON object with: { skillsScore:0-1, experienceScore:0-1, cultureScore:0-1, summary:string }.\n\nJob Description:\n${jdText}\n\nResume (PII redacted):\n${maskedText}\n\nRespond only with JSON.`;

    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.2 },
        }),
      }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`AI request failed: ${resp.status} ${txt}`);
    }

    const data = await resp.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Try to parse JSON from the model output
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      // fallback: attempt to extract JSON substring
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    if (!parsed) {
      // fallback scoring
      return {
        matchScore: 0.5,
        matchDetails: { raw: content },
        aiEvaluation: String(content).slice(0, 1000),
      };
    }

    const skills = Number(parsed.skillsScore ?? parsed.skills ?? 0) || 0;
    const exp = Number(parsed.experienceScore ?? parsed.experience ?? 0) || 0;
    const cult = Number(parsed.cultureScore ?? parsed.culture ?? 0) || 0;
    const avg = Math.max(0, Math.min(1, (skills + exp + cult) / 3));

    return {
      matchScore: avg,
      matchDetails: parsed,
      aiEvaluation: String(parsed.summary ?? JSON.stringify(parsed)).slice(0, 2000),
    };
  } catch (err) {
    console.error("evaluateCandidateAgainstJD error:", err);
    return {
      matchScore: 0,
      matchDetails: { error: String(err) },
      aiEvaluation: "Error during AI evaluation",
    };
  }
}
