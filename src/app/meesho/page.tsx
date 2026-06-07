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
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  RotateCcw,
  Tag,
  Sparkles,
  TrendingDown,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayDate = () => new Date().toISOString().split("T")[0];
const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
const parseMoney = (s: string): number => {
  const m = s.replace(/[^\d.]/g, "");
  return parseFloat(m) || 0;
};

const STATUS_CONFIG = {
  Packed: { label: "Packed", bg: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  Shipped: { label: "Shipped", bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.25)" },
  RTO: { label: "RTO", bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.25)" },
} as const;

// ─── PDF Text Extraction ───────────────────────────────────────────────────────
function pageItemsToLines(items: Array<{ str: string; transform: number[] }>): string {
  const rows = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    if (!it.str?.trim()) continue;
    const y = Math.round(it.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push({ x: it.transform[4], str: it.str });
  }
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(" ")
    )
    .join("\n");
}

// ─── Shipping Label Parser ─────────────────────────────────────────────────────
interface ShippingData {
  orderNo: string;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerPincode: string;
  sku: string;
  size: string;
  color: string;
  qty: number;
  paymentType: "Prepaid" | "COD";
  courier: string;
  codAmount: number;
}

function parseShippingLabel(text: string): ShippingData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const data: ShippingData = {
    orderNo: "",
    customerName: "",
    customerAddress: "",
    customerCity: "",
    customerPincode: "",
    sku: "",
    size: "",
    color: "",
    qty: 1,
    paymentType: "Prepaid",
    courier: "",
    codAmount: 0,
  };

  // Payment type
  if (/prepaid/i.test(text)) data.paymentType = "Prepaid";
  else if (/cash on delivery|COD/i.test(text)) {
    data.paymentType = "COD";
    const codMatch = text.match(/(?:cash on delivery|COD)[:\s]+Rs\.?\s*([\d.]+)/i);
    if (codMatch) data.codAmount = parseFloat(codMatch[1]);
  }

  // Courier
  const couriers = ["Xpress Bees", "XpressBees", "Delhivery", "Shadowfax", "Ecom Express", "BlueDart", "DTDC", "Shiprocket", "Valmo"];
  for (const c of couriers) {
    if (new RegExp(c, "i").test(text)) {
      data.courier = c === "XpressBees" ? "Xpress Bees" : c;
      break;
    }
  }

  // Customer Name (line after "Customer Address")
  const custAddrIdx = lines.findIndex((l) => /customer\s*address/i.test(l));
  if (custAddrIdx >= 0 && custAddrIdx + 1 < lines.length) {
    const candidate = lines[custAddrIdx + 1];
    if (!/prepaid|xpress|delivery|pickup|cod/i.test(candidate)) {
      data.customerName = candidate.replace(/\*/g, "").trim();
    }
  }

  // Address block (lines between customer name and "If undelivered")
  if (custAddrIdx >= 0) {
    const endIdx = lines.findIndex((l, i) => i > custAddrIdx + 1 && /if undelivered|return to|prepaid|xpress|pickup/i.test(l));
    const stop = endIdx > 0 ? endIdx : custAddrIdx + 7;
    const addrLines: string[] = [];
    for (let i = custAddrIdx + 2; i < Math.min(stop, lines.length); i++) {
      const l = lines[i];
      if (l && !data.customerName.includes(l)) addrLines.push(l);
    }

    // Extract pincode from last address line
    for (const line of [...addrLines].reverse()) {
      const pm = line.match(/\b(\d{6})\b/);
      if (pm) {
        data.customerPincode = pm[1];
        // City = text before the pincode in that line
        const beforePin = line.split(pm[1])[0].replace(/[,\s]+$/, "").trim();
        // Often "District, State, Pincode" format
        const parts = beforePin.split(",").map((p) => p.trim()).filter(Boolean);
        data.customerCity = parts[parts.length - 1] || "";
        break;
      }
    }
    data.customerAddress = addrLines.slice(0, -1).join(", ").replace(/,\s*$/, "");
  }

  // Pincode fallback
  if (!data.customerPincode) {
    const pm = text.match(/\b(\d{6})\b/);
    if (pm) data.customerPincode = pm[1];
  }

  // Product Details — SKU, Size, Qty, Color, Order No.
  // Pattern: after "Product Details" header line, there's a header row then data row
  const prodIdx = lines.findIndex((l) => /product\s*details/i.test(l));
  if (prodIdx >= 0) {
    // Find the data row: usually contains SKU-like string
    for (let i = prodIdx + 1; i < Math.min(prodIdx + 8, lines.length); i++) {
      const l = lines[i];
      // Skip header row
      if (/\bsku\b.*\bsize\b/i.test(l) || /\bsku\b.*\bqty\b/i.test(l)) continue;

      // Try to parse: SKU  Size  Qty  Color  OrderNo
      // "KDK-YELLOW-BOY   3-4 Years   1   NA   294893329110980480_1"
      const skuMatch = l.match(/\b([A-Z0-9]{2,}-[A-Z0-9\-]{2,})\b/);
      if (skuMatch) {
        data.sku = skuMatch[1];
        // Size: e.g. "3-4 Years", "M", "XL", "Free Size"
        const sizeMatch = l.match(/(\d+[-–]\d+\s*(?:Years?|Yrs?|Months?|M|Y)\b|Free\s*Size|XS|S\b|M\b|L\b|XL\b|XXL\b|XXXL\b)/i);
        if (sizeMatch) data.size = sizeMatch[1].trim();

        // Qty: first standalone digit
        const afterSku = l.slice(l.indexOf(skuMatch[1]) + skuMatch[1].length);
        const qtyMatch = afterSku.match(/\b(\d+)\b/);
        if (qtyMatch) data.qty = parseInt(qtyMatch[1], 10) || 1;

        // Color: "NA" or a word before order number
        const colorMatch = afterSku.match(/\b(NA|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b(?=\s+\d{10,})/);
        if (colorMatch) data.color = colorMatch[1];

        // Order No: long numeric string at end
        const orderMatch = l.match(/\b(\d{10,}(?:_\d+)?)\b/);
        if (orderMatch) data.orderNo = orderMatch[1];
        break;
      }
    }
  }

  // Order No fallback: large numeric barcode number in the page
  if (!data.orderNo) {
    const matches = [...text.matchAll(/\b(\d{13,20})\b/g)];
    if (matches.length) data.orderNo = matches[matches.length - 1][1];
  }

  return data;
}

// ─── Invoice Parser ────────────────────────────────────────────────────────────
interface InvoiceData {
  orderNo: string;
  invoiceNo: string;
  productName: string;
  grossAmount: number;
  discount: number;
  tax: number;
  total: number;
}

function parseInvoice(text: string): InvoiceData {
  const data: InvoiceData = {
    orderNo: "",
    invoiceNo: "",
    productName: "",
    grossAmount: 0,
    discount: 0,
    tax: 0,
    total: 0,
  };

  // Purchase Order No
  const poMatch = text.match(/purchase\s+order\s+no\.?\s*\n?\s*([A-Z0-9]{8,})/i);
  if (poMatch) data.orderNo = poMatch[1].trim();

  // Invoice No
  const invMatch = text.match(/invoice\s+no\.?\s*\n?\s*([a-zA-Z0-9]+)/i);
  if (invMatch) data.invoiceNo = invMatch[1].trim();

  // Product Name: text in the Description column before HSN number
  // Usually the first multi-word text after the table header
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const tableHeaderIdx = lines.findIndex((l) => /description\s+hsn/i.test(l) || /description.*qty.*gross/i.test(l));

  if (tableHeaderIdx >= 0) {
    const descLines: string[] = [];
    for (let i = tableHeaderIdx + 1; i < Math.min(tableHeaderIdx + 8, lines.length); i++) {
      const l = lines[i];
      // Stop at "Other Charges" or "Total" row
      if (/other charges|^total\b/i.test(l)) break;
      // Stop if line looks like it contains Rs. amounts (it's a data row, not description continuation)
      if (/Rs\.\s*\d/.test(l) && descLines.length > 0) {
        // This line might have the amounts — extract them
        const amounts = [...l.matchAll(/Rs\.?\s*([\d,]+\.?\d*)/g)].map((m) => parseMoney(m[1]));
        if (amounts.length >= 1) data.grossAmount = amounts[0];
        if (amounts.length >= 2) data.discount = amounts[1];
        if (amounts.length >= 4) data.total = amounts[amounts.length - 1];
        break;
      }
      // If the line starts with a number (HSN code like 611130), parse amounts from it
      if (/^\d{6}/.test(l)) {
        const amounts = [...l.matchAll(/Rs\.?\s*([\d,]+\.?\d*)/g)].map((m) => parseMoney(m[0]));
        if (amounts.length >= 1) data.grossAmount = amounts[0];
        if (amounts.length >= 2) data.discount = amounts[1];
        if (amounts.length >= 4) data.total = amounts[amounts.length - 1];
        break;
      }
      descLines.push(l);
    }
    data.productName = descLines.join(" ").replace(/\s+/g, " ").trim();
  }

  // Amounts — comprehensive pattern search if table parsing didn't find them
  if (data.grossAmount === 0) {
    // "Gross Amount" column value
    const grossMatch = text.match(/Rs\.?\s*([\d,]+\.?\d*)\s*(?:Rs\.?\s*[\d,]+\.?\d*\s*){1,5}Rs\.?\s*([\d,]+\.?\d*)\s*$/m);
    if (grossMatch) {
      data.grossAmount = parseMoney(grossMatch[1]);
      data.total = parseMoney(grossMatch[2]);
    }
  }

  // Total line at bottom: "Total ... Rs.256.00"
  const totalLine = text.match(/^total\b.*Rs\.?\s*([\d,]+\.?\d*)\s*$/im);
  if (totalLine) data.total = parseMoney(totalLine[1]);

  // Tax: IGST amount
  const igstMatch = text.match(/IGST\s*@?\s*[\d.]+%?\s*Rs\.?\s*([\d,]+\.?\d*)/i);
  if (igstMatch) data.tax = parseMoney(igstMatch[1]);

  // Discount
  if (data.discount === 0) {
    const discMatch = text.match(/discount\s+.*?Rs\.?\s*([\d,]+\.?\d*)/i);
    if (discMatch) data.discount = parseMoney(discMatch[1]);
  }

  return data;
}

// ─── Page classifier ───────────────────────────────────────────────────────────
function classifyPage(text: string): "shipping" | "invoice" | "unknown" {
  const hasProductDetails = /product\s*details/i.test(text);
  const hasCustomerAddress = /customer\s*address/i.test(text);
  const hasTaxInvoice = /tax\s*invoice/i.test(text);
  const hasPurchaseOrder = /purchase\s*order\s*no/i.test(text);

  if (hasTaxInvoice || hasPurchaseOrder) return "invoice";
  if (hasProductDetails || hasCustomerAddress) return "shipping";
  return "unknown";
}

// ─── Main extractor ────────────────────────────────────────────────────────────
export interface ExtractedOrder {
  orderNo: string;
  invoiceNo: string;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerPincode: string;
  sku: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  grossAmount: number;
  discount: number;
  tax: number;
  sellingPrice: number;
  paymentType: "Prepaid" | "COD";
  courier: string;
  pageNos: number[];
}

async function extractFromPdf(
  file: File,
  onProgress: (msg: string, pct: number) => void
): Promise<ExtractedOrder[]> {
  onProgress("Loading PDF…", 5);
  const pdfjs: typeof import("pdfjs-dist") = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const total = pdf.numPages;

  // Extract text from each page
  const pages: { text: string; type: "shipping" | "invoice" | "unknown"; pageNo: number }[] = [];

  for (let i = 1; i <= total; i++) {
    onProgress(`Reading page ${i} of ${total}…`, 5 + Math.round((i / total) * 60));
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = pageItemsToLines(content.items as Array<{ str: string; transform: number[] }>);
    const type = classifyPage(text);
    pages.push({ text, type, pageNo: i });
  }

  onProgress("Matching orders…", 70);

  // Parse each page
  const shippingPages: (ShippingData & { pageNo: number })[] = [];
  const invoicePages: (InvoiceData & { pageNo: number })[] = [];

  for (const { text, type, pageNo } of pages) {
    if (type === "shipping") {
      shippingPages.push({ ...parseShippingLabel(text), pageNo });
    } else if (type === "invoice") {
      invoicePages.push({ ...parseInvoice(text), pageNo });
    }
  }

  // Match shipping + invoice by order number (strip trailing _N suffix)
  const normalize = (s: string) => s.replace(/_\d+$/, "").trim();

  const orders: ExtractedOrder[] = [];
  const usedInvoices = new Set<number>();

  for (const ship of shippingPages) {
    const shipOrderNo = normalize(ship.orderNo);

    // Find matching invoice
    const inv = invoicePages.find(
      (inv) => !usedInvoices.has(inv.pageNo) && normalize(inv.orderNo) === shipOrderNo
    );

    if (inv) usedInvoices.add(inv.pageNo);

    orders.push({
      orderNo: ship.orderNo || inv?.orderNo || "",
      invoiceNo: inv?.invoiceNo || "",
      customerName: ship.customerName,
      customerAddress: ship.customerAddress,
      customerCity: ship.customerCity,
      customerPincode: ship.customerPincode,
      sku: ship.sku,
      productName: inv?.productName || "",
      size: ship.size,
      color: ship.color,
      qty: ship.qty,
      grossAmount: inv?.grossAmount || 0,
      discount: inv?.discount || 0,
      tax: inv?.tax || 0,
      sellingPrice: inv?.total || (ship.paymentType === "COD" ? ship.codAmount : 0),
      paymentType: ship.paymentType,
      courier: ship.courier,
      pageNos: [ship.pageNo, ...(inv ? [inv.pageNo] : [])],
    });
  }

  // Add unmatched invoices (shipping page might have been unknown)
  for (const inv of invoicePages) {
    if (!usedInvoices.has(inv.pageNo)) {
      orders.push({
        orderNo: inv.orderNo,
        invoiceNo: inv.invoiceNo,
        customerName: "",
        customerAddress: "",
        customerCity: "",
        customerPincode: "",
        sku: "",
        productName: inv.productName,
        size: "",
        color: "",
        qty: 1,
        grossAmount: inv.grossAmount,
        discount: inv.discount,
        tax: inv.tax,
        sellingPrice: inv.total,
        paymentType: "Prepaid",
        courier: "",
        pageNos: [inv.pageNo],
      });
    }
  }

  onProgress("Done!", 100);
  return orders;
}

// ─── Review Table ──────────────────────────────────────────────────────────────
function ReviewTable({
  orders,
  onUpdate,
  onRemove,
  onSave,
  onReset,
}: {
  orders: ExtractedOrder[];
  onUpdate: (idx: number, field: keyof ExtractedOrder, value: string | number) => void;
  onRemove: (idx: number) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const cellInput =
    "w-full bg-transparent border-0 border-b border-transparent focus:border-[#ccc] focus:outline-none text-xs text-black py-0.5 font-medium placeholder-[#bbb] min-w-0";

  const totalRevenue = orders.reduce((s, o) => s + o.sellingPrice, 0);
  const totalDiscount = orders.reduce((s, o) => s + o.discount, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-gradient-to-r from-[#f0fdf4] to-[#eff6ff] border border-[#bbf7d0] rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-green-600" />
          <span className="text-sm font-bold text-green-700">
            {orders.length} orders extracted
          </span>
        </div>
        <div className="text-xs text-[#555]">
          Revenue: <strong>₹{totalRevenue.toLocaleString("en-IN")}</strong>
        </div>
        <div className="text-xs text-[#555]">
          Discount: <strong>₹{totalDiscount.toLocaleString("en-IN")}</strong>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#666] border border-[#e8e8e8] bg-white hover:bg-[#f5f5f5] transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-black hover:bg-[#1a1a1a] transition-colors"
          >
            <Save size={12} /> Save All Orders
          </button>
        </div>
      </div>

      {/* Table (horizontal scroll) */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#fafafa] border-b border-[#e8e8e8]">
              <tr>
                {[
                  "#",
                  "Customer",
                  "Order No.",
                  "SKU",
                  "Product Name",
                  "Size",
                  "Qty",
                  "Gross (₹)",
                  "Disc (₹)",
                  "Total (₹)",
                  "Payment",
                  "Courier",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-[10px] font-semibold text-[#888] uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f5f5]">
              {orders.map((o, idx) => (
                <tr key={idx} className="hover:bg-[#fafafa] transition-colors group">
                  <td className="px-3 py-2 text-[#aaa] font-bold">{idx + 1}</td>
                  <td className="px-3 py-2 min-w-[130px]">
                    <input
                      className={cellInput}
                      value={o.customerName}
                      onChange={(e) => onUpdate(idx, "customerName", e.target.value)}
                      placeholder="Customer name"
                    />
                    {o.customerCity && (
                      <div className="text-[10px] text-[#aaa] mt-0.5">{o.customerCity} {o.customerPincode}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <div className="font-mono text-[10px] text-[#666] truncate max-w-[140px]" title={o.orderNo}>
                      {o.orderNo || "—"}
                    </div>
                    {o.invoiceNo && <div className="text-[10px] text-[#bbb]">Inv: {o.invoiceNo}</div>}
                  </td>
                  <td className="px-3 py-2 min-w-[110px]">
                    <input
                      className={`${cellInput} font-mono`}
                      value={o.sku}
                      onChange={(e) => onUpdate(idx, "sku", e.target.value)}
                      placeholder="SKU"
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[160px]">
                    <input
                      className={cellInput}
                      value={o.productName}
                      onChange={(e) => onUpdate(idx, "productName", e.target.value)}
                      placeholder="Product name"
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[80px]">
                    <input
                      className={cellInput}
                      value={o.size}
                      onChange={(e) => onUpdate(idx, "size", e.target.value)}
                      placeholder="Size"
                    />
                  </td>
                  <td className="px-3 py-2 w-12 text-center">
                    <input
                      type="number"
                      min={1}
                      className={`${cellInput} text-center`}
                      value={o.qty}
                      onChange={(e) => onUpdate(idx, "qty", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2 text-right w-20">
                    <input
                      type="number"
                      min={0}
                      className={`${cellInput} text-right`}
                      value={o.grossAmount || ""}
                      onChange={(e) => onUpdate(idx, "grossAmount", Number(e.target.value))}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-right w-20">
                    <input
                      type="number"
                      min={0}
                      className={`${cellInput} text-right text-red-500`}
                      value={o.discount || ""}
                      onChange={(e) => onUpdate(idx, "discount", Number(e.target.value))}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-right w-20">
                    <input
                      type="number"
                      min={0}
                      className={`${cellInput} text-right font-bold`}
                      value={o.sellingPrice || ""}
                      onChange={(e) => onUpdate(idx, "sellingPrice", Number(e.target.value))}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        o.paymentType === "Prepaid"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {o.paymentType}
                    </span>
                  </td>
                  <td className="px-3 py-2 min-w-[90px]">
                    <input
                      className={cellInput}
                      value={o.courier}
                      onChange={(e) => onUpdate(idx, "courier", e.target.value)}
                      placeholder="Courier"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onRemove(idx)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
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
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
        >
          <Save size={15} />
          Save {orders.length} Orders to Today
        </button>
      </div>
    </div>
  );
}

// ─── Order Card (History) ──────────────────────────────────────────────────────
function OrderCard({ order, onDelete }: { order: MeeshoOrder; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition-shadow">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-start gap-3"
      >
        <div
          className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: cfg.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-black text-sm leading-tight">
                {order.customerName || "—"}
              </div>
              <div className="text-[11px] text-[#888] font-mono mt-0.5 truncate">
                #{order.orderNo || "—"}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  order.paymentType === "Prepaid"
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {order.paymentType}
              </span>
              <span
                className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold border"
                style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
              >
                {cfg.label}
              </span>
              <ChevronDown
                size={14}
                className={`text-[#aaa] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {order.sku && (
              <span className="text-[11px] bg-[#f5f5f5] text-[#666] px-2 py-0.5 rounded-md font-medium font-mono">
                {order.sku}
              </span>
            )}
            {order.size && <span className="text-[11px] text-[#888]">{order.size}</span>}
            {order.qty > 0 && <span className="text-[11px] text-[#888]">Qty: {order.qty}</span>}
            {order.discount > 0 && (
              <span className="text-[11px] text-red-500 line-through">
                ₹{order.grossAmount.toLocaleString("en-IN")}
              </span>
            )}
            {order.sellingPrice > 0 && (
              <span className="text-[11px] font-bold text-black">
                ₹{order.sellingPrice.toLocaleString("en-IN")}
              </span>
            )}
            {order.discount > 0 && (
              <span className="text-[11px] text-green-600 font-semibold">
                −₹{order.discount.toLocaleString("en-IN")}
              </span>
            )}
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
            <div className="bg-[#fafafa] rounded-xl p-2.5 text-center">
              <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">MRP</div>
              <div className="font-bold text-black text-sm">₹{order.grossAmount.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-[#fafafa] rounded-xl p-2.5 text-center">
              <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Disc</div>
              <div className="font-bold text-red-500 text-sm">−₹{order.discount.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-[#fafafa] rounded-xl p-2.5 text-center">
              <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Paid</div>
              <div className="font-bold text-green-600 text-sm">₹{order.sellingPrice.toLocaleString("en-IN")}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {order.courier && (
              <div className="bg-[#fafafa] rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Courier</div>
                <div className="font-semibold text-black text-xs">{order.courier}</div>
              </div>
            )}
            {order.invoiceNo && (
              <div className="bg-[#fafafa] rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Invoice</div>
                <div className="font-semibold text-black text-xs font-mono">{order.invoiceNo}</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#aaa]">Added {fmtTime(order.scannedAt)}</span>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
          {order.notes && (
            <div className="text-[12px] text-[#777] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3 py-2">
              {order.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
type AppState = "idle" | "processing" | "reviewing";

export default function MeeshoOrders() {
  const { meeshoOrders, setMeeshoOrders } = useData();
  const [appState, setAppState] = useState<AppState>("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"today" | "all">("today");
  const [dateFilter, setDateFilter] = useState(todayDate());
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = todayDate();
  const todayOrders = useMemo(
    () => meeshoOrders.filter((o) => o.date === todayStr),
    [meeshoOrders, todayStr]
  );

  const filteredOrders = useMemo(() => {
    if (activeTab === "today") return todayOrders;
    if (dateFilter) return meeshoOrders.filter((o) => o.date === dateFilter);
    return meeshoOrders;
  }, [meeshoOrders, todayOrders, activeTab, dateFilter]);

  const todayStats = useMemo(() => ({
    count: todayOrders.length,
    qty: todayOrders.reduce((s, o) => s + o.qty, 0),
    revenue: todayOrders.filter((o) => o.status !== "RTO").reduce((s, o) => s + o.sellingPrice, 0),
    discount: todayOrders.reduce((s, o) => s + o.discount, 0),
  }), [todayOrders]);

  const groupedByDate = useMemo(() => {
    if (activeTab === "today") return null;
    const groups: Record<string, MeeshoOrder[]> = {};
    filteredOrders.forEach((o) => {
      if (!groups[o.date]) groups[o.date] = [];
      groups[o.date].push(o);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredOrders, activeTab]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(pdf)$/i)) {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setAppState("processing");
    setProgressPct(0);
    setProgressMsg("Starting…");
    try {
      const orders = await extractFromPdf(file, (msg, pct) => {
        setProgressMsg(msg);
        setProgressPct(pct);
      });
      setExtractedOrders(orders);
      setAppState("reviewing");
    } catch (e) {
      console.error(e);
      setError("Failed to process PDF. Please try again.");
      setAppState("idle");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const updateOrder = (idx: number, field: keyof ExtractedOrder, value: string | number) => {
    setExtractedOrders((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o))
    );
  };

  const removeOrder = (idx: number) => {
    setExtractedOrders((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveAllOrders = () => {
    const now = new Date().toISOString();
    const newOrders: MeeshoOrder[] = extractedOrders.map((o, i) => ({
      id: `${Date.now()}-${i}`,
      date: todayDate(),
      scannedAt: now,
      orderNo: o.orderNo,
      invoiceNo: o.invoiceNo,
      customerName: o.customerName,
      customerAddress: o.customerAddress,
      customerCity: o.customerCity,
      customerPincode: o.customerPincode,
      sku: o.sku,
      productName: o.productName,
      size: o.size,
      color: o.color,
      qty: o.qty,
      grossAmount: o.grossAmount,
      discount: o.discount,
      tax: o.tax,
      sellingPrice: o.sellingPrice,
      paymentType: o.paymentType,
      courier: o.courier,
      status: "Packed",
      notes: "",
    }));
    setMeeshoOrders((prev) => [...newOrders, ...prev]);
    setAppState("idle");
    setExtractedOrders([]);
    setActiveTab("today");
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Meesho Orders</h2>
          <p className="text-sm text-[#888] mt-1">Daily packing tracker</p>
        </div>
        {appState !== "reviewing" && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
          >
            <Upload size={15} />
            Upload PDF
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>

      {/* ── Today's Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: ClipboardList, color: "text-blue-500", bg: "bg-[#eff6ff]", label: "Today", value: todayStats.count, sub: "Orders" },
          { icon: Package, color: "text-green-500", bg: "bg-[#f0fdf4]", label: "Items", value: todayStats.qty, sub: "Qty packed" },
          { icon: IndianRupee, color: "text-purple-500", bg: "bg-[#fdf4ff]", label: "Revenue", value: `₹${todayStats.revenue.toLocaleString("en-IN")}`, sub: "Earned today" },
          { icon: TrendingDown, color: "text-red-400", bg: "bg-[#fff1f2]", label: "Discount", value: `₹${todayStats.discount.toLocaleString("en-IN")}`, sub: "Given today" },
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

      {/* ── Processing State ── */}
      {appState === "processing" && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 flex flex-col items-center gap-4 shadow-sm">
          <div className="w-14 h-14 bg-[#f5f5f5] rounded-2xl flex items-center justify-center">
            <Loader2 size={28} className="text-black animate-spin" />
          </div>
          <div className="text-center">
            <div className="font-bold text-black">{progressMsg}</div>
            <div className="text-sm text-[#888] mt-1">Extracting order details from PDF…</div>
          </div>
          <div className="w-full max-w-xs">
            <div className="w-full h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-center text-xs text-[#aaa] mt-1">{progressPct}%</div>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-700 font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Review Table ── */}
      {appState === "reviewing" && extractedOrders.length > 0 && (
        <ReviewTable
          orders={extractedOrders}
          onUpdate={updateOrder}
          onRemove={removeOrder}
          onSave={saveAllOrders}
          onReset={() => { setAppState("idle"); setExtractedOrders([]); }}
        />
      )}

      {/* ── Upload Drop Zone (idle + no orders) ── */}
      {appState === "idle" && meeshoOrders.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center text-center gap-4 cursor-pointer transition-all ${
            isDragging
              ? "border-black bg-[#f5f5f5] scale-[1.01]"
              : "border-[#ddd] hover:border-[#aaa] hover:bg-[#fafafa]"
          }`}
        >
          <div className="w-16 h-16 bg-[#f5f5f5] rounded-2xl flex items-center justify-center">
            <FileText size={32} className="text-[#888]" />
          </div>
          <div>
            <div className="font-bold text-black text-lg">Upload Today&apos;s Meesho PDF</div>
            <div className="text-sm text-[#666] mt-2 leading-relaxed max-w-sm">
              Drop your Meesho orders PDF here or click to browse.<br />
              All orders will be extracted automatically — customer name, SKU, product, price, discount, Prepaid/COD.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {["Customer Name", "SKU", "Product", "Size", "Gross Price", "Discount", "Final Price", "Prepaid/COD"].map((t) => (
              <span key={t} className="px-2.5 py-1 bg-[#f0f0f0] rounded-lg text-xs font-semibold text-[#555]">{t}</span>
            ))}
          </div>
          <div className="text-xs text-[#bbb]">Supports .pdf files · Multiple orders in one file</div>
        </div>
      )}

      {/* ── Upload again banner (when orders exist) ── */}
      {appState === "idle" && meeshoOrders.length > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl px-5 py-4 flex items-center gap-4 cursor-pointer transition-all ${
            isDragging ? "border-black bg-[#f5f5f5]" : "border-[#e8e8e8] hover:border-[#aaa]"
          }`}
        >
          <div className="w-10 h-10 bg-[#f5f5f5] rounded-xl flex items-center justify-center shrink-0">
            <Upload size={18} className="text-[#666]" />
          </div>
          <div>
            <div className="font-bold text-sm text-black">Upload new PDF</div>
            <div className="text-xs text-[#888]">Drop another Meesho PDF to extract more orders</div>
          </div>
        </div>
      )}

      {/* ── Orders History ── */}
      {appState !== "reviewing" && meeshoOrders.length > 0 && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-[#f5f5f5] p-1 rounded-xl gap-1">
              {(["today", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === t ? "bg-white text-black shadow-sm" : "text-[#888] hover:text-black"}`}
                >
                  {t === "today" ? `Today (${todayStats.count})` : `All (${meeshoOrders.length})`}
                </button>
              ))}
            </div>
            {activeTab === "all" && (
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-white border border-[#e8e8e8] rounded-xl px-3 py-1.5 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            )}
            {activeTab === "all" && dateFilter && (
              <button onClick={() => setDateFilter("")} className="text-xs text-[#888] hover:text-black font-semibold">
                Clear date
              </button>
            )}
          </div>

          {activeTab === "today" ? (
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-[#aaa] text-sm">
                  No orders packed today yet. Upload a PDF above!
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onDelete={() => setMeeshoOrders((p) => p.filter((o) => o.id !== order.id))}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDate?.length === 0 && (
                <div className="text-center py-8 text-[#aaa] text-sm">No orders found.</div>
              )}
              {groupedByDate?.map(([date, orders]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={13} className="text-[#aaa]" />
                      <span className="text-xs font-bold text-[#888] uppercase tracking-wider">
                        {formatDate(date)}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-[#f0f0f0]" />
                    <span className="text-xs font-bold text-black">
                      {orders.length} orders · ₹{orders.reduce((s, o) => s + o.sellingPrice, 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onDelete={() => setMeeshoOrders((p) => p.filter((o) => o.id !== order.id))}
                      />
                    ))}
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
