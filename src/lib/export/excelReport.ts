import type {
  EcomSale,
  WholesaleSale,
  Manufacturer,
  PurchaseOrder,
  Transaction,
} from "@/lib/types";
import { wholesaleTotal } from "@/lib/wholesale";

// ── Brand palette (ARGB) ──
const C = {
  brandBg: "FF111111",
  brandText: "FFFFFFFF",
  subText: "FF6B6B6B",
  headerBg: "FF1F1F1F",
  headerText: "FFFFFFFF",
  zebra: "FFF7F7F7",
  totalBg: "FFEAEAEA",
  border: "FFE0E0E0",
  borderDark: "FFBFBFBF",
  pos: "FF0F7B0F",
  neg: "FFB42318",
};

const CURRENCY_FMT = '"₹"#,##0';
const DATE_FMT = "dd-mmm-yyyy";

export interface PLOverall {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalDeductions: number;
  netProfit: number;
}

export interface PLMonth {
  monthStr: string;
  ecomRev: number;
  wholesaleRev: number;
  rev: number;
  cogs: number;
  gp: number;
  deductions: number;
  rto: number;
  otherExpenses: number;
  np: number;
}

export interface ReportData {
  ecomSales: EcomSale[];
  wholesaleSales: WholesaleSale[];
  manufacturers: Manufacturer[];
  purchases: PurchaseOrder[];
  transactions: Transaction[];
  overall: PLOverall;
  monthly: PLMonth[];
}

type ColType = "text" | "currency" | "number" | "date";
interface Col {
  header: string;
  width: number;
  type?: ColType;
  total?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fmtMonthLabel(monthStr: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!m) return monthStr;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// Loosely typed to avoid pulling ExcelJS types into the runtime import.
/* eslint-disable @typescript-eslint/no-explicit-any */

function styleHeaderCell(cell: any, align: "left" | "right" | "center") {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
  cell.font = { bold: true, color: { argb: C.headerText }, size: 11, name: "Calibri" };
  cell.alignment = { vertical: "middle", horizontal: align };
  cell.border = {
    top: { style: "thin", color: { argb: C.borderDark } },
    bottom: { style: "thin", color: { argb: C.borderDark } },
    left: { style: "thin", color: { argb: C.border } },
    right: { style: "thin", color: { argb: C.border } },
  };
}

function alignFor(type?: ColType): "left" | "right" | "center" {
  if (type === "currency" || type === "number") return "right";
  if (type === "date") return "center";
  return "left";
}

function buildTableSheet(
  wb: any,
  name: string,
  title: string,
  cols: Col[],
  rows: (string | number | Date | null)[][]
) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
  });
  const n = cols.length;

  cols.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));

  // ── Brand band ──
  ws.mergeCells(1, 1, 1, n);
  const brand = ws.getCell(1, 1);
  brand.value = "BizTrack";
  brand.font = { bold: true, size: 20, color: { argb: C.brandText }, name: "Calibri" };
  brand.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  brand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandBg } };
  ws.getRow(1).height = 34;

  ws.mergeCells(2, 1, 2, n);
  const sub = ws.getCell(2, 1);
  sub.value = title;
  sub.font = { bold: true, size: 12, color: { argb: "FF222222" }, name: "Calibri" };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 20;

  ws.mergeCells(3, 1, 3, n);
  const gen = ws.getCell(3, 1);
  gen.value = `Generated ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;
  gen.font = { size: 9, italic: true, color: { argb: C.subText }, name: "Calibri" };
  gen.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(3).height = 16;

  // Row 4 spacer, header on row 5
  const headerRowIdx = 5;
  const hr = ws.getRow(headerRowIdx);
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    styleHeaderCell(cell, alignFor(c.type));
  });
  hr.height = 22;

  // ── Data rows ──
  rows.forEach((r, ri) => {
    const row = ws.getRow(headerRowIdx + 1 + ri);
    const zebra = ri % 2 === 1;
    cols.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const v = r[ci];
      cell.value = v as any;
      if (c.type === "currency") cell.numFmt = CURRENCY_FMT;
      else if (c.type === "number") cell.numFmt = "#,##0";
      else if (c.type === "date" && v instanceof Date) cell.numFmt = DATE_FMT;
      cell.alignment = { vertical: "middle", horizontal: alignFor(c.type) };
      cell.font = { size: 10, name: "Calibri", color: { argb: "FF222222" } };
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      cell.border = {
        bottom: { style: "hair", color: { argb: C.border } },
        left: { style: "hair", color: { argb: C.border } },
        right: { style: "hair", color: { argb: C.border } },
      };
    });
  });

  // ── Totals row ──
  const hasTotals = cols.some((c) => c.total);
  if (hasTotals && rows.length > 0) {
    const totalRow = ws.getRow(headerRowIdx + 1 + rows.length);
    cols.forEach((c, ci) => {
      const cell = totalRow.getCell(ci + 1);
      if (ci === 0) {
        cell.value = "TOTAL";
      } else if (c.total) {
        let sum = 0;
        rows.forEach((r) => {
          const v = r[ci];
          if (typeof v === "number") sum += v;
        });
        cell.value = sum;
        cell.numFmt = c.type === "currency" ? CURRENCY_FMT : "#,##0";
      }
      cell.font = { bold: true, size: 10, name: "Calibri" };
      cell.alignment = { vertical: "middle", horizontal: alignFor(c.type) };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.totalBg } };
      cell.border = { top: { style: "medium", color: { argb: C.borderDark } } };
    });
    totalRow.height = 20;
  }

  // Auto filter over the table header + data
  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowIdx, column: 1 },
      to: { row: headerRowIdx, column: n },
    };
  }

  return ws;
}

function buildSummarySheet(wb: any, data: ReportData) {
  const ws = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait" },
  });
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 26;

  // Brand band
  ws.mergeCells(1, 1, 1, 2);
  const brand = ws.getCell(1, 1);
  brand.value = "BizTrack";
  brand.font = { bold: true, size: 22, color: { argb: C.brandText }, name: "Calibri" };
  brand.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  brand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandBg } };
  ws.getRow(1).height = 40;

  ws.mergeCells(2, 1, 2, 2);
  const sub = ws.getCell(2, 1);
  sub.value = "Business Report";
  sub.font = { bold: true, size: 13, color: { argb: "FF222222" }, name: "Calibri" };
  sub.alignment = { horizontal: "left", indent: 1 };
  ws.getRow(2).height = 22;

  ws.mergeCells(3, 1, 3, 2);
  const gen = ws.getCell(3, 1);
  gen.value = `Generated ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`;
  gen.font = { size: 9, italic: true, color: { argb: C.subText }, name: "Calibri" };
  gen.alignment = { horizontal: "left", indent: 1 };

  let row = 5;
  const section = (text: string) => {
    ws.mergeCells(row, 1, row, 2);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
    cell.font = { bold: true, size: 11, color: { argb: C.headerText }, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(row).height = 20;
    row += 1;
  };
  const kpi = (label: string, value: number, opts: { currency?: boolean; bold?: boolean; color?: string } = {}) => {
    const l = ws.getCell(row, 1);
    l.value = label;
    l.font = { size: 10, bold: !!opts.bold, name: "Calibri", color: { argb: "FF333333" } };
    l.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    const v = ws.getCell(row, 2);
    v.value = value;
    v.numFmt = opts.currency ? CURRENCY_FMT : "#,##0";
    v.font = { size: 11, bold: !!opts.bold, name: "Calibri", color: { argb: opts.color || "FF222222" } };
    v.alignment = { vertical: "middle", horizontal: "right" };
    [l, v].forEach((c) => (c.border = { bottom: { style: "hair", color: { argb: C.border } } }));
    ws.getRow(row).height = 18;
    row += 1;
  };

  const o = data.overall;
  section("Profit & Loss Overview");
  kpi("Total Revenue", o.totalRevenue, { currency: true });
  kpi("Cost of Goods Sold (Bulk)", o.totalCogs, { currency: true });
  kpi("Gross Profit", o.grossProfit, { currency: true });
  kpi("Deductions (Commissions, Ads, RTO, Other)", o.totalDeductions, { currency: true });
  kpi("Net Profit", o.netProfit, {
    currency: true,
    bold: true,
    color: o.netProfit >= 0 ? C.pos : C.neg,
  });

  row += 1;
  const ecomRev = data.ecomSales.reduce((a, s) => a + (s.isRTO ? 0 : s.netPayout), 0);
  const wsRev = data.wholesaleSales.reduce((a, w) => a + wholesaleTotal(w), 0);
  section("Revenue by Source");
  kpi("E-commerce", ecomRev, { currency: true });
  kpi("Wholesale", wsRev, { currency: true });

  row += 1;
  section("Records");
  kpi("E-commerce entries", data.ecomSales.length);
  kpi("Wholesale bills", data.wholesaleSales.length);
  kpi("Purchase orders", data.purchases.length);
  kpi("Bank transactions", data.transactions.length);
  kpi("Manufacturers", data.manufacturers.length);

  return ws;
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function exportExcelReport(data: ReportData) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "BizTrack";
  wb.created = new Date();

  buildSummarySheet(wb, data);

  // Monthly P&L
  buildTableSheet(
    wb,
    "Monthly P&L",
    "Profit & Loss — Month by Month",
    [
      { header: "Month", width: 14, type: "text" },
      { header: "E-com Rev", width: 14, type: "currency", total: true },
      { header: "Wholesale Rev", width: 16, type: "currency", total: true },
      { header: "Total Revenue", width: 16, type: "currency", total: true },
      { header: "COGS", width: 14, type: "currency", total: true },
      { header: "Gross Profit", width: 15, type: "currency", total: true },
      { header: "Deductions", width: 14, type: "currency", total: true },
      { header: "RTO Losses", width: 13, type: "currency", total: true },
      { header: "Other Exp.", width: 13, type: "currency", total: true },
      { header: "Net Profit", width: 15, type: "currency", total: true },
    ],
    data.monthly.map((m) => [
      fmtMonthLabel(m.monthStr),
      m.ecomRev,
      m.wholesaleRev,
      m.rev,
      m.cogs,
      m.gp,
      m.deductions,
      m.rto,
      m.otherExpenses,
      m.np,
    ])
  );

  // E-commerce Sales
  const ecomRows = [...data.ecomSales]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((s) => [toDate(s.date), s.platform, s.netPayout, s.isRTO ? "RTO" : "Received"]);
  buildTableSheet(
    wb,
    "E-commerce Sales",
    "E-commerce Sales",
    [
      { header: "Date", width: 14, type: "date" },
      { header: "Platform", width: 16, type: "text" },
      { header: "Net Payout", width: 16, type: "currency", total: true },
      { header: "Status", width: 14, type: "text" },
    ],
    ecomRows
  );

  // Wholesale Bills
  const wsRows = [...data.wholesaleSales]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((w) => {
      const total = wholesaleTotal(w);
      return [
        toDate(w.date),
        w.billNo || "",
        w.retailerName,
        total,
        w.paymentReceived,
        total - w.paymentReceived,
        toDate(w.receivedDate),
        w.paymentMode,
      ];
    });
  buildTableSheet(
    wb,
    "Wholesale Bills",
    "Wholesale Bills",
    [
      { header: "Bill Date", width: 14, type: "date" },
      { header: "Bill No", width: 20, type: "text" },
      { header: "Shop Name", width: 28, type: "text" },
      { header: "Bill Amount", width: 15, type: "currency", total: true },
      { header: "Received", width: 14, type: "currency", total: true },
      { header: "Pending", width: 14, type: "currency", total: true },
      { header: "Received Date", width: 15, type: "date" },
      { header: "Mode", width: 14, type: "text" },
    ],
    wsRows
  );

  // Purchase Orders
  const mfgName = new Map(data.manufacturers.map((m) => [m.id, m.name]));
  const poRows = [...data.purchases]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((p) => [
      toDate(p.date),
      mfgName.get(p.manufacturerId) || "—",
      p.orderType,
      p.productName,
      p.qty,
      p.rate,
      p.qty * p.rate,
      p.paymentStatus,
      p.shipmentStatus,
    ]);
  buildTableSheet(
    wb,
    "Purchases",
    "Purchase Orders",
    [
      { header: "Date", width: 14, type: "date" },
      { header: "Manufacturer", width: 24, type: "text" },
      { header: "Type", width: 12, type: "text" },
      { header: "Product", width: 26, type: "text" },
      { header: "Qty", width: 10, type: "number", total: true },
      { header: "Rate", width: 12, type: "currency" },
      { header: "Amount", width: 15, type: "currency", total: true },
      { header: "Payment", width: 13, type: "text" },
      { header: "Shipment", width: 13, type: "text" },
    ],
    poRows
  );

  // Bank Transactions
  const txRows = [...data.transactions]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((t) => [toDate(t.date), t.account, t.type, t.amount, t.category, t.description, t.utr]);
  buildTableSheet(
    wb,
    "Bank Transactions",
    "Bank Transactions",
    [
      { header: "Date", width: 14, type: "date" },
      { header: "Account", width: 18, type: "text" },
      { header: "Type", width: 10, type: "text" },
      { header: "Amount", width: 15, type: "currency", total: true },
      { header: "Category", width: 22, type: "text" },
      { header: "Description", width: 32, type: "text" },
      { header: "UTR / Ref", width: 20, type: "text" },
    ],
    txRows
  );

  // Manufacturers
  const mfgRows = data.manufacturers.map((m) => [
    m.name,
    m.city,
    m.phone,
    m.productsSupplied,
    m.notes,
  ]);
  buildTableSheet(
    wb,
    "Manufacturers",
    "Manufacturer Directory",
    [
      { header: "Name", width: 26, type: "text" },
      { header: "City", width: 18, type: "text" },
      { header: "Phone", width: 16, type: "text" },
      { header: "Products Supplied", width: 30, type: "text" },
      { header: "Notes", width: 36, type: "text" },
    ],
    mfgRows
  );

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().split("T")[0];
  triggerDownload(buffer as ArrayBuffer, `BizTrack_Report_${stamp}.xlsx`);
}
