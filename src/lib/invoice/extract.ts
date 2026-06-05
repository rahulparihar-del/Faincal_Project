import { ExtractionResult } from "./types";
import { parseInvoiceText } from "./parse";

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type ProgressFn = (message: string) => void;

/** Reconstruct line-structured text from a pdf.js page's text content. */
function pageItemsToText(items: Array<{ str: string; transform: number[] }>): string {
  const rows = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push({ x: it.transform[4], str: it.str });
  }
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0]) // top of page first (higher y)
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" "))
    .join("\n");
}

async function extractPdfText(file: File, onProgress?: ProgressFn): Promise<string> {
  onProgress?.("Reading PDF…");
  const pdfjs: typeof import("pdfjs-dist") = await import("pdfjs-dist");
  // Load the worker from CDN, pinned to the installed version.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += pageItemsToText(content.items as Array<{ str: string; transform: number[] }>) + "\n";
  }
  return text.trim();
}

async function ocrImage(image: HTMLCanvasElement | string, onProgress?: ProgressFn): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const { data } = await Tesseract.recognize(image, "eng", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress?.(`Reading text… ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return data.text || "";
}

/** Render scanned PDF pages to canvases and OCR them. */
async function ocrPdf(file: File, onProgress?: ProgressFn): Promise<string> {
  const pdfjs: typeof import("pdfjs-dist") = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  let text = "";
  const pages = Math.min(pdf.numPages, 5); // cap for performance
  for (let i = 1; i <= pages; i++) {
    onProgress?.(`Scanning page ${i}/${pages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
    text += (await ocrImage(canvas, onProgress)) + "\n";
  }
  return text.trim();
}

export async function extractInvoice(file: File, onProgress?: ProgressFn): Promise<ExtractionResult> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let rawText = "";
  let source: ExtractionResult["source"] = "ocr";

  if (isPdf) {
    rawText = await extractPdfText(file, onProgress);
    source = "pdf-text";
    // If the PDF has little/no embedded text, it's likely scanned -> OCR.
    if (rawText.replace(/\s/g, "").length < 40) {
      onProgress?.("No text layer found — running OCR…");
      rawText = await ocrPdf(file, onProgress);
      source = "ocr";
    }
  } else {
    onProgress?.("Reading image…");
    rawText = await ocrImage(await fileToDataUrl(file), onProgress);
    source = "ocr";
  }

  onProgress?.("Extracting fields…");
  const { summary, lineItems } = parseInvoiceText(rawText);
  return { summary, lineItems, rawText, source };
}
