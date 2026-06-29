"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Package, Clock, AlertTriangle, Image as ImageIcon, X, Calendar, Download, FileSpreadsheet, FileText, Upload, CheckCircle, MapPin, Tag, Search } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";

interface MeeshoManualOrder {
  id: string;
  image: string;
  productName: string;
  orderId: string;
  subOrderNo: string;
  sku: string;
  catalogId: string;
  qty: number;
  size: string;
  orderDate: string;
  slaStatus: "Normal" | "Breaching Soon" | "Breached";
  // Raw Excel headers extracted
  reasonForCreditEntry: string;
  orderSource: string;
  customerState: string;
  supplierListedPrice: number;
  supplierDiscountedPrice: number;
  packetId: string;
}

const DEFAULT_ORDERS: MeeshoManualOrder[] = [
  {
    id: "m_1",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=300&q=80",
    productName: "Baby Pure Cotton Sleeveless Jhabla & Shorts Set - Cute Train Print Sleepsuit, Newborn Infant Co-ord Set (0-12 Months)",
    orderId: "281563483236968896",
    subOrderNo: "281563483236968896_1",
    sku: "KK-BABY-COORD-02",
    catalogId: "463114673",
    qty: 1,
    size: "0-3 Months",
    orderDate: "2026-05-01",
    slaStatus: "Normal",
    reasonForCreditEntry: "DELIVERED",
    orderSource: "organic",
    customerState: "Gujarat",
    supplierListedPrice: 281,
    supplierDiscountedPrice: 281,
    packetId: "OG01OGM01344192"
  }
];

interface MeeshoReturn {
  id: string;
  sNo: string;
  productName: string;
  sku: string;
  variation: string;
  meeshoPid: string;
  category: string;
  qty: number;
  orderNumber: string;
  suborderNumber: string;
  dispatchDate: string;
  returnCreatedDate: string;
  typeOfReturn: string;
  subType: string;
  expectedDeliveryDate: string;
  courierPartner: string;
  awbNumber: string;
  status: string;
  attempt: string;
  trackingLink: string;
  returnPriceType: string;
  returnReason: string;
  detailedReturnReason: string;
  deliveredDate?: string;
  proofOfDelivery?: string;
  otpVerifiedAt?: string;
}

const DEFAULT_RETURNS: MeeshoReturn[] = [
  {
    id: "r_1",
    sNo: "1",
    productName: "Baby Pure Cotton Sleeveless Jhabla & Shorts Set",
    sku: "KK-C0-TRAIN",
    variation: "6-9 Months",
    meeshoPid: "463114673",
    category: "Clothing Set",
    qty: 1,
    orderNumber: "3.00936E+17",
    suborderNumber: "300935668088315072_1",
    dispatchDate: "24/06/26",
    returnCreatedDate: "29/06/26",
    typeOfReturn: "Customer Return",
    subType: "FIRST_RET",
    expectedDeliveryDate: "24/07/26",
    courierPartner: "Delhivery",
    awbNumber: "1.49071E+15",
    status: "Picked Up",
    attempt: "NA",
    trackingLink: "https://track.delhivery.com/p/149071121853756",
    returnPriceType: "Meesho Price",
    returnReason: "Have size / fit related issues",
    detailedReturnReason: "Size correct but too tight"
  }
];


// Parses dates like "24/06/26", "24/06/2026", "2026-07-14" → "14 Jul 2026"
function formatReturnDate(raw: string): string {
  if (!raw || raw === "NA" || raw === "null" || raw === "") return raw;
  let d: Date | null = null;
  // Try DD/MM/YY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let year = parseInt(dmy[3]);
    if (year < 100) year += 2000;
    d = new Date(year, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  } else {
    // Try ISO "2026-07-14"
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  }
  if (!d || isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Returns a human-friendly duration string between two raw date strings
function calcDuration(from: string, to: string): string {
  const parseRaw = (raw: string): Date | null => {
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dmy) {
      let year = parseInt(dmy[3]);
      if (year < 100) year += 2000;
      return new Date(year, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    }
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return null;
  };
  const d1 = parseRaw(from);
  const d2 = parseRaw(to);
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return "";
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day";
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 14) return "1 week";
  if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks`;
  if (diffDays < 60) return "~1 month";
  return `~${Math.round(diffDays / 30)} months`;
}

export default function MeeshoPage() {
  const [orders, setOrders, isReady] = useSupabaseTable<MeeshoManualOrder>(
    "meesho_orders",
    "biztrack_meesho_manual_orders",
    DEFAULT_ORDERS
  );
  const [returnsList, setReturnsList, isReturnsReady] = useSupabaseTable<MeeshoReturn>(
    "meesho_returns",
    "biztrack_meesho_returns",
    DEFAULT_RETURNS
  );
  // Sub-tab dedicated tables
  const [inTransitList, setInTransitList] = useSupabaseTable<MeeshoReturn>(
    "meesho_returns_in_transit",
    "biztrack_meesho_returns_in_transit",
    []
  );
  const [outForDeliveryList, setOutForDeliveryList] = useSupabaseTable<MeeshoReturn>(
    "meesho_returns_out_delivery",
    "biztrack_meesho_returns_out_delivery",
    []
  );
  const [deliveredList, setDeliveredList] = useSupabaseTable<MeeshoReturn>(
    "meesho_returns_delivered",
    "biztrack_meesho_returns_delivered",
    []
  );
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<"dispatch" | "return">("dispatch");
  const [returnSubTab, setReturnSubTab] = useState<"in-transit" | "out-for-delivery" | "delivered">("in-transit");
  const [selectedOrder, setSelectedOrder] = useState<MeeshoManualOrder | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<MeeshoReturn | null>(null);
  const [liveTracking, setLiveTracking] = useState<{
    status: string; statusType: string; lastScan: string; lastLocation: string;
    lastDateTime: string; scans: Array<{ dateTime: string; scan: string; location: string; instructions: string }>;
    loading: boolean; error: string; trackingUrl?: string; note?: string; courier?: string;
  } | null>(null);

  // Fetch live courier status when a return modal opens
  useEffect(() => {
    if (!selectedReturn) { setLiveTracking(null); return; }
    const awb = selectedReturn.awbNumber?.replace(/[^0-9]/g, "");
    const courier = selectedReturn.courierPartner;
    if (!awb || awb.length < 8) { setLiveTracking(null); return; }
    setLiveTracking({ status: "", statusType: "", lastScan: "", lastLocation: "", lastDateTime: "", scans: [], loading: true, error: "", trackingUrl: "", note: "" });
    fetch(`/api/track?awb=${awb}&courier=${encodeURIComponent(courier)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error && !data.trackingUrl) setLiveTracking(prev => prev ? { ...prev, loading: false, error: data.error } : null);
        else setLiveTracking({ ...data, loading: false, error: data.error ?? "" });
      })
      .catch(err => setLiveTracking(prev => prev ? { ...prev, loading: false, error: err.message } : null));
  }, [selectedReturn?.id]);

  // Migrate old returnsList data to returnSubTabs on load if sub-tabs are empty
  useEffect(() => {
    if (
      isReturnsReady &&
      returnsList.length > 0 &&
      inTransitList.length === 0 &&
      outForDeliveryList.length === 0 &&
      deliveredList.length === 0
    ) {
      const transit: MeeshoReturn[] = [];
      const outDelivery: MeeshoReturn[] = [];
      const deliv: MeeshoReturn[] = [];

      returnsList.forEach(item => {
        const status = String(item.status || "").toLowerCase();
        if (status === "delivered" || status === "returned") {
          deliv.push(item);
        } else if (status === "out for delivery" || status === "out-for-delivery" || status.includes("out")) {
          outDelivery.push(item);
        } else {
          transit.push(item);
        }
      });

      if (transit.length > 0) setInTransitList(transit);
      if (outDelivery.length > 0) setOutForDeliveryList(outDelivery);
      if (deliv.length > 0) setDeliveredList(deliv);
    }
  }, [isReturnsReady, returnsList, inTransitList.length, outForDeliveryList.length, deliveredList.length]);
  const [searchQuery, setSearchQuery] = useState("");
  const [returnSearchQuery, setReturnSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "DELIVERED" | "RTO" | "CANCELLED">("all");
  const [returnStatusFilter, setReturnStatusFilter] = useState<"all" | "customer" | "rto" | "returned">("all");
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; msg: string } | null>(null);

  // CSV text parsing helper with column header resolver
  const parseCSVText = (text: string): MeeshoManualOrder[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    const parseCSVRow = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(v => v.replace(/^"|"$/g, ''));
    };

    const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
    
    const idxReason = headers.findIndex(h => h.includes("reason for credit") || h.includes("reason"));
    const idxSubOrder = headers.findIndex(h => h.includes("sub order no") || h.includes("sub_order_no") || h.includes("sub order"));
    const idxCatalog = headers.findIndex(h => h.includes("catalog"));
    const idxDate = headers.findIndex(h => h.includes("date"));
    const idxSource = headers.findIndex(h => h.includes("source"));
    const idxState = headers.findIndex(h => h.includes("state"));
    const idxProduct = headers.findIndex(h => h.includes("product"));
    const idxSku = headers.findIndex(h => h.includes("sku"));
    const idxSize = headers.findIndex(h => h.includes("size"));
    const idxQty = headers.findIndex(h => h.includes("quantity") || h.includes("qty"));
    const idxListedPrice = headers.findIndex(h => h.includes("listed price"));
    const idxDiscountedPrice = headers.findIndex(h => h.includes("discounted price"));
    const idxPacket = headers.findIndex(h => h.includes("packet id") || h.includes("packet_id"));

    const imported: MeeshoManualOrder[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVRow(lines[i]);
      if (row.length < headers.length) continue;

      const subOrderNo = idxSubOrder !== -1 ? row[idxSubOrder] : "";
      if (!subOrderNo) continue;

      const orderId = subOrderNo.split("_")[0];
      
      let rawDate = idxDate !== -1 ? row[idxDate] : "";
      // Convert dd/mm/yy to standard date if possible
      let orderDate = "";
      if (rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = parts[2].split(" ")[0];
          if (year.length === 2) year = "20" + year;
          orderDate = `${year}-${month}-${day}`;
        } else {
          orderDate = rawDate.split(" ")[0];
        }
      } else {
        orderDate = rawDate.split(" ")[0] || new Date().toISOString().split("T")[0];
      }

      const reason = idxReason !== -1 ? row[idxReason] : "DELIVERED";
      const productName = idxProduct !== -1 ? row[idxProduct] : "Meesho Product";
      const sku = idxSku !== -1 ? row[idxSku] : "SKU";
      const catalogId = idxCatalog !== -1 ? row[idxCatalog] : "N/A";
      const qty = idxQty !== -1 ? (parseInt(row[idxQty], 10) || 1) : 1;
      const size = idxSize !== -1 ? row[idxSize] : "Free Size";
      const source = idxSource !== -1 ? row[idxSource] : "organic";
      const state = idxState !== -1 ? row[idxState] : "N/A";
      const listedPrice = idxListedPrice !== -1 ? Math.round(parseFloat(row[idxListedPrice].replace(/[^\d.-]/g, "")) || 0) : 0;
      const discountedPrice = idxDiscountedPrice !== -1 ? Math.round(parseFloat(row[idxDiscountedPrice].replace(/[^\d.-]/g, "")) || 0) : 0;
      const packetId = idxPacket !== -1 ? row[idxPacket] : "N/A";

      let slaStatus: "Normal" | "Breaching Soon" | "Breached" = "Normal";
      if (reason === "CANCELLED") {
        slaStatus = "Breached";
      } else if (reason.includes("RTO") || reason === "DELIVERED") {
        slaStatus = "Normal";
      } else {
        slaStatus = "Breaching Soon";
      }

      imported.push({
        id: "ord_csv_" + subOrderNo + "_" + Date.now() + "_" + i,
        image: "https://images.unsplash.com/photo-1515488042361-404e9250afef?auto=format&fit=crop&w=300&q=80",
        productName,
        orderId,
        subOrderNo,
        sku,
        catalogId,
        qty,
        size,
        orderDate,
        slaStatus,
        reasonForCreditEntry: reason,
        orderSource: source,
        customerState: state,
        supplierListedPrice: listedPrice,
        supplierDiscountedPrice: discountedPrice,
        packetId: packetId
      });
    }
    return imported;
  };

  // Excel file parsing helper with dynamic header mapping
  const processExcelBuffer = async (buffer: ArrayBuffer, fileName: string): Promise<MeeshoManualOrder[]> => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const imported: MeeshoManualOrder[] = [];
    
    // Dynamically scan headers in Row 1
    const headerRow = sheet.getRow(1);
    const colMap: { [key: string]: number } = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value ? String(cell.value).toLowerCase().trim() : "";
      if (val.includes("reason for credit") || val.includes("reason")) colMap["reason"] = colNumber;
      else if (val.includes("sub order no") || val.includes("sub_order") || val.includes("sub order")) colMap["subOrder"] = colNumber;
      else if (val.includes("catalog")) colMap["catalog"] = colNumber;
      else if (val.includes("order date")) colMap["date"] = colNumber;
      else if (val.includes("order source") || val.includes("source")) colMap["source"] = colNumber;
      else if (val.includes("customer state") || val.includes("state")) colMap["state"] = colNumber;
      else if (val.includes("product name") || val.includes("product")) colMap["product"] = colNumber;
      else if (val.includes("sku")) colMap["sku"] = colNumber;
      else if (val.includes("size")) colMap["size"] = colNumber;
      else if (val.includes("quantity") || val.includes("qty")) colMap["qty"] = colNumber;
      else if (val.includes("listed price")) colMap["listedPrice"] = colNumber;
      else if (val.includes("discounted price")) colMap["discountedPrice"] = colNumber;
      else if (val.includes("packet id") || val.includes("packet_id") || val.includes("packet")) colMap["packetId"] = colNumber;
    });

    const getCol = (key: string, defIdx: number): number => colMap[key] || defIdx;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // Data starts on Row 2 (headers are on Row 1)
      if (rowNumber > 1) {
        const getValue = (colIdx: number): any => {
          const val = row.getCell(colIdx).value;
          if (val && typeof val === "object" && "result" in val) return val.result;
          return val;
        };

        const getString = (colIdx: number): string => {
          const val = getValue(colIdx);
          return val !== null && val !== undefined ? String(val).trim() : "";
        };

        const getInt = (colIdx: number): number => {
          const val = getValue(colIdx);
          if (typeof val === "number") return Math.round(val);
          const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ""));
          return isNaN(parsed) ? 0 : Math.round(parsed);
        };

        const subOrderNo = getString(getCol("subOrder", 2));
        if (!subOrderNo) return;

        const orderId = subOrderNo.split("_")[0];
        
        const orderDateVal = getValue(getCol("date", 4));
        let orderDate = "";
        if (orderDateVal instanceof Date) {
          orderDate = orderDateVal.toISOString().split("T")[0];
        } else if (orderDateVal) {
          const str = String(orderDateVal).split(" ")[0];
          if (str.includes("/")) {
            const parts = str.split("/");
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              let year = parts[2];
              if (year.length === 2) year = "20" + year;
              orderDate = `${year}-${month}-${day}`;
            } else {
              orderDate = str;
            }
          } else {
            orderDate = str;
          }
        } else {
          orderDate = new Date().toISOString().split("T")[0];
        }

        const reason = getString(getCol("reason", 1)) || "DELIVERED";
        const productName = getString(getCol("product", 7));
        const sku = getString(getCol("sku", 8)) || "SKU";
        const catalogId = getString(getCol("catalog", 3)) || "N/A";
        const qty = getInt(getCol("qty", 10)) || 1;
        const size = getString(getCol("size", 9)) || "Free Size";
        const source = getString(getCol("source", 5)) || "organic";
        const state = getString(getCol("state", 6)) || "N/A";
        const listedPrice = getInt(getCol("listedPrice", 11));
        const discountedPrice = getInt(getCol("discountedPrice", 12));
        const packetId = getString(getCol("packetId", 13));

        let slaStatus: "Normal" | "Breaching Soon" | "Breached" = "Normal";
        if (reason === "CANCELLED") {
          slaStatus = "Breached";
        } else if (reason.includes("RTO") || reason === "DELIVERED") {
          slaStatus = "Normal";
        } else {
          slaStatus = "Breaching Soon";
        }

        imported.push({
          id: `ord_xlsx_${orderId}_${rowNumber}_${Date.now()}`,
          image: "https://images.unsplash.com/photo-1515488042361-404e9250afef?auto=format&fit=crop&w=300&q=80",
          productName,
          orderId,
          subOrderNo,
          sku,
          catalogId,
          qty,
          size,
          orderDate,
          slaStatus,
          reasonForCreditEntry: reason,
          orderSource: source,
          customerState: state,
          supplierListedPrice: listedPrice,
          supplierDiscountedPrice: discountedPrice,
          packetId: packetId
        });
      }
    });

    return imported;
  };

  // Process Return CSV text
  const parseReturnsCSVText = (text: string): MeeshoReturn[] => {
    const lines = text.split(/\r?\n/);
    let headerRowIdx = -1;
    const parsedRows: string[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cells: string[] = [];
      let currentCell = "";
      let insideQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          cells.push(currentCell.trim());
          currentCell = "";
        } else {
          currentCell += char;
        }
      }
      cells.push(currentCell.trim());
      parsedRows.push(cells);
    }
    
    let colMap: { [key: string]: number } = {};
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      let hasSNo = false;
      let hasSubOrder = false;
      row.forEach(cell => {
        const val = cell.toLowerCase().trim();
        if (val.includes("s no") || val === "s.no" || val === "sno") hasSNo = true;
        if (val.includes("suborder") || val.includes("sub-order") || val.includes("sub order")) hasSubOrder = true;
      });
      
      if (hasSNo && hasSubOrder) {
        headerRowIdx = i;
        row.forEach((cell, idx) => {
          const val = cell.toLowerCase().trim();
          if (val.includes("s no") || val === "s.no" || val === "sno") colMap["sNo"] = idx;
          else if (val.includes("product name") || val.includes("product")) colMap["productName"] = idx;
          else if (val.includes("sku")) colMap["sku"] = idx;
          else if (val.includes("variation") || val.includes("size")) colMap["variation"] = idx;
          else if (val.includes("pid") || val.includes("meesho pid")) colMap["meeshoPid"] = idx;
          else if (val.includes("category")) colMap["category"] = idx;
          else if (val.includes("qty") || val.includes("quantity")) colMap["qty"] = idx;
          else if (val.includes("suborder number") || val.includes("suborder")) colMap["suborderNumber"] = idx;
          else if (val.includes("order number")) colMap["orderNumber"] = idx;
          else if (val.includes("dispatch date")) colMap["dispatchDate"] = idx;
          else if (val.includes("return created")) colMap["returnCreatedDate"] = idx;
          else if (val.includes("type of return") || val.includes("return type")) colMap["typeOfReturn"] = idx;
          else if (val.includes("sub type")) colMap["subType"] = idx;
          else if (val.includes("expected delivery")) colMap["expectedDeliveryDate"] = idx;
          else if (val.includes("courier partner") || val.includes("courier")) colMap["courierPartner"] = idx;
          else if (val.includes("awb number") || val.includes("awb")) colMap["awbNumber"] = idx;
          else if (val.includes("status")) colMap["status"] = idx;
          else if (val.includes("attempt")) colMap["attempt"] = idx;
          else if (val.includes("tracking link") || val.includes("tracking")) colMap["trackingLink"] = idx;
          else if (val.includes("price type")) colMap["returnPriceType"] = idx;
          else if (val.includes("detailed return")) colMap["detailedReturnReason"] = idx;
          else if (val.includes("return reason")) colMap["returnReason"] = idx;
          else if (val.includes("delivered date")) colMap["deliveredDate"] = idx;
          else if (val.includes("proof of delivery") || val.includes("proof")) colMap["proofOfDelivery"] = idx;
          else if (val.includes("otp verified")) colMap["otpVerifiedAt"] = idx;
        });
        break;
      }
    }
    
    const newReturns: MeeshoReturn[] = [];
    if (headerRowIdx !== -1) {
      for (let i = headerRowIdx + 1; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const getVal = (colKey: string): string => {
          const colIdx = colMap[colKey];
          if (colIdx === undefined || colIdx >= row.length) return "";
          return row[colIdx];
        };
        
        const suborderNumber = getVal("suborderNumber");
        if (!suborderNumber) continue;
        
        const qtyVal = parseInt(getVal("qty"), 10) || 1;
        
        newReturns.push({
          id: `ret_${suborderNumber}`,
          sNo: getVal("sNo"),
          productName: getVal("productName"),
          sku: getVal("sku"),
          variation: getVal("variation"),
          meeshoPid: getVal("meeshoPid"),
          category: getVal("category"),
          qty: qtyVal,
          orderNumber: getVal("orderNumber"),
          suborderNumber,
          dispatchDate: getVal("dispatchDate"),
          returnCreatedDate: getVal("returnCreatedDate"),
          typeOfReturn: getVal("typeOfReturn"),
          subType: getVal("subType"),
          expectedDeliveryDate: getVal("expectedDeliveryDate"),
          courierPartner: getVal("courierPartner"),
          awbNumber: getVal("awbNumber"),
          status: getVal("status") || "Delivered",
          attempt: getVal("attempt"),
          trackingLink: getVal("trackingLink"),
          returnPriceType: getVal("returnPriceType"),
          returnReason: getVal("returnReason"),
          detailedReturnReason: getVal("detailedReturnReason"),
          deliveredDate: getVal("deliveredDate"),
          proofOfDelivery: getVal("proofOfDelivery"),
          otpVerifiedAt: getVal("otpVerifiedAt")
        });
      }
    }
    return newReturns;
  };

  // Process Return XLSX buffer
  const processReturnsExcelBuffer = async (buffer: ArrayBuffer, filename: string): Promise<MeeshoReturn[]> => {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    if (!worksheet) return [];

    let headerRowIdx = -1;
    let colMap: { [key: string]: number } = {};

    worksheet.eachRow((row, rowNumber) => {
      if (headerRowIdx !== -1) return;
      let hasSNo = false;
      let hasSubOrder = false;
      
      row.eachCell((cell) => {
        const val = String(cell.value || "").toLowerCase().trim();
        if (val.includes("s no") || val === "s.no" || val === "sno") hasSNo = true;
        if (val.includes("suborder") || val.includes("sub-order") || val.includes("sub order")) hasSubOrder = true;
      });
      
      if (hasSNo && hasSubOrder) {
        headerRowIdx = rowNumber;
        row.eachCell((cell, colNumber) => {
          const val = String(cell.value || "").toLowerCase().trim();
          if (val.includes("s no") || val === "s.no" || val === "sno") colMap["sNo"] = colNumber;
          else if (val.includes("product name") || val.includes("product")) colMap["productName"] = colNumber;
          else if (val.includes("sku")) colMap["sku"] = colNumber;
          else if (val.includes("variation") || val.includes("size")) colMap["variation"] = colNumber;
          else if (val.includes("pid") || val.includes("meesho pid")) colMap["meeshoPid"] = colNumber;
          else if (val.includes("category")) colMap["category"] = colNumber;
          else if (val.includes("qty") || val.includes("quantity")) colMap["qty"] = colNumber;
          else if (val.includes("suborder number") || val.includes("suborder")) colMap["suborderNumber"] = colNumber;
          else if (val.includes("order number")) colMap["orderNumber"] = colNumber;
          else if (val.includes("dispatch date")) colMap["dispatchDate"] = colNumber;
          else if (val.includes("return created")) colMap["returnCreatedDate"] = colNumber;
          else if (val.includes("type of return") || val.includes("return type")) colMap["typeOfReturn"] = colNumber;
          else if (val.includes("sub type")) colMap["subType"] = colNumber;
          else if (val.includes("expected delivery")) colMap["expectedDeliveryDate"] = colNumber;
          else if (val.includes("courier partner") || val.includes("courier")) colMap["courierPartner"] = colNumber;
          else if (val.includes("awb number") || val.includes("awb")) colMap["awbNumber"] = colNumber;
          else if (val.includes("status")) colMap["status"] = colNumber;
          else if (val.includes("attempt")) colMap["attempt"] = colNumber;
          else if (val.includes("tracking link") || val.includes("tracking")) colMap["trackingLink"] = colNumber;
          else if (val.includes("price type")) colMap["returnPriceType"] = colNumber;
          else if (val.includes("detailed return")) colMap["detailedReturnReason"] = colNumber;
          else if (val.includes("return reason")) colMap["returnReason"] = colNumber;
          else if (val.includes("delivered date")) colMap["deliveredDate"] = colNumber;
          else if (val.includes("proof of delivery") || val.includes("proof")) colMap["proofOfDelivery"] = colNumber;
          else if (val.includes("otp verified")) colMap["otpVerifiedAt"] = colNumber;
        });
      }
    });

    const newReturns: MeeshoReturn[] = [];
    if (headerRowIdx !== -1) {
      for (let rIdx = headerRowIdx + 1; rIdx <= worksheet.rowCount; rIdx++) {
        const row = worksheet.getRow(rIdx);
        
        const getVal = (colKey: string): string => {
          const colIdx = colMap[colKey];
          if (!colIdx) return "";
          const cell = row.getCell(colIdx);
          const cellVal = cell.value;
          if (cellVal && typeof cellVal === "object") {
            if ("result" in cellVal) return String(cellVal.result).trim();
            if ("text" in cellVal) return String(cellVal.text).trim();
          }
          return cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : "";
        };
        
        const suborderNumber = getVal("suborderNumber");
        if (!suborderNumber) continue;
        
        const qtyVal = parseInt(getVal("qty"), 10) || 1;
        
        newReturns.push({
          id: `ret_${suborderNumber}`,
          sNo: getVal("sNo"),
          productName: getVal("productName"),
          sku: getVal("sku"),
          variation: getVal("variation"),
          meeshoPid: getVal("meeshoPid"),
          category: getVal("category"),
          qty: qtyVal,
          orderNumber: getVal("orderNumber"),
          suborderNumber,
          dispatchDate: getVal("dispatchDate"),
          returnCreatedDate: getVal("returnCreatedDate"),
          typeOfReturn: getVal("typeOfReturn"),
          subType: getVal("subType"),
          expectedDeliveryDate: getVal("expectedDeliveryDate"),
          courierPartner: getVal("courierPartner"),
          awbNumber: getVal("awbNumber"),
          status: getVal("status") || "Delivered",
          attempt: getVal("attempt"),
          trackingLink: getVal("trackingLink"),
          returnPriceType: getVal("returnPriceType"),
          returnReason: getVal("returnReason"),
          detailedReturnReason: getVal("detailedReturnReason"),
          deliveredDate: getVal("deliveredDate"),
          proofOfDelivery: getVal("proofOfDelivery"),
          otpVerifiedAt: getVal("otpVerifiedAt")
        });
      }
    }
    return newReturns;
  };


  // Uploader Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv = file.name.endsWith(".csv");

    if (!isCsv && !isXlsx) {
      setFeedback({ status: "error", msg: "Invalid file format. Please upload a CSV or XLSX file." });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    if (activeTab === "return") {
      try {
        if (isXlsx) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const buffer = event.target?.result as ArrayBuffer;
            if (buffer) {
              try {
                const newReturns = await processReturnsExcelBuffer(buffer, file.name);
                if (newReturns.length > 0) {
                  const existing =
                    returnSubTab === "in-transit" ? inTransitList :
                    returnSubTab === "out-for-delivery" ? outForDeliveryList :
                    deliveredList;
                  const merged = [...existing];
                  let addedCount = 0;
                  let updatedCount = 0;
                  
                  newReturns.forEach(nr => {
                    const idx = merged.findIndex(er => er.suborderNumber === nr.suborderNumber);
                    if (idx !== -1) {
                      merged[idx] = nr;
                      updatedCount++;
                    } else {
                      merged.unshift(nr);
                      addedCount++;
                    }
                  });
                  
                  if (returnSubTab === "in-transit") {
                    setInTransitList(merged);
                  } else if (returnSubTab === "out-for-delivery") {
                    setOutForDeliveryList(merged);
                  } else {
                    setDeliveredList(merged);
                  }
                  setFeedback({
                    status: "success",
                    msg: `Import completed! Successfully parsed ${newReturns.length} returns from Excel. Added ${addedCount} new records, updated ${updatedCount} existing records.`
                  });
                } else {
                  setFeedback({ status: "error", msg: "Could not find any return rows inside Sheet 1. Make sure headers are on Row 8." });
                }
              } catch (err: any) {
                setFeedback({ status: "error", msg: `Error reading Excel workbook: ${err.message || err}` });
              }
            }
            setIsLoading(false);
          };
          reader.readAsArrayBuffer(file);
        } else {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const text = event.target?.result as string;
            if (text) {
              try {
                const newReturns = parseReturnsCSVText(text);
                if (newReturns.length > 0) {
                  const existing =
                    returnSubTab === "in-transit" ? inTransitList :
                    returnSubTab === "out-for-delivery" ? outForDeliveryList :
                    deliveredList;
                  const merged = [...existing];
                  let addedCount = 0;
                  let updatedCount = 0;
                  
                  newReturns.forEach(nr => {
                    const idx = merged.findIndex(er => er.suborderNumber === nr.suborderNumber);
                    if (idx !== -1) {
                      merged[idx] = nr;
                      updatedCount++;
                    } else {
                      merged.unshift(nr);
                      addedCount++;
                    }
                  });
                  
                  if (returnSubTab === "in-transit") {
                    setInTransitList(merged);
                  } else if (returnSubTab === "out-for-delivery") {
                    setOutForDeliveryList(merged);
                  } else {
                    setDeliveredList(merged);
                  }
                  setFeedback({
                    status: "success",
                    msg: `Import completed! Successfully parsed ${newReturns.length} returns from CSV. Added ${addedCount} new records, updated ${updatedCount} existing records.`
                  });
                } else {
                  setFeedback({ status: "error", msg: "No valid return records found in CSV file." });
                }
              } catch (err: any) {
                setFeedback({ status: "error", msg: `Error reading CSV file: ${err.message || err}` });
              }
            }
            setIsLoading(false);
          };
          reader.readAsText(file);
        }
      } catch (e) {
        setFeedback({ status: "error", msg: "Failed to process returns file." });
        setIsLoading(false);
      }
      return;
    }

    try {
      if (isXlsx) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const buffer = event.target?.result as ArrayBuffer;
          if (buffer) {
            try {
              const newOrders = await processExcelBuffer(buffer, file.name);
              if (newOrders.length > 0) {
                const existing = orders;
                const merged = [...existing];
                let addedCount = 0;
                let updatedCount = 0;
                
                newOrders.forEach(no => {
                  const idx = merged.findIndex(eo => eo.subOrderNo === no.subOrderNo);
                  if (idx !== -1) {
                    merged[idx] = no;
                    updatedCount++;
                  } else {
                    merged.unshift(no);
                    addedCount++;
                  }
                });
                
                setOrders(merged);
                setFeedback({
                  status: "success",
                  msg: `Import completed! Successfully parsed ${newOrders.length} orders from Excel. Added ${addedCount} new records, updated ${updatedCount} existing records.`
                });
              } else {
                setFeedback({ status: "error", msg: "Could not find any order rows inside Sheet 1." });
              }
            } catch (err: any) {
              setFeedback({ status: "error", msg: `Error reading Excel workbook: ${err.message || err}` });
            }
          }
          setIsLoading(false);
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const text = event.target?.result as string;
          if (text) {
            try {
              const newOrders = parseCSVText(text);
              if (newOrders.length > 0) {
                const existing = orders;
                const merged = [...existing];
                let addedCount = 0;
                let updatedCount = 0;
                
                newOrders.forEach(no => {
                  const idx = merged.findIndex(eo => eo.subOrderNo === no.subOrderNo);
                  if (idx !== -1) {
                    merged[idx] = no;
                    updatedCount++;
                  } else {
                    merged.unshift(no);
                    addedCount++;
                  }
                });
                
                setOrders(merged);
                setFeedback({
                  status: "success",
                  msg: `Import completed! Successfully parsed ${newOrders.length} orders from CSV. Added ${addedCount} new records, updated ${updatedCount} existing records.`
                });
              } else {
                setFeedback({ status: "error", msg: "No valid order records found in CSV file." });
              }
            } catch (err: any) {
              setFeedback({ status: "error", msg: `Error reading CSV file: ${err.message || err}` });
            }
          }
          setIsLoading(false);
        };
        reader.readAsText(file);
      }
    } catch (e) {
      setFeedback({ status: "error", msg: "Failed to process the uploaded file." });
      setIsLoading(false);
    }
  };

  const clearAllOrders = () => {
    if (confirm("Are you sure you want to delete all Meesho order data from the ledger and cloud database?")) {
      setOrders([]);
      setFeedback({ status: "success", msg: "All orders cleared successfully." });
    }
  };

  const clearAllReturns = () => {
    const subTabName =
      returnSubTab === "in-transit" ? "In Transit" :
      returnSubTab === "out-for-delivery" ? "Out for Delivery" :
      "Delivered";
    if (confirm(`Are you sure you want to delete all Meesho returns data for "${subTabName}" from the ledger and cloud database?`)) {
      if (returnSubTab === "in-transit") {
        setInTransitList([]);
      } else if (returnSubTab === "out-for-delivery") {
        setOutForDeliveryList([]);
      } else {
        setDeliveredList([]);
      }
      setFeedback({ status: "success", msg: `All returns for "${subTabName}" cleared successfully.` });
    }
  };

  // Metric computations
  const totalOrders = orders.length;
  const deliveredCount = orders.filter(o => o.reasonForCreditEntry === "DELIVERED").length;
  const rtoCount = orders.filter(o => o.reasonForCreditEntry === "RTO_COMPLETE" || o.reasonForCreditEntry.includes("RTO")).length;
  const cancelledCount = orders.filter(o => o.reasonForCreditEntry === "CANCELLED").length;

  // Returns computations
  const currentReturnsList =
    returnSubTab === "in-transit" ? inTransitList :
    returnSubTab === "out-for-delivery" ? outForDeliveryList :
    deliveredList;

  const totalReturns = currentReturnsList.length;
  const customerReturnsCount = currentReturnsList.filter(r => r.typeOfReturn === "Customer Return").length;
  const rtoReturnsCount = currentReturnsList.filter(r => r.typeOfReturn === "Courier Return (RTO)" || r.typeOfReturn.includes("RTO")).length;
  const completedReturnsCount = currentReturnsList.filter(r => r.status === "Returned" || r.status === "Delivered").length;

  // Export CSV
  const exportToCSV = () => {
    if (orders.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = ["Reason for Credit Entry", "Sub Order No", "Catalog ID", "Order Date", "Order source", "Customer State", "Product Name", "SKU", "Size", "Quantity", "Supplier Listed Price", "Supplier Discounted Price", "Packet Id"];
    const rows = orders.map(o => [
      o.reasonForCreditEntry,
      o.subOrderNo,
      o.catalogId,
      o.orderDate,
      o.orderSource,
      o.customerState,
      o.productName,
      o.sku,
      o.size,
      String(o.qty),
      String(o.supplierListedPrice),
      String(o.supplierDiscountedPrice),
      o.packetId
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `meesho_orders_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const exportToPDF = () => {
    if (orders.length === 0) {
      alert("No data available to print.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export PDF.");
      return;
    }

    const headersHtml = ["Sub Order No", "Product Details", "SKU / Catalog", "Location / Source", "Price Details", "Status"].map(h => `
      <th style="padding: 10px; background: #000000; color: #ffffff; text-align: left; font-size: 10px; font-weight: 700; border-bottom: 2px solid #ddd;">${h}</th>
    `).join("");

    const rowsHtml = orders.map(o => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #1e293b;">
          <strong>Sub No:</strong> ${o.subOrderNo}<br/>
          <span style="color:#64748b; font-size: 9px;">PID: ${o.packetId}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #1e293b; max-width: 250px;">
          ${o.productName}<br/>
          <span style="color:#64748b; font-size: 9px;">Size: ${o.size} | Qty: ${o.qty}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #334155;">
          <strong>SKU:</strong> ${o.sku}<br/>
          <span style="color:#64748b; font-size: 9px;">Cat: ${o.catalogId}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #334155;">
          <strong>State:</strong> ${o.customerState}<br/>
          <span style="color:#64748b; font-size: 9px;">Src: ${o.orderSource}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #334155;">
          <strong>Listed:</strong> ₹${o.supplierListedPrice}<br/>
          <span style="color:#64748b; font-size: 9px;">Discount: ₹${o.supplierDiscountedPrice}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 800;">
          <span style="
            padding: 2px 8px; 
            border-radius: 20px;
            background: ${o.reasonForCreditEntry === 'DELIVERED' ? '#f0fdf4' : o.reasonForCreditEntry === 'CANCELLED' ? '#fef2f2' : '#fff7ed'};
            color: ${o.reasonForCreditEntry === 'DELIVERED' ? '#16a34a' : o.reasonForCreditEntry === 'CANCELLED' ? '#ef4444' : '#f97316'};
          ">
            ${o.reasonForCreditEntry}
          </span>
        </td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Meesho Dispatch Ledger</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #ffffff; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            h1 { font-size: 20px; font-weight: 800; color: #000; margin: 0 0 4px 0; }
            p { font-size: 11px; color: #64748b; margin: 0 0 20px 0; }
            .print-btn { background: #000; color: white; border: none; padding: 8px 16px; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }
            @media print { .print-btn { display: none; } }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
          <h1>Meesho Dispatch Ledger</h1>
          <p>Generated: ${new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' })} | Active records: ${orders.length}</p>
          <table>
            <thead><tr>${headersHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Download Sample CSV Template matching exactly Row 1 columns
  const downloadSampleCSV = () => {
    const headers = ["Reason for Credit Entry", "Sub Order No", "Catalog ID", "Order Date", "Order source", "Customer State", "Product Name", "SKU", "Size", "Quantity", "Supplier Listed Price (Incl. GST + Commission)", "Supplier Discounted Price (Incl GST and Commision)", "Packet Id"];
    const rows = [
      ["DELIVERED", "281563483236968896_1", "463114673", "01/05/26", "", "Gujarat", "Baby Boys & Girls Soft Cotton Sleeveless Jhabla & Shorts Set for New Born Infant Toddler Kids | Combo Pack of 2 | 0-12 Months", "KK-BABY-COORD-02", "0-3 Months", "1", "281", "281", "OG01OGM01344192"],
      ["RTO_COMPLETE", "281683081219254725_1", "468042994", "01/05/26", "", "Andhra Pradesh", "Baby Girls Muslin Cotton Sleeveless Frock | Cute Dino Print Dress for Newborn Baby | Soft Breathable Infant Dress 0-12 Months", "KK-BABY-FROCK-CAR", "6-12 Months", "1", "199", "199", "OG01OGM01344184"],
      ["CANCELLED", "281776018702895936_1", "468042994", "01/05/26", "Ad order", "Andhra Pradesh", "Baby Girls Muslin Cotton Sleeveless Frock", "KK-BABY-FROCK-CAR", "6-12 Months", "1", "199", "199", "OG01OGM01313099"]
    ];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sample_meesho_orders_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample Excel Template
  const downloadSampleExcel = () => {
    const headers = ["Reason for Credit Entry", "Sub Order No", "Catalog ID", "Order Date", "Order source", "Customer State", "Product Name", "SKU", "Size", "Quantity", "Supplier Listed Price (Incl. GST + Commission)", "Supplier Discounted Price (Incl GST and Commision)", "Packet Id"];
    const rows = [
      ["DELIVERED", "281563483236968896_1", "463114673", "01/05/26", "", "Gujarat", "Baby Boys & Girls Soft Cotton Sleeveless Jhabla & Shorts Set for New Born Infant Toddler Kids | Combo Pack of 2 | 0-12 Months", "KK-BABY-COORD-02", "0-3 Months", "1", "281", "281", "OG01OGM01344192"],
      ["RTO_COMPLETE", "281683081219254725_1", "468042994", "01/05/26", "", "Andhra Pradesh", "Baby Girls Muslin Cotton Sleeveless Frock | Cute Dino Print Dress for Newborn Baby | Soft Breathable Infant Dress 0-12 Months", "KK-BABY-FROCK-CAR", "6-12 Months", "1", "199", "199", "OG01OGM01344184"],
      ["CANCELLED", "281776018702895936_1", "468042994", "01/05/26", "Ad order", "Andhra Pradesh", "Baby Girls Muslin Cotton Sleeveless Frock", "KK-BABY-FROCK-CAR", "6-12 Months", "1", "199", "199", "OG01OGM01313099"]
    ];
    const content = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
    const encodedUri = "data:application/vnd.ms-excel;charset=utf-8,\uFEFF" + encodeURIComponent(content);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `meesho_orders_file_sample.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered orders list based on status filter and search query (matches by Sub Order ID only)
  const filteredOrders = orders.filter(ord => {
    // 1. Status Filter
    if (statusFilter === "DELIVERED" && ord.reasonForCreditEntry !== "DELIVERED") return false;
    if (statusFilter === "RTO" && ord.reasonForCreditEntry !== "RTO_COMPLETE" && !ord.reasonForCreditEntry.includes("RTO")) return false;
    if (statusFilter === "CANCELLED" && ord.reasonForCreditEntry !== "CANCELLED") return false;

    // 2. Search Query
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return ord.subOrderNo.toLowerCase().includes(q);
  });

  // Filtered returns list
  const filteredReturns = currentReturnsList.filter(ret => {
    // 1. Status Filter
    if (returnStatusFilter === "customer" && ret.typeOfReturn !== "Customer Return") return false;
    if (returnStatusFilter === "rto" && ret.typeOfReturn !== "Courier Return (RTO)" && !ret.typeOfReturn.includes("RTO")) return false;
    if (returnStatusFilter === "returned" && ret.status !== "Returned" && ret.status !== "Delivered") return false;

    // 2. Search Query
    const q = returnSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return ret.suborderNumber.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: "24px 30px", background: isDark ? "#09090b" : "#fcfcfc", minHeight: "100vh", transition: "background 0.2s" }}>
      {/* Top Banner / Heading */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: isDark ? "#f8fafc" : "#111", letterSpacing: "-0.03em" }}>Meesho Console</h1>
          <p style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#666", marginTop: 2 }}>
            {activeTab === "return" 
              ? "Log, track, and reconcile customer and RTO package returns verbatim"
              : "Log, track, and dispatch manual customer packages verbatim"}
          </p>
        </div>
        
        {/* Action Controls */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="file"
            id="meesho-orders-upload"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            onClick={() => document.getElementById("meesho-orders-upload")?.click()}
            style={{
              background: isDark ? "#ffffff" : "#000000",
              color: isDark ? "#09090b" : "white",
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              fontSize: 12,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? "#f1f5f9" : "#1f1f1f";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark ? "#ffffff" : "#000000";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <Upload size={14} />
            {isLoading 
              ? "Ingesting..." 
              : activeTab === "return" 
                ? `Upload ${returnSubTab === "in-transit" ? "In Transit" : returnSubTab === "out-for-delivery" ? "Out for Delivery" : "Delivered"} Excel/CSV` 
                : "Upload Excel/CSV"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", paddingBottom: 10, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("dispatch")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "dispatch" ? (isDark ? "2px solid #ffffff" : "2px solid #000000") : "2px solid transparent",
            color: activeTab === "dispatch" ? (isDark ? "#ffffff" : "#000000") : "#64748b",
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Forward Dispatch
        </button>
        <button
          onClick={() => setActiveTab("return")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "return" ? (isDark ? "2px solid #ffffff" : "2px solid #000000") : "2px solid transparent",
            color: activeTab === "return" ? (isDark ? "#ffffff" : "#000000") : "#64748b",
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Customer Returns
        </button>
      </div>

      {/* Return Sub-Tabs */}
      {activeTab === "return" && (
        <div style={{
          display: "flex",
          gap: 16,
          borderBottom: isDark ? "1px solid #27272a" : "1px solid #e2e8f0",
          paddingBottom: 0,
          marginBottom: 24,
          alignItems: "center"
        }}>
          {[
            { id: "in-transit", label: "In transit" },
            { id: "out-for-delivery", label: "Out for Delivery" },
            { id: "delivered", label: "Delivered" }
          ].map((subTab) => {
            const isActive = returnSubTab === subTab.id;
            return (
              <button
                key={subTab.id}
                onClick={() => setReturnSubTab(subTab.id as any)}
                style={{
                  background: isActive ? (isDark ? "#18181b" : "#ffffff") : "transparent",
                  border: isActive ? (isDark ? "1px solid #27272a" : "1px solid #cbd5e1") : "1px solid transparent",
                  borderBottom: isActive ? (isDark ? "1px solid #18181b" : "1px solid #ffffff") : "1px solid transparent",
                  borderRadius: "12px 12px 0 0",
                  color: isActive ? (isDark ? "#a78bfa" : "#4f46e5") : (isDark ? "#71717a" : "#64748b"),
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 550,
                  cursor: "pointer",
                  marginBottom: -1,
                  position: "relative",
                  zIndex: isActive ? 1 : 0,
                  transition: "all 0.15s"
                }}
              >
                {subTab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 24,
            padding: "12px 16px",
            borderRadius: 14,
            background: feedback.status === "success" 
              ? (isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4")
              : (isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2"),
            border: feedback.status === "success" 
              ? (isDark ? "1px solid rgba(22, 163, 74, 0.3)" : "1px solid #dcfce7")
              : (isDark ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid #fee2e2"),
            color: feedback.status === "success" 
              ? (isDark ? "#4ade80" : "#16a34a")
              : (isDark ? "#f87171" : "#ef4444"),
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.01)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={14} />
            <span>{feedback.msg}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <X size={12} />
          </button>
        </motion.div>
      )}

      {/* Dispatch Metrics Bar */}
      {activeTab === "dispatch" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* Metric 1: Total Orders */}
          <div
            onClick={() => setStatusFilter("all")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: statusFilter === "all" 
                ? (isDark ? "1.5px solid #94a3b8" : "1.5px solid #64748b")
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: statusFilter === "all" ? "0 4px 12px rgba(100,116,139,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: statusFilter === "all" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (statusFilter !== "all") e.currentTarget.style.borderColor = isDark ? "#52525b" : "#94a3b8";
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== "all") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "#27272a" : "#f1f5f9", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Orders</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: isDark ? "#ffffff" : "#111", marginTop: 2 }}>{totalOrders}</div>
            </div>
          </div>

          {/* Metric 2: Delivered */}
          <div
            onClick={() => setStatusFilter("DELIVERED")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: statusFilter === "DELIVERED"
                ? "1.5px solid #16a34a"
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: statusFilter === "DELIVERED" ? "0 4px 12px rgba(22,163,74,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: statusFilter === "DELIVERED" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (statusFilter !== "DELIVERED") e.currentTarget.style.borderColor = isDark ? "#16a34a" : "#86efac";
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== "DELIVERED") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Delivered</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a", marginTop: 2 }}>{deliveredCount}</div>
            </div>
          </div>

          {/* Metric 3: RTO / Returned */}
          <div
            onClick={() => setStatusFilter("RTO")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: statusFilter === "RTO"
                ? "1.5px solid #ea580c"
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: statusFilter === "RTO" ? "0 4px 12px rgba(234,88,12,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: statusFilter === "RTO" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (statusFilter !== "RTO") e.currentTarget.style.borderColor = isDark ? "#ea580c" : "#fdba74";
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== "RTO") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "rgba(234, 88, 12, 0.1)" : "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>RTO / Returned</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#ea580c", marginTop: 2 }}>{rtoCount}</div>
            </div>
          </div>

          {/* Metric 4: Cancelled */}
          <div
            onClick={() => setStatusFilter("CANCELLED")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: statusFilter === "CANCELLED"
                ? "1.5px solid #ef4444"
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: statusFilter === "CANCELLED" ? "0 4px 12px rgba(239,68,68,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: statusFilter === "CANCELLED" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (statusFilter !== "CANCELLED") e.currentTarget.style.borderColor = isDark ? "#ef4444" : "#fca5a5";
            }}
            onMouseLeave={(e) => {
              if (statusFilter !== "CANCELLED") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cancelled</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#ef4444", marginTop: 2 }}>{cancelledCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Return Metrics Bar */}
      {activeTab === "return" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* Metric 1: Total Returns */}
          <div
            onClick={() => setReturnStatusFilter("all")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: returnStatusFilter === "all"
                ? (isDark ? "1.5px solid #94a3b8" : "1.5px solid #64748b")
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: returnStatusFilter === "all" ? "0 4px 12px rgba(100,116,139,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: returnStatusFilter === "all" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (returnStatusFilter !== "all") e.currentTarget.style.borderColor = isDark ? "#52525b" : "#94a3b8";
            }}
            onMouseLeave={(e) => {
              if (returnStatusFilter !== "all") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "#27272a" : "#f1f5f9", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Returns</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: isDark ? "#ffffff" : "#111", marginTop: 2 }}>{totalReturns}</div>
            </div>
          </div>

          {/* Metric 2: Customer Returns */}
          <div
            onClick={() => setReturnStatusFilter("customer")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: returnStatusFilter === "customer"
                ? "1.5px solid #3b82f6"
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: returnStatusFilter === "customer" ? "0 4px 12px rgba(59,130,246,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: returnStatusFilter === "customer" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (returnStatusFilter !== "customer") e.currentTarget.style.borderColor = isDark ? "#3b82f6" : "#93c5fd";
            }}
            onMouseLeave={(e) => {
              if (returnStatusFilter !== "customer") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "rgba(59, 130, 246, 0.1)" : "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer Returns</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#3b82f6", marginTop: 2 }}>{customerReturnsCount}</div>
            </div>
          </div>

          {/* Metric 3: RTO Returns */}
          <div
            onClick={() => setReturnStatusFilter("rto")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: returnStatusFilter === "rto"
                ? "1.5px solid #f97316"
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: returnStatusFilter === "rto" ? "0 4px 12px rgba(249,115,22,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: returnStatusFilter === "rto" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (returnStatusFilter !== "rto") e.currentTarget.style.borderColor = isDark ? "#f97316" : "#fdba74";
            }}
            onMouseLeave={(e) => {
              if (returnStatusFilter !== "rto") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "rgba(249, 115, 22, 0.1)" : "#fff7ed", color: "#f97316", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>RTO Returns</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f97316", marginTop: 2 }}>{rtoReturnsCount}</div>
            </div>
          </div>

          {/* Metric 4: Returned (Completed) */}
          <div
            onClick={() => setReturnStatusFilter("returned")}
            style={{
              background: isDark ? "#18181b" : "white",
              border: returnStatusFilter === "returned"
                ? "1.5px solid #16a34a"
                : (isDark ? "1.5px solid #27272a" : "1.5px solid #eef2f6"),
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: returnStatusFilter === "returned" ? "0 4px 12px rgba(22,163,74,0.08)" : "0 2px 8px rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "all 0.2s",
              transform: returnStatusFilter === "returned" ? "scale(1.02)" : "scale(1)"
            }}
            onMouseEnter={(e) => {
              if (returnStatusFilter !== "returned") e.currentTarget.style.borderColor = isDark ? "#16a34a" : "#86efac";
            }}
            onMouseLeave={(e) => {
              if (returnStatusFilter !== "returned") e.currentTarget.style.borderColor = isDark ? "#27272a" : "#eef2f6";
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#71717a" : "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Returned (Completed)</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a", marginTop: 2 }}>{completedReturnsCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Ledger Board */}
      {activeTab === "dispatch" && (
        <div style={{ background: isDark ? "#18181b" : "white", border: isDark ? "1px solid #27272a" : "1px solid #eef2f6", borderRadius: 20, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.01)", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#111", margin: 0 }}>
              Live Dispatch Ledger {searchQuery ? `(${filteredOrders.length} matching of ${orders.length} sub-orders)` : `(${orders.length} sub-orders)`}
            </h3>
            {orders.length > 0 && (
              <button
                onClick={clearAllOrders}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                Delete All Data
              </button>
            )}
          </div>

          {/* Search Input Bar */}
          {orders.length > 0 && (
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: isDark ? "#52525b" : "#64748b" }} />
              <input
                type="text"
                placeholder="Search by Sub Order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  fontSize: 11,
                  borderRadius: 12,
                  border: isDark ? "1px solid #27272a" : "1px solid #cbd5e1",
                  background: isDark ? "#09090b" : "white",
                  color: isDark ? "#ffffff" : "#000000",
                  outline: "none",
                  transition: "all 0.2s"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "#ffffff" : "#000000";
                  e.currentTarget.style.boxShadow = isDark ? "0 0 0 2px rgba(255, 255, 255, 0.1)" : "0 0 0 2px rgba(0, 0, 0, 0.05)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "#27272a" : "#cbd5e1";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          )}
          
          {orders.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#aaa" }}>
              <Package size={32} style={{ margin: "0 auto 10px", color: isDark ? "#52525b" : "#ccc" }} />
              <span style={{ fontSize: 12 }}>No logged packages. Drag and drop your orders file above to begin seeding.</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#aaa" }}>
              <Search size={32} style={{ margin: "0 auto 10px", color: isDark ? "#52525b" : "#ccc" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#f8fafc" : "#1e293b", marginTop: 8 }}>No matching records found</div>
              <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b", marginTop: 4, display: "block" }}>No matches found for "{searchQuery}". Try searching with another keyword.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrder(ord)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.2fr 1.2fr 1fr 1fr",
                    alignItems: "center",
                    gap: 16,
                    padding: 14,
                    borderRadius: 14,
                    border: isDark ? "1px solid #27272a" : "1px solid #f1f5f9",
                    background: isDark ? "#202023" : "#fdfdfd",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isDark ? "#ffffff" : "#000000";
                    e.currentTarget.style.background = isDark ? "#27272a" : "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDark ? "#27272a" : "#f1f5f9";
                    e.currentTarget.style.background = isDark ? "#202023" : "#fdfdfd";
                  }}
                >
                  {/* Info */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#f8fafc" : "#1a1a1a", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {ord.productName}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", marginTop: 4, fontSize: 10, color: isDark ? "#94a3b8" : "#64748b" }}>
                      <span><strong>SKU:</strong> {ord.sku}</span>
                      <span><strong>Catalog ID:</strong> {ord.catalogId}</span>
                      {ord.packetId && ord.packetId !== "N/A" && (
                        <span style={{ color: isDark ? "#fff" : "#000" }}><strong>Packet ID:</strong> {ord.packetId}</span>
                      )}
                    </div>
                  </div>

                  {/* Order References */}
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase" }}>References</span>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#334155", marginTop: 2 }}>Sub: {ord.subOrderNo}</div>
                    {ord.orderSource && (
                      <div style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 3, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>
                        <Tag size={10} />
                        <span>{ord.orderSource}</span>
                      </div>
                    )}
                  </div>

                  {/* Qty & Size & Price */}
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase" }}>Specs & Revenue</span>
                    <div style={{ fontSize: 10, color: isDark ? "#cbd5e1" : "#334155", marginTop: 2 }}>
                      <strong>Qty:</strong> {ord.qty} | <strong>Size:</strong> {ord.size}
                    </div>
                    {(ord.supplierListedPrice > 0 || ord.supplierDiscountedPrice > 0) && (
                      <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, marginTop: 1 }}>
                        ₹{ord.supplierDiscountedPrice} <span style={{ textDecoration: "line-through", color: isDark ? "#52525b" : "#aaa", fontSize: 9, fontWeight: 400 }}>₹{ord.supplierListedPrice}</span>
                      </div>
                    )}
                  </div>

                  {/* Date & State & Credit Reason */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 10, color: isDark ? "#94a3b8" : "#64748b", display: "block" }}>
                      {new Date(ord.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                    {ord.customerState && ord.customerState !== "N/A" && (
                      <span style={{ fontSize: 9, color: isDark ? "#94a3b8" : "#64748b", display: "inline-flex", alignItems: "center", gap: 2, marginTop: 2 }}>
                        <MapPin size={9} /> {ord.customerState}
                      </span>
                    )}
                    <span
                      style={{
                        display: "block",
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: 20,
                        marginTop: 4,
                        textAlign: "center",
                        background: ord.reasonForCreditEntry === "CANCELLED" ? (isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2") : ord.reasonForCreditEntry.includes("RTO") ? (isDark ? "rgba(234, 88, 12, 0.1)" : "#fff7ed") : (isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4"),
                        color: ord.reasonForCreditEntry === "CANCELLED" ? "#ef4444" : ord.reasonForCreditEntry.includes("RTO") ? "#f97316" : "#16a34a",
                        border: ord.reasonForCreditEntry === "CANCELLED" ? (isDark ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid #fee2e2") : ord.reasonForCreditEntry.includes("RTO") ? (isDark ? "1px solid rgba(234, 88, 12, 0.2)" : "1px solid #ffedd5") : (isDark ? "1px solid rgba(22, 163, 74, 0.2)" : "1px solid #dcfce7"),
                      }}
                    >
                      {ord.reasonForCreditEntry}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Return Ledger Board */}
      {activeTab === "return" && (
        <div style={{ background: isDark ? "#18181b" : "white", border: isDark ? "1px solid #27272a" : "1px solid #eef2f6", borderRadius: 20, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.01)", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#111", margin: 0 }}>
              Live Returns Ledger ({returnSubTab === "in-transit" ? "In Transit" : returnSubTab === "out-for-delivery" ? "Out for Delivery" : "Delivered"}) {returnSearchQuery ? `(${filteredReturns.length} matching of ${currentReturnsList.length} returns)` : `(${currentReturnsList.length} returns)`}
            </h3>
            {currentReturnsList.length > 0 && (
              <button
                onClick={clearAllReturns}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                Delete All Data
              </button>
            )}
          </div>

          {/* Return Search Bar */}
          {currentReturnsList.length > 0 && (
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: isDark ? "#52525b" : "#64748b" }} />
              <input
                type="text"
                placeholder="Search by Suborder Number..."
                value={returnSearchQuery}
                onChange={(e) => setReturnSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  fontSize: 11,
                  borderRadius: 12,
                  border: isDark ? "1px solid #27272a" : "1px solid #cbd5e1",
                  background: isDark ? "#09090b" : "white",
                  color: isDark ? "#ffffff" : "#000000",
                  outline: "none",
                  transition: "all 0.2s"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "#ffffff" : "#000000";
                  e.currentTarget.style.boxShadow = isDark ? "0 0 0 2px rgba(255, 255, 255, 0.1)" : "0 0 0 2px rgba(0, 0, 0, 0.05)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "#27272a" : "#cbd5e1";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          )}

          {currentReturnsList.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#aaa" }}>
              <Package size={32} style={{ margin: "0 auto 10px", color: isDark ? "#52525b" : "#ccc" }} />
              <span style={{ fontSize: 12 }}>No logged returns in this tab. Upload your returns file above to seed records.</span>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#aaa" }}>
              <Search size={32} style={{ margin: "0 auto 10px", color: isDark ? "#52525b" : "#ccc" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#f8fafc" : "#1e293b", marginTop: 8 }}>No matching records found</div>
              <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b", marginTop: 4, display: "block" }}>No matches found for "{returnSearchQuery}". Try searching with another keyword.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredReturns.map((ret) => (
                <div
                  key={ret.id}
                  onClick={() => setSelectedReturn(ret)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr 1.3fr 1fr",
                    alignItems: "center",
                    gap: 16,
                    padding: 14,
                    borderRadius: 14,
                    border: isDark ? "1px solid #27272a" : "1px solid #f1f5f9",
                    background: isDark ? "#202023" : "#fdfdfd",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isDark ? "#ffffff" : "#000000";
                    e.currentTarget.style.background = isDark ? "#27272a" : "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDark ? "#27272a" : "#f1f5f9";
                    e.currentTarget.style.background = isDark ? "#202023" : "#fdfdfd";
                  }}
                >
                  {/* Product Details */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#f8fafc" : "#1a1a1a", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {ret.productName}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", marginTop: 4, fontSize: 10, color: isDark ? "#94a3b8" : "#64748b" }}>
                      <span><strong>SKU:</strong> {ret.sku}</span>
                      <span><strong>PID:</strong> {ret.meeshoPid}</span>
                      <span><strong>Qty:</strong> {ret.qty}</span>
                    </div>
                  </div>

                  {/* References */}
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase" }}>Suborder / Order</span>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#334155", marginTop: 2 }}>{ret.suborderNumber}</div>
                    <div style={{ fontSize: 9, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>Order: {ret.orderNumber}</div>
                  </div>

                  {/* Courier / Tracking */}
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase" }}>AWB & Courier</span>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#334155", marginTop: 2 }}>{ret.courierPartner}</div>
                    <div style={{ fontSize: 9, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>AWB: {ret.awbNumber}</div>
                  </div>

                  {/* Status & Reason */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 10, color: isDark ? "#94a3b8" : "#64748b", display: "block" }}>
                      {ret.returnCreatedDate}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: 20,
                        marginTop: 4,
                        textAlign: "center",
                        background: ret.status === "Returned" || ret.status === "Delivered" ? (isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4") : (isDark ? "rgba(249, 115, 22, 0.1)" : "#fff7ed"),
                        color: ret.status === "Returned" || ret.status === "Delivered" ? "#16a34a" : "#ea580c",
                        border: ret.status === "Returned" || ret.status === "Delivered" ? (isDark ? "1px solid rgba(22, 163, 74, 0.2)" : "1px solid #dcfce7") : (isDark ? "1px solid rgba(249, 115, 22, 0.2)" : "1px solid #ffedd5"),
                      }}
                    >
                      {ret.status}
                    </span>
                    <div style={{ fontSize: 9, color: isDark ? "#94a3b8" : "#64748b", marginTop: 4, fontStyle: "italic" }}>
                      {ret.typeOfReturn}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dispatch Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
            />

            {/* Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "relative",
                width: "90%",
                maxWidth: 560,
                background: isDark ? "#1e1e1e" : "white",
                border: isDark ? "1px solid #2d2d2d" : "none",
                borderRadius: 24,
                padding: 28,
                boxShadow: isDark ? "0 25px 50px -12px rgba(0,0,0,0.5)" : "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                overflowY: "auto",
                maxHeight: "90vh",
                zIndex: 101
              }}
            >
              {/* Close Icon */}
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ position: "absolute", right: 20, top: 20, background: "transparent", border: "none", color: isDark ? "#94a3b8" : "#64748b", cursor: "pointer" }}
              >
                <X size={18} />
              </button>

              <h2 style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#f8fafc" : "#1e293b", marginBottom: 2 }}>Order Details</h2>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: selectedOrder.reasonForCreditEntry === "CANCELLED" ? (isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2") : selectedOrder.reasonForCreditEntry.includes("RTO") ? (isDark ? "rgba(234, 88, 12, 0.1)" : "#fff7ed") : (isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4"),
                  color: selectedOrder.reasonForCreditEntry === "CANCELLED" ? "#ef4444" : selectedOrder.reasonForCreditEntry.includes("RTO") ? "#f97316" : "#16a34a",
                  border: selectedOrder.reasonForCreditEntry === "CANCELLED" ? (isDark ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid #fee2e2") : selectedOrder.reasonForCreditEntry.includes("RTO") ? (isDark ? "1px solid rgba(234, 88, 12, 0.2)" : "1px solid #ffedd5") : (isDark ? "1px solid rgba(22, 163, 74, 0.2)" : "1px solid #dcfce7"),
                  marginBottom: 16
                }}
              >
                {selectedOrder.reasonForCreditEntry}
              </span>

              {/* Product Info Card */}
              <div style={{ background: isDark ? "#18181b" : "#f8fafc", borderRadius: 16, padding: 16, marginBottom: 20, border: isDark ? "1px solid #2d2d2d" : "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Product Details</span>
                <p style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#f8fafc" : "#1e293b", margin: 0, lineHeight: 1.5 }}>{selectedOrder.productName}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 10, fontSize: 11, color: isDark ? "#cbd5e1" : "#475569" }}>
                  <span><strong>SKU:</strong> {selectedOrder.sku}</span>
                  <span><strong>Catalog ID:</strong> {selectedOrder.catalogId}</span>
                  <span><strong>Size:</strong> {selectedOrder.size}</span>
                  <span><strong>Quantity:</strong> {selectedOrder.qty}</span>
                </div>
              </div>

              {/* Meta Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                {/* References */}
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>References</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Sub Order No:</span>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{selectedOrder.subOrderNo}</div>
                    </div>
                    {selectedOrder.packetId && selectedOrder.packetId !== "N/A" && (
                      <div>
                        <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Packet ID:</span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{selectedOrder.packetId}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations */}
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Operational Data</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Order Date:</span>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>
                        {new Date(selectedOrder.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Destination / Source:</span>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>
                        {selectedOrder.customerState} | {selectedOrder.orderSource}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing breakdown */}
              {(selectedOrder.supplierListedPrice > 0 || selectedOrder.supplierDiscountedPrice > 0) && (
                <div style={{ borderTop: isDark ? "1px solid #2d2d2d" : "1px solid #f1f5f9", paddingTop: 16, marginBottom: 24 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Revenue details</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Supplier Listed Price:</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#52525b" : "#64748b", textDecoration: "line-through" }}>₹{selectedOrder.supplierListedPrice}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>Settled Value:</span>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#16a34a" }}>₹{selectedOrder.supplierDiscountedPrice}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: "none",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 800,
                    background: isDark ? "#ffffff" : "#000000",
                    color: isDark ? "#09090b" : "white",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#f1f5f9" : "#1f1f1f"}
                  onMouseLeave={(e) => e.currentTarget.style.background = isDark ? "#ffffff" : "#000000"}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Details Modal */}
      <AnimatePresence>
        {selectedReturn && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReturn(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
            />

            {/* Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "relative",
                width: "95vw",
                maxWidth: 980,
                background: isDark ? "#1e1e1e" : "white",
                border: isDark ? "1px solid #2d2d2d" : "none",
                borderRadius: 24,
                padding: "24px 28px",
                boxShadow: isDark ? "0 25px 50px -12px rgba(0,0,0,0.5)" : "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                overflowY: "auto",
                maxHeight: "92vh",
                zIndex: 101
              }}
            >
              {/* Close Icon */}
              <button
                onClick={() => setSelectedReturn(null)}
                style={{ position: "absolute", right: 20, top: 20, background: "transparent", border: "none", color: isDark ? "#94a3b8" : "#64748b", cursor: "pointer" }}
              >
                <X size={18} />
              </button>

              <h2 style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#f8fafc" : "#1e293b", marginBottom: 2 }}>Return Details</h2>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: selectedReturn.status === "Returned" || selectedReturn.status === "Delivered" ? (isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4") : (isDark ? "rgba(249, 115, 22, 0.1)" : "#fff7ed"),
                  color: selectedReturn.status === "Returned" || selectedReturn.status === "Delivered" ? "#16a34a" : "#ea580c",
                  border: selectedReturn.status === "Returned" || selectedReturn.status === "Delivered" ? (isDark ? "1px solid rgba(22, 163, 74, 0.2)" : "1px solid #dcfce7") : (isDark ? "1px solid rgba(249, 115, 22, 0.2)" : "1px solid #ffedd5"),
                  marginBottom: 16
                }}
              >
                {selectedReturn.status} | {selectedReturn.typeOfReturn}
              </span>

              {/* Product Info + Return Reason — side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                {/* Product Info Card */}
                <div style={{ background: isDark ? "#18181b" : "#f8fafc", borderRadius: 14, padding: 14, border: isDark ? "1px solid #2d2d2d" : "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Product Details</span>
                  <p style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#f8fafc" : "#1e293b", margin: 0, lineHeight: 1.5 }}>{selectedReturn.productName}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: 10, color: isDark ? "#cbd5e1" : "#475569" }}>
                    <span><strong>SKU:</strong> {selectedReturn.sku}</span>
                    <span><strong>PID:</strong> {selectedReturn.meeshoPid || "—"}</span>
                    <span><strong>Variation:</strong> {selectedReturn.variation}</span>
                    <span><strong>Qty:</strong> {selectedReturn.qty}</span>
                  </div>
                </div>

                {/* Return Reasons Card */}
                <div style={{ background: isDark ? "#18181b" : "#f8fafc", borderRadius: 14, padding: 14, border: isDark ? "1px solid #2d2d2d" : "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Reason for Return</span>
                  <p style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#f8fafc" : "#1e293b", margin: 0, lineHeight: 1.5 }}>
                    {selectedReturn.returnReason && selectedReturn.returnReason !== "NA" ? selectedReturn.returnReason : "No specific reason logged"}
                  </p>
                  {selectedReturn.detailedReturnReason && selectedReturn.detailedReturnReason !== "NA" && (
                    <div style={{ fontSize: 10, color: isDark ? "#cbd5e1" : "#475569", marginTop: 5 }}>
                      <strong>Details:</strong> {selectedReturn.detailedReturnReason}
                    </div>
                  )}
                  {selectedReturn.returnPriceType && (
                    <div style={{ fontSize: 10, color: isDark ? "#cbd5e1" : "#475569", marginTop: 4 }}>
                      <strong>Price Type:</strong> {selectedReturn.returnPriceType}
                    </div>
                  )}
                </div>
              </div>

              {/* Meta Grid — 3 columns: References | Logistics Data | Live Courier Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 16, marginBottom: 18, alignItems: "start" }}>

                {/* Col 1: References */}
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>References</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Suborder Number:</span>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{selectedReturn.suborderNumber}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Order ID:</span>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{selectedReturn.orderNumber}</div>
                    </div>
                    {selectedReturn.awbNumber && (
                      <div>
                        <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>AWB Number:</span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{selectedReturn.awbNumber}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 2: Logistics Data */}
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Logistics Data</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Courier Partner:</span>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{selectedReturn.courierPartner}</div>
                    </div>
                    {selectedReturn.returnCreatedDate && (
                      <div>
                        <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Return Created:</span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{formatReturnDate(selectedReturn.returnCreatedDate)}</div>
                      </div>
                    )}
                    {selectedReturn.expectedDeliveryDate && (
                      <div>
                        <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>Expected Delivery:</span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b" }}>{formatReturnDate(selectedReturn.expectedDeliveryDate)}</div>
                        {selectedReturn.returnCreatedDate && (() => {
                          const dur = calcDuration(selectedReturn.returnCreatedDate, selectedReturn.expectedDeliveryDate);
                          return dur ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, background: isDark ? "#1e3a5f" : "#dbeafe", color: isDark ? "#93c5fd" : "#1d4ed8", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>
                              ⏱ {dur} to resolve
                            </span>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 3: Live Courier Status */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase" }}>📡 Live Courier Status</span>
                    {liveTracking?.loading && <span style={{ fontSize: 9, color: isDark ? "#52525b" : "#94a3b8" }}>Fetching…</span>}
                  </div>

                  {!liveTracking && (
                    <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8" }}>No AWB to track.</div>
                  )}

                  {liveTracking?.loading && (
                    <div style={{ height: 36, background: isDark ? "#27272a" : "#f8fafc", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, color: isDark ? "#71717a" : "#94a3b8" }}>Loading live status…</span>
                    </div>
                  )}

                  {liveTracking && !liveTracking.loading && liveTracking.error && (
                    <div style={{
                      display: "flex",
                      alignItems: "start",
                      gap: 8,
                      fontSize: 10.5,
                      lineHeight: 1.4,
                      color: isDark ? "#fbbf24" : "#b45309",
                      padding: "8px 12px",
                      background: isDark ? "rgba(217, 119, 6, 0.1)" : "#fffbeb",
                      border: isDark ? "1px solid rgba(217, 119, 6, 0.2)" : "1px solid #fde68a",
                      borderRadius: 10
                    }}>
                      <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <strong>Notice:</strong> {liveTracking.error}
                      </div>
                    </div>
                  )}

                  {liveTracking && !liveTracking.loading && !liveTracking.error && (() => {
                    const isRedirect = liveTracking.statusType === "REDIRECT";

                    if (isRedirect) {
                      return (
                        <div>
                          <div style={{ fontSize: 10, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
                            {liveTracking.note || "Live inline tracking is not available for this courier."}
                          </div>
                          {liveTracking.trackingUrl && (
                            <a
                              href={liveTracking.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: isDark ? "#7c3aed" : "#6d28d9", color: "white", padding: "9px 12px", borderRadius: 10, fontSize: 11, fontWeight: 800, textDecoration: "none", transition: "background 0.2s" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#5b21b6"}
                              onMouseLeave={(e) => e.currentTarget.style.background = isDark ? "#7c3aed" : "#6d28d9"}
                            >
                              🔗 Track on {liveTracking.courier || "Courier Website"} →
                            </a>
                          )}
                        </div>
                      );
                    }

                    const st = liveTracking.status?.toLowerCase();
                    const isDelivered = st === "delivered" || st === "returned" || liveTracking.statusType === "DL";
                    const isInTransit = st === "in transit";
                    const isPending = st === "pending";
                    const isRto = liveTracking.statusType === "RT";
                    const badgeColor = isDelivered ? "#16a34a" : isInTransit ? "#2563eb" : isPending ? "#d97706" : "#6b7280";
                    const badgeBg = isDelivered ? (isDark ? "#14532d" : "#dcfce7") : isInTransit ? (isDark ? "#1e3a5f" : "#dbeafe") : isPending ? (isDark ? "#431407" : "#fef9c3") : (isDark ? "#27272a" : "#f1f5f9");

                    return (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase" }}>
                            {liveTracking.status || "Unknown"}
                          </span>
                          {isRto && <span style={{ fontSize: 9, color: isDark ? "#f97316" : "#ea580c", fontWeight: 700, background: isDark ? "#431407" : "#fff7ed", padding: "2px 8px", borderRadius: 20 }}>RTO Route</span>}
                          {!isDelivered && <span style={{ fontSize: 9, color: isDark ? "#71717a" : "#94a3b8" }}>⚠ Not at warehouse</span>}
                        </div>
                        {liveTracking.lastLocation && (
                          <div style={{ fontSize: 10, color: isDark ? "#94a3b8" : "#475569", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 4 }}>
                            <span>📍</span>
                            <span>Last: <strong style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>{liveTracking.lastLocation.replace(/_/g, " ")}</strong>
                              {liveTracking.lastDateTime && <span style={{ color: isDark ? "#52525b" : "#94a3b8", marginLeft: 4 }}>
                                {new Date(liveTracking.lastDateTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>}
                            </span>
                          </div>
                        )}
                        {liveTracking.scans.length > 0 && (
                          <div style={{ borderLeft: `2px solid ${isDark ? "#3f3f46" : "#e2e8f0"}`, paddingLeft: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                            {[...liveTracking.scans].reverse().slice(0, 4).map((sc, i) => (
                              <div key={i} style={{ position: "relative" }}>
                                <div style={{ position: "absolute", left: -14, top: 3, width: 6, height: 6, borderRadius: "50%", background: i === 0 ? badgeColor : (isDark ? "#3f3f46" : "#cbd5e1") }} />
                                <div style={{ fontSize: 10, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? (isDark ? "#e2e8f0" : "#1e293b") : (isDark ? "#71717a" : "#64748b") }}>
                                  {sc.scan}{sc.location && <span style={{ fontWeight: 400, color: isDark ? "#52525b" : "#94a3b8", marginLeft: 4 }}>— {sc.location.replace(/_/g, " ")}</span>}
                                </div>
                                <div style={{ fontSize: 9, color: isDark ? "#52525b" : "#94a3b8" }}>
                                  {sc.dateTime ? new Date(sc.dateTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* Action Buttons Row — Track + Close side by side */}
              <div style={{ borderTop: isDark ? "1px solid #2d2d2d" : "1px solid #f1f5f9", paddingTop: 16, display: "flex", gap: 10 }}>
                {selectedReturn.trackingLink && selectedReturn.trackingLink !== "NA" && (
                  <a
                    href={selectedReturn.trackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      background: "#3b82f6",
                      color: "white",
                      padding: "12px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 800,
                      textDecoration: "none",
                      transition: "background 0.2s",
                      whiteSpace: "nowrap"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#2563eb"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#3b82f6"}
                  >
                    🚚 Track Return
                  </a>
                )}
                <button
                  onClick={() => setSelectedReturn(null)}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: "none",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 800,
                    background: isDark ? "#27272a" : "#f1f5f9",
                    color: isDark ? "#e4e4e7" : "#374151",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "#3f3f46" : "#e2e8f0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? "#27272a" : "#f1f5f9"; }}
                >
                  ✕ Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
