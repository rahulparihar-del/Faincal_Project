/**
 * BizTrack — Meesho Orders CSV / XLSX Parser
 *
 * Converts Meesho Supplier Panel export files into MeeshoOrder records.
 * All parsed records are fed through orderService.mergeOrders() — never
 * written directly to Supabase.
 *
 * Column mapping follows Meesho's official export headers (as of 2026).
 * The mapper is intentionally strict: unknown columns are captured in raw_json.
 */

import type { MeeshoOrder } from "./types";

// ── Shared helpers ────────────────────────────────────────────────────

function toISODate(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  const n = parseFloat(String(v ?? "").replace(/[₹,\s]/g, ""));
  return isFinite(n) ? n : 0;
}

// ── Column header normalisation ───────────────────────────────────────

type ColKey =
  | "subOrder" | "catalog" | "date" | "source" | "state" | "product"
  | "sku" | "size" | "qty" | "listedPrice" | "discountedPrice"
  | "packetId" | "reason" | "orderId" | "city";

/**
 * Maps a header string to a ColKey.
 * Explicit string matching preferred; regex used only as last resort.
 */
function headerToKey(raw: string): ColKey | null {
  const h = raw.toLowerCase().trim();

  // Explicit known headers (Meesho export columns, 2026)
  if (h === "sub order no" || h === "sub_order_no" || h === "suborder no") return "subOrder";
  if (h === "catalog id" || h === "catalog_id" || h === "meesho pid") return "catalog";
  if (h === "order date" || h === "order_date") return "date";
  if (h === "order source" || h === "order_source") return "source";
  if (h === "customer state" || h === "customer_state") return "state";
  if (h === "customer city" || h === "customer_city") return "city";
  if (h === "product name" || h === "product_name") return "product";
  if (h === "sku" || h === "sku id" || h === "supplier sku") return "sku";
  if (h === "size" || h === "variation") return "size";
  if (h === "quantity" || h === "qty") return "qty";
  if (
    h === "supplier listed price (incl. gst + commission)" ||
    h === "supplier listed price" ||
    h === "listed price"
  ) return "listedPrice";
  if (
    h === "supplier discounted price (incl gst and commision)" ||
    h === "supplier discounted price" ||
    h === "discounted price" ||
    h === "selling price"
  ) return "discountedPrice";
  if (h === "packet id" || h === "packet_id") return "packetId";
  if (h === "reason for credit entry" || h === "reason") return "reason";
  if (h === "order id" || h === "order_id") return "orderId";

  // Regex fallback — only for headers we haven't seen before
  if (/sub.?order/.test(h)) return "subOrder";
  if (/catalog|meesho.?pid/.test(h)) return "catalog";
  if (/order.?date/.test(h)) return "date";
  if (/source/.test(h)) return "source";
  if (/customer.?state|^state$/.test(h)) return "state";
  if (/customer.?city|^city$/.test(h)) return "city";
  if (/product.?name|^product$/.test(h)) return "product";
  if (/^sku/.test(h)) return "sku";
  if (/^size$|variation/.test(h)) return "size";
  if (/quant|^qty$/.test(h)) return "qty";
  if (/listed.?price/.test(h)) return "listedPrice";
  if (/discount.?price|selling.?price/.test(h)) return "discountedPrice";
  if (/packet.?id/.test(h)) return "packetId";
  if (/reason/.test(h)) return "reason";

  return null;
}

function buildColMap(headers: string[]): Partial<Record<ColKey, number>> {
  const map: Partial<Record<ColKey, number>> = {};
  headers.forEach((h, i) => {
    const key = headerToKey(h);
    if (key && !(key in map)) map[key] = i; // first match wins
  });
  return map;
}

// ── CSV parsing ───────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

export function parseOrdersCSV(text: string): Partial<MeeshoOrder>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]);
  const colMap = buildColMap(headers);

  if (!("subOrder" in colMap)) return []; // can't parse without sub_order_no

  const now = new Date().toISOString();
  const results: Partial<MeeshoOrder>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    const g = (k: ColKey) => (colMap[k] !== undefined ? row[colMap[k]!] ?? "" : "");

    const subOrderNo = g("subOrder").trim();
    if (!subOrderNo) continue;

    const rawObj: Record<string, string> = {};
    headers.forEach((h, idx) => { rawObj[h] = row[idx] ?? ""; });

    results.push({
      id: subOrderNo,
      sub_order_no: subOrderNo,
      order_date: toISODate(g("date")),
      status: g("reason") || "PENDING",
      product_name: g("product"),
      sku: g("sku"),
      size: g("size"),
      qty: parseInt(g("qty"), 10) || 1,
      listing_price: toNum(g("listedPrice")),
      selling_price: toNum(g("discountedPrice")),
      catalog_id: g("catalog"),
      packet_id: g("packetId"),
      order_source: g("source"),
      customer_state: g("state"),
      customer_city: g("city"),
      data_source: "csv",
      captured_at: now,
      raw_json: rawObj as unknown as Record<string, unknown>,
    });
  }

  return results;
}

// ── XLSX parsing ──────────────────────────────────────────────────────

export async function parseOrdersXLSX(buffer: ArrayBuffer): Promise<Partial<MeeshoOrder>[]> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getText = (cell: any): string => {
    const v = cell.value;
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object") {
      if ("result" in v) return String(v.result);
      if ("text" in v) return String(v.text);
      if ("richText" in v && Array.isArray(v.richText))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return v.richText.map((r: any) => r.text).join("");
    }
    return String(v);
  };

  // Build colMap from row 1
  const headerRow = sheet.getRow(1);
  const rawHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    rawHeaders.push(getText(cell));
  });
  const colMap = buildColMap(rawHeaders);

  if (!("subOrder" in colMap)) return [];

  const now = new Date().toISOString();
  const results: Partial<MeeshoOrder>[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return; // skip header

    const g = (k: ColKey): string => {
      const idx = colMap[k];
      if (idx === undefined) return "";
      return getText(row.getCell(idx));
    };

    const getNum = (k: ColKey): number => {
      const idx = colMap[k];
      if (idx === undefined) return 0;
      const v = row.getCell(idx).value;
      if (typeof v === "number") return v;
      return toNum(v);
    };

    const subOrderNo = g("subOrder").trim();
    if (!subOrderNo) return;

    // Capture all cells as raw_json
    const rawObj: Record<string, unknown> = {};
    rawHeaders.forEach((h, idx) => {
      rawObj[h] = getText(row.getCell(idx + 1));
    });

    results.push({
      id: subOrderNo,
      sub_order_no: subOrderNo,
      order_date: toISODate(g("date") || row.getCell((colMap.date ?? 0) + 1).value),
      status: g("reason") || "PENDING",
      product_name: g("product"),
      sku: g("sku"),
      size: g("size"),
      qty: parseInt(g("qty"), 10) || 1,
      listing_price: getNum("listedPrice"),
      selling_price: getNum("discountedPrice"),
      catalog_id: g("catalog"),
      packet_id: g("packetId"),
      order_source: g("source"),
      customer_state: g("state"),
      customer_city: g("city"),
      data_source: "xlsx",
      captured_at: now,
      raw_json: rawObj,
    });
  });

  return results;
}

// ── Sample template data ──────────────────────────────────────────────

export const SAMPLE_CSV_HEADERS = [
  "Reason for Credit Entry",
  "Sub Order No",
  "Catalog ID",
  "Order Date",
  "Order source",
  "Customer State",
  "Customer City",
  "Product Name",
  "SKU",
  "Size",
  "Quantity",
  "Supplier Listed Price (Incl. GST + Commission)",
  "Supplier Discounted Price (Incl GST and Commision)",
  "Packet Id",
];

export const SAMPLE_CSV_ROWS = [
  ["DELIVERED", "281563483236968896_1", "463114673", "01/05/26", "organic", "Gujarat", "Surat", "Baby Pure Cotton Sleeveless Jhabla & Shorts Set", "KK-BABY-COORD-02", "0-3 Months", "1", "281", "281", "OG01OGM01344192"],
  ["RTO_COMPLETE", "281683081219254725_1", "468042994", "01/05/26", "", "Andhra Pradesh", "Hyderabad", "Baby Girls Muslin Cotton Sleeveless Frock", "KK-BABY-FROCK-CAR", "6-12 Months", "1", "199", "199", "OG01OGM01344184"],
  ["CANCELLED", "281776018702895936_1", "468042994", "01/05/26", "ad_order", "Andhra Pradesh", "Vijayawada", "Baby Girls Muslin Cotton Sleeveless Frock", "KK-BABY-FROCK-CAR", "6-12 Months", "1", "199", "199", "OG01OGM01313099"],
];
