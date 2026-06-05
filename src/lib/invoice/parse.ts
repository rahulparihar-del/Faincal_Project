import { InvoiceSummary, InvoiceLineItem, GstType } from "./types";
import { stateFromGstin } from "./gstStates";

const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse common Indian invoice date formats into YYYY-MM-DD; returns raw if unknown. */
export function toISODate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD
  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(s);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(s);
  if (m) {
    let year = +m[3];
    if (year < 100) year += 2000;
    return `${year}-${pad(+m[2])}-${pad(+m[1])}`;
  }

  // DD-Mon-YYYY / DD Month YYYY
  m = /\b(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]*(\d{2,4})\b/.exec(s);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) {
      let year = +m[3];
      if (year < 100) year += 2000;
      return `${year}-${pad(mon)}-${pad(+m[1])}`;
    }
  }
  return null;
}

/** Find the first number that appears after any of the given labels (same or next token). */
function amountAfter(lines: string[], labels: string[]): number | null {
  const numRe = /(?:₹|rs\.?|inr)?\s*([\d][\d,]*(?:\.\d{1,2})?)/i;
  for (const label of labels) {
    const labelRe = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    for (const line of lines) {
      if (labelRe.test(line)) {
        // take the last number on the label line (amount usually right-aligned)
        const nums = line.match(/[\d][\d,]*(?:\.\d{1,2})?/g);
        if (nums && nums.length) {
          const val = toNumber(nums[nums.length - 1]);
          if (val !== null && val > 0) return val;
        }
        // otherwise check it parses inline
        const inline = numRe.exec(line);
        if (inline) {
          const val = toNumber(inline[1]);
          if (val !== null && val > 0) return val;
        }
      }
    }
  }
  return null;
}

function findInvoiceNumber(lines: string[]): string | null {
  const re = /(?:invoice|bill|inv|tax invoice)\s*(?:no|number|#|num)?\.?\s*[:\-#]?\s*([A-Za-z0-9][A-Za-z0-9/\-]{2,})/i;
  for (const line of lines) {
    const m = re.exec(line);
    if (m && !/date/i.test(line)) {
      const candidate = m[1].replace(/[.,;]+$/, "");
      // avoid catching the word "date" or pure labels
      if (candidate.length >= 3) return candidate;
    }
  }
  return null;
}

function findInvoiceDate(lines: string[]): string | null {
  for (const line of lines) {
    if (/(?:invoice|bill|inv)\s*date|date\s*[:\-]|dated/i.test(line)) {
      const iso = toISODate(line);
      if (iso) return iso;
    }
  }
  // fall back to the first date-looking token anywhere
  for (const line of lines) {
    const iso = toISODate(line);
    if (iso) return iso;
  }
  return null;
}

function findVendorName(lines: string[], gstin: string | null): string | null {
  const isNoise = (l: string) =>
    /tax invoice|^invoice$|gstin|g\.?s\.?t|original|duplicate|^bill\b|^date|state\s*code|phone|mobile|email|www\.|^to\b|^ship|^bill to/i.test(l) ||
    /^[\d\W]+$/.test(l);

  // Prefer the line just above the (first) GSTIN occurrence.
  if (gstin) {
    const idx = lines.findIndex((l) => l.includes(gstin));
    for (let i = idx - 1; i >= 0 && i >= idx - 3; i--) {
      const l = lines[i]?.trim();
      if (l && !isNoise(l) && /[A-Za-z]{3,}/.test(l)) return l.replace(/^m\/s\.?\s*/i, "").trim();
    }
  }

  // Otherwise the first meaningful line near the top.
  for (const l of lines.slice(0, 8)) {
    const t = l.trim();
    if (t && !isNoise(t) && /[A-Za-z]{3,}/.test(t) && t.length <= 60) {
      return t.replace(/^m\/s\.?\s*/i, "").trim();
    }
  }
  return null;
}

function findCity(lines: string[], state: string | null): string | null {
  // Explicit "City: X"
  for (const line of lines) {
    const m = /\bcity\s*[:\-]\s*([A-Za-z][A-Za-z .]+)/i.exec(line);
    if (m) return m[1].trim();
  }
  // "<City> - 560001" or "<City>, <State> - 560001"
  for (const line of lines) {
    const m = /([A-Za-z][A-Za-z .]{2,}?)\s*[-,]?\s*\b\d{6}\b/.exec(line);
    if (m) {
      let city = m[1].trim().replace(/,$/, "");
      if (state) city = city.replace(new RegExp(state, "i"), "").replace(/[,\-]\s*$/, "").trim();
      const parts = city.split(/[,]/).map((p) => p.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /[A-Za-z]{3,}/.test(last)) return last;
    }
  }
  return null;
}

function parseLineItems(lines: string[]): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/total|gst|cgst|sgst|igst|taxable|invoice|gstin|amount in words|subtotal|sub total/i.test(t)) continue;
    // Description followed by 2-4 numbers (qty, rate, amount ...)
    const m = /^(.*?[A-Za-z].*?)\s+((?:[\d][\d,]*(?:\.\d{1,2})?\s+){1,4}[\d][\d,]*(?:\.\d{1,2})?)\s*$/.exec(t);
    if (m) {
      const desc = m[1].trim().replace(/^\d+[.)]\s*/, "");
      const nums = m[2].trim().split(/\s+/).map((x) => toNumber(x)).filter((x): x is number => x !== null);
      if (desc.length >= 2 && nums.length >= 2) {
        const amount = nums[nums.length - 1];
        const qty = nums.length >= 3 ? nums[0] : null;
        const rate = nums.length >= 3 ? nums[1] : nums[0];
        items.push({ description: desc, qty, rate, amount });
      }
    }
  }
  return items.slice(0, 100);
}

export function parseInvoiceText(rawText: string): { summary: InvoiceSummary; lineItems: InvoiceLineItem[] } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
  const upper = rawText.toUpperCase();

  // GSTIN (take the first; usually the supplier's)
  const gstMatches = rawText.toUpperCase().match(GSTIN_RE);
  const gstNumber = gstMatches && gstMatches.length ? gstMatches[0] : null;

  // GST type
  const hasCgst = /\bC\s?GST\b/i.test(rawText) || upper.includes("CGST");
  const hasSgst = /\bS\s?GST\b/i.test(rawText) || upper.includes("SGST");
  const hasIgst = upper.includes("IGST");
  let gstType: GstType = null;
  if (hasCgst && hasSgst) gstType = "CGST/SGST";
  else if (hasIgst) gstType = "IGST";

  // Amounts
  const totalAmount = amountAfter(lines, [
    "grand total", "amount payable", "invoice total", "total amount", "net payable", "net amount", "bill amount", "total",
  ]);
  const subtotal = amountAfter(lines, [
    "taxable value", "taxable amount", "sub total", "subtotal", "amount before tax", "basic amount",
  ]);

  let gstAmount: number | null = null;
  const directGst = amountAfter(lines, ["total tax", "total gst", "gst amount", "tax amount"]);
  if (directGst !== null) {
    gstAmount = directGst;
  } else if (gstType === "IGST") {
    gstAmount = amountAfter(lines, ["igst"]);
  } else {
    const c = amountAfter(lines, ["cgst"]);
    const s = amountAfter(lines, ["sgst"]);
    if (c !== null || s !== null) gstAmount = (c ?? 0) + (s ?? 0);
  }
  // Derive a missing leg if two of the three are known
  if (gstAmount === null && subtotal !== null && totalAmount !== null && totalAmount > subtotal) {
    gstAmount = Math.round((totalAmount - subtotal) * 100) / 100;
  }

  const state = stateFromGstin(gstNumber);

  const summary: InvoiceSummary = {
    vendorName: findVendorName(lines, gstNumber),
    gstNumber,
    invoiceNumber: findInvoiceNumber(lines),
    invoiceDate: findInvoiceDate(lines),
    city: findCity(lines, state),
    state,
    subtotal,
    gstAmount,
    totalAmount,
    gstType,
  };

  return { summary, lineItems: parseLineItems(lines) };
}
