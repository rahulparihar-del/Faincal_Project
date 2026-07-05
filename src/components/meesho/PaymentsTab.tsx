"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  IndianRupee,
  Clock,
  Megaphone,
  Package,
  CheckCircle,
  X,
  Trash2,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import {
  MeeshoPaymentRow,
  MeeshoAdsRow,
  MeeshoOrderLogRow,
  parsePaymentWorkbook,
  parseOrdersWorkbook,
  buildDailyRows,
  buildSummary,
  formatINR,
  todayISO,
} from "@/lib/meesho/paymentsParser";

const EMPTY_PAYMENTS: MeeshoPaymentRow[] = [];
const EMPTY_ADS: MeeshoAdsRow[] = [];
const EMPTY_ORDERS: MeeshoOrderLogRow[] = [];

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const d = new Date(key + "-01T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function PaymentsTab() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
  const [orderLog, setOrderLog] = useSupabaseTable<MeeshoOrderLogRow>(
    "meesho_order_log",
    "biztrack_meesho_order_log",
    EMPTY_ORDERS
  );

  const [feedback, setFeedback] = useState<{ status: "success" | "error"; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const ordersInputRef = useRef<HTMLInputElement>(null);

  // ── upload handlers ──────────────────────────────────────────────

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
          msg: "Could not find 'Order Payments' / 'Ads Cost' sheets in this file. Please upload the Meesho payment xlsx (SP_ORDER_ADS_REFERRAL_PAYMENT_FILE...).",
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
        msg: `Payment file processed — ${addedP} new payment rows, ${addedA} new ads rows added (${newPayments.length - addedP + (newAds.length - addedA)} duplicates skipped).`,
      });
    } catch (err) {
      console.error("Payment file parse failed:", err);
      setFeedback({ status: "error", msg: "Failed to read the payment file. Make sure it is a valid .xlsx file." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrdersFile = async (file: File) => {
    setIsLoading(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const rows = parseOrdersWorkbook(workbook);

      if (rows.length === 0) {
        setFeedback({
          status: "error",
          msg: "No orders found — couldn't locate 'Sub Order No' + 'Order Date' columns in this file.",
        });
        return;
      }

      let added = 0;
      setOrderLog((prev) => {
        const ids = new Set(prev.map((o) => o.id));
        const fresh = rows.filter((o) => !ids.has(o.id));
        added = fresh.length;
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      setFeedback({
        status: "success",
        msg: `Orders file processed — ${added} new orders added (${rows.length - added} duplicates skipped).`,
      });
    } catch (err) {
      console.error("Orders file parse failed:", err);
      setFeedback({ status: "error", msg: "Failed to read the orders file. Make sure it is a valid .xlsx file." });
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

  const clearAll = () => {
    if (
      confirm(
        "Delete ALL Meesho payment, ads and order-log data from this dashboard (and cloud database)?"
      )
    ) {
      setPayments([]);
      setAds([]);
      setOrderLog([]);
      setFeedback({ status: "success", msg: "All payments dashboard data cleared." });
    }
  };

  // ── derived data ─────────────────────────────────────────────────

  const months = useMemo(() => {
    const s = new Set<string>();
    for (const p of payments) {
      if (p.orderDate) s.add(monthKey(p.orderDate));
      if (p.paymentDate) s.add(monthKey(p.paymentDate));
    }
    for (const a of ads) s.add(monthKey(a.deductionDuration || a.deductionDate));
    for (const o of orderLog) if (o.orderDate) s.add(monthKey(o.orderDate));
    return Array.from(s).filter(Boolean).sort().reverse();
  }, [payments, ads, orderLog]);

  const filtered = useMemo(() => {
    if (monthFilter === "all") return { payments, ads, orderLog };
    return {
      payments: payments.filter(
        (p) =>
          (p.orderDate && monthKey(p.orderDate) === monthFilter) ||
          (p.paymentDate && monthKey(p.paymentDate) === monthFilter)
      ),
      ads: ads.filter((a) => monthKey(a.deductionDuration || a.deductionDate) === monthFilter),
      orderLog: orderLog.filter((o) => o.orderDate && monthKey(o.orderDate) === monthFilter),
    };
  }, [payments, ads, orderLog, monthFilter]);

  const summary = useMemo(
    () => buildSummary(filtered.payments, filtered.ads, filtered.orderLog),
    [filtered]
  );
  const dailyRows = useMemo(
    () => buildDailyRows(filtered.payments, filtered.ads, filtered.orderLog),
    [filtered]
  );

  const today = todayISO();
  const hasData = payments.length > 0 || ads.length > 0 || orderLog.length > 0;

  // ── styles ───────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: isDark ? "#18181b" : "#ffffff",
    border: isDark ? "1px solid #27272a" : "1px solid #e8e8e8",
    borderRadius: 16,
    padding: "16px 18px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: isDark ? "#71717a" : "#888",
  };
  const thStyle: React.CSSProperties = {
    textAlign: "right",
    padding: "10px 12px",
    fontSize: 10.5,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: isDark ? "#a1a1aa" : "#64748b",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    textAlign: "right",
    padding: "10px 12px",
    fontSize: 12.5,
    color: isDark ? "#e4e4e7" : "#1e293b",
    whiteSpace: "nowrap",
  };

  const statCards: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    color: string;
  }[] = [
    {
      label: "Total Orders",
      value: String(summary.totalOrders),
      sub: `${summary.delivered} delivered · ${summary.returned} return/RTO`,
      icon: Package,
      color: isDark ? "#fafafa" : "#111111",
    },
    {
      label: "Payment Received",
      value: formatINR(summary.settledAmount),
      sub: "Settled till today (aa chuka)",
      icon: IndianRupee,
      color: "#16a34a",
    },
    {
      label: "Upcoming Payment",
      value: formatINR(summary.upcomingAmount),
      sub: "Future payment dates (aane wala)",
      icon: Clock,
      color: "#f59e0b",
    },
    {
      label: "Ads Spend",
      value: formatINR(summary.totalAds),
      sub: "Total deducted for ads",
      icon: Megaphone,
      color: "#ef4444",
    },
    {
      label: "Net (after ads)",
      value: formatINR(summary.net),
      sub: "Received + upcoming − ads",
      icon: TrendingUp,
      color: summary.net >= 0 ? "#16a34a" : "#ef4444",
    },
  ];

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

      {/* Upload row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <button
          onClick={() => paymentInputRef.current?.click()}
          disabled={isLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: isDark ? "#fafafa" : "#111111",
            color: isDark ? "#111" : "#fff",
            border: "none",
            boxShadow: "0 3px 10px rgba(0,0,0,0.2)",
            borderRadius: 12,
            padding: "10px 18px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            opacity: isLoading ? 0.6 : 1,
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
            color: isDark ? "#e4e4e7" : "#111",
            border: isDark ? "1px solid #3f3f46" : "1px solid #cbd5e1",
            borderRadius: 12,
            padding: "10px 18px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          <FileSpreadsheet size={14} />
          Upload Orders XLSX
        </button>

        {months.length > 0 && (
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{
              marginLeft: "auto",
              background: isDark ? "#18181b" : "#fff",
              color: isDark ? "#e4e4e7" : "#111",
              border: isDark ? "1px solid #3f3f46" : "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        )}

        {hasData && (
          <button
            onClick={clearAll}
            title="Clear all payments data"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 14,
            background:
              feedback.status === "success"
                ? isDark
                  ? "rgba(22,163,74,0.1)"
                  : "#f0fdf4"
                : isDark
                  ? "rgba(239,68,68,0.1)"
                  : "#fef2f2",
            border:
              feedback.status === "success"
                ? isDark
                  ? "1px solid rgba(22,163,74,0.3)"
                  : "1px solid #dcfce7"
                : isDark
                  ? "1px solid rgba(239,68,68,0.3)"
                  : "1px solid #fee2e2",
            color:
              feedback.status === "success"
                ? isDark
                  ? "#4ade80"
                  : "#16a34a"
                : isDark
                  ? "#f87171"
                  : "#ef4444",
            fontSize: 11,
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
          <button
            onClick={() => setFeedback(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex" }}
          >
            <X size={12} />
          </button>
        </motion.div>
      )}

      {/* Empty state */}
      {!hasData && paymentsReady && (
        <div
          style={{
            ...cardStyle,
            padding: "48px 24px",
            textAlign: "center",
            color: isDark ? "#71717a" : "#94a3b8",
          }}
        >
          <FileSpreadsheet size={36} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <p style={{ fontSize: 14, fontWeight: 800, color: isDark ? "#e4e4e7" : "#334155", marginBottom: 6 }}>
            Upload your Meesho payment file to get started
          </p>
          <p style={{ fontSize: 12, maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Meesho Supplier Panel → Payments → download the payment xlsx
            (SP_ORDER_ADS_REFERRAL_PAYMENT_FILE…). Upload it here daily — duplicates are skipped
            automatically. Optionally upload the orders xlsx too so daily order counts include
            orders that haven&apos;t settled yet.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 24,
            }}
          >
            {statCards.map((c, ci) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ci * 0.06, duration: 0.35, ease: "easeOut" }}
                style={cardStyle}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={labelStyle}>{c.label}</span>
                  <c.icon size={15} style={{ color: c.color }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", color: isDark ? "#fafafa" : "#111" }}>
                  {c.value}
                </div>
                {c.sub && (
                  <div style={{ fontSize: 10.5, color: isDark ? "#71717a" : "#94a3b8", marginTop: 4 }}>{c.sub}</div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Daily breakdown table */}
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <RotateCcw size={13} style={{ color: isDark ? "#fafafa" : "#111111" }} />
              <span style={{ fontSize: 13, fontWeight: 900, color: isDark ? "#fafafa" : "#111" }}>
                Daily Breakdown
              </span>
              <span style={{ fontSize: 10.5, color: isDark ? "#71717a" : "#94a3b8" }}>
                orders by order date · payment by payout date · ads by spend date
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: isDark ? "#111113" : "#fafafa" }}>
                    <th style={{ ...thStyle, textAlign: "left" }}>Date</th>
                    <th style={thStyle}>Orders</th>
                    <th style={thStyle}>Delivered</th>
                    <th style={thStyle}>Return / RTO</th>
                    <th style={thStyle}>Payment Received</th>
                    <th style={thStyle}>Upcoming</th>
                    <th style={thStyle}>Ads Spend</th>
                    <th style={thStyle}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((r) => {
                    const isToday = r.date === today;
                    return (
                      <tr
                        key={r.date}
                        style={{
                          borderTop: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9",
                          background: isToday ? (isDark ? "rgba(250,250,250,0.05)" : "rgba(0,0,0,0.035)") : "transparent",
                        }}
                      >
                        <td style={{ ...tdStyle, textAlign: "left", fontWeight: 800 }}>
                          {fmtDate(r.date)}
                          {isToday && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 9,
                                fontWeight: 900,
                                padding: "2px 6px",
                                borderRadius: 6,
                                background: isDark ? "rgba(250,250,250,0.14)" : "rgba(0,0,0,0.08)",
                                color: isDark ? "#fafafa" : "#111111",
                              }}
                            >
                              TODAY
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 800 }}>{r.ordersPlaced || "—"}</td>
                        <td style={{ ...tdStyle, color: "#16a34a" }}>{r.delivered || "—"}</td>
                        <td style={{ ...tdStyle, color: r.returned ? "#ef4444" : tdStyle.color }}>
                          {r.returned || "—"}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 800, color: r.paymentSettled ? "#16a34a" : tdStyle.color }}>
                          {r.paymentSettled ? formatINR(r.paymentSettled) : "—"}
                        </td>
                        <td style={{ ...tdStyle, color: r.paymentUpcoming ? "#f59e0b" : tdStyle.color }}>
                          {r.paymentUpcoming ? formatINR(r.paymentUpcoming) : "—"}
                        </td>
                        <td style={{ ...tdStyle, color: r.adsCost ? "#ef4444" : tdStyle.color }}>
                          {r.adsCost ? `− ${formatINR(r.adsCost)}` : "—"}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 900,
                            color: r.net > 0 ? "#16a34a" : r.net < 0 ? "#ef4444" : tdStyle.color,
                          }}
                        >
                          {r.net ? formatINR(r.net) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
