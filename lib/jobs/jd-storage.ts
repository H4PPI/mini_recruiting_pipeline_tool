import { del, put } from "@vercel/blob";

const JD_BLOB_PREFIX = "job-descriptions/";

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function uploadJobDescriptionPdf(file: File, jobId: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const filename = sanitizeFilename(file.name || "job-description.pdf");
  const pathname = `${JD_BLOB_PREFIX}${jobId}/${filename}`;

  const blob = await put(pathname, file, {
    access: "private",
    contentType: file.type || "application/pdf",
    allowOverwrite: true,
  });

  return blob.pathname;
}

export async function deleteJobDescriptionPdf(pathname: string | null | undefined) {
  if (!pathname) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;

  await del(pathname);
}

export function isPdfFile(value: FormDataEntryValue | null): value is File {
  return (
    value instanceof File &&
    value.size > 0 &&
    (value.type === "application/pdf" || value.name.toLowerCase().endsWith(".pdf"))
  );
}
