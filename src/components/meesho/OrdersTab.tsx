"use client";

/**
 * BizTrack — Meesho Orders Tab (Forward Dispatch)
 *
 * Data flow:
 *   Supabase (meesho_orders) → useMeeshoOrders hook → display
 *   File upload (CSV / XLSX)  → ordersParser → orderService.mergeOrders → refetch
 *
 * All writes go through orderService so validation, dedup, sync-log are
 * always enforced regardless of the write source.
 */

import React, { useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, CheckCircle, AlertTriangle, X, Upload, Download,
  FileSpreadsheet, FileText, Search, Trash2, RefreshCw,
  MapPin, Tag, ShoppingBag, Image as ImageIcon, ChevronDown,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useMeeshoOrders } from "@/lib/hooks/useMeeshoOrders";
import { mergeOrders, clearAllOrders } from "@/lib/meesho/orderService";
import { parseOrdersCSV, parseOrdersXLSX, SAMPLE_CSV_HEADERS, SAMPLE_CSV_ROWS } from "@/lib/meesho/ordersParser";
import type { MeeshoOrder } from "@/lib/meesho/types";
import type { SyncResult } from "@/lib/meesho/types";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

// ── Status config ─────────────────────────────────────────────────────

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

// ── Feedback Banner ───────────────────────────────────────────────────

function FeedbackBanner({
  result,
  onDismiss,
  isDark,
}: {
  result: SyncResult & { isError?: boolean; message?: string };
  onDismiss: () => void;
  isDark: boolean;
}) {
  const isOk = !result.isError && result.records_err === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        padding: "12px 16px", borderRadius: 14, marginBottom: 20,
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

// ── Image cell ────────────────────────────────────────────────────────

function OrderImage({ url, name, isDark }: { url: string; name: string; isDark: boolean }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: isDark ? "#27272a" : "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <ImageIcon size={18} color={isDark ? "#52525b" : "#cbd5e1"} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      onError={() => setErr(true)}
      style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────

export default function OrdersTab() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [orders, isReady, refetch] = useMeeshoOrders();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | "DELIVERED" | "RTO_COMPLETE" | "CANCELLED" | "PENDING">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "extension" | "csv" | "xlsx">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<(SyncResult & { isError?: boolean; message?: string }) | null>(null);

  // ── Metrics ──────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total      = orders.length;
    const delivered  = orders.filter(o => o.status === "DELIVERED").length;
    const rto        = orders.filter(o => o.status === "RTO_COMPLETE" || o.status === "RTO").length;
    const cancelled  = orders.filter(o => o.status === "CANCELLED").length;
    const pending    = orders.filter(o => !["DELIVERED","RTO_COMPLETE","RTO","CANCELLED"].includes(o.status)).length;
    return { total, delivered, rto, cancelled, pending };
  }, [orders]);

  // ── Filtered list ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "all") {
        if (statusFilter === "RTO_COMPLETE" && o.status !== "RTO_COMPLETE" && o.status !== "RTO") return false;
        else if (statusFilter !== "RTO_COMPLETE" && o.status !== statusFilter) return false;
      }
      if (sourceFilter !== "all" && o.data_source !== sourceFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          o.sub_order_no?.toLowerCase().includes(q) ||
          o.sku?.toLowerCase().includes(q) ||
          o.product_name?.toLowerCase().includes(q) ||
          o.catalog_id?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, statusFilter, sourceFilter, searchQuery]);

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
      setSyncResult({ ...result, message: `Import from ${file.name} complete` });
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

  // ── Clear all ─────────────────────────────────────────────────────

  const handleClearAll = async () => {
    if (!confirm("Delete ALL orders from Supabase? This cannot be undone.")) return;
    setIsLoading(true);
    try {
      await clearAllOrders();
      refetch();
      setSyncResult({ records_in: 0, records_new: 0, records_upd: 0, records_dup: 0, records_err: 0, errors: [], message: "All orders cleared from Supabase." });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────

  const exportCSV = () => {
    if (filtered.length === 0) { alert("No data to export."); return; }
    const headers = ["Sub Order No","Order ID","Order Date","Dispatch Date","Status","Product Name","SKU","Catalog ID","Packet ID","Size","Qty","Selling Price","Listing Price","Source","State","City","Data Source"];
    const rows = filtered.map(o => [
      o.sub_order_no, o.order_id, o.order_date, o.dispatch_date, o.status,
      o.product_name, o.sku, o.catalog_id, o.packet_id, o.size,
      String(o.qty), String(o.selling_price), String(o.listing_price),
      o.order_source, o.customer_state, o.customer_city, o.data_source,
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `meesho_orders_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // ── Download sample template ──────────────────────────────────────

  const downloadSample = () => {
    const csv = "\uFEFF" + [SAMPLE_CSV_HEADERS, ...SAMPLE_CSV_ROWS].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "meesho_orders_sample_template.csv";
    a.click();
  };

  // ── Styles ────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: isDark ? "#18181b" : "#ffffff",
    border: isDark ? "1px solid #27272a" : "1px solid #ececec",
    borderRadius: 16, padding: "16px 18px",
    boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
  };

  const th: React.CSSProperties = {
    padding: "10px 14px", fontSize: 10, fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.07em", color: isDark ? "#71717a" : "#94a3b8",
    textAlign: "left", whiteSpace: "nowrap", borderBottom: isDark ? "1px solid #27272a" : "1px solid #f1f5f9",
    background: isDark ? "#111113" : "#fafafa",
  };

  const td: React.CSSProperties = {
    padding: "12px 14px", fontSize: 12, color: isDark ? "#e4e4e7" : "#1e293b",
    borderBottom: isDark ? "1px solid #1f1f23" : "1px solid #f8fafc", verticalAlign: "middle",
  };

  // ── Metric card config ────────────────────────────────────────────

  type FilterKey = "all" | "DELIVERED" | "RTO_COMPLETE" | "CANCELLED" | "PENDING";
  const metricCards: { label: string; value: number; filter: FilterKey; icon: React.ElementType; color: string; activeBorder: string }[] = [
    { label: "Total Orders",  value: metrics.total,     filter: "all",          icon: Package,       color: isDark ? "#fafafa" : "#111",  activeBorder: isDark ? "#94a3b8" : "#64748b" },
    { label: "Delivered",     value: metrics.delivered, filter: "DELIVERED",    icon: CheckCircle,   color: "#16a34a",                    activeBorder: "#16a34a" },
    { label: "RTO / Returned",value: metrics.rto,       filter: "RTO_COMPLETE", icon: AlertTriangle, color: "#ea580c",                    activeBorder: "#ea580c" },
    { label: "Cancelled",     value: metrics.cancelled, filter: "CANCELLED",    icon: X,             color: "#ef4444",                    activeBorder: "#ef4444" },
    { label: "Pending / Other",value: metrics.pending,  filter: "PENDING",      icon: ShoppingBag,   color: "#f59e0b",                    activeBorder: "#f59e0b" },
  ];

  // ── Empty state ───────────────────────────────────────────────────

  const showEmpty = isReady && orders.length === 0;
  const showNoResults = isReady && orders.length > 0 && filtered.length === 0;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Metric Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 14, marginBottom: 24 }}>
        {metricCards.map((m, i) => {
          const isActive = statusFilter === m.filter;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => setStatusFilter(m.filter)}
              style={{
                ...card, cursor: "pointer",
                border: isActive ? `1.5px solid ${m.activeBorder}` : (isDark ? "1px solid #27272a" : "1px solid #ececec"),
                transform: isActive ? "scale(1.02)" : "scale(1)",
                transition: "all 0.18s",
                display: "flex", alignItems: "center", gap: 14,
              }}
              whileHover={{ scale: isActive ? 1.02 : 1.01 }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: isDark ? "#27272a" : "#f8fafc", color: m.color, flexShrink: 0 }}>
                <m.icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: isDark ? "#71717a" : "#94a3b8", marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: m.color, fontVariantNumeric: "tabular-nums" }}>
                  <AnimatedCounter value={m.value} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Feedback Banner ── */}
      <AnimatePresence>
        {syncResult && (
          <FeedbackBanner result={syncResult} onDismiss={() => setSyncResult(null)} isDark={isDark} />
        )}
      </AnimatePresence>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: isDark ? "#52525b" : "#94a3b8", pointerEvents: "none" }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search order no, SKU, product…"
            style={{
              width: "100%", padding: "9px 12px 9px 34px", fontSize: 12,
              border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0",
              borderRadius: 10, background: isDark ? "#18181b" : "#fff",
              color: isDark ? "#e4e4e7" : "#111", outline: "none",
            }}
          />
        </div>

        {/* Source filter */}
        <div style={{ position: "relative" }}>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}
            style={{
              padding: "9px 32px 9px 12px", fontSize: 12, fontWeight: 700,
              border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0",
              borderRadius: 10, background: isDark ? "#18181b" : "#fff",
              color: isDark ? "#e4e4e7" : "#111", cursor: "pointer", outline: "none",
              appearance: "none",
            }}
          >
            <option value="all">All Sources</option>
            <option value="extension">Extension</option>
            <option value="csv">CSV Import</option>
            <option value="xlsx">Excel Import</option>
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: isDark ? "#71717a" : "#94a3b8" }} />
        </div>

        {/* Refresh */}
        <button
          onClick={refetch}
          title="Refresh from Supabase"
          style={{ padding: "9px 12px", border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: isDark ? "#a1a1aa" : "#64748b", fontSize: 12, fontWeight: 700 }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Import */}
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
          {isLoading ? "Importing…" : "Import CSV / Excel"}
        </button>

        {/* Sample template */}
        <button
          onClick={downloadSample}
          title="Download sample CSV template"
          style={{ padding: "9px 14px", border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: isDark ? "#a1a1aa" : "#64748b", fontSize: 12, fontWeight: 700 }}
        >
          <FileSpreadsheet size={14} />
          Sample
        </button>

        {/* Export CSV */}
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          style={{ padding: "9px 14px", border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: isDark ? "#a1a1aa" : "#64748b", fontSize: 12, fontWeight: 700, opacity: filtered.length === 0 ? 0.4 : 1 }}
        >
          <Download size={14} />
          Export
        </button>

        {/* Clear all */}
        <button
          onClick={handleClearAll}
          disabled={isLoading || orders.length === 0}
          style={{ padding: "9px 14px", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: 12, fontWeight: 700, opacity: orders.length === 0 ? 0.4 : 1 }}
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      {/* ── Record count ── */}
      <div style={{ fontSize: 11, color: isDark ? "#52525b" : "#94a3b8", fontWeight: 700, marginBottom: 12 }}>
        {isReady ? `${filtered.length} of ${orders.length} orders` : "Loading…"}
        {statusFilter !== "all" && (
          <button onClick={() => setStatusFilter("all")} style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: isDark ? "#a1a1aa" : "#64748b", background: isDark ? "#27272a" : "#f1f5f9", border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
            Clear filter
          </button>
        )}
      </div>

      {/* ── Empty states ── */}
      {showEmpty && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ ...card, textAlign: "center", padding: "56px 24px" }}
        >
          <Package size={40} style={{ margin: "0 auto 14px", opacity: 0.25 }} />
          <p style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#e4e4e7" : "#334155", marginBottom: 6 }}>No orders yet</p>
          <p style={{ fontSize: 12, color: isDark ? "#71717a" : "#94a3b8", lineHeight: 1.65, maxWidth: 420, margin: "0 auto 20px" }}>
            Browse your Orders page on the <strong>Meesho Supplier Panel</strong> with the BizTrack Sync extension active, then click <strong>Sync to BizTrack</strong> in the popup.
            Alternatively, import a CSV / Excel export below.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 7, background: isDark ? "#fafafa" : "#111", color: isDark ? "#111" : "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              <Upload size={14} />
              Import CSV / Excel
            </button>
            <button
              onClick={downloadSample}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", color: isDark ? "#a1a1aa" : "#64748b", border: isDark ? "1px solid #3f3f46" : "1px solid #e2e8f0", borderRadius: 10, padding: "10px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              <FileSpreadsheet size={14} />
              Download Sample Template
            </button>
          </div>
        </motion.div>
      )}

      {showNoResults && (
        <div style={{ ...card, textAlign: "center", padding: "40px 24px", color: isDark ? "#71717a" : "#94a3b8", fontSize: 13 }}>
          No orders match your current filters.{" "}
          <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setSourceFilter("all"); }} style={{ color: isDark ? "#a1a1aa" : "#64748b", fontWeight: 800, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Orders Table ── */}
      {filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          style={{ ...card, padding: 0, overflow: "hidden" }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th style={th}>Product</th>
                  <th style={th}>Sub Order No</th>
                  <th style={th}>SKU / Catalog</th>
                  <th style={th}>Order Date</th>
                  <th style={th}>Dispatch Date</th>
                  <th style={th}>Size / Qty</th>
                  <th style={{ ...th, textAlign: "right" }}>Price</th>
                  <th style={th}>Location</th>
                  <th style={th}>Source</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, i) => {
                  const sc = getStatusConfig(order.status);
                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    >
                      {/* Product */}
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 220, maxWidth: 320 }}>
                          <OrderImage url={order.image_url} name={order.product_name} isDark={isDark} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? "#e4e4e7" : "#111", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {order.product_name || "—"}
                            </div>
                            {order.packet_id && (
                              <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", marginTop: 2 }}>
                                PID: {order.packet_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Sub Order No */}
                      <td style={td}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? "#fafafa" : "#111", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {order.sub_order_no}
                        </div>
                        {order.order_id && order.order_id !== order.sub_order_no && (
                          <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8" }}>
                            Order: {order.order_id}
                          </div>
                        )}
                      </td>

                      {/* SKU / Catalog */}
                      <td style={td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {order.sku && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, background: isDark ? "#27272a" : "#f1f5f9", color: isDark ? "#e4e4e7" : "#334155", borderRadius: 6, padding: "2px 7px", width: "fit-content" }}>
                              <Tag size={9} />
                              {order.sku}
                            </span>
                          )}
                          {order.catalog_id && (
                            <span style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8" }}>
                              Cat: {order.catalog_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Order Date */}
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {order.order_date
                          ? new Date(order.order_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
                          : "—"}
                      </td>

                      {/* Dispatch Date */}
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {order.dispatch_date
                          ? new Date(order.dispatch_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
                          : <span style={{ color: isDark ? "#52525b" : "#cbd5e1" }}>—</span>}
                      </td>

                      {/* Size / Qty */}
                      <td style={td}>
                        <div style={{ whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{order.size || "Free Size"}</span>
                          <span style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", marginLeft: 6 }}>× {order.qty}</span>
                        </div>
                      </td>

                      {/* Price */}
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#fafafa" : "#111" }}>
                          ₹{(order.selling_price ?? 0).toFixed(0)}
                        </div>
                        {order.listing_price > 0 && order.listing_price !== order.selling_price && (
                          <div style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8", textDecoration: "line-through" }}>
                            ₹{order.listing_price.toFixed(0)}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                          <MapPin size={11} color={isDark ? "#52525b" : "#94a3b8"} />
                          <span style={{ fontSize: 11.5 }}>
                            {[order.customer_city, order.customer_state].filter(Boolean).join(", ") || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Source */}
                      <td style={td}>
                        {order.order_source === "ad_order" ? (
                          <span style={{ fontSize: 10, fontWeight: 800, background: isDark ? "rgba(168,85,247,0.12)" : "#faf5ff", color: "#9333ea", borderRadius: 6, padding: "2px 7px" }}>
                            Ad Order
                          </span>
                        ) : order.order_source ? (
                          <span style={{ fontSize: 10, color: isDark ? "#52525b" : "#94a3b8" }}>
                            {order.order_source}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: isDark ? "#52525b" : "#cbd5e1" }}>—</span>
                        )}
                        {/* Data source badge */}
                        <div style={{ marginTop: 3 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", color: order.data_source === "extension" ? "#16a34a" : (isDark ? "#71717a" : "#94a3b8"), textTransform: "uppercase" }}>
                            {order.data_source === "extension" ? "⚡ ext" : order.data_source}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={td}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, borderRadius: 8, padding: "4px 10px", whiteSpace: "nowrap",
                          background: isDark ? sc.darkBg : sc.bg, color: sc.color,
                        }}>
                          {sc.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div style={{ padding: "10px 16px", borderTop: isDark ? "1px solid #27272a" : "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: isDark ? "#52525b" : "#94a3b8", fontWeight: 700 }}>
              Showing {filtered.length} records
            </span>
            <button
              onClick={exportCSV}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: isDark ? "#a1a1aa" : "#64748b", background: "transparent", border: "none", cursor: "pointer" }}
            >
              <FileText size={12} />
              Export visible rows
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
