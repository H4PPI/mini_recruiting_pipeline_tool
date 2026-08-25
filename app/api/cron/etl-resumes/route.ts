import { list, get, put } from "@vercel/blob";
import type { ListBlobResultBlob } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { extractTextFromPDF } from "@/lib/etl/pdf-extractor";
import { parseResume } from "@/lib/etl/resume-parser";
import { maskPII } from "@/lib/etl/pii-masker";
import type { ResumeSource } from "@/lib/etl/types";
import { evaluateCandidateAgainstJD } from "@/lib/etl/ai-screener";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
/** Base delay in ms for exponential back-off between retries. */
const RETRY_BASE_MS = 1_000;
const SOURCE_BLOB_PREFIX = "mock-sources/";
const DRAFT_BLOB_PREFIX = "candidate-resumes/";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Collect every blob under a prefix, following pagination cursors. */
async function listAllBlobs(prefix: string): Promise<ListBlobResultBlob[]> {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({ prefix, cursor, limit: 100 });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return blobs;
}

/** Derive the ResumeSource from a blob pathname like mock-sources/{source}/file.pdf */
function sourceFromPathname(pathname: string): ResumeSource {
  const parts = pathname.split("/");
  // parts: ["mock-sources", "{source}", "{filename}"]
  const raw = parts[1] ?? "";
  const valid: ResumeSource[] = ["jobsdb", "jobthai", "jobbkk", "linkedin", "referral"];
  return valid.includes(raw as ResumeSource) ? (raw as ResumeSource) : "referral";
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * GET /api/cron/etl-resumes
 *
 * Triggered daily at 06:00 AM (UTC+7) by Vercel Cron.
 * Authenticated via `Authorization: Bearer <CRON_SECRET>`.
 *
 * Pipeline:
 *  1. List all PDFs in `mock-sources/` blob prefix.
 *  2. Skip files already present in the `candidates` table.
 *  3. For each new file:
 *     a. Download from private store via presigned URL.
 *     b. Extract text with pdf-parse.
 *     c. Parse into normalized resume structure.
 *     d. Mask PII  → masked text is AI-safe; raw PII stored for HR only.
 *     e. Upload masked draft to `candidate-resumes/` prefix.
 *     f. Insert candidate row into Postgres.
 *  4. Retry failed files up to 3 times with exponential back-off.
 *  5. Persist run summary to `etl_run_log`.
 */
export async function GET(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is not configured." }, { status: 500 });
  }

  // ── 2. Create run log entry ───────────────────────────────────────────────
  const runLog = await prisma.etlRunLog.create({
    data: { runStatus: "running" },
  });
  const runId = runLog.id;

  // ── 4. List source blobs ──────────────────────────────────────────────────
  const allBlobs = await listAllBlobs(SOURCE_BLOB_PREFIX);
  const pdfBlobs = allBlobs.filter((b) => b.pathname.toLowerCase().endsWith(".pdf"));

  // ── 5. Filter already-processed files ────────────────────────────────────
  let alreadyProcessed: string[] = [];
  if (pdfBlobs.length > 0) {
    const rows = await prisma.candidate.findMany({
      where: { sourceBlobPath: { in: pdfBlobs.map((b) => b.pathname) } },
      select: { sourceBlobPath: true },
    });
    alreadyProcessed = rows.map((r) => r.sourceBlobPath);
  }

  const processedSet = new Set(alreadyProcessed);
  const toProcess = pdfBlobs.filter((b) => !processedSet.has(b.pathname));

  // ── 6. Process each file ──────────────────────────────────────────────────
  let processed = 0;
  let failed = 0;
  const errorDetails: { pathname: string; error: string }[] = [];

  for (const blob of toProcess) {
    let lastError = "";
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // a. Fetch blob content directly (server-side, authenticated via BLOB_READ_WRITE_TOKEN)
        const result = await get(blob.pathname, { access: "private" });
        if (!result) throw new Error(`Blob not found: ${blob.pathname}`);
        const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());

        // c. Extract raw text
        const rawText = await extractTextFromPDF(buffer);

        // d. Parse structured data
        const parsed = parseResume(rawText);

        // e. Mask PII — maskedText is safe for AI; tokens stay in Postgres (HR only)
        const { maskedText, tokens } = maskPII(rawText, parsed.name);

        const source = sourceFromPathname(blob.pathname);
        const filename = blob.pathname.split("/").pop() ?? blob.pathname;

        // f. Upload raw text and masked draft to candidate-resumes/
        const rawPath = `${DRAFT_BLOB_PREFIX}raw/${source}/${filename.replace(/\.pdf$/i, ".txt")}`;
        const draftPath = `${DRAFT_BLOB_PREFIX}masked/${source}/${filename.replace(/\.pdf$/i, ".txt")}`;

        const rawBlob = await put(rawPath, rawText, {
          access: "private",
          contentType: "text/plain",
          allowOverwrite: true,
        });

        const draftBlob = await put(draftPath, maskedText, {
          access: "private",
          contentType: "text/plain",
          allowOverwrite: true,
        });

        // h. Call general AI screener on the masked text (no JD) to produce candidate-level summary
        let aiScore: number | null = null;
        let aiSummary: string | null = null;
        let aiDetails: any = null;
        try {
          const aiRes = await evaluateCandidateAgainstJD(maskedText, "");
          aiScore = aiRes.matchScore;
          aiDetails = aiRes.matchDetails;
          aiSummary = aiRes.aiEvaluation;
        } catch (aiErr) {
          console.error("AI screener failed for candidate:", aiErr);
        }

        // i. Persist candidate record (raw + masked + AI summary)
        await prisma.candidate.upsert({
          where: { sourceBlobPath: blob.pathname },
          create: {
            source,
            sourceBlobPath: blob.pathname,
            fullName: parsed.name || null,
            email: parsed.email || null,
            phone: parsed.phone || null,
            address: parsed.address || null,
            skills: parsed.skills as Prisma.InputJsonValue,
            experience: parsed.experience as unknown as Prisma.InputJsonValue,
            education: parsed.education as unknown as Prisma.InputJsonValue,
            summary: parsed.summary || null,
            languages: parsed.languages as Prisma.InputJsonValue,
            maskedText,
            draftResumeBlobPath: draftBlob.pathname,
            rawResumeBlobPath: rawBlob.pathname,
            rawText,
            aiScore,
            aiSummary,
            aiDetails: aiDetails as Prisma.InputJsonValue,
          },
          update: {},
        });

        processed++;
        success = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_MS * attempt); // 1 s, 2 s
        }
      }
    }

    if (!success) {
      failed++;
      errorDetails.push({ pathname: blob.pathname, error: lastError });
    }
  }

  // ── 8. Finalise run log ───────────────────────────────────────────────────
  const finalStatus =
    toProcess.length > 0 && failed === toProcess.length ? "failed" : "completed";

  await prisma.etlRunLog.update({
    where: { id: runId },
    data: {
      runStatus: finalStatus,
      totalFound: pdfBlobs.length,
      processed,
      skipped: processedSet.size,
      failed,
      errorDetails,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    runId,
    summary: {
      totalFound: pdfBlobs.length,
      processed,
      skipped: processedSet.size,
      failed,
    },
    ...(errorDetails.length > 0 && { errors: errorDetails }),
  });
}
