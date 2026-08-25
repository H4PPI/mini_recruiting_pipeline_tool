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
