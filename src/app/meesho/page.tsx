"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { useData } from "@/context/DataContext";
import { MeeshoOrder } from "@/lib/types";
import {
  Upload,
  FileText,
  X,
  Package,
  ChevronDown,
  Trash2,
  ClipboardList,
  CalendarDays,
  IndianRupee,
  AlertCircle,
  Loader2,
  Save,
  RotateCcw,
  TrendingDown,
  Sparkles,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayDate = () => new Date().toISOString().split("T")[0];
const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const parseMoney = (s: string) => parseFloat(s.replace(/[^\d.]/g, "")) || 0;

const STATUS_CONFIG = {
  Packed:  { label: "Packed",  bg: "rgba(59,130,246,0.1)",  color: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  Shipped: { label: "Shipped", bg: "rgba(16,185,129,0.1)",  color: "#10b981", border: "rgba(16,185,129,0.25)" },
  RTO:     { label: "RTO",     bg: "rgba(239,68,68,0.1)",   color: "#ef4444", border: "rgba(239,68,68,0.25)" },
} as const;

// ─── PDF Helpers ───────────────────────────────────────────────────────────────
interface PosItem { str: string; x: number; y: number; }

function extractPosItems(raw: Array<{str:string;transform:number[]}>): PosItem[] {
  return raw
    .filter(it => it.str?.trim())
    .map(it => ({ str: it.str.trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) }));
}

/** Group items by y (within 3pt tolerance), sort top→bottom and left→right within each row */
function posToText(items: PosItem[]): string {
  const rows = new Map<number, {x:number;str:string}[]>();
  for (const it of items) {
    let key = it.y;
    for (const k of rows.keys()) if (Math.abs(k - it.y) <= 3) { key = k; break; }
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push({ x: it.x, str: it.str });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map(p => p.str).join(" "))
    .join("\n");
}

/** Strip known right-column labels that bleed into customer name due to column merging */
function cleanLine(line: string): string {
  return line
    .replace(/\b(xpress\s*bees|delhivery|shadowfax|ecom\s*express|bluedart|dtdc|valmo|dotzot|ekart|pickup|destination\s*code|return\s*code|air\s*waybill)\b.*/gi, "")
    .replace(/\b(prepaid|do\s*not\s*collect|cash\s*on\s*delivery|COD)\b.*/gi, "")
    .replace(/[^\w\s.''-]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Page classifier ───────────────────────────────────────────────────────────
function classifyPage(text: string): "shipping" | "invoice" | "unknown" {
  const t = text.toLowerCase();
  if (t.includes("tax invoice") || (t.includes("gstin") && t.includes("purchase order"))) return "invoice";
  if (t.includes("customer address") || t.includes("product details") || t.includes("prepaid") || t.includes("do not collect")) return "shipping";
  return "unknown";
}

// ─── OCR a canvas image (shipping label) ──────────────────────────────────────
async function ocrCanvas(canvas: HTMLCanvasElement, onProgress?: (s: string) => void): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const { data } = await Tesseract.recognize(canvas, "eng", {
    logger: (m: {status:string;progress:number}) => {
      if (m.status === "recognizing text") onProgress?.(`OCR ${Math.round(m.progress * 100)}%…`);
    },
  });
  return data.text || "";
}

// ─── Render a PDF page to canvas for OCR ──────────────────────────────────────
async function renderPageToCanvas(page: import("pdfjs-dist/types/src/display/api").PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (page.render as unknown as (params: {canvasContext:CanvasRenderingContext2D;viewport:unknown}) => {promise:Promise<void>})({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// ─── Invoice Parser ────────────────────────────────────────────────────────────
interface InvoiceData {
  orderNo: string; invoiceNo: string;
  customerName: string; customerAddress: string; customerCity: string; customerPincode: string;
  productName: string; size: string;
  grossAmount: number; discount: number; tax: number; total: number;
}

function parseInvoice(rawText: string): InvoiceData {
  const data: InvoiceData = {
    orderNo: "", invoiceNo: "",
    customerName: "", customerAddress: "", customerCity: "", customerPincode: "",
    productName: "", size: "",
    grossAmount: 0, discount: 0, tax: 0, total: 0,
  };

  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // ── Purchase Order No (13+ digits) ──
  const poLine = lines.findIndex(l => /purchase\s*order\s*no/i.test(l));
  if (poLine >= 0) {
    for (let i = poLine; i <= Math.min(poLine + 2, lines.length - 1); i++) {
      const m = lines[i].match(/\b(\d{13,})\b/);
      if (m) { data.orderNo = m[1]; break; }
    }
  }
  if (!data.orderNo) { const m = rawText.match(/\b(\d{15,20})\b/); if (m) data.orderNo = m[1]; }

  // ── Invoice No (alphanumeric code: letters + digits, 5-15 chars) ──
  const invLine = lines.findIndex(l => /invoice\s*no/i.test(l));
  if (invLine >= 0) {
    for (let i = invLine; i <= Math.min(invLine + 2, lines.length - 1); i++) {
      const codes = [...lines[i].matchAll(/\b([a-zA-Z][a-zA-Z0-9]{4,14})\b/g)].map(m => m[1]);
      for (const code of codes) {
        if (/[a-zA-Z]/.test(code) && /[0-9]/.test(code) &&
            !/^(invoice|order|date|total|bill|ship|tax|hsn|qty|amount|discount|value|taxes|sold|gstin|igst|original|recipient|prepaid|purchase)/i.test(code)) {
          data.invoiceNo = code; break;
        }
      }
      if (data.invoiceNo) break;
    }
  }

  // ── Customer name + address from "BILL TO / SHIP TO" section ──
  const billToLine = lines.findIndex(l => /bill\s*to.*ship\s*to/i.test(l));
  if (billToLine >= 0 && billToLine + 1 < lines.length) {
    const nameLine = lines[billToLine + 1];
    // Format: "Kundan Kumar - kamal kant house, city, state, 814142, ..."
    const nameMatch = nameLine.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,4})\s*[-–]/);
    if (nameMatch) {
      data.customerName = nameMatch[1].trim();
      // Everything after the dash = address
      const addrFull = nameLine.slice(nameLine.indexOf("-") + 1).trim();
      // Remove seller info that might bleed in (stop at all-caps company name or "Shop No")
      const addrClean = addrFull
        .replace(/\s+[A-Z]{2,}[A-Z\s]+(?:KIDSWEAR|WEAR|STORE|SHOP|LTD|PVT).*$/g, "")
        .replace(/\s*Place of Supply.*$/i, "")
        .trim();
      const pincodeMatch = addrClean.match(/\b(\d{6})\b/);
      if (pincodeMatch) {
        data.customerPincode = pincodeMatch[1];
        const parts = addrClean.split(",").map(p => p.trim()).filter(Boolean);
        data.customerCity = parts[parts.length - 2]?.trim() || "";
        data.customerAddress = parts.slice(0, -2).join(", ");
      } else {
        data.customerAddress = addrClean;
      }
    }
  }

  // ── Product name + amounts from invoice table ──
  const tableHeaderLine = lines.findIndex(l => /description.*hsn|description.*qty.*gross/i.test(l));
  if (tableHeaderLine >= 0) {
    const descParts: string[] = [];

    for (let i = tableHeaderLine + 1; i < Math.min(tableHeaderLine + 15, lines.length); i++) {
      const line = lines[i];
      if (/^\s*(?:other\s+charges|total)\b/i.test(line)) break;

      // Find a line that has 2+ Rs. values → this is the product data row
      const rsMatches = [...line.matchAll(/Rs\.?\s*([\d,]+(?:\.\d+)?)/g)];
      if (rsMatches.length >= 2) {
        const rsAmts = rsMatches.map(m => parseMoney(m[1]));
        data.grossAmount = rsAmts[0];
        data.discount    = rsAmts[1];
        if (rsAmts.length >= 4) data.total = rsAmts[rsAmts.length - 1];
        // Grab description prefix from this line (before HSN code or Rs.)
        const beforeData = line.replace(/\b6\d{5}\b.*$/, "").replace(/Rs\..*$/, "").trim();
        if (beforeData) descParts.push(beforeData);
        break;
      }
      // Line with HSN only (no amounts yet)
      const hsnOnly = line.match(/^6\d{5}\b/) || line.match(/\b6\d{5}\b/);
      if (hsnOnly) continue;

      // Description continuation
      if (!/Rs\.|IGST|Taxes?|Taxable/i.test(line)) descParts.push(line);
    }

    data.productName = descParts.join(" ").replace(/\s+/g, " ").trim();
  }

  // ── Size from product name ──
  const sizeInProd = data.productName.match(/\b(\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?|months?|mos?)\b|free\s*size|XS\b|S\b|M\b|L\b|XL\b|XXL\b)/i);
  if (sizeInProd) data.size = sizeInProd[1].trim();

  // ── Total from "Total" line at bottom ──
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*total\b/i.test(lines[i])) {
      const rsAmts = [...lines[i].matchAll(/Rs\.?\s*([\d,]+(?:\.\d+)?)/g)].map(m => parseMoney(m[1]));
      if (rsAmts.length > 0) {
        data.total = rsAmts[rsAmts.length - 1];
        if (rsAmts.length >= 2 && !data.tax) data.tax = rsAmts[0];
        break;
      }
    }
  }

  // ── Tax ──
  if (!data.tax) {
    const igst = rawText.match(/IGST\s*@?[\d.]+%?\s*Rs\.?\s*([\d,]+(?:\.\d+)?)/i);
    if (igst) data.tax = parseMoney(igst[1]);
  }

  return data;
}

// ─── Shipping Label Parser (full-text mode, no column split required) ─────────
interface ShippingData {
  orderNo: string; customerName: string; customerAddress: string;
  customerCity: string; customerPincode: string;
  sku: string; size: string; color: string; qty: number;
  paymentType: "Prepaid" | "COD"; courier: string; codAmount: number;
}

const COURIER_LIST = [
  { pat: /xpress\s*bees/i,  name: "Xpress Bees" },
  { pat: /delhivery/i,       name: "Delhivery" },
  { pat: /shadowfax/i,       name: "Shadowfax" },
  { pat: /ecom\s*express/i,  name: "Ecom Express" },
  { pat: /bluedart/i,        name: "BlueDart" },
  { pat: /dtdc/i,            name: "DTDC" },
  { pat: /valmo/i,           name: "Valmo" },
  { pat: /shiprocket/i,      name: "Shiprocket" },
  { pat: /dotzot/i,          name: "Dotzot" },
  { pat: /ekart/i,           name: "Ekart" },
];

function parseShippingLabel(fullText: string): ShippingData {
  const data: ShippingData = {
    orderNo: "", customerName: "", customerAddress: "",
    customerCity: "", customerPincode: "", sku: "",
    size: "", color: "", qty: 1, paymentType: "Prepaid", courier: "", codAmount: 0,
  };

  // ── Payment type ──
  if (/prepaid/i.test(fullText)) {
    data.paymentType = "Prepaid";
  } else if (/cash\s+on\s+delivery|(?<![a-z])COD(?![a-z])/i.test(fullText)) {
    data.paymentType = "COD";
    const codAmt = fullText.match(/(?:Cash\s+on\s+Delivery|COD)[^₹\d]{0,30}(?:Rs\.?\s*)?([\d]+(?:\.\d+)?)/i);
    if (codAmt) data.codAmount = parseFloat(codAmt[1]) || 0;
  }

  // ── Courier ──
  for (const c of COURIER_LIST) {
    if (c.pat.test(fullText)) { data.courier = c.name; break; }
  }

  // ── Customer name (line after "Customer Address" header, stripped of right-column noise) ──
  const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
  const custAddrIdx = lines.findIndex(l => /customer\s*address/i.test(l));

  if (custAddrIdx >= 0) {
    const addrBody: string[] = [];
    for (let i = custAddrIdx + 1; i < Math.min(custAddrIdx + 10, lines.length); i++) {
      const raw = lines[i];
      if (/if\s+undelivered|return\s+to/i.test(raw)) break;
      const cleaned = cleanLine(raw);
      if (!data.customerName && cleaned.length >= 3) {
        data.customerName = cleaned;
      } else if (data.customerName && cleaned.length >= 3) {
        addrBody.push(cleaned);
      }
    }

    // Pincode from address lines
    for (const al of [...addrBody].reverse()) {
      const pm = al.match(/\b(\d{6})\b/);
      if (pm) {
        data.customerPincode = pm[1];
        const parts = al.split(",").map(p => p.trim()).filter(Boolean);
        data.customerCity = parts[parts.length - 1] || "";
        break;
      }
    }
    data.customerAddress = addrBody.slice(0, -1).join(", ");
  }

  // Pincode fallback
  if (!data.customerPincode) {
    const pm = fullText.match(/\b(\d{6})\b/);
    if (pm) data.customerPincode = pm[1];
  }

  // ── SKU (search in Product Details section first, then full text) ──
  const prodIdx = fullText.search(/product\s*details/i);
  const searchZone = prodIdx >= 0 ? fullText.slice(prodIdx) : fullText;

  // SKU pattern: 2+ ALL-CAPS words joined by hyphens, min 5 chars
  const skuMatches = [...searchZone.matchAll(/\b([A-Z]{2,}(?:-[A-Z0-9]+){1,})\b/g)].map(m => m[1]);
  const EXCLUDED_SKUS = /^(BILL|SHIP|PICK|RETURN|DEST|CODE|ECOM|BLUE|DART|DTDC|VALMO|XPRESS|BEES|ORDER|SIZE|COLOR|QTY|NA)-/i;
  const sku = skuMatches.find(s => s.length >= 5 && !EXCLUDED_SKUS.test(s));
  if (sku) data.sku = sku;

  // ── Size ──
  const sizeMatch = fullText.match(/\b(\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?|months?|mos?)\b|Free\s*Size)\b/i)
    || fullText.match(/\b(XS|S|M|L|XL|XXL|XXXL)\b/);
  if (sizeMatch) data.size = sizeMatch[1].trim();

  // ── Qty and Color from product table row ──
  // Look for the row that has the SKU code on it
  if (data.sku) {
    const skuLine = lines.find(l => l.includes(data.sku));
    if (skuLine) {
      const afterSku = skuLine.slice(skuLine.indexOf(data.sku) + data.sku.length).trim();
      const qtyMatch = afterSku.match(/\b(\d{1,2})\b(?!\s*[-\d])/);
      if (qtyMatch) data.qty = Math.min(parseInt(qtyMatch[1], 10) || 1, 99);
      const colorMatch = afterSku.match(/\b(NA|[A-Z][a-z]+)\b(?=\s+\d{10,}|\s*$)/);
      if (colorMatch) data.color = colorMatch[1];
      const orderMatch = [...skuLine.matchAll(/\b(\d{10,}(?:_\d+)?)\b/g)];
      if (orderMatch.length) data.orderNo = orderMatch[orderMatch.length - 1][1];
    }
  }

  // ── Order No fallback ──
  if (!data.orderNo) {
    const allNums = [...fullText.matchAll(/\b(\d{13,20}(?:_\d+)?)\b/g)];
    if (allNums.length) data.orderNo = allNums[allNums.length - 1][1];
  }

  return data;
}

// ─── Main extractor ────────────────────────────────────────────────────────────
export interface ExtractedOrder {
  orderNo: string; invoiceNo: string;
  customerName: string; customerAddress: string; customerCity: string; customerPincode: string;
  sku: string; productName: string; size: string; color: string; qty: number;
  grossAmount: number; discount: number; tax: number; sellingPrice: number;
  paymentType: "Prepaid" | "COD"; courier: string; pageNos: number[];
}

async function extractFromPdf(
  file: File,
  useAi: boolean,
  onProgress: (msg: string, pct: number) => void
): Promise<{
  orders: ExtractedOrder[];
  aiFailed: boolean;
  errorMsg?: string;
}> {
  onProgress("Loading PDF…", 5);
  const pdfjs: typeof import("pdfjs-dist") = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const total = pdf.numPages;

  let aiFailed = false;
  let errorMsg = "";

  const pageTexts: {
    pageNo: number;
    text: string;
    image?: string;
    isImage: boolean;
    type: "shipping" | "invoice" | "unknown";
  }[] = [];

  for (let i = 1; i <= total; i++) {
    onProgress(`Reading page ${i}/${total}…`, 5 + Math.round((i / total) * 35));
    const page = await pdf.getPage(i);

    // ── Try text extraction first ──
    const content = await page.getTextContent();
    const rawItems = content.items as Array<{ str: string; transform: number[] }>;
    let text = posToText(extractPosItems(rawItems));

    // ── If page has too little text → it's an image, render to base64 ──
    const hasEnoughText = text.replace(/\s/g, "").length > 80;
    if (!hasEnoughText) {
      try {
        onProgress(`Page ${i}: rendering image…`, 5 + Math.round((i / total) * 35));
        const canvas = await renderPageToCanvas(page);
        const base64 = canvas.toDataURL("image/jpeg", 0.85);
        pageTexts.push({
          pageNo: i,
          text: "",
          image: base64,
          isImage: true,
          type: "shipping" // assume shipping for image pages like barcode labels
        });
      } catch (err) {
        console.error("Rendering page to canvas failed:", err);
        pageTexts.push({ pageNo: i, text: "", isImage: false, type: "unknown" });
      }
    } else {
      pageTexts.push({
        pageNo: i,
        text,
        isImage: false,
        type: classifyPage(text)
      });
    }
  }

  // Helper local fallback matching logic (in case AI fails or is disabled)
  const localParseBatch = async (batch: typeof pageTexts) => {
    const shippingPages: (ShippingData & { pageNo: number })[] = [];
    const invoicePages:  (InvoiceData  & { pageNo: number })[] = [];

    for (const item of batch) {
      let textToParse = item.text;
      let computedType = item.type;

      if (item.isImage) {
        try {
          const page = await pdf.getPage(item.pageNo);
          const canvas = await renderPageToCanvas(page);
          textToParse = await ocrCanvas(canvas);
          computedType = classifyPage(textToParse);
        } catch {
          textToParse = "";
        }
      }

      if (computedType === "invoice") {
        invoicePages.push({ ...parseInvoice(textToParse), pageNo: item.pageNo });
      } else if (computedType === "shipping") {
        shippingPages.push({ ...parseShippingLabel(textToParse), pageNo: item.pageNo });
      }
    }

    const norm = (s: string) => s.replace(/_\d+$/, "").trim();
    const batchOrders: ExtractedOrder[] = [];
    const usedInvoices = new Set<number>();

    for (const ship of shippingPages) {
      const shipNo = norm(ship.orderNo);
      const inv = invoicePages.find(iv =>
        !usedInvoices.has(iv.pageNo) &&
        (shipNo && norm(iv.orderNo) === shipNo || !shipNo)
      ) ?? invoicePages.find(iv => !usedInvoices.has(iv.pageNo));

      if (inv) usedInvoices.add(inv.pageNo);

      batchOrders.push({
        orderNo:         ship.orderNo || inv?.orderNo || "",
        invoiceNo:       inv?.invoiceNo || "",
        customerName:    ship.customerName || inv?.customerName || "",
        customerAddress: ship.customerAddress || inv?.customerAddress || "",
        customerCity:    ship.customerCity   || inv?.customerCity   || "",
        customerPincode: ship.customerPincode|| inv?.customerPincode|| "",
        sku:             ship.sku,
        productName:     inv?.productName || "",
        size:            ship.size || inv?.size || "",
        color:           ship.color,
        qty:             ship.qty,
        grossAmount:     inv?.grossAmount || 0,
        discount:        inv?.discount    || 0,
        tax:             inv?.tax         || 0,
        sellingPrice:    inv?.total       || (ship.paymentType === "COD" ? ship.codAmount : 0),
        paymentType:     ship.paymentType,
        courier:         ship.courier,
        pageNos: [ship.pageNo, ...(inv ? [inv.pageNo] : [])],
      });
    }

    // Unmatched invoices
    for (const inv of invoicePages) {
      if (!usedInvoices.has(inv.pageNo)) {
        batchOrders.push({
          orderNo: inv.orderNo, invoiceNo: inv.invoiceNo,
          customerName: inv.customerName, customerAddress: inv.customerAddress,
          customerCity: inv.customerCity, customerPincode: inv.customerPincode,
          sku: "", productName: inv.productName, size: inv.size,
          color: "", qty: 1,
          grossAmount: inv.grossAmount, discount: inv.discount, tax: inv.tax,
          sellingPrice: inv.total, paymentType: "Prepaid", courier: "",
          pageNos: [inv.pageNo],
        });
      }
    }

    return batchOrders;
  };

  if (!useAi) {
    onProgress("Scanning locally...", 60);
    return { orders: await localParseBatch(pageTexts), aiFailed: false };
  }

  // Batch pages for the Claude API (10 pages per batch to fit context & rate limits securely)
  const batchSize = 10;
  const batches: (typeof pageTexts)[] = [];
  for (let i = 0; i < pageTexts.length; i += batchSize) {
    batches.push(pageTexts.slice(i, i + batchSize));
  }

  const processBatch = async (batch: typeof pageTexts, batchIndex: number) => {
    try {
      const pageStart = batch[0].pageNo;
      const pageEnd = batch[batch.length - 1].pageNo;
      onProgress(`Scanning pages ${pageStart} to ${pageEnd} using Claude AI…`, 40 + Math.round((batchIndex / batches.length) * 50));

      const res = await fetch("/api/parse-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: batch.map(p => ({
            pageNo: p.pageNo,
            text: p.text || undefined,
            image: p.image || undefined
          }))
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const orders = await res.json();
      if (orders.error) throw new Error(orders.error);
      return orders as ExtractedOrder[];
    } catch (e: any) {
      console.error(`AI scanning failed for batch starting at page ${batch[0].pageNo}, falling back to local:`, e);
      aiFailed = true;
      errorMsg = e.message || String(e);
      return await localParseBatch(batch);
    }
  };

  const parsedOrders: ExtractedOrder[] = [];
  for (let b = 0; b < batches.length; b++) {
    const orders = await processBatch(batches[b], b);
    parsedOrders.push(...orders);
  }

  // Sanitize extracted results to prevent typed schema mismatches
  const sanitizedOrders = parsedOrders.map(o => ({
    orderNo:         String(o?.orderNo || "").trim(),
    invoiceNo:       String(o?.invoiceNo || "").trim(),
    customerName:    String(o?.customerName || "").trim(),
    customerAddress: String(o?.customerAddress || "").trim(),
    customerCity:    String(o?.customerCity || "").trim(),
    customerPincode: String(o?.customerPincode || "").trim(),
    sku:             String(o?.sku || "").trim(),
    productName:     String(o?.productName || "").trim(),
    size:            String(o?.size || "").trim(),
    color:           String(o?.color || "").trim(),
    qty:             Number(o?.qty) || 1,
    grossAmount:     Number(o?.grossAmount) || 0,
    discount:        Number(o?.discount) || 0,
    tax:             Number(o?.tax) || 0,
    sellingPrice:    Number(o?.sellingPrice) || 0,
    paymentType:     o?.paymentType === "COD" ? ("COD" as const) : ("Prepaid" as const),
    courier:         String(o?.courier || "").trim(),
    pageNos:         Array.isArray(o?.pageNos) ? o.pageNos.map(Number) : [],
  }));

  onProgress("Done!", 100);
  return { orders: sanitizedOrders, aiFailed, errorMsg };
}

// ─── Review Table ──────────────────────────────────────────────────────────────
function ReviewTable({ orders, onUpdate, onRemove, onSave, onReset }: {
  orders: ExtractedOrder[];
  onUpdate: (idx: number, field: keyof ExtractedOrder, value: string | number) => void;
  onRemove: (idx: number) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const cell = "w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-slate-500 focus:outline-none text-xs text-slate-800 dark:text-slate-100 py-1.5 px-2 rounded-lg font-medium placeholder-slate-400 dark:placeholder-slate-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const selectCell = "bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 text-[10px] font-bold cursor-pointer focus:outline-none py-1.5 px-2 rounded-lg text-slate-800 dark:text-slate-100 transition-colors";
  const totalRevenue  = orders.reduce((s, o) => s + o.sellingPrice, 0);
  const totalDiscount = orders.reduce((s, o) => s + o.discount, 0);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{orders.length} orders extracted</span>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-300">Revenue: <strong>₹{totalRevenue.toLocaleString("en-IN")}</strong></span>
        <span className="text-xs text-slate-600 dark:text-slate-300">Discount: <strong>₹{totalDiscount.toLocaleString("en-IN")}</strong></span>
        <div className="ml-auto flex gap-2">
          <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-black hover:bg-[#1a1a1a] transition-colors">
            <Save size={12} /> Save All Orders
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                {["#","Customer","Order No.","SKU","Product Name","Size","Qty","Gross ₹","Disc ₹","Total ₹","Payment","Courier",""].map(h => (
                  <th key={h} className="px-3 py-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((o, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                  <td className="px-3 py-2.5 text-[#bbb] font-bold text-[10px]">{idx + 1}</td>

                  <td className="px-3 py-2.5 min-w-[150px]">
                    <input className={cell} value={o.customerName} onChange={e => onUpdate(idx, "customerName", e.target.value)} placeholder="Customer name" />
                    {(o.customerCity || o.customerPincode) && (
                      <div className="text-[10px] text-[#bbb] mt-0.5 px-1">{[o.customerCity, o.customerPincode].filter(Boolean).join(" ")}</div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 min-w-[130px]">
                    <div className="font-mono text-[10px] text-[#666] truncate max-w-[130px] px-1" title={o.orderNo}>{o.orderNo || "—"}</div>
                    {o.invoiceNo && <div className="text-[10px] text-[#bbb] px-1">Inv: {o.invoiceNo}</div>}
                  </td>

                  <td className="px-3 py-2.5 min-w-[110px]">
                    <input className={`${cell} font-mono`} value={o.sku} onChange={e => onUpdate(idx, "sku", e.target.value)} placeholder="SKU" />
                  </td>

                  <td className="px-3 py-2.5 min-w-[200px]">
                    <input className={cell} value={o.productName} onChange={e => onUpdate(idx, "productName", e.target.value)} placeholder="Product name" />
                  </td>

                  <td className="px-3 py-2.5 min-w-[100px]">
                    <input className={cell} value={o.size} onChange={e => onUpdate(idx, "size", e.target.value)} placeholder="e.g. 3-4 Yrs" />
                  </td>

                  <td className="px-3 py-2.5 w-16 text-center">
                    <input type="number" min={1} className={`${cell} text-center`} value={o.qty} onChange={e => onUpdate(idx, "qty", Number(e.target.value))} />
                  </td>

                  <td className="px-3 py-2.5 w-24 text-right">
                    <input type="number" min={0} className={`${cell} text-right`} value={o.grossAmount || ""} onChange={e => onUpdate(idx, "grossAmount", Number(e.target.value))} placeholder="0" />
                  </td>

                  <td className="px-3 py-2.5 w-24 text-right">
                    <input type="number" min={0} className={`${cell} text-right text-red-500`} value={o.discount || ""} onChange={e => onUpdate(idx, "discount", Number(e.target.value))} placeholder="0" />
                  </td>

                  <td className="px-3 py-2.5 w-24 text-right">
                    <input type="number" min={0} className={`${cell} text-right font-bold`} value={o.sellingPrice || ""} onChange={e => onUpdate(idx, "sellingPrice", Number(e.target.value))} placeholder="0" />
                  </td>

                  <td className="px-3 py-2.5 min-w-[110px]">
                    <select className={selectCell}
                      value={o.paymentType} onChange={e => onUpdate(idx, "paymentType", e.target.value as any)}>
                      <option value="Prepaid">Prepaid</option>
                      <option value="COD">COD</option>
                    </select>
                  </td>

                  <td className="px-3 py-2.5 min-w-[110px]">
                    <input className={cell} value={o.courier} onChange={e => onUpdate(idx, "courier", e.target.value)} placeholder="Courier" />
                  </td>

                  <td className="px-3 py-2.5">
                    <button onClick={() => onRemove(idx)} className="w-6 h-6 flex items-center justify-center rounded-lg text-[#ddd] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100">
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
          <Save size={15} /> Save {orders.length} Orders to Today
        </button>
      </div>
    </div>
  );
}

// ─── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onDelete }: { order: MeeshoOrder; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition-shadow">
      <button onClick={() => setExpanded(v => !v)} className="w-full text-left px-4 py-3.5 flex items-start gap-3">
        <div className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-black text-sm leading-tight">{order.customerName || "—"}</div>
              <div className="text-[11px] text-[#888] font-mono mt-0.5 truncate">#{order.orderNo || "—"}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${order.paymentType === "Prepaid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                {order.paymentType}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>{cfg.label}</span>
              <ChevronDown size={14} className={`text-[#aaa] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {order.sku && <span className="text-[11px] bg-[#f5f5f5] text-[#666] px-2 py-0.5 rounded-md font-medium font-mono">{order.sku}</span>}
            {order.size && <span className="text-[11px] text-[#888]">{order.size}</span>}
            {order.qty > 0 && <span className="text-[11px] text-[#888]">Qty: {order.qty}</span>}
            {order.discount > 0 && <span className="text-[11px] text-red-400 line-through">₹{order.grossAmount.toLocaleString("en-IN")}</span>}
            {order.sellingPrice > 0 && <span className="text-[11px] font-bold text-black">₹{order.sellingPrice.toLocaleString("en-IN")}</span>}
            {order.discount > 0 && <span className="text-[11px] text-green-600 font-semibold">−₹{order.discount.toLocaleString("en-IN")}</span>}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#f5f5f5] space-y-3">
          {order.productName && (
            <div className="bg-[#fafafa] rounded-xl p-3">
              <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Product</div>
              <div className="font-semibold text-sm text-black">{order.productName}</div>
            </div>
          )}
          {(order.customerAddress || order.customerCity) && (
            <div className="bg-[#fafafa] rounded-xl p-3">
              <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-1">Ship To</div>
              <div className="text-sm text-[#333] leading-relaxed">
                {[order.customerAddress, order.customerCity, order.customerPincode].filter(Boolean).join(", ")}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "MRP",  value: `₹${order.grossAmount.toLocaleString("en-IN")}`,  cls: "text-black" },
              { label: "Disc", value: `−₹${order.discount.toLocaleString("en-IN")}`,    cls: "text-red-500" },
              { label: "Paid", value: `₹${order.sellingPrice.toLocaleString("en-IN")}`, cls: "text-green-600" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-[#fafafa] rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">{label}</div>
                <div className={`font-bold text-sm ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
          {(order.courier || order.invoiceNo) && (
            <div className="grid grid-cols-2 gap-2">
              {order.courier   && <div className="bg-[#fafafa] rounded-xl p-2.5"><div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Courier</div><div className="font-semibold text-black text-xs">{order.courier}</div></div>}
              {order.invoiceNo && <div className="bg-[#fafafa] rounded-xl p-2.5"><div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Invoice No.</div><div className="font-semibold text-black text-xs font-mono">{order.invoiceNo}</div></div>}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#aaa]">Added {fmtTime(order.scannedAt)}</span>
            <button onClick={onDelete} className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-600 transition-colors">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
type AppState = "idle" | "processing" | "reviewing";

export default function MeeshoOrders() {
  const { meeshoOrders, setMeeshoOrders } = useData();
  const [appState, setAppState]           = useState<AppState>("idle");
  const [useAi, setUseAi]                 = useState(true);
  const [aiFailed, setAiFailed]           = useState(false);
  const [aiErrorMsg, setAiErrorMsg]       = useState("");
  const [progressMsg, setProgressMsg]     = useState("");
  const [progressPct, setProgressPct]     = useState(0);
  const [extracted, setExtracted]         = useState<ExtractedOrder[]>([]);
  const [activeTab, setActiveTab]         = useState<"today" | "all">("today");
  const [dateFilter, setDateFilter]       = useState(todayDate());
  const [error, setError]                 = useState<string | null>(null);
  const [isDragging, setIsDragging]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr    = todayDate();
  const todayOrders = useMemo(() => meeshoOrders.filter(o => o.date === todayStr), [meeshoOrders, todayStr]);
  const filteredOrders = useMemo(() => {
    if (activeTab === "today") return todayOrders;
    if (dateFilter) return meeshoOrders.filter(o => o.date === dateFilter);
    return meeshoOrders;
  }, [meeshoOrders, todayOrders, activeTab, dateFilter]);

  const stats = useMemo(() => ({
    count:    todayOrders.length,
    qty:      todayOrders.reduce((s, o) => s + o.qty, 0),
    revenue:  todayOrders.filter(o => o.status !== "RTO").reduce((s, o) => s + o.sellingPrice, 0),
    discount: todayOrders.reduce((s, o) => s + o.discount, 0),
  }), [todayOrders]);

  const groupedByDate = useMemo(() => {
    if (activeTab === "today") return null;
    const groups: Record<string, MeeshoOrder[]> = {};
    filteredOrders.forEach(o => { if (!groups[o.date]) groups[o.date] = []; groups[o.date].push(o); });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredOrders, activeTab]);

  const handleFile = useCallback(async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setError(null);
    setAiFailed(false);
    setAiErrorMsg("");
    setAppState("processing");
    setProgressPct(0);
    setProgressMsg("Starting…");
    try {
      const result = await extractFromPdf(file, useAi, (msg, pct) => { setProgressMsg(msg); setProgressPct(pct); });
      if (result.orders.length === 0) { setError("No orders found. Make sure this is a Meesho shipping PDF."); setAppState("idle"); return; }
      setExtracted(result.orders);
      setAiFailed(result.aiFailed);
      setAiErrorMsg(result.errorMsg || "");
      setAppState("reviewing");
    } catch (e) {
      console.error(e);
      setError("Failed to process PDF. Please try again.");
      setAppState("idle");
    }
  }, [useAi]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const saveAll = () => {
    const now = new Date().toISOString();
    const newOrders: MeeshoOrder[] = extracted.map((o, i) => ({
      id: `${Date.now()}-${i}`, date: todayDate(), scannedAt: now,
      orderNo: o.orderNo, invoiceNo: o.invoiceNo,
      customerName: o.customerName, customerAddress: o.customerAddress,
      customerCity: o.customerCity, customerPincode: o.customerPincode,
      sku: o.sku, productName: o.productName, size: o.size, color: o.color, qty: o.qty,
      grossAmount: o.grossAmount, discount: o.discount, tax: o.tax, sellingPrice: o.sellingPrice,
      paymentType: o.paymentType, courier: o.courier, status: "Packed", notes: "",
    }));
    setMeeshoOrders(prev => [...newOrders, ...prev]);
    setExtracted([]); setAppState("idle"); setActiveTab("today");
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Meesho Orders</h2>
          <p className="text-sm text-[#888] mt-1">Daily packing tracker</p>
        </div>
        {appState !== "reviewing" && (
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
            <Upload size={15} /> Upload PDF
          </button>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>

      {/* AI Toggle Bar */}
      {appState !== "reviewing" && (
        <div className="flex items-center justify-between bg-gradient-to-r from-violet-50/50 to-indigo-50/50 border border-violet-100 rounded-2xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-violet-600/10 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-violet-600" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5 flex-wrap">
                Claude AI Order Parser
                <span className="bg-violet-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider scale-90">High Accuracy</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Scans names, items, prices, discounts, and addresses with near 100% accuracy using Claude 3.5 Sonnet.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUseAi(!useAi)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useAi ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useAi ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: ClipboardList, color: "text-blue-500",   bg: "bg-[#eff6ff]", label: "Today",    value: stats.count,   sub: "Orders" },
          { icon: Package,       color: "text-green-500",  bg: "bg-[#f0fdf4]", label: "Items",    value: stats.qty,     sub: "Qty packed" },
          { icon: IndianRupee,   color: "text-purple-500", bg: "bg-[#fdf4ff]", label: "Revenue",  value: `₹${stats.revenue.toLocaleString("en-IN")}`, sub: "Earned today" },
          { icon: TrendingDown,  color: "text-red-400",    bg: "bg-[#fff1f2]", label: "Discount", value: `₹${stats.discount.toLocaleString("en-IN")}`, sub: "Given today" },
        ].map(({ icon: Icon, color, bg, label, value, sub }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-xl font-black text-black leading-tight">{value}</div>
            <div className="text-[11px] text-[#aaa] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-700 font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Processing */}
      {appState === "processing" && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 flex flex-col items-center gap-4 shadow-sm">
          <div className="w-14 h-14 bg-[#f5f5f5] rounded-2xl flex items-center justify-center">
            <Loader2 size={28} className="text-black animate-spin" />
          </div>
          <div className="text-center">
            <div className="font-bold text-black">{progressMsg}</div>
            <div className="text-sm text-[#888] mt-1">Reading all orders from PDF…</div>
          </div>
          <div className="w-full max-w-xs">
            <div className="w-full h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
              <div className="h-full bg-black rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="text-center text-xs text-[#aaa] mt-1">{progressPct}%</div>
          </div>
        </div>
      )}

      {/* Review */}
      {appState === "reviewing" && extracted.length > 0 && (
        <div className="space-y-4">
          {aiFailed && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 text-amber-800 dark:text-amber-300 animate-fade-in-up">
              <AlertCircle className="shrink-0 mt-0.5" size={16} />
              <div>
                <div className="font-bold text-xs">AI Scan Bypassed (Local Regex Fallback Used)</div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                  The Claude AI parser failed or returned an error: <strong>&ldquo;{aiErrorMsg}&rdquo;</strong>.
                  The system automatically fell back to the local regex parser, which might not extract all fields (SKU, Customer Name, Size, Courier) perfectly. Please configure a standard Anthropic API key starting with <code>sk-ant-</code>.
                </p>
              </div>
            </div>
          )}
          <ReviewTable
            orders={extracted}
            onUpdate={(idx, field, val) => setExtracted(p => p.map((o, i) => i === idx ? { ...o, [field]: val } : o))}
            onRemove={idx => setExtracted(p => p.filter((_, i) => i !== idx))}
            onSave={saveAll}
            onReset={() => { setAppState("idle"); setExtracted([]); setAiFailed(false); setAiErrorMsg(""); }}
          />
        </div>
      )}

      {/* Drop Zone */}
      {appState === "idle" && meeshoOrders.length === 0 && (
        <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center text-center gap-4 cursor-pointer transition-all ${isDragging ? "border-black bg-[#f5f5f5] scale-[1.01]" : "border-[#ddd] hover:border-[#aaa] hover:bg-[#fafafa]"}`}>
          <div className="w-16 h-16 bg-[#f5f5f5] rounded-2xl flex items-center justify-center">
            <FileText size={32} className="text-[#888]" />
          </div>
          <div>
            <div className="font-bold text-black text-lg">Upload Today&apos;s Meesho PDF</div>
            <div className="text-sm text-[#666] mt-2 leading-relaxed max-w-sm">
              Drop your Meesho orders PDF — all orders extracted automatically.<br />
              Customer, SKU, product, size, price, discount, Prepaid/COD.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {["Customer Name","SKU","Product","Size","Gross Price","Discount","Final Price","Prepaid/COD"].map(t => (
              <span key={t} className="px-2.5 py-1 bg-[#f0f0f0] rounded-lg text-xs font-semibold text-[#555]">{t}</span>
            ))}
          </div>
          <div className="text-xs text-[#bbb]">Supports .pdf · Multiple orders in one file</div>
        </div>
      )}

      {/* Upload again */}
      {appState === "idle" && meeshoOrders.length > 0 && (
        <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl px-5 py-4 flex items-center gap-4 cursor-pointer transition-all ${isDragging ? "border-black bg-[#f5f5f5]" : "border-[#e8e8e8] hover:border-[#aaa]"}`}>
          <div className="w-10 h-10 bg-[#f5f5f5] rounded-xl flex items-center justify-center shrink-0">
            <Upload size={18} className="text-[#666]" />
          </div>
          <div>
            <div className="font-bold text-sm text-black">Upload new PDF</div>
            <div className="text-xs text-[#888]">Drop another Meesho PDF to extract more orders</div>
          </div>
        </div>
      )}

      {/* History */}
      {appState !== "reviewing" && meeshoOrders.length > 0 && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-[#f5f5f5] p-1 rounded-xl gap-1">
              {(["today","all"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === t ? "bg-white text-black shadow-sm" : "text-[#888] hover:text-black"}`}>
                  {t === "today" ? `Today (${stats.count})` : `All (${meeshoOrders.length})`}
                </button>
              ))}
            </div>
            {activeTab === "all" && (
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                className="bg-white border border-[#e8e8e8] rounded-xl px-3 py-1.5 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10" />
            )}
            {activeTab === "all" && dateFilter && (
              <button onClick={() => setDateFilter("")} className="text-xs text-[#888] hover:text-black font-semibold">Clear date</button>
            )}
          </div>

          {activeTab === "today" ? (
            <div className="space-y-3">
              {filteredOrders.length === 0
                ? <div className="text-center py-8 text-[#aaa] text-sm">No orders today yet. Upload a PDF above!</div>
                : filteredOrders.map(order => <OrderCard key={order.id} order={order} onDelete={() => setMeeshoOrders(p => p.filter(o => o.id !== order.id))} />)}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDate?.length === 0 && <div className="text-center py-8 text-[#aaa] text-sm">No orders found.</div>}
              {groupedByDate?.map(([date, orders]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={13} className="text-[#aaa]" />
                      <span className="text-xs font-bold text-[#888] uppercase tracking-wider">{formatDate(date)}</span>
                    </div>
                    <div className="flex-1 h-px bg-[#f0f0f0]" />
                    <span className="text-xs font-bold text-black">
                      {orders.length} orders · ₹{orders.reduce((s, o) => s + o.sellingPrice, 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {orders.map(order => <OrderCard key={order.id} order={order} onDelete={() => setMeeshoOrders(p => p.filter(o => o.id !== order.id))} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
