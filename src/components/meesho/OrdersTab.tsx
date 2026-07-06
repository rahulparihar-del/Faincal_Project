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
          o.product_name?.toLowerCase().includes(q) ||
          o.customer_state?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const revenue   = orders.reduce((s, o) => s + (o.selling_price ?? 0), 0);
  const delivered = orders.filter(o => o.status === "DELIVERED").length;
  const rto       = orders.filter(o => o.status === "RTO_COMPLETE" || o.status === "RTO").length;
  const cancelled = orders.filter(o => o.status === "CANCELLED").length;
  const pending   = orders.length - delivered - rto - cancelled;

  const d        = new Date(date + "T00:00:00");
  const fullDate = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const uniqueStatuses = Array.from(new Set(orders.map(o => o.status)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 1060,
          maxHeight: "92vh",
          display: "flex", flexDirection: "column",
          background: isDark ? "#0f0f11" : "#ffffff",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)"
            : "0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {/* ── Hero Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #0f0f10 0%, #18181b 55%, #1e1e23 100%)",
          padding: "22px 28px 20px",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -80, left: "40%", width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.025), transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>
                  Daily Order Report
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  {fullDate}
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", marginTop: 5, fontWeight: 600 }}>
                  {orders.length} orders processed · CSV Import
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.55)", flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {[
                { label: "Revenue",   value: `₹${revenue.toLocaleString("en-IN")}`, color: "#ffffff" },
                { label: "Delivered", value: String(delivered), color: "#4ade80" },
                { label: "RTO",       value: String(rto),       color: "#fb923c" },
                { label: "Cancelled", value: String(cancelled), color: "#f87171" },
                { label: "Pending",   value: String(pending),   color: "#facc15" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: "12px 14px",
                }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 5 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: s.label === "Revenue" ? 14 : 22, fontWeight: 900, color: s.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div style={{
          padding: "12px 20px",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #f0f0f0",
          display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flexShrink: 0,
          background: isDark ? "#0d0d0f" : "#fafafa",
        }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
            <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: isDark ? "#52525b" : "#94a3b8", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sub-order, SKU, product, state…"
              style={{
                width: "100%", padding: "8px 12px 8px 32px", fontSize: 12,
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e4e4e7",
                borderRadius: 9,
                background: isDark ? "rgba(255,255,255,0.04)" : "#fff",
                color: isDark ? "#e4e4e7" : "#111", outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[{ value: "all", label: "All" }, ...uniqueStatuses.map(s => ({ value: s, label: getStatusConfig(s).label }))].map(opt => {
              const isActive = statusFilter === opt.value;
              const sc = opt.value !== "all" ? getStatusConfig(opt.value) : null;
              const cnt = opt.value === "all" ? orders.length : orders.filter(o => o.status === opt.value).length;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                    cursor: "pointer",
                    background: isActive
                      ? (sc ? (isDark ? sc.darkBg : sc.bg) : (isDark ? "#27272a" : "#111"))
                      : (isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9"),
                    color: isActive
                      ? (sc ? sc.color : (isDark ? "#fff" : "#fff"))
                      : (isDark ? "#52525b" : "#94a3b8"),
                    border: isActive
                      ? `1px solid ${sc ? sc.color + "44" : "rgba(255,255,255,0.2)"}`
                      : `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0"}`,
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label} <span style={{ opacity: 0.65 }}>{cnt}</span>
                </button>
              );
            })}
          </div>

          <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.2)" : "#94a3b8", fontWeight: 600, marginLeft: "auto", whiteSpace: "nowrap" }}>
            {filtered.length} / {orders.length}
          </span>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                {[
                  { label: "#",            align: "left"   },
                  { label: "Sub Order No", align: "left"   },
                  { label: "Product Name", align: "left"   },
                  { label: "SKU",          align: "left"   },
                  { label: "Size",         align: "left"   },
                  { label: "Qty",          align: "center" },
                  { label: "Price",        align: "right"  },
                  { label: "Location",     align: "left"   },
                  { label: "Source",       align: "left"   },
                  { label: "Status",       align: "left"   },
                ].map(h => (
                  <th key={h.label} style={{
                    padding: "10px 14px",
                    fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: isDark ? "rgba(255,255,255,0.25)" : "#94a3b8",
                    textAlign: h.align as any, whiteSpace: "nowrap",
                    background: isDark ? "rgba(255,255,255,0.02)" : "#f8fafc",
                    borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #f1f5f9",
                    position: "sticky", top: 0, zIndex: 2,
                  }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const sc = getStatusConfig(o.status);
                return (
                  <motion.tr
                    key={o.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.008, 0.12) }}
                    onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.025)" : "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.035)" : "1px solid #f8fafc", transition: "background 0.1s" }}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: isDark ? "rgba(255,255,255,0.12)" : "#d1d5db", verticalAlign: "middle" }}>{i + 1}</td>

                    <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "monospace", color: isDark ? "#d4d4d8" : "#111", whiteSpace: "nowrap" }}>{o.sub_order_no}</div>
                      {o.packet_id && <div style={{ fontSize: 9.5, color: isDark ? "rgba(255,255,255,0.18)" : "#94a3b8", marginTop: 2 }}>PID: {o.packet_id}</div>}
                    </td>

                    <td style={{ padding: "10px 14px", maxWidth: 210, verticalAlign: "middle" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? "#d4d4d8" : "#1e293b", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {o.product_name || "—"}
                      </div>
                    </td>

                    <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                      {o.sku ? (
                        <>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, background: isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9", color: isDark ? "#a1a1aa" : "#334155", borderRadius: 6, padding: "3px 8px", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                            <Tag size={8} />{o.sku}
                          </span>
                          {o.catalog_id && <div style={{ fontSize: 9.5, color: isDark ? "rgba(255,255,255,0.18)" : "#94a3b8", marginTop: 3 }}>{o.catalog_id}</div>}
                        </>
                      ) : <span style={{ color: isDark ? "rgba(255,255,255,0.12)" : "#d1d5db" }}>—</span>}
                    </td>

                    <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#e4e4e7" : "#334155", background: isDark ? "rgba(255,255,255,0.06)" : "#f4f4f5", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e4e4e7", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap", display: "inline-block" }}>
                        {o.size || "Free"}
                      </span>
                    </td>

                    <td style={{ padding: "10px 14px", textAlign: "center", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: isDark ? "#fff" : "#111" }}>{o.qty}</span>
                    </td>

                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: isDark ? "#ffffff" : "#111" }}>₹{(o.selling_price ?? 0).toFixed(0)}</span>
                    </td>

                    <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <MapPin size={10} color={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"} style={{ flexShrink: 0 }} />
                        <div>
                          {o.customer_city && <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#d4d4d8" : "#334155", whiteSpace: "nowrap" }}>{o.customer_city}</div>}
                          {o.customer_state && <div style={{ fontSize: 9.5, color: isDark ? "rgba(255,255,255,0.28)" : "#94a3b8", whiteSpace: "nowrap" }}>{o.customer_state}</div>}
                          {!o.customer_city && !o.customer_state && <span style={{ color: isDark ? "rgba(255,255,255,0.12)" : "#d1d5db" }}>—</span>}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                      {o.order_source === "ad_order" ? (
                        <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "3px 8px", background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>🎯 Ad</span>
                      ) : o.order_source ? (
                        <span style={{ fontSize: 10, color: isDark ? "rgba(255,255,255,0.3)" : "#94a3b8", fontWeight: 600, textTransform: "capitalize" }}>{o.order_source}</span>
                      ) : <span style={{ color: isDark ? "rgba(255,255,255,0.1)" : "#d1d5db" }}>—</span>}
                    </td>

                    <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 8, padding: "4px 10px", whiteSpace: "nowrap", display: "inline-block", background: isDark ? sc.darkBg : sc.bg, color: sc.color, border: `1px solid ${sc.color}33` }}>
                        {sc.label}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: isDark ? "rgba(255,255,255,0.15)" : "#94a3b8" }}>
              <Search size={30} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>No orders match your filters</div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "10px 22px",
          borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #f0f0f0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: isDark ? "#0d0d0f" : "#fafafa", flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.2)" : "#94a3b8", fontWeight: 600 }}>
            Showing {filtered.length} of {orders.length} orders
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? "rgba(255,255,255,0.3)" : "#64748b" }}>
            Revenue: <strong style={{ color: isDark ? "#fff" : "#111", fontWeight: 900 }}>₹{revenue.toLocaleString("en-IN")}</strong>
          </span>
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
  const revenue   = orders.reduce((s, o) => s + (o.selling_price ?? 0), 0);
  const delivered = orders.filter(o => o.status === "DELIVERED").length;
  const rto       = orders.filter(o => o.status === "RTO_COMPLETE" || o.status === "RTO").length;
  const cancelled = orders.filter(o => o.status === "CANCELLED").length;
  const pending   = orders.length - delivered - rto - cancelled;
  const deliveryRate = orders.length > 0 ? Math.round((delivered / orders.length) * 100) : 0;

  const d       = new Date(date + "T00:00:00");
  const dayName = d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
  const dayNum  = d.toLocaleDateString("en-IN", { day: "2-digit" });
  const month   = d.toLocaleDateString("en-IN", { month: "short" });
  const year    = d.toLocaleDateString("en-IN", { year: "2-digit" });

  return (
    <motion.button
      whileHover={{ y: -4, boxShadow: isDark ? "0 12px 32px rgba(0,0,0,0.5)" : "0 12px 32px rgba(0,0,0,0.12)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        cursor: "pointer", textAlign: "left",
        background: isDark ? "#18181b" : "#ffffff",
        borderRadius: 18,
        border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid #e8e8ec",
        padding: 0,
        boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        minWidth: 155,
        transition: "box-shadow 0.2s",
      }}
    >
      {/* ── Soft header with date ── */}
      <div style={{
        background: isDark
          ? "linear-gradient(135deg, #2a2a2a 0%, #333333 100%)"
          : "linear-gradient(135deg, #3a3a3a 0%, #525252 100%)",
        padding: "14px 16px 12px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Glow orb */}
        <div style={{
          position: "absolute", top: -20, right: -20,
          width: 70, height: 70, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>
              {dayName}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {dayNum}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              {month} {year}
            </div>
          </div>

          {/* Order count badge */}
          <div style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, padding: "5px 9px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{orders.length}</div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>orders</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {/* Revenue */}
        <div>
          <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: isDark ? "#52525b" : "#94a3b8", marginBottom: 2 }}>
            Revenue
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: isDark ? "#e4e4e7" : "#111", fontVariantNumeric: "tabular-nums" }}>
            ₹{revenue.toLocaleString("en-IN")}
          </div>
        </div>

        {/* Delivery rate bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: isDark ? "#52525b" : "#94a3b8" }}>
              Delivery Rate
            </div>
            <div style={{ fontSize: 10, fontWeight: 900, color: deliveryRate >= 70 ? "#16a34a" : deliveryRate >= 40 ? "#f59e0b" : "#ef4444" }}>
              {deliveryRate}%
            </div>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: isDark ? "rgba(255,255,255,0.06)" : "#f0f0f2", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99,
              width: `${deliveryRate}%`,
              background: deliveryRate >= 70 ? "#16a34a" : deliveryRate >= 40 ? "#f59e0b" : "#ef4444",
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Status pills row */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {delivered > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
              background: "rgba(22,163,74,0.1)", color: "#16a34a",
              border: "1px solid rgba(22,163,74,0.15)",
            }}>✓ {delivered}</span>
          )}
          {rto > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
              background: "rgba(234,88,12,0.1)", color: "#ea580c",
              border: "1px solid rgba(234,88,12,0.15)",
            }}>↩ {rto}</span>
          )}
          {cancelled > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
              background: "rgba(239,68,68,0.1)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.15)",
            }}>✕ {cancelled}</span>
          )}
          {pending > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: "2px 7px",
              background: isDark ? "rgba(255,255,255,0.05)" : "#f4f4f5",
              color: isDark ? "#71717a" : "#6b7280",
              border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid #e4e4e7",
            }}>~ {pending}</span>
          )}
        </div>
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
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total Orders",  value: metrics.total,     icon: ShoppingCart,  color: isDark ? "#e4e4e7" : "#111",  grow: 1 },
          { label: "Days of Data",  value: metrics.days,      icon: Calendar,      color: "#3b82f6",                    grow: 1 },
          { label: "Delivered",     value: metrics.delivered, icon: CheckCircle,   color: "#16a34a",                    grow: 1 },
          { label: "RTO / Returns", value: metrics.rto,       icon: AlertTriangle, color: "#ea580c",                    grow: 1 },
          { label: "Cancelled",     value: metrics.cancelled, icon: X,             color: "#ef4444",                    grow: 1 },
          { label: "Revenue",       value: null,              icon: IndianRupee,   color: "#8b5cf6", revenue: metrics.revenue, grow: 2 },
        ].map((m) => {
          const display = "revenue" in m && m.revenue !== undefined
            ? `₹${m.revenue.toLocaleString("en-IN")}`
            : String(m.value ?? 0);
          // Shrink font for long values to prevent overflow
          const numSize = display.length > 9 ? 14 : display.length > 6 ? 17 : 20;
          return (
            <div
              key={m.label}
              style={{
                ...card,
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px",
                flex: `${m.grow} 1 0`, minWidth: 120,
                overflow: "hidden",
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: isDark ? "#27272a" : "#f4f4f5",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: m.color,
              }}>
                <m.icon size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                <div style={{
                  fontSize: 8.5, fontWeight: 800, textTransform: "uppercase",
                  letterSpacing: "0.07em", color: isDark ? "#52525b" : "#94a3b8",
                  marginBottom: 1, whiteSpace: "nowrap",
                }}>
                  {m.label}
                </div>
                <div style={{
                  fontSize: numSize, fontWeight: 900, color: m.color,
                  fontVariantNumeric: "tabular-nums", lineHeight: 1.15,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {"revenue" in m && m.revenue !== undefined
                    ? display
                    : <AnimatedCounter value={m.value ?? 0} />}
                </div>
              </div>
            </div>
          );
        })}
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
