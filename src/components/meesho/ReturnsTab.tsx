"use client";

/**
 * BizTrack — Meesho Returns Tab
 * 
 * Manages customer returns, courier returns (RTO), and delivered returns.
 * Ingests files via processReturnsExcelBuffer and parseReturnsCSVText,
 * syncs with Supabase via useSupabaseTable hooks, and tracks live courier
 * status using the AWB / Api route.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, AlertTriangle, X, CheckCircle, Upload, RotateCcw,
  Store, Wallet, LayoutDashboard, Search, FileSpreadsheet,
  Download, FileText, ChevronRight, RefreshCw, Calendar, MapPin,
  Tag, Clock, ArrowRight, Check, AlertCircle, HelpCircle,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

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

const DEFAULT_RETURNS: MeeshoReturn[] = [];

// Parses dates like "24/06/26", "24/06/2026", "2026-07-14" → "14 Jul 2026"
function formatReturnDate(raw: string): string {
  if (!raw || raw === "NA" || raw === "null" || raw === "") return raw;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    let year = parseInt(match[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(raw + "T00:00:00");
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return raw;
}

function isSameReturn(a: MeeshoReturn, b: MeeshoReturn): boolean {
  return (
    a.suborderNumber === b.suborderNumber &&
    a.typeOfReturn === b.typeOfReturn &&
    a.subType === b.subType &&
    a.expectedDeliveryDate === b.expectedDeliveryDate &&
    a.courierPartner === b.courierPartner &&
    a.awbNumber === b.awbNumber &&
    a.status === b.status &&
    a.attempt === b.attempt &&
    a.trackingLink === b.trackingLink &&
    a.returnPriceType === b.returnPriceType &&
    a.returnReason === b.returnReason &&
    a.detailedReturnReason === b.detailedReturnReason &&
    a.deliveredDate === b.deliveredDate &&
    a.proofOfDelivery === b.proofOfDelivery &&
    a.otpVerifiedAt === b.otpVerifiedAt
  );
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

// Helper to convert CSV text to MeeshoReturn rows
function parseReturnsCSVText(text: string): MeeshoReturn[] {
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
    return result;
  };

  // Find header row dynamically (usually Row 7 or 8 in Meesho supplier panel returns export)
  let h = -1;
  for (let r = 0; r < Math.min(lines.length, 15); r++) {
    const rowText = lines[r].toLowerCase();
    if (rowText.includes("suborder") || rowText.includes("sub-order") || rowText.includes("meeshopid") || rowText.includes("meesho pid")) {
      h = r;
      break;
    }
  }
  if (h === -1) h = 0; // fallback to first row

  const headers = parseCSVRow(lines[h]).map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  const getCol = (...keys: string[]): number => {
    for (const key of keys) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = headers.indexOf(normalizedKey);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const cSNo = getCol("sno", "serialnumber", "no");
  const cProduct = getCol("productname", "product");
  const cSku = getCol("sku");
  const cVariation = getCol("variation", "size");
  const cMeeshoPid = getCol("meeshopid", "pid");
  const cCategory = getCol("category");
  const cQty = getCol("quantity", "qty");
  const cOrderNumber = getCol("ordernumber", "orderid");
  const cSuborderNumber = getCol("subordernumber", "suborderid", "suborderno");
  const cDispatchDate = getCol("dispatchdate");
  const cReturnCreatedDate = getCol("returncreateddate", "createddate");
  const cTypeOfReturn = getCol("typeofreturn", "returntype");
  const cSubType = getCol("subtype");
  const cExpectedDeliveryDate = getCol("expecteddeliverydate", "deliverydate");
  const cCourierPartner = getCol("courierpartner", "courier");
  const cAwbNumber = getCol("awbnumber", "awb");
  const cStatus = getCol("status");
  const cAttempt = getCol("attempt");
  const cTrackingLink = getCol("trackinglink", "tracking");
  const cReturnPriceType = getCol("returnpricetype", "returnprice");
  const cReturnReason = getCol("returnreason", "reason");
  const cDetailedReturnReason = getCol("detailedreturnreason", "details");
  const cDeliveredDate = getCol("delivereddate");
  const cProofOfDelivery = getCol("proofofdelivery");
  const cOtpVerifiedAt = getCol("otpverifiedat");

  if (cSuborderNumber === -1) return [];

  const returns: MeeshoReturn[] = [];
  for (let i = h + 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    if (cols.length < 2) continue;

    const suborderNumber = cols[cSuborderNumber];
    if (!suborderNumber || !/\d{6,}/.test(suborderNumber)) continue;

    const getVal = (idx: number): string => (idx !== -1 && cols[idx] ? cols[idx].replace(/^"|"$/g, "").trim() : "");
    const getNum = (idx: number): number => {
      const val = getVal(idx);
      const parsed = parseInt(val.replace(/[^\d]/g, ""));
      return isNaN(parsed) ? 1 : parsed;
    };

    returns.push({
      id: suborderNumber,
      sNo: getVal(cSNo),
      productName: getVal(cProduct),
      sku: getVal(cSku) || "SKU",
      variation: getVal(cVariation),
      meeshoPid: getVal(cMeeshoPid),
      category: getVal(cCategory),
      qty: getNum(cQty),
      orderNumber: getVal(cOrderNumber),
      suborderNumber,
      dispatchDate: getVal(cDispatchDate),
      returnCreatedDate: getVal(cReturnCreatedDate),
      typeOfReturn: getVal(cTypeOfReturn) || "Customer Return",
      subType: getVal(cSubType),
      expectedDeliveryDate: getVal(cExpectedDeliveryDate),
      courierPartner: getVal(cCourierPartner),
      awbNumber: getVal(cAwbNumber),
      status: getVal(cStatus) || "In Transit",
      attempt: getVal(cAttempt),
      trackingLink: getVal(cTrackingLink),
      returnPriceType: getVal(cReturnPriceType),
      returnReason: getVal(cReturnReason),
      detailedReturnReason: getVal(cDetailedReturnReason),
      deliveredDate: getVal(cDeliveredDate),
      proofOfDelivery: getVal(cProofOfDelivery),
      otpVerifiedAt: getVal(cOtpVerifiedAt)
    });
  }
  return returns;
}

// Parses Returns Excel file
async function processReturnsExcelBuffer(buffer: ArrayBuffer, filename: string): Promise<MeeshoReturn[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const text: string[][] = [];
  const raw: any[][] = [];

  sheet.eachRow({ includeEmpty: true }, (row) => {
    const textRow: string[] = [];
    const rawRow: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      let cellValue = cell.value;
      if (cellValue && typeof cellValue === "object" && "result" in cellValue) {
        cellValue = cellValue.result;
      }
      rawRow.push(cellValue);
      textRow.push(cellValue !== null && cellValue !== undefined ? String(cellValue).trim() : "");
    });
    text.push(textRow);
    raw.push(rawRow);
  });

  // Find header row starting from Row 8 (Meesho standard exports usually have headers on Row 8)
  let h = -1;
  for (let r = 7; r < text.length; r++) {
    const rowText = text[r].join(" ").toLowerCase();
    if (rowText.includes("suborder") || rowText.includes("sub-order") || (rowText.includes("order") && rowText.includes("return"))) {
      h = r;
      break;
    }
  }
  if (h === -1) {
    // Fallback to row scanning
    for (let r = 0; r < Math.min(text.length, 12); r++) {
      const rowText = text[r].join(" ").toLowerCase();
      if (rowText.includes("suborder") || rowText.includes("sub-order")) {
        h = r;
        break;
      }
    }
  }

  if (h === -1) return [];

  const headers = text[h].map(col => col.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  const getCol = (...keys: string[]): number => {
    for (const key of keys) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = headers.indexOf(normalizedKey);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const cSNo = getCol("sno", "serialnumber");
  const cProduct = getCol("productname", "product");
  const cSku = getCol("sku");
  const cVariation = getCol("variation", "size");
  const cMeeshoPid = getCol("meeshopid", "pid");
  const cCategory = getCol("category");
  const cQty = getCol("quantity", "qty");
  const cOrderNumber = getCol("ordernumber", "orderid");
  const cSuborderNumber = getCol("subordernumber", "suborderid", "suborderno");
  const cDispatchDate = getCol("dispatchdate");
  const cReturnCreatedDate = getCol("returncreateddate", "createddate");
  const cTypeOfReturn = getCol("typeofreturn", "returntype");
  const cSubType = getCol("subtype");
  const cExpectedDeliveryDate = getCol("expecteddeliverydate", "deliverydate");
  const cCourierPartner = getCol("courierpartner", "courier");
  const cAwbNumber = getCol("awbnumber", "awb");
  const cStatus = getCol("status");
  const cAttempt = getCol("attempt");
  const cTrackingLink = getCol("trackinglink", "tracking");
  const cReturnPriceType = getCol("returnpricetype");
  const cReturnReason = getCol("returnreason", "reason");
  const cDetailedReturnReason = getCol("detailedreturnreason", "details");
  const cDeliveredDate = getCol("delivereddate");
  const cProofOfDelivery = getCol("proofofdelivery");
  const cOtpVerifiedAt = getCol("otpverifiedat");

  if (cSuborderNumber === -1) return [];

  const newReturns: MeeshoReturn[] = [];
  for (let i = h + 1; i < raw.length; i++) {
    const getVal = (idx: number): string => {
      if (idx === -1 || idx >= raw[i].length) return "";
      const val = raw[i][idx];
      if (val instanceof Date) return val.toISOString().split("T")[0];
      return val !== null && val !== undefined ? String(val).trim() : "";
    };
    const getNum = (idx: number): number => {
      const val = getVal(idx);
      const parsed = parseInt(val.replace(/[^\d]/g, ""));
      return isNaN(parsed) ? 1 : parsed;
    };

    const suborderNumber = getVal(cSuborderNumber);
    if (suborderNumber && /\d{6,}/.test(suborderNumber)) {
      newReturns.push({
        id: suborderNumber,
        sNo: getVal(cSNo),
        productName: getVal(cProduct),
        sku: getVal(cSku) || "SKU",
        variation: getVal(cVariation),
        meeshoPid: getVal(cMeeshoPid),
        category: getVal(cCategory),
        qty: getNum(cQty),
        orderNumber: getVal(cOrderNumber),
        suborderNumber,
        dispatchDate: getVal(cDispatchDate),
        returnCreatedDate: getVal(cReturnCreatedDate),
        typeOfReturn: getVal(cTypeOfReturn) || "Customer Return",
        subType: getVal(cSubType),
        expectedDeliveryDate: getVal(cExpectedDeliveryDate),
        courierPartner: getVal(cCourierPartner),
        awbNumber: getVal(cAwbNumber),
        status: getVal(cStatus) || "In Transit",
        attempt: getVal(cAttempt),
        trackingLink: getVal(cTrackingLink),
        returnPriceType: getVal(cReturnPriceType),
        returnReason: getVal(cReturnReason),
        detailedReturnReason: getVal(cDetailedReturnReason),
        deliveredDate: getVal(cDeliveredDate),
        proofOfDelivery: getVal(cProofOfDelivery),
        otpVerifiedAt: getVal(cOtpVerifiedAt)
      });
    }
  }
  return newReturns;
}

export default function ReturnsTab() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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

  const [returnSubTab, setReturnSubTab] = useState<"in-transit" | "out-for-delivery" | "delivered">("in-transit");
  const [selectedReturn, setSelectedReturn] = useState<MeeshoReturn | null>(null);
  const [returnSearchQuery, setReturnSearchQuery] = useState("");
  const [returnStatusFilter, setReturnStatusFilter] = useState<"all" | "customer" | "rto" | "returned">("all");
  
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; msg: string } | null>(null);
  const [replaceMode, setReplaceMode] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Returns computations
  const currentReturnsList = useMemo(() => {
    return returnSubTab === "in-transit" ? inTransitList :
      returnSubTab === "out-for-delivery" ? outForDeliveryList :
      deliveredList;
  }, [returnSubTab, inTransitList, outForDeliveryList, deliveredList]);

  const metrics = useMemo(() => {
    const total = currentReturnsList.length;
    const customer = currentReturnsList.filter(r => r.typeOfReturn === "Customer Return").length;
    const rto = currentReturnsList.filter(r => r.typeOfReturn === "Courier Return (RTO)" || r.typeOfReturn.includes("RTO")).length;
    const completed = currentReturnsList.filter(r => r.status === "Returned" || r.status === "Delivered").length;
    return { total, customer, rto, completed };
  }, [currentReturnsList]);

  // File upload logic
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv = file.name.endsWith(".csv");

    if (!isCsv && !isXlsx) {
      setFeedback({ status: "error", msg: "Invalid file format. Please upload a CSV or XLSX file." });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (isXlsx) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const buffer = event.target?.result as ArrayBuffer;
          if (buffer) {
            try {
              const newReturns = await processReturnsExcelBuffer(buffer, file.name);
              if (newReturns.length > 0) {
                const existing = replaceMode ? [] : [...currentReturnsList];
                let addedCount = 0;
                let updatedCount = 0;
                
                newReturns.forEach(nr => {
                  const idx = existing.findIndex(er => er.suborderNumber === nr.suborderNumber);
                  if (idx !== -1) {
                    if (!isSameReturn(existing[idx], nr)) {
                      existing[idx] = { ...nr, id: existing[idx].id };
                      updatedCount++;
                    }
                  } else {
                    existing.unshift(nr);
                    addedCount++;
                  }
                });
                
                if (returnSubTab === "in-transit") {
                  setInTransitList(existing);
                } else if (returnSubTab === "out-for-delivery") {
                  setOutForDeliveryList(existing);
                } else {
                  setDeliveredList(existing);
                }
                setFeedback({
                  status: "success",
                  msg: replaceMode 
                    ? `Fresh start! Replaced all records in this tab with ${newReturns.length} returns from Excel.`
                    : `Import completed! Successfully parsed ${newReturns.length} returns from Excel. Added ${addedCount} new records, updated ${updatedCount} existing records.`
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
                const existing = replaceMode ? [] : [...currentReturnsList];
                let addedCount = 0;
                let updatedCount = 0;
                
                newReturns.forEach(nr => {
                  const idx = existing.findIndex(er => er.suborderNumber === nr.suborderNumber);
                  if (idx !== -1) {
                    if (!isSameReturn(existing[idx], nr)) {
                      existing[idx] = { ...nr, id: existing[idx].id };
                      updatedCount++;
                    }
                  } else {
                    existing.unshift(nr);
                    addedCount++;
                  }
                });
                
                if (returnSubTab === "in-transit") {
                  setInTransitList(existing);
                } else if (returnSubTab === "out-for-delivery") {
                  setOutForDeliveryList(existing);
                } else {
                  setDeliveredList(existing);
                }
                setFeedback({
                  status: "success",
                  msg: replaceMode
                    ? `Fresh start! Replaced all records in this tab with ${newReturns.length} returns from CSV.`
                    : `Import completed! Successfully parsed ${newReturns.length} returns from CSV. Added ${addedCount} new records, updated ${updatedCount} existing records.`
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
  };

  // Filtered returns list
  const filteredReturns = useMemo(() => {
    return currentReturnsList.filter((ret) => {
      // 1. Status Filter
      if (returnStatusFilter === "customer" && ret.typeOfReturn !== "Customer Return") return false;
      if (returnStatusFilter === "rto" && ret.typeOfReturn !== "Courier Return (RTO)" && !ret.typeOfReturn.includes("RTO")) return false;
      if (returnStatusFilter === "returned" && ret.status !== "Returned" && ret.status !== "Delivered") return false;

      // 2. Search Query
      const q = returnSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return ret.suborderNumber.toLowerCase().includes(q);
    });
  }, [currentReturnsList, returnStatusFilter, returnSearchQuery]);

  const cardStyle: React.CSSProperties = {
    background: isDark ? "#18181b" : "#ffffff",
    border: isDark ? "1px solid #27272a" : "1px solid #ececec",
    borderRadius: 16, padding: "16px 18px",
    boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        id="returns-file-upload"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Sub-Tab Switcher ── */}
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
                color: isActive ? (isDark ? "#ffffff" : "#000000") : (isDark ? "#71717a" : "#64748b"),
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: isActive ? 800 : 550,
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

      {/* ── Feedback Banner ── */}
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

      {/* ── Return Metrics Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Returns", value: metrics.total, icon: RotateCcw, color: isDark ? "#fff" : "#1e293b" },
          { label: "Customer Returns", value: metrics.customer, icon: AlertTriangle, color: "#f59e0b" },
          { label: "Courier Returns (RTO)", value: metrics.rto, icon: Package, color: "#ef4444" },
          { label: "Completed Returns", value: metrics.completed, icon: CheckCircle, color: "#16a34a" }
        ].map((m) => (
          <div key={m.label} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: isDark ? "#71717a" : "#94a3b8", letterSpacing: "0.05em" }}>{m.label}</span>
              <m.icon size={16} style={{ color: m.color }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: m.color }}>
              <AnimatedCounter value={m.value} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: isDark ? "#52525b" : "#94a3b8", pointerEvents: "none" }} />
          <input
            value={returnSearchQuery}
            onChange={e => setReturnSearchQuery(e.target.value)}
            placeholder="Search by suborder ID..."
            style={{
              width: "100%", padding: "9px 12px 9px 34px", fontSize: 12,
              border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0",
              borderRadius: 10, background: isDark ? "#18181b" : "#fff",
              color: isDark ? "#e4e4e7" : "#111", outline: "none",
            }}
          />
        </div>

        {/* Return status type filter */}
        <div style={{ position: "relative" }}>
          <select
            value={returnStatusFilter}
            onChange={e => setReturnStatusFilter(e.target.value as any)}
            style={{
              padding: "9px 32px 9px 12px", fontSize: 12, fontWeight: 700,
              border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0",
              borderRadius: 10, background: isDark ? "#18181b" : "#fff",
              color: isDark ? "#e4e4e7" : "#111", cursor: "pointer", outline: "none",
              appearance: "none",
            }}
          >
            <option value="all">All Types</option>
            <option value="customer">Customer Return</option>
            <option value="rto">Courier Return (RTO)</option>
            <option value="returned">Completed / Returned</option>
          </select>
        </div>

        {/* Clear filter button */}
        {returnStatusFilter !== "all" && (
          <button onClick={() => setReturnStatusFilter("all")} style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#a1a1aa" : "#64748b", background: isDark ? "#27272a" : "#f1f5f9", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
            Clear Status Filter
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Overwrite mode checkbox toggle */}
        <label style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          color: isDark ? "#a1a1aa" : "#475569",
          marginRight: 6
        }}>
          <input
            type="checkbox"
            checked={replaceMode}
            onChange={e => setReplaceMode(e.target.checked)}
            style={{
              accentColor: isDark ? "#fff" : "#000",
              cursor: "pointer",
              width: 14,
              height: 14,
            }}
          />
          <span>Replace existing records (Fresh start)</span>
        </label>

        {/* Ingest Returns CSV/Excel */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: isDark ? "#fafafa" : "#111",
            color: isDark ? "#111" : "#fff",
            border: "none", borderRadius: 10, padding: "9px 16px",
            fontSize: 12, fontWeight: 800, cursor: isLoading ? "wait" : "pointer",
            opacity: isLoading ? 0.6 : 1, transition: "all 0.2s",
          }}
        >
          <Upload size={14} />
          {isLoading ? "Ingesting..." : "Upload Returns File"}
        </button>

        {/* Clear All */}
        <button
          onClick={clearAllReturns}
          disabled={currentReturnsList.length === 0}
          style={{ padding: "9px 14px", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: 12, fontWeight: 700, opacity: currentReturnsList.length === 0 ? 0.4 : 1 }}
        >
          <RotateCcw size={14} />
          Clear Tab Data
        </button>
      </div>

      {/* ── Ledger Table ── */}
      {currentReturnsList.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "50px 20px" }}>
          <Package size={40} style={{ margin: "0 auto 12px", opacity: 0.25 }} />
          <p style={{ fontSize: 14, fontWeight: 800, color: isDark ? "#e4e4e7" : "#334155", marginBottom: 4 }}>No logged returns</p>
          <p style={{ fontSize: 11, color: isDark ? "#71717a" : "#94a3b8" }}>Upload a CSV or Excel sheet with returns to seed this section.</p>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px 20px", color: isDark ? "#71717a" : "#94a3b8", fontSize: 12 }}>
          No records matching "{returnSearchQuery}".{" "}
          <button onClick={() => { setReturnSearchQuery(""); setReturnStatusFilter("all"); }} style={{ color: isDark ? "#a1a1aa" : "#64748b", fontWeight: 800, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8", textAlign: "left", background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>Product Details</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8", textAlign: "left", background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>Suborder / SKU</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8", textAlign: "left", background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>Created Date</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8", textAlign: "left", background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>Return Type</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8", textAlign: "left", background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>Courier Info</th>
                  <th style={{ padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8", textAlign: "left", background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map((ret, idx) => {
                  const isDelivered = ret.status === "Delivered" || ret.status === "Returned";
                  return (
                    <tr
                      key={ret.id}
                      onClick={() => setSelectedReturn(ret)}
                      style={{ cursor: "pointer", borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f8fafc" }}
                    >
                      <td style={{ padding: "12px 14px", fontSize: 12, verticalAlign: "middle" }}>
                        <div style={{ maxWidth: 300 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? "#e4e4e7" : "#111", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
                            {ret.productName}
                          </div>
                          <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", marginTop: 3 }}>
                            Qty: {ret.qty} | Size: {ret.variation}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, verticalAlign: "middle" }}>
                        <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{ret.suborderNumber}</div>
                        <div style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b", marginTop: 2 }}>SKU: {ret.sku}</div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, verticalAlign: "middle" }}>
                        {formatReturnDate(ret.returnCreatedDate)}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, verticalAlign: "middle" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 6px",
                          background: ret.typeOfReturn === "Customer Return" ? (isDark ? "rgba(245,158,11,0.12)" : "#fef3c7") : (isDark ? "rgba(239,68,68,0.12)" : "#fee2e2"),
                          color: ret.typeOfReturn === "Customer Return" ? "#d97706" : "#ef4444"
                        }}>
                          {ret.typeOfReturn === "Customer Return" ? "Customer" : "RTO"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, verticalAlign: "middle" }}>
                        <div>{ret.courierPartner || "—"}</div>
                        <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", marginTop: 2 }}>AWB: {ret.awbNumber || "—"}</div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, verticalAlign: "middle" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, borderRadius: 8, padding: "4px 8px",
                          background: isDelivered ? (isDark ? "rgba(22,163,74,0.12)" : "#f0fdf4") : (isDark ? "rgba(234,88,12,0.12)" : "#fff7ed"),
                          color: isDelivered ? "#16a34a" : "#ea580c"
                        }}>
                          {ret.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Return Details Modal ── */}
      <AnimatePresence>
        {selectedReturn && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReturn(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "relative",
                width: "95vw",
                maxWidth: 820,
                background: isDark ? "#1e1e1e" : "white",
                border: isDark ? "1px solid #2d2d2d" : "none",
                borderRadius: 24,
                padding: "24px 28px",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
                overflowY: "auto",
                maxHeight: "92vh",
                zIndex: 101
              }}
            >
              <button
                onClick={() => setSelectedReturn(null)}
                style={{ position: "absolute", right: 20, top: 20, background: "transparent", border: "none", color: isDark ? "#94a3b8" : "#64748b", cursor: "pointer" }}
              >
                <X size={18} />
              </button>

              <h2 style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#f8fafc" : "#1e293b", marginBottom: 2 }}>Return Ticket Details</h2>
              <span style={{
                display: "inline-block", fontSize: 9, fontWeight: 800, textTransform: "uppercase", padding: "2px 8px", borderRadius: 20,
                background: selectedReturn.status === "Returned" || selectedReturn.status === "Delivered" ? (isDark ? "rgba(22, 163, 74, 0.1)" : "#f0fdf4") : (isDark ? "rgba(249, 115, 22, 0.1)" : "#fff7ed"),
                color: selectedReturn.status === "Returned" || selectedReturn.status === "Delivered" ? "#16a34a" : "#ea580c",
                border: selectedReturn.status === "Returned" || selectedReturn.status === "Delivered" ? (isDark ? "1px solid rgba(22, 163, 74, 0.2)" : "1px solid #dcfce7") : (isDark ? "1px solid rgba(249, 115, 22, 0.2)" : "1px solid #ffedd5"),
                marginBottom: 16
              }}>
                {selectedReturn.status} | {selectedReturn.typeOfReturn}
              </span>

              {/* Grid Details */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                {/* Product details */}
                <div style={{ background: isDark ? "#18181b" : "#f8fafc", padding: 14, borderRadius: 14, border: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Product</span>
                  <div style={{ fontSize: 11, fontWeight: 800 }}>{selectedReturn.productName}</div>
                  <div style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b", marginTop: 4 }}>
                    <strong>SKU:</strong> {selectedReturn.sku} | <strong>PID:</strong> {selectedReturn.meeshoPid || "—"}
                  </div>
                </div>

                {/* Suborder details */}
                <div style={{ background: isDark ? "#18181b" : "#f8fafc", padding: 14, borderRadius: 14, border: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Identifiers</span>
                  <div style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b" }}>
                    <div><strong>Suborder ID:</strong> <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{selectedReturn.suborderNumber}</span></div>
                    <div><strong>Order ID:</strong> <span style={{ fontFamily: "monospace" }}>{selectedReturn.orderNumber}</span></div>
                    <div><strong>AWB:</strong> {selectedReturn.awbNumber || "—"} ({selectedReturn.courierPartner})</div>
                  </div>
                </div>
              </div>

              {/* Tracking Details */}
              <div style={{ background: isDark ? "#18181b" : "#fafafa", borderRadius: 16, padding: 18, border: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 12 }}>Courier Journey Timeline</span>
                
                {liveTracking?.loading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", color: isDark ? "#71717a" : "#64748b" }}>
                    <RefreshCw size={14} className="animate-spin" />
                    <span style={{ fontSize: 11 }}>Querying live carrier status...</span>
                  </div>
                ) : liveTracking?.error ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ef4444", padding: "10px 0" }}>
                    <AlertCircle size={14} />
                    <span style={{ fontSize: 11 }}>Live tracking unavailable: {liveTracking.error}</span>
                  </div>
                ) : liveTracking?.scans && liveTracking.scans.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {liveTracking.scans.map((s, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: idx === 0 ? "#16a34a" : (isDark ? "#3f3f46" : "#cbd5e1"), marginTop: 4 }} />
                          {idx < liveTracking.scans.length - 1 && (
                            <div style={{ width: 1, flex: 1, background: isDark ? "#27272a" : "#e2e8f0", minHeight: 12 }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? "#e4e4e7" : "#111" }}>{s.scan}</div>
                          <div style={{ fontSize: 10, color: isDark ? "#71717a" : "#64748b", marginTop: 2 }}>
                            {s.dateTime} {s.location && `· ${s.location}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: isDark ? "#71717a" : "#64748b", fontSize: 11 }}>
                    No tracking updates available. AWB Link:{" "}
                    {selectedReturn.trackingLink ? (
                      <a href={selectedReturn.trackingLink} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", textDecoration: "underline" }}>
                        Click to Track
                      </a>
                    ) : "—"}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
