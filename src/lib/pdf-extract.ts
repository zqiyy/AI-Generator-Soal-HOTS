// Client-side PDF text extraction using pdfjs-dist.
// We import lazily to keep initial bundle small.

export async function extractTextFromPdf(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Ukuran PDF maksimal 10MB");
  const pdfjs = await import("pdfjs-dist");
  // Worker bundled via Vite
  const workerMod: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  const workerSrc = workerMod.default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    pages.push(text);
  }
  return cleanText(pages.join("\n\n"));
}

function cleanText(t: string): string {
  return t
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\d+\s*$/gm, "") // bare page numbers
    .trim();
}