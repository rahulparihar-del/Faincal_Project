"use client";

/**
 * BizTrack — Meesho Orders Tab (Forward Dispatch)
 *
 * NEW WORKFLOW:
 *   Upload CSV daily → stored in Supabase (meesho_orders)
 *   Date boxes on screen = each unique order_date you have data for
 *   Click any date box → modal shows all orders for that day in a table
 *
 * Data flow:
 *   Supabase (meesho_orders) → useMeeshoOrders hook → date-grouped display
 *   File upload (CSV / XLSX)  → ordersParser → orderService.mergeOrders → refetch
 */

import React, { useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, CheckCircle, AlertTriangle, X, Upload,
  FileSpreadsheet, FileText, Search, Trash2, RefreshCw,
  MapPin, Tag, ChevronDown, Calendar, TrendingUp,
  ShoppingCart, IndianRupee,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useMeeshoOrders } from "@/lib/hooks/useMeeshoOrders";
import { mergeOrders, clearAllOrders } from "@/lib/meesho/orderService";
import { parseOrdersCSV, parseOrdersXLSX, SAMPLE_CSV_HEADERS, SAMPLE_CSV_ROWS } from "@/lib/meesho/ordersParser";
import type { MeeshoOrder } from "@/lib/meesho/types";
import type { SyncResult } from "@/lib/meesho/types";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

// ── Status config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; darkBg: string }> = {
  DELIVERED:    { label: "Delivered",   bg: "#f0fdf4", color: "#16a34a", darkBg: "rgba(22,163,74,0.12)" },
  RTO_COMPLETE: { label: "RTO",         bg: "#fff7ed", color: "#ea580c", darkBg: "rgba(234,88,12,0.12)" },
  CANCELLED:    { label: "Cancelled",   bg: "#fef2f2", color: "#ef4444", darkBg: "rgba(239,68,68,0.12)" },
  PENDING:      { label: "Pending",     bg: "#fefce8", color: "#ca8a04", darkBg: "rgba(202,138,4,0.12)" },
  SHIPPED:      { label: "Shipped",     bg: "#eff6ff", color: "#3b82f6", darkBg: "rgba(59,130,246,0.12)" },
  PICKED_UP:    { label: "Picked Up",   bg: "#f5f3ff", color: "#7c3aed", darkBg: "rgba(124,58,237,0.12)" },
};

function getStatusConfig(status: string) {
  const s = String(status).toUpperCase().replace(/\s+/g, "_");
  return STATUS_CONFIG[s] ?? { label: status || "—", bg: "#f8fafc", color: "#64748b", darkBg: "rgba(100,116,139,0.12)" };
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── Feedback Banner ────────────────────────────────────────────────────

function FeedbackBanner({
  result, onDismiss, isDark,
}: {
  result: SyncResult & { isError?: boolean; message?: string };
  onDismiss: () => void;
  isDark: boolean;
}) {
  const isOk = !result.isError && result.records_err === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        padding: "12px 16px", borderRadius: 12, marginBottom: 16,
        background: isOk ? (isDark ? "rgba(22,163,74,0.1)" : "#f0fdf4") : (isDark ? "rgba(239,68,68,0.1)" : "#fef2f2"),
        border: `1px solid ${isOk ? (isDark ? "rgba(22,163,74,0.3)" : "#dcfce7") : (isDark ? "rgba(239,68,68,0.3)" : "#fee2e2")}`,
        color: isOk ? (isDark ? "#4ade80" : "#16a34a") : (isDark ? "#f87171" : "#ef4444"),
        fontSize: 12, fontWeight: 700,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {result.message && <span>{result.message}</span>}
        {(result.records_in > 0 || !result.message) && (
          <span>
            {result.records_in} in →&nbsp;
            {result.records_new > 0 && <span style={{ color: "#16a34a" }}>{result.records_new} new&nbsp;</span>}
            {result.records_upd > 0 && <span style={{ color: "#f59e0b" }}>{result.records_upd} updated&nbsp;</span>}
            {result.records_dup > 0 && <span style={{ color: isDark ? "#52525b" : "#94a3b8" }}>{result.records_dup} duplicate&nbsp;</span>}
            {result.records_err > 0 && <span style={{ color: "#ef4444" }}>{result.records_err} rejected</span>}
          </span>
        )}
        {result.errors.length > 0 && (
          <span style={{ fontSize: 10.5, opacity: 0.8 }}>
            {result.errors[0].reason}{result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : ""}
          </span>
        )}
      </div>
      <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", flexShrink: 0 }}>
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ── Day Detail Modal ───────────────────────────────────────────────────

function DayModal({
  date, orders, isDark, onClose,
}: {
  date: string;
  orders: MeeshoOrder[];
  isDark: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.sub_order_no?.toLowerCase().includes(q) ||
          o.sku?.toLowerCase().includes(q) ||
          o.product_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const revenue = orders.reduce((s, o) => s + (o.selling_price ?? 0), 0);
  const uniqueStatuses = Array.from(new Set(orders.map(o => o.status)));

  const th: React.CSSProperties = {
    padding: "9px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8",
    textAlign: "left", whiteSpace: "nowrap",
    background: isDark ? "#111113" : "#fafafa",
    borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9",
    position: "sticky", top: 0, zIndex: 2,
  };
  const td: React.CSSProperties = {
    padding: "10px 12px", fontSize: 12, color: isDark ? "#e4e4e7" : "#1e293b",
    borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f8fafc", verticalAlign: "middle",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 960,
          maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          background: isDark ? "#18181b" : "#fff",
          border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: "18px 22px",
          borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          background: isDark ? "#111113" : "#fafafa",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: isDark ? "#27272a" : "#f1f5f9",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Calendar size={18} color={isDark ? "#a1a1aa" : "#64748b"} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#fff" : "#111" }}>
                {fmtDate(date)}
              </div>
              <div style={{ fontSize: 10.5, color: isDark ? "#71717a" : "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {orders.length} orders · ₹{revenue.toLocaleString("en-IN")} revenue
              </div>
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {uniqueStatuses.map(s => {
              const sc = getStatusConfig(s);
              const count = orders.filter(o => o.status === s).length;
              return (
                <span key={s} style={{
                  fontSize: 11, fontWeight: 800,
                  background: isDark ? sc.darkBg : sc.bg,
                  color: sc.color,
                  borderRadius: 8, padding: "4px 10px",
                }}>
                  {sc.label}: {count}
                </span>
              );
            })}
          </div>

          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: isDark ? "#71717a" : "#94a3b8", flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div style={{
          padding: "10px 16px",
          borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9",
          display: "flex", gap: 10, alignItems: "center", flexShrink: 0,
          background: isDark ? "#18181b" : "#fff",
        }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: isDark ? "#52525b" : "#94a3b8", pointerEvents: "none" }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search sub-order, SKU, product…"
              style={{
                width: "100%", padding: "7px 10px 7px 30px", fontSize: 12,
                border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0",
                borderRadius: 8, background: isDark ? "#111" : "#f8fafc",
                color: isDark ? "#e4e4e7" : "#111", outline: "none",
              }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: "7px 28px 7px 10px", fontSize: 12, fontWeight: 700,
                border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0",
                borderRadius: 8, background: isDark ? "#111" : "#f8fafc",
                color: isDark ? "#e4e4e7" : "#111", cursor: "pointer", outline: "none", appearance: "none",
              }}
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(s => (
                <option key={s} value={s}>{getStatusConfig(s).label}</option>
              ))}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: isDark ? "#71717a" : "#94a3b8" }} />
          </div>
          <span style={{ fontSize: 11, color: isDark ? "#52525b" : "#94a3b8", fontWeight: 700, marginLeft: "auto" }}>
            {filtered.length} of {orders.length}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Sub Order No</th>
                <th style={th}>Product</th>
                <th style={th}>SKU</th>
                <th style={th}>Size</th>
                <th style={{ ...th, textAlign: "center" }}>Qty</th>
                <th style={{ ...th, textAlign: "right" }}>Price</th>
                <th style={th}>Location</th>
                <th style={th}>Source</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const sc = getStatusConfig(o.status);
                return (
                  <tr key={o.id} style={{ background: i % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)") }}>
                    <td style={{ ...td, color: isDark ? "#52525b" : "#cbd5e1", fontSize: 10, fontWeight: 700 }}>{i + 1}</td>
                    <td style={td}>
                      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: isDark ? "#e4e4e7" : "#111", whiteSpace: "nowrap" }}>
                        {o.sub_order_no}
                      </div>
                      {o.packet_id && (
                        <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", marginTop: 1 }}>PID: {o.packet_id}</div>
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 200 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {o.product_name || "—"}
                      </div>
                    </td>
                    <td style={td}>
                      {o.sku && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, background: isDark ? "#27272a" : "#f1f5f9", color: isDark ? "#e4e4e7" : "#334155", borderRadius: 5, padding: "2px 6px" }}>
                          <Tag size={8} />{o.sku}
                        </span>
                      )}
                      {o.catalog_id && <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", marginTop: 2 }}>Cat: {o.catalog_id}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700 }}>{o.size || "—"}</td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 800 }}>{o.qty}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#fafafa" : "#111" }}>₹{(o.selling_price ?? 0).toFixed(0)}</div>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize: 11 }}>
                        <MapPin size={10} color={isDark ? "#52525b" : "#94a3b8"} />
                        {[o.customer_city, o.customer_state].filter(Boolean).join(", ") || "—"}
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
                        {o.order_source === "ad_order" ? "🎯 Ad" : o.order_source || "—"}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, borderRadius: 7, padding: "3px 8px", whiteSpace: "nowrap",
                        background: isDark ? sc.darkBg : sc.bg, color: sc.color,
                      }}>
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: isDark ? "#52525b" : "#94a3b8", fontSize: 13 }}>
              No orders match filters
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Date Box Card ──────────────────────────────────────────────────────

function DateBox({
  date, orders, isDark, onClick,
}: {
  date: string;
  orders: MeeshoOrder[];
  isDark: boolean;
  onClick: () => void;
}) {
  const revenue = orders.reduce((s, o) => s + (o.selling_price ?? 0), 0);
  const delivered = orders.filter(o => o.status === "DELIVERED").length;
  const rto = orders.filter(o => o.status === "RTO_COMPLETE" || o.status === "RTO").length;
  const cancelled = orders.filter(o => o.status === "CANCELLED").length;

  const d = new Date(date + "T00:00:00");
  const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });
  const dayNum  = d.toLocaleDateString("en-IN", { day: "2-digit" });
  const monthYr = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        cursor: "pointer", textAlign: "left",
        background: isDark ? "#18181b" : "#fff",
        borderRadius: 16,
        border: isDark ? "1px solid #27272a" : "1px solid #e2e8f0",
        padding: "14px 16px",
        boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.15s",
        display: "flex", flexDirection: "column", gap: 10,
        minWidth: 160,
      }}
    >
      {/* Date header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: isDark ? "#52525b" : "#94a3b8" }}>{dayName}</span>
          <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: isDark ? "#fff" : "#111", fontVariantNumeric: "tabular-nums" }}>{dayNum}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8" }}>{monthYr}</span>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: isDark ? "#111" : "#f8fafc",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: isDark ? "#e4e4e7" : "#111", lineHeight: 1 }}>{orders.length}</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: isDark ? "#52525b" : "#94a3b8", textTransform: "uppercase" }}>orders</span>
        </div>
      </div>

      {/* Revenue */}
      <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#a1a1aa" : "#334155" }}>
        ₹{revenue.toLocaleString("en-IN")}
      </div>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {delivered > 0 && (
          <span style={{ fontSize: 9.5, fontWeight: 800, background: "rgba(22,163,74,0.1)", color: "#16a34a", borderRadius: 6, padding: "2px 6px" }}>✓ {delivered}</span>
        )}
        {rto > 0 && (
          <span style={{ fontSize: 9.5, fontWeight: 800, background: "rgba(234,88,12,0.1)", color: "#ea580c", borderRadius: 6, padding: "2px 6px" }}>↩ {rto}</span>
        )}
        {cancelled > 0 && (
          <span style={{ fontSize: 9.5, fontWeight: 800, background: "rgba(239,68,68,0.1)", color: "#ef4444", borderRadius: 6, padding: "2px 6px" }}>✕ {cancelled}</span>
        )}
        {(orders.length - delivered - rto - cancelled) > 0 && (
          <span style={{ fontSize: 9.5, fontWeight: 800, background: isDark ? "#27272a" : "#f1f5f9", color: isDark ? "#a1a1aa" : "#64748b", borderRadius: 6, padding: "2px 6px" }}>
            ~ {orders.length - delivered - rto - cancelled}
          </span>
        )}
      </div>
    </motion.button>
  );
}

// ── Main OrdersTab component ───────────────────────────────────────────

export default function OrdersTab() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [orders, isReady, refetch] = useMeeshoOrders();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<(SyncResult & { isError?: boolean; message?: string }) | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Group orders by date ──────────────────────────────────────────

  const dateGroups = useMemo(() => {
    const map: Record<string, MeeshoOrder[]> = {};
    for (const o of orders) {
      const d = o.order_date || "unknown";
      if (!map[d]) map[d] = [];
      map[d].push(o);
    }
    // Sort dates descending
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a));
  }, [orders]);

  // ── Summary metrics ───────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total     = orders.length;
    const delivered = orders.filter(o => o.status === "DELIVERED").length;
    const rto       = orders.filter(o => o.status === "RTO_COMPLETE" || o.status === "RTO").length;
    const cancelled = orders.filter(o => o.status === "CANCELLED").length;
    const revenue   = orders.reduce((s, o) => s + (o.selling_price ?? 0), 0);
    const days      = dateGroups.length;
    return { total, delivered, rto, cancelled, revenue, days };
  }, [orders, dateGroups]);

  // ── File import ───────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const isCsv  = /\.csv$/i.test(file.name);

    if (!isXlsx && !isCsv) {
      setSyncResult({ records_in: 0, records_new: 0, records_upd: 0, records_dup: 0, records_err: 1, errors: [], isError: true, message: "Invalid file type. Please upload .csv or .xlsx" });
      return;
    }

    setIsLoading(true);
    setSyncResult(null);

    try {
      let rows;
      if (isXlsx) {
        const buf = await file.arrayBuffer();
        rows = await parseOrdersXLSX(buf);
      } else {
        const text = await file.text();
        rows = parseOrdersCSV(text);
      }

      if (rows.length === 0) {
        setSyncResult({ records_in: 0, records_new: 0, records_upd: 0, records_dup: 0, records_err: 1, errors: [], isError: true, message: "No valid records found. Check column headers match the Meesho export format." });
        return;
      }

      const result = await mergeOrders(rows, isXlsx ? "xlsx" : "csv");
      setSyncResult({ ...result, message: `✓ Imported ${result.records_new} new orders from ${file.name}` });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncResult({ records_in: 0, records_new: 0, records_upd: 0, records_dup: 0, records_err: 1, errors: [], isError: true, message: `Error: ${msg}` });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [refetch]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void processFile(f);
  };

  const handleClearAll = async () => {
    if (!confirm("Delete ALL orders from Supabase? This cannot be undone.")) return;
    setIsLoading(true);
    try {
      await clearAllOrders();
      refetch();
      setSyncResult({ records_in: 0, records_new: 0, records_upd: 0, records_dup: 0, records_err: 0, errors: [], message: "All orders cleared." });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadSample = () => {
    const csv = "\uFEFF" + [SAMPLE_CSV_HEADERS, ...SAMPLE_CSV_ROWS].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "meesho_orders_sample_template.csv";
    a.click();
  };

  const selectedOrders = useMemo(() => {
    if (!selectedDate) return [];
    return orders.filter(o => o.order_date === selectedDate);
  }, [selectedDate, orders]);

  // Card style
  const card: React.CSSProperties = {
    background: isDark ? "#18181b" : "#ffffff",
    border: isDark ? "1px solid #27272a" : "1px solid #ececec",
    borderRadius: 16, padding: "16px 18px",
    boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
  };

  // ── Empty state ───────────────────────────────────────────────────

  const showEmpty = isReady && orders.length === 0;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Summary Metrics ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Orders", value: metrics.total,     icon: ShoppingCart,   color: isDark ? "#fafafa" : "#111" },
          { label: "Days of Data", value: metrics.days,       icon: Calendar,       color: "#3b82f6" },
          { label: "Delivered",    value: metrics.delivered,  icon: CheckCircle,    color: "#16a34a" },
          { label: "RTO / Returns",value: metrics.rto,        icon: AlertTriangle,  color: "#ea580c" },
          { label: "Cancelled",    value: metrics.cancelled,  icon: X,              color: "#ef4444" },
          { label: "Revenue",      value: null,               icon: IndianRupee,    color: "#8b5cf6", revenue: metrics.revenue },
        ].map((m) => (
          <div key={m.label} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? "#27272a" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: m.color }}>
              <m.icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: isDark ? "#71717a" : "#94a3b8" }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: m.color, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {"revenue" in m && m.revenue !== undefined
                  ? `₹${m.revenue.toLocaleString("en-IN")}`
                  : <AnimatedCounter value={m.value ?? 0} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Feedback Banner ── */}
      <AnimatePresence>
        {syncResult && (
          <FeedbackBanner result={syncResult} onDismiss={() => setSyncResult(null)} isDark={isDark} />
        )}
      </AnimatePresence>

      {/* ── Upload toolbar ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
          <TrendingUp size={15} color={isDark ? "#52525b" : "#94a3b8"} />
          <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#e4e4e7" : "#111" }}>Orders by Date</span>
          <span style={{ fontSize: 11, color: isDark ? "#52525b" : "#94a3b8", fontWeight: 600 }}>— click any date to view details</span>
        </div>
        <button
          onClick={refetch}
          style={{ padding: "8px 12px", border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: isDark ? "#a1a1aa" : "#64748b", fontSize: 12, fontWeight: 700 }}
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: isDark ? "#fafafa" : "#111",
            color: isDark ? "#111" : "#fff",
            border: "none", borderRadius: 10, padding: "9px 18px",
            fontSize: 12, fontWeight: 800, cursor: isLoading ? "wait" : "pointer",
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          <Upload size={14} />
          {isLoading ? "Importing…" : "Upload Today's CSV"}
        </button>
        <button
          onClick={downloadSample}
          style={{ padding: "8px 14px", border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: isDark ? "#a1a1aa" : "#64748b", fontSize: 12, fontWeight: 700 }}
        >
          <FileSpreadsheet size={13} />
          Sample CSV
        </button>
        {orders.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isLoading}
            style={{ padding: "8px 14px", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: 12, fontWeight: 700 }}
          >
            <Trash2 size={13} />
            Clear All
          </button>
        )}
      </div>

      {/* ── Date Boxes Grid ── */}
      {showEmpty ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ ...card, textAlign: "center", padding: "56px 24px" }}>
          <Calendar size={40} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
          <p style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#e4e4e7" : "#334155", marginBottom: 8 }}>No orders yet</p>
          <p style={{ fontSize: 12, color: isDark ? "#71717a" : "#94a3b8", lineHeight: 1.65, maxWidth: 400, margin: "0 auto 24px" }}>
            Download your orders CSV from the Meesho Supplier Panel, then click <strong>Upload Today's CSV</strong> above. Each day&apos;s orders will appear as a date box below.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 7, background: isDark ? "#fafafa" : "#111", color: isDark ? "#111" : "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
            >
              <Upload size={14} />
              Upload CSV Now
            </button>
            <button
              onClick={downloadSample}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", color: isDark ? "#a1a1aa" : "#64748b", border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <FileSpreadsheet size={14} />
              Sample Template
            </button>
          </div>
        </motion.div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 14 }}>
          {dateGroups.map(([date, dayOrders], idx) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
            >
              <DateBox
                date={date}
                orders={dayOrders}
                isDark={isDark}
                onClick={() => setSelectedDate(date)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Day Detail Modal ── */}
      <AnimatePresence>
        {selectedDate && (
          <DayModal
            date={selectedDate}
            orders={selectedOrders}
            isDark={isDark}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
