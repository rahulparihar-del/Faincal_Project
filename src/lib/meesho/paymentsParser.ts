// Parser for Meesho Seller payment files (SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_*.xlsx)
// and Meesho orders excel files. Used by the Meesho "Payments" tab.
//
// Payment file structure (xlsx):
//   Sheet "Order Payments": row 1 = group titles, row 2 = column headers,
//     row 3 = formula legend, row 4+ = data
//   Sheet "Ads Cost": row 1 = title, row 2 = headers, row 3 = legend, row 4+ = data

export interface MeeshoPaymentRow {
  id: string; // subOrderNo | paymentDate (a suborder can settle across multiple payouts)
  subOrderNo: string;
  orderDate: string; // YYYY-MM-DD
  dispatchDate: string;
  productName: string;
  sku: string;
  liveOrderStatus: string; // Delivered | Return | RTO | Exchange | Cancelled | Shipped ...
  listingPrice: number;
  qty: number;
  transactionId: string;
  paymentDate: string; // YYYY-MM-DD — future date means upcoming payment
  settlementAmount: number; // Final Settlement Amount
  saleAmount: number; // Total Sale Amount (Incl. Shipping & GST)
  returnAmount: number; // Total Sale Return Amount
  priceType: string;
}

export interface MeeshoAdsRow {
  id: string; // deductionDuration | deductionDate | campaignId
  deductionDuration: string; // the day the ads actually ran
  deductionDate: string; // YYYY-MM-DD
  campaignId: string;
  adCost: number; // base ad cost (positive)
  gst: number;
  totalAdsCost: number; // total incl GST (positive number = money spent)
}

export interface MeeshoOrderLogRow {
  id: string; // subOrderNo
  subOrderNo: string;
  orderDate: string; // YYYY-MM-DD
  status: string;
  productName: string;
  sku: string;
  size: string;
  qty: number;
  price: number;
  state: string;
}

// ── helpers ─────────────────────────────────────────────────────────

// exceljs cell values can be Date, number, string, { richText }, { text }, { result }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cellText(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return String(v.text);
    if ("richText" in v && Array.isArray(v.richText)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return v.richText.map((r: any) => r.text).join("");
    }
    if ("hyperlink" in v) return String(v.hyperlink);
    return String(v);
  }
  return String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cellNumber(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "result" in v) return cellNumber(v.result);
  const n = parseFloat(String(cellText(v)).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Normalise any date-ish value to "YYYY-MM-DD" ("" when unparseable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toISODate(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    // exceljs parses dates as UTC — use UTC parts to avoid timezone shifts
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = cellText(v).trim();
  if (!s) return "";
  // "2026-06-01" or "2026-06-01 15:13:38" or ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // "24/06/26" or "24/06/2026" (DD/MM/YY[YY])
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
}

type Grid = string[][]; // raw text grid
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawGrid = any[][]; // raw values (keeps Dates/numbers)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sheetToGrids(ws: any): { text: Grid; raw: RawGrid } {
  const text: Grid = [];
  const raw: RawGrid = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws.eachRow({ includeEmpty: true }, (row: any) => {
    const t: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.eachCell({ includeEmpty: true }, (cell: any) => {
      t.push(cellText(cell.value).trim());
      r.push(cell.value);
    });
    text.push(t);
    raw.push(r);
  });
  return { text, raw };
}

function findHeaderRow(grid: Grid, mustInclude: string[], maxScan = 10): number {
  const wanted = mustInclude.map((w) => w.toLowerCase());
  for (let i = 0; i < Math.min(grid.length, maxScan); i++) {
    const cells = grid[i].map((c) => c.toLowerCase());
    if (wanted.every((w) => cells.some((c) => c.includes(w)))) return i;
  }
  return -1;
}

function colIndex(header: string[], ...candidates: string[]): number {
  const lower = header.map((h) => h.toLowerCase());
  for (const cand of candidates) {
    const c = cand.toLowerCase();
    let idx = lower.findIndex((h) => h === c);
    if (idx !== -1) return idx;
    idx = lower.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

export interface PaymentFileResult {
  payments: MeeshoPaymentRow[];
  ads: MeeshoAdsRow[];
}

// ── payment file parser ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePaymentWorkbook(workbook: any): PaymentFileResult {
  const payments: MeeshoPaymentRow[] = [];
  const ads: MeeshoAdsRow[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workbook.eachSheet((ws: any) => {
    const name = String(ws.name || "").toLowerCase();
    if (name.includes("order payment")) {
      const { text, raw } = sheetToGrids(ws);
      const h = findHeaderRow(text, ["sub order no", "payment date"]);
      if (h === -1) return;
      const header = text[h];
      const cSub = colIndex(header, "sub order no");
      const cOrderDate = colIndex(header, "order date");
      const cDispatch = colIndex(header, "dispatch date");
      const cProduct = colIndex(header, "product name");
      const cSku = colIndex(header, "supplier sku", "sku");
      const cStatus = colIndex(header, "live order status", "order status");
      const cListing = colIndex(header, "listing price");
      const cQty = colIndex(header, "quantity", "qty");
      const cTxn = colIndex(header, "transaction id");
      const cPayDate = colIndex(header, "payment date");
      const cSettle = colIndex(header, "final settlement amount");
      const cPriceType = colIndex(header, "price type");
      const cSale = colIndex(header, "total sale amount");
      const cReturn = colIndex(header, "total sale return amount");

      for (let i = h + 1; i < raw.length; i++) {
        const subOrderNo = (text[i][cSub] || "").trim();
        // skip legend row ("(B + C + ...)") and empty rows — real suborder ids contain digits+underscore
        if (!subOrderNo || !/\d{6,}/.test(subOrderNo)) continue;
        const paymentDate = toISODate(raw[i][cPayDate]);
        payments.push({
          id: `${subOrderNo}|${paymentDate}`,
          subOrderNo,
          orderDate: toISODate(raw[i][cOrderDate]),
          dispatchDate: cDispatch !== -1 ? toISODate(raw[i][cDispatch]) : "",
          productName: cProduct !== -1 ? text[i][cProduct] || "" : "",
          sku: cSku !== -1 ? text[i][cSku] || "" : "",
          liveOrderStatus: cStatus !== -1 ? text[i][cStatus] || "" : "",
          listingPrice: cListing !== -1 ? cellNumber(raw[i][cListing]) : 0,
          qty: cQty !== -1 ? cellNumber(raw[i][cQty]) || 1 : 1,
          transactionId: cTxn !== -1 ? text[i][cTxn] || "" : "",
          paymentDate,
          settlementAmount: cSettle !== -1 ? cellNumber(raw[i][cSettle]) : 0,
          saleAmount: cSale !== -1 ? cellNumber(raw[i][cSale]) : 0,
          returnAmount: cReturn !== -1 ? cellNumber(raw[i][cReturn]) : 0,
          priceType: cPriceType !== -1 ? text[i][cPriceType] || "" : "",
        });
      }
    } else if (name.includes("ads cost")) {
      const { text, raw } = sheetToGrids(ws);
      const h = findHeaderRow(text, ["deduction date", "campaign"]);
      if (h === -1) return;
      const header = text[h];
      const cDur = colIndex(header, "deduction duration");
      const cDate = colIndex(header, "deduction date");
      const cCamp = colIndex(header, "campaign id");
      const cCost = colIndex(header, "ad cost incl", "ad cost");
      const cGst = colIndex(header, "gst");
      const cTotal = colIndex(header, "total ads cost");

      for (let i = h + 1; i < raw.length; i++) {
        const deductionDate = toISODate(raw[i][cDate]);
        const campaignId = (text[i][cCamp] || "").trim();
        if (!deductionDate || !campaignId) continue;
        // File stores costs as negative deductions — normalise to positive "spend"
        const total = Math.abs(cellNumber(raw[i][cTotal]));
        if (total === 0) continue;
        const deductionDuration = cDur !== -1 ? toISODate(raw[i][cDur]) || text[i][cDur] || "" : "";
        ads.push({
          id: `${deductionDuration}|${deductionDate}|${campaignId}`,
          deductionDuration,
          deductionDate,
          campaignId,
          adCost: Math.abs(cellNumber(raw[i][cCost])),
          gst: Math.abs(cellNumber(raw[i][cGst])),
          totalAdsCost: total,
        });
      }
    }
  });

  return { payments, ads };
}

// ── orders excel parser (Seller Insights / forward orders file) ─────
// Tolerant: finds any header row that has "sub order" + "order date" columns.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOrdersWorkbook(workbook: any): MeeshoOrderLogRow[] {
  const out: MeeshoOrderLogRow[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workbook.eachSheet((ws: any) => {
    if (out.length > 0) return; // first matching sheet wins
    const { text, raw } = sheetToGrids(ws);
    const h = findHeaderRow(text, ["sub order", "order date"], 15);
    if (h === -1) return;
    const header = text[h];
    const cSub = colIndex(header, "sub order no", "sub order id", "sub order");
    const cDate = colIndex(header, "order date");
    const cStatus = colIndex(
      header,
      "reason for credit entry",
      "live order status",
      "order status",
      "status"
    );
    const cProduct = colIndex(header, "product name");
    const cSku = colIndex(header, "sku");
    const cSize = colIndex(header, "size", "variation");
    const cQty = colIndex(header, "quantity", "qty");
    const cPrice = colIndex(
      header,
      "supplier discounted price",
      "final sale amount",
      "supplier listed price",
      "listing price",
      "price"
    );
    const cState = colIndex(header, "customer state", "state");

    for (let i = h + 1; i < raw.length; i++) {
      const subOrderNo = (text[i][cSub] || "").trim();
      if (!subOrderNo || !/\d{6,}/.test(subOrderNo)) continue;
      const orderDate = toISODate(raw[i][cDate]);
      if (!orderDate) continue;
      out.push({
        id: subOrderNo,
        subOrderNo,
        orderDate,
        status: cStatus !== -1 ? text[i][cStatus] || "" : "",
        productName: cProduct !== -1 ? text[i][cProduct] || "" : "",
        sku: cSku !== -1 ? text[i][cSku] || "" : "",
        size: cSize !== -1 ? text[i][cSize] || "" : "",
        qty: cQty !== -1 ? cellNumber(raw[i][cQty]) || 1 : 1,
        price: cPrice !== -1 ? cellNumber(raw[i][cPrice]) : 0,
        state: cState !== -1 ? text[i][cState] || "" : "",
      });
    }
  });
  return out;
}

// ── aggregation ─────────────────────────────────────────────────────

// The Chrome extension syncs day-level payout totals (priceType "PAYOUT_AGGREGATE",
// one row per payout date) because Meesho's panel APIs don't expose per-order
// settlements. The xlsx payment files DO have per-order rows. To avoid double
// counting when both sources exist, aggregate rows are dropped for any payment
// date that already has per-order rows.
export function isAggregateRow(p: MeeshoPaymentRow): boolean {
  return p.priceType === "PAYOUT_AGGREGATE" || p.subOrderNo.startsWith("PAYOUT_");
}

export function resolvePayments(payments: MeeshoPaymentRow[]): MeeshoPaymentRow[] {
  const detailDates = new Set(
    payments.filter((p) => !isAggregateRow(p) && p.paymentDate).map((p) => p.paymentDate)
  );
  return payments.filter((p) => !isAggregateRow(p) || !detailDates.has(p.paymentDate));
}

export interface DailyRow {
  date: string; // YYYY-MM-DD
  ordersPlaced: number; // unique suborders ordered that day
  orderValue: number; // sum of order prices that day
  delivered: number;
  returned: number; // Return + RTO + Exchange settlements dated that day (by order)
  paymentSettled: number; // settlement amounts with paymentDate === date (only past/today)
  paymentUpcoming: number; // settlement amounts with future paymentDate === date
  adsCost: number;
  net: number; // settled - ads
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildDailyRows(
  rawPayments: MeeshoPaymentRow[],
  ads: MeeshoAdsRow[],
  orderLog: MeeshoOrderLogRow[]
): DailyRow[] {
  const payments = resolvePayments(rawPayments);
  const map = new Map<string, DailyRow>();
  const get = (date: string): DailyRow => {
    let r = map.get(date);
    if (!r) {
      r = {
        date,
        ordersPlaced: 0,
        orderValue: 0,
        delivered: 0,
        returned: 0,
        paymentSettled: 0,
        paymentUpcoming: 0,
        adsCost: 0,
        net: 0,
      };
      map.set(date, r);
    }
    return r;
  };

  const today = todayISO();

  // Orders per day: prefer the uploaded orders log; fill gaps from payment rows.
  const seenOrders = new Set<string>();
  for (const o of orderLog) {
    if (!o.orderDate || seenOrders.has(o.subOrderNo)) continue;
    seenOrders.add(o.subOrderNo);
    const r = get(o.orderDate);
    r.ordersPlaced += 1;
    r.orderValue += o.price * (o.qty || 1);
  }
  for (const p of payments) {
    if (!p.orderDate || seenOrders.has(p.subOrderNo)) continue;
    seenOrders.add(p.subOrderNo);
    const r = get(p.orderDate);
    r.ordersPlaced += 1;
    r.orderValue += p.listingPrice * (p.qty || 1);
  }

  // Status counts (per unique suborder, by order date)
  const statusSeen = new Set<string>();
  for (const p of payments) {
    if (!p.orderDate || statusSeen.has(p.subOrderNo)) continue;
    statusSeen.add(p.subOrderNo);
    const s = p.liveOrderStatus.toLowerCase();
    const r = get(p.orderDate);
    if (s.includes("deliver")) r.delivered += 1;
    else if (s.includes("return") || s.includes("rto") || s.includes("exchange")) r.returned += 1;
  }

  // Payments by payment date
  for (const p of payments) {
    if (!p.paymentDate) continue;
    const r = get(p.paymentDate);
    if (p.paymentDate > today) r.paymentUpcoming += p.settlementAmount;
    else r.paymentSettled += p.settlementAmount;
  }

  // Ads by the day they actually ran (deduction duration), falling back to deduction date
  for (const a of ads) {
    const r = get(a.deductionDuration || a.deductionDate);
    r.adsCost += a.totalAdsCost;
  }

  const rows = Array.from(map.values());
  for (const r of rows) r.net = r.paymentSettled + r.paymentUpcoming - r.adsCost;
  rows.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  return rows;
}

export interface PaymentsSummary {
  totalOrders: number;
  delivered: number;
  returned: number;
  settledAmount: number; // paymentDate <= today
  upcomingAmount: number; // paymentDate > today
  totalAds: number;
  net: number;
}

export function buildSummary(
  rawPayments: MeeshoPaymentRow[],
  ads: MeeshoAdsRow[],
  orderLog: MeeshoOrderLogRow[]
): PaymentsSummary {
  const payments = resolvePayments(rawPayments);
  const today = todayISO();
  const orderIds = new Set<string>();
  for (const o of orderLog) orderIds.add(o.subOrderNo);
  for (const p of payments) {
    if (!isAggregateRow(p)) orderIds.add(p.subOrderNo);
  }

  let delivered = 0;
  let returned = 0;
  const statusSeen = new Set<string>();
  for (const p of payments) {
    if (isAggregateRow(p) || statusSeen.has(p.subOrderNo)) continue;
    statusSeen.add(p.subOrderNo);
    const s = p.liveOrderStatus.toLowerCase();
    if (s.includes("deliver")) delivered += 1;
    else if (s.includes("return") || s.includes("rto") || s.includes("exchange")) returned += 1;
  }

  let settledAmount = 0;
  let upcomingAmount = 0;
  for (const p of payments) {
    if (p.paymentDate && p.paymentDate > today) upcomingAmount += p.settlementAmount;
    else settledAmount += p.settlementAmount;
  }
  const totalAds = ads.reduce((s, a) => s + a.totalAdsCost, 0);

  return {
    totalOrders: orderIds.size,
    delivered,
    returned,
    settledAmount,
    upcomingAmount,
    totalAds,
    net: settledAmount + upcomingAmount - totalAds,
  };
}

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
