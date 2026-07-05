"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  IndianRupee,
  RotateCcw,
  Megaphone,
  Loader2,
  AlertTriangle,
  Trophy,
  FileSpreadsheet,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import {
  formatINR,
} from "@/lib/meesho/paymentsParser";
import { MeeshoPaymentRow, MeeshoAdsRow } from "@/lib/meesho/types";
import { buildAnalytics, analyticsToAISummary, GrowthMetric } from "@/lib/meesho/insights";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { useMeeshoOrders } from "@/lib/hooks/useMeeshoOrders";

const EMPTY_PAYMENTS: MeeshoPaymentRow[] = [];
const EMPTY_ADS: MeeshoAdsRow[] = [];

// ── small UI atoms ──────────────────────────────────────────────────

function GrowthChip({ metric, isDark }: { metric: GrowthMetric; isDark: boolean }) {
  const pct = metric.growthPct;
  if (pct === null) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 10,
          fontWeight: 800,
          padding: "3px 8px",
          borderRadius: 999,
          background: isDark ? "#27272a" : "#f1f5f9",
          color: isDark ? "#a1a1aa" : "#64748b",
        }}
      >
        <Minus size={10} /> new
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        fontWeight: 800,
        padding: "3px 8px",
        borderRadius: 999,
        background: up ? "rgba(22,163,74,0.12)" : "rgba(239,68,68,0.12)",
        color: up ? "#16a34a" : "#ef4444",
      }}
    >
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── SVG bar chart ───────────────────────────────────────────────────

function BarChart({
  data,
  color,
  isDark,
  height = 130,
  valueFormatter,
}: {
  data: { label: string; value: number }[];
  color: string;
  isDark: boolean;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length || 1;
  const gap = 3;
  const W = 100; // percent-based viewBox width units per bar handled via index

  return (
    <div style={{ position: "relative" }}>
      {hover !== null && data[hover] && (
        <div
          style={{
            position: "absolute",
            top: -6,
            left: `${(hover / n) * 100}%`,
            transform: "translateX(-30%)",
            background: isDark ? "#27272a" : "#111",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 8,
            padding: "4px 8px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          {data[hover].label} · {valueFormatter ? valueFormatter(data[hover].value) : data[hover].value}
        </div>
      )}
      <svg
        viewBox={`0 0 ${n * (W / n)} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        {data.map((d, i) => {
          const barW = W / n - gap * (100 / (n * 30));
          const h = Math.max((d.value / max) * (height - 14), d.value > 0 ? 3 : 0);
          const x = (i * W) / n;
          return (
            <g key={i}>
              {/* hover hit area */}
              <rect
                x={x}
                y={0}
                width={W / n}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <motion.rect
                x={x + gap / 2}
                initial={{ y: height, height: 0 }}
                animate={{ y: height - h, height: h }}
                transition={{ delay: 0.15 + i * 0.015, duration: 0.5, ease: "easeOut" }}
                width={Math.max(barW, 0.5)}
                rx={1}
                fill={color}
                opacity={hover === i ? 1 : 0.75}
                style={{ transition: "opacity 0.15s" }}
                pointerEvents="none"
              />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9.5,
          fontWeight: 700,
          color: isDark ? "#52525b" : "#94a3b8",
          marginTop: 4,
        }}
      >
        <span>{data[0]?.label ?? ""}</span>
        <span>{data[Math.floor(data.length / 2)]?.label ?? ""}</span>
        <span>{data[data.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}

// Minimal markdown-ish renderer for AI insights text
function renderInsights(text: string, isDark: boolean): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  const boldify = (s: string, key: string) => {
    const parts = s.split(/\*\*(.+?)\*\*/g);
    return parts.map((p, i) =>
      i % 2 === 1 ? (
        <strong key={`${key}-${i}`} style={{ color: isDark ? "#fafafa" : "#111" }}>
          {p}
        </strong>
      ) : (
        p
      )
    );
  };
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const key = `l${idx}`;
    if (/^#{1,4}\s/.test(line)) {
      nodes.push(
        <p key={key} style={{ fontWeight: 900, fontSize: 12.5, margin: "12px 0 4px", color: isDark ? "#fafafa" : "#111" }}>
          {boldify(line.replace(/^#{1,4}\s/, ""), key)}
        </p>
      );
    } else if (/^(\d+\.|[-*•])\s/.test(line)) {
      nodes.push(
        <p key={key} style={{ margin: "3px 0 3px 8px", fontSize: 12, lineHeight: 1.65, display: "flex", gap: 7 }}>
          <span style={{ color: isDark ? "#fafafa" : "#111", fontWeight: 900, flexShrink: 0 }}>›</span>
          <span>{boldify(line.replace(/^(\d+\.|[-*•])\s/, ""), key)}</span>
        </p>
      );
    } else {
      nodes.push(
        <p key={key} style={{ margin: "6px 0", fontSize: 12, lineHeight: 1.65 }}>
          {boldify(line, key)}
        </p>
      );
    }
  });
  return nodes;
}

// ── main component ──────────────────────────────────────────────────

export default function OverviewTab() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [payments] = useSupabaseTable<MeeshoPaymentRow>(
    "meesho_payments",
    "biztrack_meesho_payments",
    EMPTY_PAYMENTS
  );
  const [ads] = useSupabaseTable<MeeshoAdsRow>("meesho_ads", "biztrack_meesho_ads", EMPTY_ADS);
  const [orderLog] = useMeeshoOrders();

  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");

  const analytics = useMemo(() => buildAnalytics(payments, ads, orderLog), [payments, ads, orderLog]);
  const hasData = payments.length > 0 || ads.length > 0 || orderLog.length > 0;

  const generateInsights = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: analyticsToAISummary(analytics) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setAiText(json.insights);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  };

  // last 30 days of daily series for charts
  const last30 = analytics.daily.slice(-30);
  const ordersSeries = last30.map((d) => ({ label: shortDate(d.date), value: d.orders }));
  const settledSeries = last30.map((d) => ({ label: shortDate(d.date), value: Math.round(d.settled) }));
  const adsSeries = last30.map((d) => ({ label: shortDate(d.date), value: Math.round(d.ads) }));

  const curMonth = analytics.monthly[analytics.monthly.length - 1];
  const monthNet = curMonth ? curMonth.net : 0;

  const card: React.CSSProperties = {
    background: isDark ? "#18181b" : "#ffffff",
    border: isDark ? "1px solid #27272a" : "1px solid #ececec",
    borderRadius: 18,
    padding: 18,
    boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.03)",
  };
  const cardTitle: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    color: isDark ? "#71717a" : "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 6,
  };
  const bigNum: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: isDark ? "#fafafa" : "#111",
    fontVariantNumeric: "tabular-nums",
  };

  if (!hasData) {
    return (
      <div style={{ ...card, padding: "56px 24px", textAlign: "center" }}>
        <FileSpreadsheet size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
        <p style={{ fontSize: 14, fontWeight: 800, color: isDark ? "#e4e4e7" : "#334155", marginBottom: 6 }}>
          No data yet — upload your Meesho files first
        </p>
        <p style={{ fontSize: 12, color: isDark ? "#71717a" : "#94a3b8", maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>
          Go to the <strong>Payments &amp; Ads</strong> tab and upload your payment xlsx (and orders
          xlsx). The overview dashboard, growth analytics and AI insights will light up automatically.
        </p>
      </div>
    );
  }

  const kpis: {
    title: string;
    icon: React.ElementType;
    value: React.ReactNode;
    sub: string;
    chip: GrowthMetric | null;
    valueColor?: string;
  }[] = [
    {
      title: "Orders · This Week",
      icon: Package,
      value: <AnimatedCounter value={analytics.ordersWoW.current} />,
      sub: `prev week ${analytics.ordersWoW.previous}`,
      chip: analytics.ordersWoW,
    },
    {
      title: "Payment · This Week",
      icon: IndianRupee,
      value: <AnimatedCounter value={Math.round(analytics.paymentWoW.current)} prefix="₹" />,
      sub: `prev week ${formatINR(analytics.paymentWoW.previous)}`,
      chip: analytics.paymentWoW,
    },
    {
      title: `Net P&L · ${curMonth?.label ?? "This Month"}`,
      icon: monthNet >= 0 ? TrendingUp : TrendingDown,
      value: <AnimatedCounter value={Math.round(monthNet)} prefix="₹" />,
      sub: monthNet >= 0 ? "profit after ads" : "loss after ads",
      valueColor: monthNet >= 0 ? "#16a34a" : "#ef4444",
      chip: null,
    },
    {
      title: "Return / RTO Rate",
      icon: RotateCcw,
      value: <AnimatedCounter value={analytics.returnRatePct} suffix="%" decimals={1} />,
      sub: "of decided orders",
      valueColor: analytics.returnRatePct > 25 ? "#ef4444" : analytics.returnRatePct > 15 ? "#f59e0b" : "#16a34a",
      chip: null,
    },
    {
      title: "Ads % of Payments",
      icon: Megaphone,
      value: <AnimatedCounter value={analytics.adsPctOfSettled} suffix="%" decimals={1} />,
      sub: `avg ₹${Math.round(analytics.avgSettlementPerDelivered)} / delivered order`,
      valueColor: analytics.adsPctOfSettled > 30 ? "#ef4444" : analytics.adsPctOfSettled > 15 ? "#f59e0b" : "#16a34a",
      chip: null,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        {kpis.map((k, i) => (
          <motion.div
            key={k.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            style={card}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={cardTitle}>
                <k.icon size={12} style={{ color: isDark ? "#fafafa" : "#111" }} /> {k.title}
              </span>
              {k.chip && <GrowthChip metric={k.chip} isDark={isDark} />}
            </div>
            <div style={{ ...bigNum, color: k.valueColor ?? bigNum.color }}>{k.value}</div>
            <div style={{ fontSize: 10.5, color: isDark ? "#71717a" : "#94a3b8", marginTop: 4 }}>{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 14 }}>
            <Package size={12} style={{ color: isDark ? "#fafafa" : "#111" }} /> Daily Orders (last 30 days)
          </div>
          <BarChart data={ordersSeries} color={isDark ? "#fafafa" : "#111111"} isDark={isDark} />
        </div>
        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 14 }}>
            <IndianRupee size={12} style={{ color: "#16a34a" }} /> Payment Received / Day
          </div>
          <BarChart data={settledSeries} color="#16a34a" isDark={isDark} valueFormatter={(v) => formatINR(v)} />
        </div>
        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 14 }}>
            <Megaphone size={12} style={{ color: "#ef4444" }} /> Ads Spend / Day
          </div>
          <BarChart data={adsSeries} color="#ef4444" isDark={isDark} valueFormatter={(v) => formatINR(v)} />
        </div>
      </div>

      {/* Weekly performance + AI insights */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        {/* Weekly table */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ ...cardTitle, padding: "16px 18px 12px" }}>
            <TrendingUp size={12} style={{ color: isDark ? "#fafafa" : "#111" }} /> Weekly Performance
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: isDark ? "#111113" : "#fafafa" }}>
                  {["Week", "Orders", "Dlv", "Ret", "Payment", "Ads", "Net"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: isDark ? "#a1a1aa" : "#64748b",
                        textAlign: i === 0 ? "left" : "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...analytics.weekly].reverse().slice(0, 8).map((w) => (
                  <tr key={w.key} style={{ borderTop: isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9" }}>
                    <td style={{ padding: "9px 12px", fontSize: 11.5, fontWeight: 800, color: isDark ? "#e4e4e7" : "#1e293b", whiteSpace: "nowrap" }}>
                      {w.label}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", fontWeight: 800, color: isDark ? "#e4e4e7" : "#111" }}>{w.orders || "—"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", color: "#16a34a" }}>{w.delivered || "—"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", color: w.returned ? "#ef4444" : (isDark ? "#52525b" : "#cbd5e1") }}>{w.returned || "—"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", fontWeight: 700, color: isDark ? "#e4e4e7" : "#111" }}>
                      {w.settled + w.upcoming ? formatINR(w.settled + w.upcoming) : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", color: w.ads ? "#ef4444" : (isDark ? "#52525b" : "#cbd5e1") }}>
                      {w.ads ? `−${formatINR(w.ads)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", fontWeight: 900, color: w.net > 0 ? "#16a34a" : w.net < 0 ? "#ef4444" : (isDark ? "#52525b" : "#cbd5e1") }}>
                      {w.net ? formatINR(w.net) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Insights */}
        <div style={{ ...card, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={cardTitle}>
              <Sparkles size={12} style={{ color: isDark ? "#fafafa" : "#111" }} /> AI Business Insights
            </span>
            <button
              onClick={generateInsights}
              disabled={aiLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: isDark ? "#fafafa" : "#111111",
                color: isDark ? "#111" : "#fff",
                border: "none",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 11,
                fontWeight: 800,
                cursor: aiLoading ? "wait" : "pointer",
                opacity: aiLoading ? 0.7 : 1,
              }}
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? "Analysing…" : aiText ? "Refresh" : "Generate"}
            </button>
          </div>

          {aiError && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: isDark ? "rgba(239,68,68,0.08)" : "#fef2f2",
                border: "1px solid rgba(239,68,68,0.25)",
                color: isDark ? "#f87171" : "#dc2626",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 11.5,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{aiError}</span>
            </div>
          )}

          {!aiText && !aiError && !aiLoading && (
            <p style={{ fontSize: 12, color: isDark ? "#71717a" : "#94a3b8", lineHeight: 1.65 }}>
              Click <strong>Generate</strong> — AI will read your weekly &amp; monthly numbers and
              write a plain-language report: growth kya hai, profit/loss kitna, returns kahan zyada
              hain, aur aage kya karna chahiye.
            </p>
          )}

          {aiText && (
            <div style={{ color: isDark ? "#d4d4d8" : "#334155", overflowY: "auto", maxHeight: 420 }}>
              {renderInsights(aiText, isDark)}
            </div>
          )}
        </div>
      </div>

      {/* SKU intelligence */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 12 }}>
            <Trophy size={12} style={{ color: "#f59e0b" }} /> Top Products by Orders
          </div>
          {analytics.topSkus.map((s, i) => (
            <div
              key={s.sku}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderTop: i > 0 ? (isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9") : "none",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 900, color: isDark ? "#fafafa" : "#111", width: 16 }}>#{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#e4e4e7" : "#111" }}>{s.sku}</div>
                <div style={{ fontSize: 10, color: isDark ? "#71717a" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.productName || "—"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: isDark ? "#fafafa" : "#111" }}>{s.orders} orders</div>
                <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>{formatINR(Math.round(s.settled))} settled</div>
              </div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 12 }}>
            <AlertTriangle size={12} style={{ color: "#ef4444" }} /> High Return-Rate Products
          </div>
          {analytics.worstSkus.filter((s) => s.returnRatePct > 0).length === 0 && (
            <p style={{ fontSize: 12, color: isDark ? "#71717a" : "#94a3b8" }}>
              No SKU with significant returns yet — great sign.
            </p>
          )}
          {analytics.worstSkus
            .filter((s) => s.returnRatePct > 0)
            .map((s, i) => (
              <div
                key={s.sku}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderTop: i > 0 ? (isDark ? "1px solid #1f1f23" : "1px solid #f1f5f9") : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#e4e4e7" : "#111" }}>{s.sku}</div>
                  <div style={{ fontSize: 10, color: isDark ? "#71717a" : "#94a3b8" }}>
                    {s.returned} of {s.orders} orders returned
                  </div>
                </div>
                <div style={{ position: "relative", width: 90, height: 6, background: isDark ? "#27272a" : "#f1f5f9", borderRadius: 999 }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${Math.min(s.returnRatePct, 100)}%`,
                      background: s.returnRatePct > 40 ? "#ef4444" : "#f59e0b",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, fontWeight: 900, color: s.returnRatePct > 40 ? "#ef4444" : "#f59e0b", width: 42, textAlign: "right" }}>
                  {s.returnRatePct.toFixed(0)}%
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
