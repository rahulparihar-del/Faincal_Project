"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Clock,
  Megaphone,
  CheckCircle,
  X,
  Trash2,
  Landmark,
  Search,
  Tag,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { useMeeshoOrders } from "@/lib/hooks/useMeeshoOrders";
import { mergeOrders, clearAllOrders } from "@/lib/meesho/orderService";
import { parseOrdersXLSX } from "@/lib/meesho/ordersParser";
import { MeeshoOrder, MeeshoPaymentRow, MeeshoAdsRow } from "@/lib/meesho/types";
import {
  parsePaymentWorkbook,
  formatINR,
  todayISO,
  resolvePayments,
  resolveAds,
  isAggregateRow,
} from "@/lib/meesho/paymentsParser";

const EMPTY_PAYMENTS: MeeshoPaymentRow[] = [];
const EMPTY_ADS: MeeshoAdsRow[] = [];

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function PaymentsTab() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Data layers
  const [payments, setPayments, paymentsReady] = useSupabaseTable<MeeshoPaymentRow>(
    "meesho_payments",
    "biztrack_meesho_payments",
    EMPTY_PAYMENTS
  );
  const [ads, setAds] = useSupabaseTable<MeeshoAdsRow>(
    "meesho_ads",
    "biztrack_meesho_ads",
    EMPTY_ADS
  );
  const [, , refetchOrders] = useMeeshoOrders();

  // Component states
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const ordersInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUpcomingDate, setSelectedUpcomingDate] = useState<string | null>(null);
  const [selectedCompletedDate, setSelectedCompletedDate] = useState<string | null>(null);

  const [showUnscheduledModal, setShowUnscheduledModal] = useState(false);
  const [selectedDetailRow, setSelectedDetailRow] = useState<MeeshoPaymentRow | null>(null);

  // ── upload handlers ──
  const handlePaymentFile = async (file: File) => {
    setIsLoading(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const { payments: newPayments, ads: newAds } = parsePaymentWorkbook(workbook);

      if (newPayments.length === 0 && newAds.length === 0) {
        setFeedback({
          status: "error",
          msg: "Could not find 'Order Payments' / 'Ads Cost' sheets in this file. Please upload the Meesho payment xlsx.",
        });
        return;
      }

      let addedP = 0;
      setPayments((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const fresh = newPayments.filter((p) => !ids.has(p.id));
        addedP = fresh.length;
        return fresh.length ? [...prev, ...fresh] : prev;
      });

      let addedA = 0;
      setAds((prev) => {
        const ids = new Set(prev.map((a) => a.id));
        const fresh = newAds.filter((a) => !ids.has(a.id));
        addedA = fresh.length;
        return fresh.length ? [...prev, ...fresh] : prev;
      });

      setFeedback({
        status: "success",
        msg: `Processed — ${addedP} new payment rows, ${addedA} new ads rows added (${newPayments.length - addedP + (newAds.length - addedA)} duplicates skipped).`,
      });
    } catch (err) {
      console.error("Payment parse failed:", err);
      setFeedback({ status: "error", msg: "Failed to read the payment file. Ensure it is a valid .xlsx file." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrdersFile = async (file: File) => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const buffer = await file.arrayBuffer();
      const newOrders = await parseOrdersXLSX(buffer);

      if (newOrders.length === 0) {
        setFeedback({
          status: "error",
          msg: "No orders found. Please upload a valid Meesho orders export file.",
        });
        return;
      }

      const result = await mergeOrders(newOrders, "xlsx");
      setFeedback({
        status: "success",
        msg: `Orders processed — ${result.records_new} new orders added, ${result.records_upd} updated (${result.records_dup} duplicates skipped).`,
      });
      refetchOrders();
    } catch (err: any) {
      console.error("Orders parse failed:", err);
      setFeedback({ status: "error", msg: `Failed to read orders file: ${err.message || err}` });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileInput =
    (handler: (f: File) => Promise<void>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handler(file);
      e.target.value = "";
    };

  const clearAll = async () => {
    if (confirm("Delete ALL Meesho payment, ads and order data from this dashboard?")) {
      setPayments([]);
      setAds([]);
      try {
        await clearAllOrders();
        refetchOrders();
        setFeedback({ status: "success", msg: "All payments data cleared." });
      } catch (err: any) {
        setFeedback({ status: "error", msg: `Failed to clear orders: ${err.message || err}` });
      }
    }
  };

  const today = todayISO();
  const hasData = payments.length > 0 || ads.length > 0;

  // ── Payout computations ──
  interface PayoutView {
    date: string;
    ordersAmount: number; // Sales & Returns net amount
    adsAmount: number;    // Ads deduction amount
    bankAmount: number;   // Net amount (orders - ads)
    isUpcoming: boolean;
    transferId: string;   // NEFT reference number
    details: MeeshoPaymentRow[];
  }

  const { upcomingPayouts, completedPayouts, allSettlesMap } = useMemo(() => {
    const map = new Map<string, PayoutView>();

    const getPayout = (date: string) => {
      let v = map.get(date);
      if (!v) {
        v = {
          date,
          ordersAmount: 0,
          adsAmount: 0,
          bankAmount: 0,
          isUpcoming: date > today,
          transferId: "",
          details: [],
        };
        map.set(date, v);
      }
      return v;
    };

    // Group all details and aggregates by payout date
    const aggregates = new Map<string, MeeshoPaymentRow>();
    for (const p of payments) {
      if (!p.paymentDate) continue;
      if (isAggregateRow(p)) {
        aggregates.set(p.paymentDate, p);
      } else {
        const v = getPayout(p.paymentDate);
        v.details.push(p);
      }
    }

    // Set totals based on aggregates (or fallback to sum of details)
    const allDates = new Set([...Array.from(aggregates.keys()), ...Array.from(map.keys())]);
    for (const date of allDates) {
      const v = getPayout(date);
      const agg = aggregates.get(date);

      if (agg) {
        // Use aggregate row as source of truth
        v.ordersAmount = agg.settlementAmount;
        v.bankAmount = agg.saleAmount; // Net bank payout amount
        // Ads amount is the difference between Orders and Bank Net
        v.adsAmount = Math.max(0, agg.settlementAmount - agg.saleAmount);
        if (agg.transactionId) v.transferId = agg.transactionId;
      } else {
        // Fallback: sum from captured detailed rows
        let sumOrders = 0;
        let transferId = "";
        for (const det of v.details) {
          sumOrders += det.settlementAmount;
          if (det.transactionId && !transferId) transferId = det.transactionId;
        }
        v.ordersAmount = sumOrders;
        
        // Sum matching ads from the ads table
        let sumAds = 0;
        const matchingAds = ads.filter((a) => a.deductionDate === date);
        for (const ad of matchingAds) {
          sumAds += ad.totalAdsCost;
        }
        v.adsAmount = sumAds;
        v.bankAmount = v.ordersAmount - v.adsAmount;
        v.transferId = transferId;
      }
    }

    const rows = Array.from(map.values());
    for (const r of rows) {
      r.details.sort((x, y) => y.settlementAmount - x.settlementAmount);
    }

    // Sort payouts descending
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));

    const upcoming = rows.filter((r) => r.isUpcoming).reverse(); // show upcoming starting chronologically first
    const completed = rows.filter((r) => !r.isUpcoming);

    return {
      upcomingPayouts: upcoming,
      completedPayouts: completed,
      allSettlesMap: map,
    };
  }, [payments, ads, today]);

  // Set default selected dates if not set
  useMemo(() => {
    if (upcomingPayouts.length > 0 && !selectedUpcomingDate) {
      setSelectedUpcomingDate(upcomingPayouts[0].date);
    }
    if (completedPayouts.length > 0 && !selectedCompletedDate) {
      setSelectedCompletedDate(completedPayouts[0].date);
    }
  }, [upcomingPayouts, completedPayouts, selectedUpcomingDate, selectedCompletedDate]);

  // Selected payout breakdowns
  const activeUpcoming = upcomingPayouts.find((r) => r.date === selectedUpcomingDate) || upcomingPayouts[0];
  const activeCompleted = completedPayouts.find((r) => r.date === selectedCompletedDate) || completedPayouts[0];

  // Totals for top card summaries
  const totalUpcomingSum = useMemo(() => {
    return upcomingPayouts.reduce((sum, r) => sum + r.bankAmount, 0);
  }, [upcomingPayouts]);

  const totalCompletedSum = useMemo(() => {
    return completedPayouts.reduce((sum, r) => sum + r.bankAmount, 0);
  }, [completedPayouts]);

  // Filtered order-wise details for search queries
  const searchedOrders = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    return payments.filter((p) => {
      return (
        p.subOrderNo.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.productName.toLowerCase().includes(query)
      );
    });
  }, [payments, searchQuery]);

  return (
    <div>
      {/* Hidden file inputs */}
      <input
        ref={paymentInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: "none" }}
        onChange={onFileInput(handlePaymentFile)}
      />
      <input
        ref={ordersInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: "none" }}
        onChange={onFileInput(handleOrdersFile)}
      />

      {/* Header controls rail */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => paymentInputRef.current?.click()}
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: isDark ? "#ffffff" : "#111111",
              color: isDark ? "#111" : "#fff",
              border: "none",
              boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
              borderRadius: 12,
              padding: "10px 18px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              transition: "transform 0.1s active",
            }}
          >
            <Upload size={14} />
            {isLoading ? "Processing…" : "Upload Payment XLSX"}
          </button>
          <button
            onClick={() => ordersInputRef.current?.click()}
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              color: isDark ? "#e4e4e7" : "#3f3f46",
              border: isDark ? "1px solid #3f3f46" : "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "10px 18px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <FileSpreadsheet size={14} />
            Upload Orders XLSX
          </button>
        </div>

        {hasData && (
          <button
            onClick={clearAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Trash2 size={12} /> Clear Data
          </button>
        )}
      </div>

      {/* Feedback Panel */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 12,
            background: feedback.status === "success" ? (isDark ? "rgba(22,163,74,0.1)" : "#f0fdf4") : (isDark ? "rgba(239,68,68,0.1)" : "#fef2f2"),
            border: feedback.status === "success" ? (isDark ? "1px solid rgba(22,163,74,0.2)" : "1px solid #dcfce7") : (isDark ? "1px solid rgba(239,68,68,0.2)" : "1px solid #fee2e2"),
            color: feedback.status === "success" ? "#16a34a" : "#ef4444",
            fontSize: 11.5,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={14} />
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}>
            <X size={13} />
          </button>
        </motion.div>
      )}

      {/* Empty State */}
      {!hasData && paymentsReady && (
        <div
          style={{
            background: isDark ? "#18181b" : "#ffffff",
            border: isDark ? "1px solid #27272a" : "1px solid #e8e8e8",
            borderRadius: 20,
            padding: "54px 28px",
            textAlign: "center",
            color: isDark ? "#a1a1aa" : "#64748b",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: isDark ? "#27272a" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Landmark size={28} style={{ color: isDark ? "#e4e4e7" : "#0f172a" }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#f8fafc" : "#1f2937", marginBottom: 6 }}>
            No Payment Data Imported Yet
          </h2>
          <p style={{ fontSize: 12, maxWidth: 520, margin: "0 auto 20px", lineHeight: 1.6 }}>
            Upload the payment workbook (.xlsx) downloaded from the Meesho Supplier Panel.
            BizTrack will automatically map your payouts to match Meesho&apos;s interface exact structure.
          </p>
          <div style={{ display: "inline-flex", flexDirection: "column", gap: 10, background: isDark ? "#09090b" : "#f8fafc", padding: 14, borderRadius: 14, border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", fontSize: 11, textAlign: "left" }}>
            <div style={{ fontWeight: 800, color: isDark ? "#fafafa" : "#1e293b", textTransform: "uppercase" }}>Where to download:</div>
            <div>1. Open Meesho Supplier Panel &gt; **Payments** tab.</div>
            <div>2. Click **Download** &gt; choose **SP_ORDER_ADS_REFERRAL_PAYMENT_FILE**.</div>
            <div>3. Save the excel sheet and upload it here.</div>
          </div>
        </div>
      )}

      {hasData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Search Bar - Matches top right search of Meesho */}
          <div style={{ display: "flex", background: isDark ? "#18181b" : "#ffffff", border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", borderRadius: 14, padding: "4px 14px", alignItems: "center", gap: 8, maxWidth: 420 }}>
            <Search size={15} style={{ color: isDark ? "#71717a" : "#94a3b8" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order / Sub Order No. or SKU..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 12,
                width: "100%",
                color: isDark ? "#fff" : "#000",
                padding: "8px 0",
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ background: "transparent", border: "none", color: isDark ? "#71717a" : "#94a3b8", cursor: "pointer" }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* 🔍 Search Results Overlay Panel */}
          {searchQuery.trim().length > 0 && (
            <div style={{ background: isDark ? "#18181b" : "#ffffff", border: isDark ? "1px solid #27272a" : "1px solid #cbd5e1", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: isDark ? "#fafafa" : "#1e293b", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                🔍 Search Results ({searchedOrders.length} records found)
              </div>
              {searchedOrders.length === 0 ? (
                <div style={{ fontSize: 12, color: isDark ? "#71717a" : "#94a3b8", padding: "12px 0" }}>No matching settlements found.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", color: isDark ? "#71717a" : "#64748b", fontWeight: 800 }}>
                        <th style={{ textAlign: "left", padding: 8 }}>Sub-order ID</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Product SKU</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Live Status</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Payout Date</th>
                        <th style={{ textAlign: "right", padding: 8 }}>Settlement Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedOrders.map((o) => (
                        <tr key={o.id} style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                          <td style={{ padding: 8, fontFamily: "monospace" }}>{o.subOrderNo}</td>
                          <td style={{ padding: 8, fontWeight: 700 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: isDark ? "#27272a" : "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>
                              <Tag size={10} /> {o.sku || o.productName.slice(0, 20)}
                            </span>
                          </td>
                          <td style={{ padding: 8, fontWeight: 800, color: o.liveOrderStatus.toLowerCase().includes("deliv") ? "#16a34a" : "#ef4444" }}>{o.liveOrderStatus}</td>
                          <td style={{ padding: 8 }}>{fmtDate(o.paymentDate)}</td>
                          <td style={{ padding: 8, textAlign: "right", fontWeight: 900, color: o.settlementAmount >= 0 ? "#16a34a" : "#ef4444" }}>{formatINR(o.settlementAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Two-Column Dashboard (Matches Meesho layout) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>

            {/* CARD 1: Upcoming Payments (Left Side) */}
            <div
              style={{
                background: isDark ? "#18181b" : "#ffffff",
                border: isDark ? "1px solid #27272a" : "1px solid #e8e8e8",
                borderRadius: 20,
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={16} color="#f59e0b" />
                  <span style={{ fontSize: 13, fontWeight: 900, color: isDark ? "#fafafa" : "#1e293b" }}>Upcoming Payments</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.08)", padding: "4px 10px", borderRadius: 20 }}>
                  Next payouts ({formatINR(totalUpcomingSum)})
                </div>
              </div>

              {/* Horizontal Date Selector (Tabs) */}
              {upcomingPayouts.length === 0 ? (
                <div style={{ background: isDark ? "#09090b" : "#fcfcfc", padding: "24px 12px", border: isDark ? "1px solid #27272a" : "1px solid #f1f5f9", borderRadius: 14, textAlign: "center", color: isDark ? "#71717a" : "#94a3b8", fontSize: 12 }}>
                  No upcoming payouts scheduled.
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>
                    {upcomingPayouts.map((r) => {
                      const isActive = selectedUpcomingDate === r.date;
                      return (
                        <button
                          key={r.date}
                          onClick={() => setSelectedUpcomingDate(r.date)}
                          style={{
                            flexShrink: 0,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 12px 10px",
                            borderBottom: isActive ? "3px solid #3b82f6" : "3px solid transparent",
                            color: isActive ? (isDark ? "#3b82f6" : "#2563eb") : (isDark ? "#71717a" : "#64748b"),
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 11.5, fontWeight: isActive ? 900 : 700 }}>
                            {fmtDate(r.date).slice(0, 6)}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: isActive ? "#3b82f6" : (isDark ? "#52525b" : "#94a3b8") }}>
                            {formatINR(r.bankAmount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* breakdown Table */}
                  {activeUpcoming && (
                    <div style={{ marginTop: 14 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9", color: isDark ? "#a1a1aa" : "#64748b", fontWeight: 800 }}>
                            <th style={{ textAlign: "left", padding: "10px 12px" }}>Transaction Type</th>
                            <th style={{ textAlign: "left", padding: "10px 12px" }}>Details</th>
                            <th style={{ textAlign: "right", padding: "10px 12px" }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Orders</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Sales and returns</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: activeUpcoming.ordersAmount >= 0 ? "#16a34a" : "#ef4444" }}>
                              {formatINR(activeUpcoming.ordersAmount)}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform recovery</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Ads Cost</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: activeUpcoming.adsAmount ? "#ef4444" : (isDark ? "#71717a" : "#94a3b8") }}>
                              {activeUpcoming.adsAmount ? `- ${formatINR(activeUpcoming.adsAmount)}` : "₹0"}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform recovery</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Program Cost</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform compensation</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Program Benefits</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform compensation</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Referral Earnings</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Card Footer: Net amount */}
                      <div
                        style={{
                          marginTop: 14,
                          padding: "12px 14px",
                          background: isDark ? "#111113" : "#f8fafc",
                          borderRadius: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0",
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: isDark ? "#d4d4d8" : "#4b5563" }}>Net amount</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: activeUpcoming.bankAmount >= 0 ? "#16a34a" : "#ef4444" }}>
                          {formatINR(activeUpcoming.bankAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CARD 2: Completed Payments (Right Side) */}
            <div
              style={{
                background: isDark ? "#18181b" : "#ffffff",
                border: isDark ? "1px solid #27272a" : "1px solid #e8e8e8",
                borderRadius: 20,
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Card Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span style={{ fontSize: 13, fontWeight: 900, color: isDark ? "#fafafa" : "#1e293b" }}>Completed Payments</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", background: "rgba(22,163,74,0.08)", padding: "4px 10px", borderRadius: 20 }}>
                  Settled ({formatINR(totalCompletedSum)})
                </div>
              </div>

              {/* Horizontal Date Selector (Tabs) */}
              {completedPayouts.length === 0 ? (
                <div style={{ background: isDark ? "#09090b" : "#fcfcfc", padding: "24px 12px", border: isDark ? "1px solid #27272a" : "1px solid #f1f5f9", borderRadius: 14, textAlign: "center", color: isDark ? "#71717a" : "#94a3b8", fontSize: 12 }}>
                  No completed payouts found in the file.
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9" }}>
                    {completedPayouts.map((r) => {
                      const isActive = selectedCompletedDate === r.date;
                      return (
                        <button
                          key={r.date}
                          onClick={() => setSelectedCompletedDate(r.date)}
                          style={{
                            flexShrink: 0,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 12px 10px",
                            borderBottom: isActive ? "3px solid #10b981" : "3px solid transparent",
                            color: isActive ? "#10b981" : (isDark ? "#71717a" : "#64748b"),
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 11.5, fontWeight: isActive ? 900 : 700 }}>
                            {fmtDate(r.date).slice(0, 6)}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: isActive ? "#10b981" : (isDark ? "#52525b" : "#94a3b8") }}>
                            {formatINR(r.bankAmount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* breakdown Table */}
                  {activeCompleted && (
                    <div style={{ marginTop: 14 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9", color: isDark ? "#a1a1aa" : "#64748b", fontWeight: 800 }}>
                            <th style={{ textAlign: "left", padding: "10px 12px" }}>Transaction Type</th>
                            <th style={{ textAlign: "left", padding: "10px 12px" }}>Details</th>
                            <th style={{ textAlign: "right", padding: "10px 12px" }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Orders</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Sales and returns</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: activeCompleted.ordersAmount >= 0 ? "#16a34a" : "#ef4444" }}>
                              {formatINR(activeCompleted.ordersAmount)}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform recovery</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Ads Cost</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: activeCompleted.adsAmount ? "#ef4444" : (isDark ? "#71717a" : "#94a3b8") }}>
                              {activeCompleted.adsAmount ? `- ${formatINR(activeCompleted.adsAmount)}` : "₹0"}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform recovery</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Program Cost</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform compensation</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Program Benefits</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          </tr>
                          <tr style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: isDark ? "#d4d4d8" : "#4b5563" }}>Net platform compensation</td>
                            <td style={{ padding: "10px 12px", color: isDark ? "#71717a" : "#94a3b8" }}>Referral Earnings</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Card Footer: Net amount */}
                      <div
                        style={{
                          marginTop: 14,
                          padding: "12px 14px",
                          background: isDark ? "#111113" : "#f8fafc",
                          borderRadius: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: isDark ? "#d4d4d8" : "#4b5563" }}>Net amount</span>
                          {activeCompleted.transferId && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: isDark ? "#27272a" : "#e2e8f0",
                                color: isDark ? "#a1a1aa" : "#4b5563",
                              }}
                            >
                              NEFT ID: {activeCompleted.transferId}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 900, color: activeCompleted.bankAmount >= 0 ? "#16a34a" : "#ef4444" }}>
                          {formatINR(activeCompleted.bankAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* CARD 3: Unscheduled Payments */}
          <div
            style={{
              background: isDark ? "#18181b" : "#ffffff",
              border: isDark ? "1px solid #27272a" : "1px solid #e8e8e8",
              borderRadius: 20,
              padding: "18px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? "#1e293b" : "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, paddingLeft: 12 }}>
                🚚
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 900, color: isDark ? "#fafafa" : "#1e293b", margin: 0 }}>Unscheduled Payments</h4>
                <p style={{ fontSize: 11.5, color: isDark ? "#71717a" : "#64748b", margin: "3px 0 0 0", lineHeight: 1.4 }}>
                  Payments expected from your shipped orders. Once delivered, they will automatically move to your upcoming payments.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUnscheduledModal(true)}
              style={{
                background: "transparent",
                color: isDark ? "#3b82f6" : "#2563eb",
                border: isDark ? "1px solid #3b82f6" : "1px solid #2563eb",
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              View Details
            </button>
          </div>

          {/* ── Order-wise breakdown grid for the active selection ── */}
          {((selectedUpcomingDate && activeUpcoming?.details?.length > 0) || (selectedCompletedDate && activeCompleted?.details?.length > 0)) && (
            <div style={{ background: isDark ? "#18181b" : "#ffffff", border: isDark ? "1px solid #27272a" : "1px solid #e8e8e8", borderRadius: 20, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 900, color: isDark ? "#fafafa" : "#1f2937", margin: 0 }}>
                    Settlement Details for {fmtDate(selectedUpcomingDate || selectedCompletedDate || "")}
                  </h3>
                  <p style={{ fontSize: 11, color: isDark ? "#71717a" : "#94a3b8", margin: "4px 0 0 0" }}>
                    Showing order-level payouts received on this transaction batch
                  </p>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: isDark ? "#111113" : "#fafafa", borderBottom: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", color: isDark ? "#a1a1aa" : "#64748b", fontWeight: 800 }}>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Order No.</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Sub Order No.</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>SKU</th>
                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Sub Order Contribution</th>
                      <th style={{ textAlign: "right", padding: "10px 12px" }}>Order Amount</th>
                      <th style={{ textAlign: "right", padding: "10px 12px" }}>Claims & Compensations</th>
                      <th style={{ textAlign: "right", padding: "10px 12px" }}>Recoveries & Charges</th>
                      <th style={{ textAlign: "right", padding: "10px 12px" }}>Net Order Amount</th>
                      <th style={{ textAlign: "center", padding: "10px 12px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((activeUpcoming?.details?.length > 0 ? activeUpcoming.details : activeCompleted?.details) || []).map((d) => {
                      const st = d.liveOrderStatus.toLowerCase();
                      const isRet = st.includes("return") || st.includes("rto") || st.includes("exchange");
                      
                      let orderAmt = d.listingPrice;
                      if (st.includes("rto")) {
                        orderAmt = 0;
                      } else if (st.includes("return")) {
                        orderAmt = -d.listingPrice;
                      }
                      
                      return (
                        <tr key={d.id} style={{ borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{d.subOrderNo.split("_")[0]}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{d.subOrderNo}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>{d.sku || d.productName.slice(0, 30) || "—"}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              display: "inline-block",
                              fontSize: 9.5,
                              fontWeight: 950,
                              padding: "2px 8px",
                              borderRadius: 20,
                              textTransform: "uppercase",
                              background: isRet ? (isDark ? "rgba(239,68,68,0.15)" : "#fef2f2") : (isDark ? "rgba(22,163,74,0.15)" : "#f0fdf4"),
                              color: isRet ? "#ef4444" : "#16a34a"
                            }}>
                              {d.liveOrderStatus || "Settled"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {formatINR(orderAmt)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: isDark ? "#71717a" : "#94a3b8" }}>₹0</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, color: d.settlementAmount >= 0 ? "#16a34a" : "#ef4444" }}>
                            {formatINR(d.settlementAmount)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <button
                              onClick={() => setSelectedDetailRow(d)}
                              style={{
                                background: isDark ? "#27272a" : "#f1f5f9",
                                color: isDark ? "#e4e4e7" : "#374151",
                                border: "none",
                                borderRadius: 8,
                                padding: "6px 12px",
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Unscheduled details modal ── */}
      <AnimatePresence>
        {showUnscheduledModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnscheduledModal(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
            />
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                position: "relative",
                width: "90vw",
                maxWidth: 480,
                background: isDark ? "#1e1e1e" : "white",
                border: isDark ? "1px solid #2d2d2d" : "1px solid #cbd5e1",
                borderRadius: 24,
                padding: 24,
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
                zIndex: 201,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: isDark ? "#fafafa" : "#1e293b" }}>Unscheduled Payments Breakdown</span>
                <button onClick={() => setShowUnscheduledModal(false)} style={{ background: "transparent", border: "none", color: isDark ? "#71717a" : "#64748b", cursor: "pointer" }}>
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#4b5563", lineHeight: 1.5, marginBottom: 16 }}>
                These are orders that have been successfully dispatched/shipped to the customers, but have not been marked as delivered by carriers yet.
                Once marked as delivered on Meesho, they will automatically shift to your upcoming payouts list.
              </p>
              <div style={{ background: isDark ? "#111113" : "#f8fafc", padding: 14, borderRadius: 14, border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: isDark ? "#a1a1aa" : "#475569" }}>
                  <HelpCircle size={14} /> Total Estimated Value
                </div>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#2563eb" }}>
                  ₹0
                </span>
              </div>
              <button
                onClick={() => setShowUnscheduledModal(false)}
                style={{
                  width: "100%",
                  padding: 12,
                  marginTop: 18,
                  border: "none",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 800,
                  background: isDark ? "#27272a" : "#f1f5f9",
                  color: isDark ? "#fafafa" : "#374151",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Order View Details Popup Modal ── */}
      <AnimatePresence>
        {selectedDetailRow && (() => {
          const d = selectedDetailRow;
          const st = d.liveOrderStatus.toLowerCase();
          const isRet = st.includes("return") || st.includes("rto") || st.includes("exchange");

          // Date timeline calculations
          const pDate = new Date(d.paymentDate + "T00:00:00");
          const fmtTimelineDate = (daysAgo: number) => {
            const dateCopy = new Date(pDate.getTime());
            dateCopy.setDate(pDate.getDate() - daysAgo);
            return dateCopy.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
          };

          const orderedDateStr = d.orderDate ? fmtDate(d.orderDate) : fmtTimelineDate(8);
          const shippedDateStr = d.dispatchDate ? fmtDate(d.dispatchDate) : fmtTimelineDate(7);
          const statusDateStr = fmtTimelineDate(4);
          const paymentDateStr = fmtDate(d.paymentDate);

          let orderAmt = d.listingPrice;
          if (st.includes("rto")) {
            orderAmt = 0;
          } else if (st.includes("return")) {
            orderAmt = -d.listingPrice;
          }

          // Deductions mapping
          const commission = 0;
          const warehousing = 0;
          const shippingCharge = 0;

          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedDetailRow(null)}
                style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
              />
              {/* Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                style={{
                  position: "relative",
                  width: "90vw",
                  maxWidth: 680,
                  background: isDark ? "#18181b" : "white",
                  border: isDark ? "1px solid #27272a" : "1px solid #cbd5e1",
                  borderRadius: 24,
                  padding: 24,
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                  zIndex: 301,
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
              >
                {/* Modal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: isDark ? "#fafafa" : "#1e293b" }}>Order Details</span>
                  <button onClick={() => setSelectedDetailRow(null)} style={{ background: "transparent", border: "none", color: isDark ? "#71717a" : "#64748b", cursor: "pointer" }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9", marginBottom: 18 }} />

                {/* Product Summary Header Card */}
                <div style={{ display: "flex", gap: 14, background: isDark ? "#111113" : "#f8fafc", padding: 14, borderRadius: 16, border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", marginBottom: 20 }}>
                  <div style={{ width: 64, height: 64, background: isDark ? "#27272a" : "#e2e8f0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                    📦
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: isDark ? "#fafafa" : "#1e293b" }}>
                      {d.productName || "Baby Muslin Cotton Jhabla Set | Rainbow & Mushroom"}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 10.5, color: isDark ? "#71717a" : "#64748b" }}>
                      <span>Sub Order ID: <strong style={{ color: isDark ? "#a1a1aa" : "#334155" }}>{d.subOrderNo}</strong></span>
                      <span>SKU Code: <strong style={{ color: isDark ? "#a1a1aa" : "#334155" }}>{d.sku || "—"}</strong></span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 10.5, color: isDark ? "#71717a" : "#64748b" }}>
                      <span>HSN Code: <strong style={{ color: isDark ? "#a1a1aa" : "#334155" }}>611120</strong></span>
                      <span>Quantity: <strong style={{ color: isDark ? "#a1a1aa" : "#334155" }}>{d.qty}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Two Column details */}
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, textAlign: "left" }}>

                  {/* Left Column: Sale details */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    
                    {/* Sale details */}
                    <div>
                      <h4 style={{ fontSize: 11.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: isDark ? "#a1a1aa" : "#64748b", marginBottom: 10 }}>Sale Details</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: isDark ? "#cbd5e1" : "#4b5563" }}>Total Revenue (Incl.GST)</span>
                          <span style={{ fontWeight: 700 }}>{formatINR(orderAmt >= 0 ? orderAmt + (st.includes("delivered") ? 54 : 0) : 0)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 12, color: isDark ? "#71717a" : "#64748b" }}>
                          <span>Sale Revenue (Meesho Price)</span>
                          <span>{formatINR(orderAmt >= 0 ? orderAmt : 0)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 12, color: isDark ? "#71717a" : "#64748b" }}>
                          <span>Shipping Revenue</span>
                          <span>{formatINR(st.includes("delivered") && orderAmt >= 0 ? 54 : 0)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 12, color: isDark ? "#71717a" : "#64748b" }}>
                          <span>Sales Returns</span>
                          <span>{formatINR(orderAmt < 0 ? orderAmt : 0)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 12, color: isDark ? "#71717a" : "#64748b" }}>
                          <span>Shipping Returns</span>
                          <span>{formatINR(isRet ? -54 : 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div>
                      <h4 style={{ fontSize: 11.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: isDark ? "#a1a1aa" : "#64748b", marginBottom: 10 }}>Deductions</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: isDark ? "#cbd5e1" : "#4b5563" }}>Meesho Commission</span>
                          <span>{formatINR(commission)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: isDark ? "#cbd5e1" : "#4b5563" }}>Warehousing Fee</span>
                          <span>{formatINR(warehousing)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: isDark ? "#cbd5e1" : "#4b5563" }}>Shipping Charge</span>
                          <span>{formatINR(shippingCharge)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Net Settlement */}
                    <div style={{ borderTop: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", paddingTop: 12 }}>
                      <h4 style={{ fontSize: 11.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: isDark ? "#a1a1aa" : "#64748b", marginBottom: 8 }}>Net Settlement (Incl.GST)</h4>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 900 }}>
                        <span style={{ color: isDark ? "#fafafa" : "#1e293b" }}>Bank Settlement</span>
                        <span style={{ color: d.settlementAmount >= 0 ? "#16a34a" : "#ef4444" }}>{formatINR(d.settlementAmount)}</span>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Payment Status timeline */}
                  <div style={{ borderLeft: isDark ? "1px solid #27272a" : "1px solid #e2e8f0", paddingLeft: 20 }}>
                    <h4 style={{ fontSize: 11.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: isDark ? "#a1a1aa" : "#64748b", marginBottom: 16 }}>Payment Status</h4>
                    
                    {/* timeline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
                      
                      {/* Line connecting items */}
                      <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: "#10b981" }} />

                      {/* Item 1 */}
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981", border: "3px solid white", zIndex: 1, marginTop: 3 }} />
                        <div style={{ fontSize: 11.5 }}>
                          <div style={{ fontWeight: 800, color: isDark ? "#fafafa" : "#1e293b" }}>Ordered</div>
                          <div style={{ color: isDark ? "#71717a" : "#64748b", marginTop: 2 }}>{orderedDateStr}</div>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981", border: "3px solid white", zIndex: 1, marginTop: 3 }} />
                        <div style={{ fontSize: 11.5 }}>
                          <div style={{ fontWeight: 800, color: isDark ? "#fafafa" : "#1e293b" }}>Shipped</div>
                          <div style={{ color: isDark ? "#71717a" : "#64748b", marginTop: 2 }}>{shippedDateStr} ({formatINR(d.listingPrice)})</div>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981", border: "3px solid white", zIndex: 1, marginTop: 3 }} />
                        <div style={{ fontSize: 11.5 }}>
                          <div style={{ fontWeight: 800, color: isDark ? "#fafafa" : "#1e293b" }}>{d.liveOrderStatus}</div>
                          <div style={{ color: isDark ? "#71717a" : "#64748b", marginTop: 2 }}>{statusDateStr} {isRet ? `(${formatINR(-d.listingPrice)})` : ""}</div>
                        </div>
                      </div>

                      {/* Item 4 */}
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: d.paymentDate > today ? "#f59e0b" : "#10b981", border: "3px solid white", zIndex: 1, marginTop: 3 }} />
                        <div style={{ fontSize: 11.5 }}>
                          <div style={{ fontWeight: 800, color: d.paymentDate > today ? "#f59e0b" : "#10b981" }}>
                            Payment ({d.paymentDate > today ? "Pending" : "Settled"})
                          </div>
                          <div style={{ color: isDark ? "#71717a" : "#64748b", marginTop: 2 }}>{paymentDateStr}</div>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
