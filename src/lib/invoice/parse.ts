import { ExtractedFields, FieldResult, GstType, InvoiceLineItem } from "./types";
import { stateFromGstin, GST_STATE_CODES } from "./gstStates";

const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const BUSINESS_SUFFIX =
  /\b(pvt|private|ltd|limited|llp|enterprises?|traders?|trading|industries|textiles?|garments?|fabrics?|creations?|collection|apparels?|agency|agencies|mills|exports?|imp(?:ex|orts?)|sons|& co|and co|company|corp(?:oration)?|distributors?|suppliers?|stores?|emporium)\b/i;
const ADDRESS_MARKER =
  /\b(road|rd\.?|street|st\.?|nagar|plot|sector|lane|floor|near|opp\.?|marg|colony|cross|block|gali|chowk|market|complex|building|bldg|industrial|estate|phase)\b|\b\d{6}\b/i;
const NOISE =
  /tax invoice|^invoice$|original|duplicate|triplicate|gstin|g\.?s\.?t\.?i?n?\b|state\s*code|phone|mobile|^tel|email|e-mail|www\.|@|^to\b|^bill to|^ship to|^buyer|^consignee|^date|^dated|^invoice no|^p\.?o\.?\b/i;

const clamp = (n: number) => Math.max(0, Math.min(0.98, n));

function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function numbersOn(line: string): number[] {
  const m = line.match(/[\d][\d,]*(?:\.\d{1,2})?/g);
  if (!m) return [];
  return m.map((x) => toNumber(x)).filter((x): x is number => x !== null);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(s);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(s);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  m = /\b(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]*(\d{2,4})\b/.exec(s);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) {
      let y = +m[3];
      if (y < 100) y += 2000;
      return `${y}-${pad(mon)}-${pad(+m[1])}`;
    }
  }
  return null;
}

const F = <T>(value: T | null, confidence: number): FieldResult<T> => ({
  value,
  confidence: value == null ? 0 : clamp(confidence),
});

/** Index where the header/vendor block ends and the invoice body begins. */
function headerEnd(lines: string[]): number {
  const marker = /tax invoice|invoice\s*(no|#|number)|bill to|ship to|buyer|consignee|invoice date|^items?\b|description|hsn|qty/i;
  for (let i = 0; i < lines.length; i++) {
    if (marker.test(lines[i])) return i;
  }
  return Math.min(10, lines.length);
}

// ── GST number (supplier) ──
function extractGstin(rawText: string, hEnd: number, lines: string[]): FieldResult<string> {
  const all = rawText.toUpperCase().match(GSTIN_RE) || [];
  if (all.length === 0) return F<string>(null, 0);
  // Prefer a GSTIN that appears within the header (supplier) block.
  const headerText = lines.slice(0, Math.max(hEnd, 6)).join("\n").toUpperCase();
  const inHeader = all.find((g) => headerText.includes(g));
  if (inHeader) return F(inHeader, 0.95);
  return F(all[0] ?? null, all.length === 1 ? 0.85 : 0.7);
}

// ── Vendor name (company name in header, before address & GST) ──
function extractVendor(lines: string[], hEnd: number, gstin: string | null): FieldResult<string> {
  const gstIdx = gstin ? lines.findIndex((l) => l.toUpperCase().includes(gstin)) : -1;
  const limit = Math.max(hEnd, gstIdx >= 0 ? gstIdx : 8);
  let best: { value: string; score: number } | null = null;

  for (let i = 0; i < Math.min(limit, lines.length); i++) {
    const raw = lines[i].trim();
    if (!raw || !/[A-Za-z]{3,}/.test(raw)) continue;
    if (NOISE.test(raw)) continue;
    if (/^[\d\W]+$/.test(raw)) continue;
    if (raw.length > 60) continue;

    let score = 0.32;
    if (BUSINESS_SUFFIX.test(raw)) score += 0.34;
    if (gstIdx >= 0 && i < gstIdx && i >= gstIdx - 4) score += 0.2; // sits just above the GSTIN
    if (i === 0) score += 0.12; // top line
    const letters = raw.replace(/[^A-Za-z]/g, "");
    if (letters && letters === letters.toUpperCase() && raw.length <= 45) score += 0.12; // ALL CAPS header
    if (ADDRESS_MARKER.test(raw)) score -= 0.35; // looks like an address line
    if (/\b\d{6}\b/.test(raw)) score -= 0.3; // pincode line
    if (/^\d+[.)]/.test(raw)) score -= 0.2; // numbered list row

    if (!best || score > best.score) best = { value: raw.replace(/^m\/s\.?\s*/i, "").trim(), score };
  }
  return best ? F(best.value, best.score) : F<string>(null, 0);
}

// ── Invoice number (labelled patterns, prioritised) ──
function extractInvoiceNumber(lines: string[]): FieldResult<string> {
  const patterns: { re: RegExp; w: number }[] = [
    { re: /(?:tax\s*)?invoice\s*(?:no|number|#|num)?\.?\s*[:#\-]?\s*([A-Za-z0-9][\w/\-]{2,})/i, w: 0.9 },
    { re: /sales\s*order\s*(?:no|number|#)?\.?\s*[:#\-]?\s*([A-Za-z0-9][\w/\-]{2,})/i, w: 0.83 },
    { re: /\border\s*(?:no|number|#)\.?\s*[:#\-]?\s*([A-Za-z0-9][\w/\-]{2,})/i, w: 0.8 },
    { re: /\bbill\s*(?:no|number|#)\.?\s*[:#\-]?\s*([A-Za-z0-9][\w/\-]{2,})/i, w: 0.76 },
    { re: /\b((?:SO|INV)[-/]?\d[\w/\-]*)\b/i, w: 0.62 },
  ];
  let best: { value: string; w: number } | null = null;
  for (const line of lines) {
    if (/date/i.test(line)) continue; // avoid "invoice date" lines
    for (const p of patterns) {
      const m = p.re.exec(line);
      if (m && m[1]) {
        const v = m[1].replace(/[.,;]+$/, "");
        if (v.length >= 3 && !/^date$/i.test(v) && (!best || p.w > best.w)) best = { value: v, w: p.w };
      }
    }
  }
  return best ? F(best.value, best.w) : F<string>(null, 0);
}

// ── Invoice date ──
function extractDate(lines: string[]): FieldResult<string> {
  for (const line of lines) {
    if (/invoice\s*date|bill\s*date/i.test(line)) {
      const iso = toISODate(line);
      if (iso) return F(iso, 0.9);
    }
  }
  for (const line of lines) {
    if (/\bdate\b|dated/i.test(line)) {
      const iso = toISODate(line);
      if (iso) return F(iso, 0.75);
    }
  }
  for (const line of lines) {
    const iso = toISODate(line);
    if (iso) return F(iso, 0.5);
  }
  return F<string>(null, 0);
}

// ── Amounts (total prioritises Grand Total / Invoice Total over Subtotal) ──
function labelledAmount(
  lines: string[],
  rules: { re: RegExp; w: number }[],
  exclude: RegExp
): { amount: number; w: number } | null {
  let best: { amount: number; w: number } | null = null;
  for (const line of lines) {
    const low = line.toLowerCase();
    if (exclude.test(low)) continue;
    const nums = numbersOn(line);
    if (!nums.length) continue;
    const amount = nums[nums.length - 1];
    if (amount <= 0) continue;
    for (const r of rules) {
      if (r.re.test(low) && (!best || r.w > best.w || (r.w === best.w && amount > best.amount))) {
        best = { amount, w: r.w };
      }
    }
  }
  return best;
}

function extractGstType(rawText: string): FieldResult<GstType> {
  const up = rawText.toUpperCase();
  const cgst = /\bC\s?GST\b/.test(up);
  const sgst = /\bS\s?GST\b/.test(up);
  const igst = /\bIGST\b/.test(up);
  if (cgst && sgst) return F<GstType>("CGST/SGST", 0.9);
  if (igst) return F<GstType>("IGST", 0.9);
  return F<GstType>(null, 0);
}

// ── City / State from the vendor address block ──
function extractCityState(
  lines: string[],
  hEnd: number,
  gstin: string | null
): { city: FieldResult<string>; state: FieldResult<string> } {
  const block = lines.slice(0, Math.max(hEnd, 8));

  // State: GSTIN state code is the most reliable signal.
  let state: FieldResult<string> = F<string>(null, 0);
  const fromGst = stateFromGstin(gstin);
  if (fromGst) {
    const mentioned = block.some((l) => new RegExp(fromGst.split(" ")[0], "i").test(l));
    state = F(fromGst, mentioned ? 0.95 : 0.9);
  } else {
    const names = Object.values(GST_STATE_CODES);
    for (const l of block) {
      const hit = names.find((n) => new RegExp(`\\b${n}\\b`, "i").test(l));
      if (hit) { state = F(hit, 0.7); break; }
    }
  }

  // City: token immediately before a pincode in the address block.
  let city: FieldResult<string> = F<string>(null, 0);
  for (const line of block) {
    const explicit = /\bcity\s*[:\-]\s*([A-Za-z][A-Za-z .]+)/i.exec(line);
    if (explicit) { city = F(explicit[1].trim(), 0.85); break; }
  }
  if (!city.value) {
    for (const line of block) {
      const m = /([A-Za-z][A-Za-z .]{2,}?)\s*[-,]?\s*\b\d{6}\b/.exec(line);
      if (m) {
        let c = m[1].trim().replace(/[,\-]+$/, "");
        if (state.value) c = c.replace(new RegExp(state.value, "i"), "").replace(/[,\-]\s*$/, "").trim();
        const parts = c.split(/[,]/).map((p) => p.trim()).filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && /[A-Za-z]{3,}/.test(last) && !ADDRESS_MARKER.test(last)) {
          city = F(last, 0.78);
          break;
        }
      }
    }
  }
  return { city, state };
}

function parseLineItems(lines: string[]): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/total|gst|cgst|sgst|igst|taxable|invoice|gstin|amount in words|sub\s*total/i.test(t)) continue;
    const m = /^(.*?[A-Za-z].*?)\s+((?:[\d][\d,]*(?:\.\d{1,2})?\s+){1,4}[\d][\d,]*(?:\.\d{1,2})?)\s*$/.exec(t);
    if (m) {
      const desc = m[1].trim().replace(/^\d+[.)]\s*/, "");
      const nums = m[2].trim().split(/\s+/).map((x) => toNumber(x)).filter((x): x is number => x !== null);
      if (desc.length >= 2 && nums.length >= 2) {
        items.push({
          description: desc,
          qty: nums.length >= 3 ? nums[0] : null,
          rate: nums.length >= 3 ? nums[1] : nums[0],
          amount: nums[nums.length - 1],
        });
      }
    }
  }
  return items.slice(0, 100);
}

export function extractFields(rawText: string): { fields: ExtractedFields; lineItems: InvoiceLineItem[] } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  const hEnd = headerEnd(lines);

  const gstNumber = extractGstin(rawText, hEnd, lines);
  const vendorName = extractVendor(lines, hEnd, gstNumber.value);
  const invoiceNumber = extractInvoiceNumber(lines);
  const invoiceDate = extractDate(lines);
  const { city, state } = extractCityState(lines, hEnd, gstNumber.value);
  const gstType = extractGstType(rawText);

  const EXCLUDE_FOR_TOTAL = /sub\s*total|subtotal|taxable|tax amount|c\s?gst|s\s?gst|igst|qty|quantity|items|hsn|round/;
  const totalCand = labelledAmount(
    lines,
    [
      { re: /grand total/, w: 1.0 },
      { re: /amount payable|net payable|invoice total|total payable|bill total/, w: 0.92 },
      { re: /total amount|total value|net amount|total\s*(?:₹|rs\.?|inr)/, w: 0.85 },
      { re: /\btotal\b/, w: 0.6 },
    ],
    EXCLUDE_FOR_TOTAL
  );
  const subCand = labelledAmount(
    lines,
    [
      { re: /taxable value|taxable amount/, w: 0.88 },
      { re: /sub\s*total|subtotal/, w: 0.85 },
      { re: /amount before tax|basic (?:value|amount)/, w: 0.78 },
    ],
    /grand total|igst|c\s?gst|s\s?gst|qty/
  );
  const gstDirect = labelledAmount(
    lines,
    [{ re: /total tax|total gst|gst amount|tax amount/, w: 0.9 }],
    /taxable|sub\s*total/
  );

  let subtotal = subCand ? F(subCand.amount, subCand.w) : F<number>(null, 0);
  let totalAmount = totalCand ? F(totalCand.amount, totalCand.w) : F<number>(null, 0);

  // GST amount: direct label, else CGST+SGST / IGST, else derived.
  let gstAmount: FieldResult<number>;
  if (gstDirect) {
    gstAmount = F(gstDirect.amount, gstDirect.w);
  } else if (gstType.value === "IGST") {
    const igst = labelledAmount(lines, [{ re: /igst/, w: 0.85 }], /taxable|total amount|grand total/);
    gstAmount = igst ? F(igst.amount, 0.85) : F<number>(null, 0);
  } else {
    const c = labelledAmount(lines, [{ re: /c\s?gst/, w: 1 }], /taxable/);
    const s = labelledAmount(lines, [{ re: /s\s?gst/, w: 1 }], /taxable/);
    if (c || s) gstAmount = F((c?.amount ?? 0) + (s?.amount ?? 0), 0.84);
    else gstAmount = F<number>(null, 0);
  }

  // ── Cross-validation (reasoning over context): subtotal + gst ≈ total ──
  if (subtotal.value != null && totalAmount.value != null) {
    if (totalAmount.value < subtotal.value) {
      totalAmount = { ...totalAmount, confidence: clamp(totalAmount.confidence - 0.3) };
    }
    if (gstAmount.value == null) {
      const diff = Math.round((totalAmount.value! - subtotal.value!) * 100) / 100;
      if (diff > 0) gstAmount = F(diff, 0.6);
    }
  }
  if (subtotal.value != null && gstAmount.value != null && totalAmount.value != null) {
    const expected = subtotal.value + gstAmount.value;
    if (Math.abs(expected - totalAmount.value) <= Math.max(1, totalAmount.value * 0.01)) {
      // Numbers reconcile — boost confidence across the trio.
      totalAmount = F(totalAmount.value, Math.max(totalAmount.confidence, 0.92));
      subtotal = F(subtotal.value, Math.max(subtotal.confidence, 0.9));
      gstAmount = F(gstAmount.value, Math.max(gstAmount.confidence, 0.9));
    }
  }

  const fields: ExtractedFields = {
    vendorName,
    gstNumber,
    invoiceNumber,
    invoiceDate,
    city,
    state,
    subtotal,
    gstAmount,
    totalAmount,
    gstType,
  };

  return { fields, lineItems: parseLineItems(lines) };
}
