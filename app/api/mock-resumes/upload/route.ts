import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

type ResumeSource = "jobsdb" | "jobthai" | "jobbkk" | "linkedin" | "referral";
const VALID_SOURCES: ResumeSource[] = ["jobsdb", "jobthai", "jobbkk", "linkedin", "referral"];

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not configured." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data body." }, { status: 400 });
  }

  const source = formData.get("source") as string | null;
  if (!source || !VALID_SOURCES.includes(source as ResumeSource)) {
    return NextResponse.json(
      { error: `"source" is required. Valid values: ${VALID_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  const fileEntries = formData.getAll("files") as File[];
  if (!fileEntries.length) {
    return NextResponse.json({ error: 'At least one file under field "files" is required.' }, { status: 400 });
  }

  const results: {
    filename: string;
    url: string;
    size: number;
    status: "uploaded" | "failed";
    error?: string;
  }[] = [];

  for (const file of fileEntries) {
    try {
      const blobPath = `mock-sources/${source}/${file.name}`;
      const blob = await put(blobPath, file, {
        access: "private",
        contentType: file.type || "application/pdf",
        addRandomSuffix: false,
      });

      results.push({ filename: file.name, url: blob.url, size: file.size, status: "uploaded" });
    } catch (err) {
      results.push({
        filename: file.name,
        url: "",
        size: file.size,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const uploaded = results.filter((r) => r.status === "uploaded").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json(
    {
      summary: { total: results.length, uploaded, failed },
      results,
    },
    { status: failed === results.length ? 500 : 200 }
  );
}
