"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  IndianRupee,
  TrendingUp,
  Package,
  CheckCircle,
  Clock,
  RotateCcw,
  AlertOctagon,
  Megaphone,
  Percent,
  TrendingDown,
  Activity,
  Zap,
  Calendar,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { BarChart } from "@/components/meesho/BarChart";
import { DonutChart } from "@/components/meesho/DonutChart";
import { MoneyFlow } from "@/components/meesho/MoneyFlow";
import { HealthScoreMeter } from "@/components/meesho/HealthScoreMeter";
import { DateFilter } from "@/components/meesho/types";
import { calculateMetrics, calculateTodayMetrics } from "@/lib/data/analytics";
import { generateAiInsights } from "@/lib/data/insights";
import { repository } from "@/lib/data/repository";

interface TimelineEvent {
  time: string;
  date: string;
  title: string;
  description: string;
  type: 'order' | 'payment' | 'return' | 'ad' | 'claim';
}

export default function ExecutiveDashboard() {
  const { orders, returns, claims, adCampaigns, paymentCycles, syncStatus, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);
  const filteredClaims = useMemo(() => filterByDate(claims, dateFilter), [claims, dateFilter]);

  // Centralized analytics calculations
  const metrics = useMemo(() => {
    return calculateMetrics(filteredOrders, filteredReturns, filteredClaims);
  }, [filteredOrders, filteredReturns, filteredClaims]);

  // Sync Freshness Status Formatter
  const formatFreshness = (timestamp: number | undefined): string => {
    if (!timestamp) return "Never Synced";
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just updated";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `Today ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return "Yesterday";
  };

  // Find latest active date to represent "Today's Business"
  const todayStr = useMemo(() => {
    if (orders.length === 0) return "2026-06-29";
    const dates = [...orders].map((o) => o.date).sort();
    return dates[dates.length - 1]; // latest order date
  }, [orders]);

  const todayMetrics = useMemo(() => {
    return calculateTodayMetrics(orders, returns, claims, adCampaigns, paymentCycles, todayStr);
  }, [orders, returns, claims, adCampaigns, paymentCycles, todayStr]);

  const healthScore = useMemo(() => {
    let score = 100;
    if (metrics.returnRate > 15) score -= 25;
    else if (metrics.returnRate > 7) score -= 12;

    if (metrics.rtoRate > 20) score -= 25;
    else if (metrics.rtoRate > 10) score -= 12;

    if (metrics.roas < 1.5) score -= 20;
    else if (metrics.roas < 3) score -= 8;

    const netMargin = metrics.revenue ? (metrics.netProfit / metrics.revenue) * 100 : 0;
    if (netMargin < 5) score -= 20;
    else if (netMargin < 15) score -= 8;

    return Math.max(0, score);
  }, [metrics]);

  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      if (!map[o.date]) map[o.date] = 0;
      if (o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned") {
        map[o.date] += o.sellingPrice;
      }
    });

    const dates = Object.keys(map).sort();
    return dates.map((d) => ({
      label: d.slice(5), // MM-DD
      value: map[d],
    }));
  }, [filteredOrders]);

  const statusDonutData = useMemo(() => {
    const counts = { packed: 0, shipped: 0, delivered: 0, rto: 0, returned: 0, cancelled: 0 };
    filteredOrders.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status]++;
    });

    return [
      { label: "Delivered", value: counts.delivered, color: "#10b981" },
      { label: "Transit / Shipped", value: counts.shipped, color: "#6366f1" },
      { label: "Packed / Pending", value: counts.packed, color: "#3b82f6" },
      { label: "RTO", value: counts.rto, color: "#ef4444" },
      { label: "Returned", value: counts.returned, color: "#f97316" },
    ].filter((d) => d.value > 0);
  }, [filteredOrders]);

  // Upgrade AI Insights Engine Cards
  const aiInsights = useMemo(() => {
    const settings = repository.getSettings();
    const inventory = repository.getInventory();
    return generateAiInsights(orders, returns, claims, adCampaigns, inventory, settings);
  }, [orders, returns, claims, adCampaigns]);

  // Chronological Business Timeline (Activity Feed)
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Orders Received
    orders.slice(0, 8).forEach((o, i) => {
      const minOffset = (i * 35) % 60;
      const hourOffset = 9 + Math.floor(i * 0.7);
      const timeStr = `${String(hourOffset).padStart(2, "0")}:${String(minOffset).padStart(2, "0")}`;
      events.push({
        date: o.date,
        time: timeStr,
        title: `${o.qty} Order${o.qty > 1 ? 's' : ''} Received`,
        description: `Sub-order #${o.orderNo} for SKU ${o.sku} (₹${o.sellingPrice.toLocaleString("en-IN")})`,
        type: "order"
      });
    });

    // Returns
    returns.slice(0, 4).forEach((r, i) => {
      events.push({
        date: r.date,
        time: "14:20",
        title: r.isRTO ? "RTO Return Logged" : "Customer Return Logged",
        description: `${r.productName} returned via ${r.courier}. Return loss: ₹${r.financialLoss}`,
        type: "return"
      });
    });

    // Payments Settled
    paymentCycles.slice(0, 3).forEach((p) => {
      events.push({
        date: p.cycleDate,
        time: "10:30",
        title: "Settlement Scheduled",
        description: `UTR ${p.utr || 'processing'}. Net Credited: ₹${p.netAmount.toLocaleString("en-IN")}`,
        type: "payment"
      });
    });

    // Ad Spends alert
    adCampaigns.slice(0, 2).forEach((c) => {
      if (c.spend > c.budget) {
        events.push({
          date: c.startDate,
          time: "12:15",
          title: "Ad Budget Exceeded",
          description: `Campaign '${c.name}' exceeded budget by ₹${(c.spend - c.budget).toFixed(0)}`,
          type: "ad"
        });
      }
    });

    // Claims Recovery
    claims.slice(0, 2).forEach((c) => {
      if (c.status === "approved") {
        events.push({
          date: c.date,
          time: "16:45",
          title: "Safety Claim Approved",
          description: `Recovery Claim approved for ₹${c.amountApproved} for Order ${c.orderId}`,
          type: "claim"
        });
      }
    });

    // Sort chronologically
    return events.sort((a, b) => {
      const cmpDate = b.date.localeCompare(a.date);
      if (cmpDate !== 0) return cmpDate;
      return b.time.localeCompare(a.time);
    }).slice(0, 10);
  }, [orders, returns, paymentCycles, adCampaigns, claims]);

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading BI metrics…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header and Sync Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Executive Dashboard</h1>
          <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>CEO business intelligence summary</p>
        </div>

        {/* Sync Status Fresheness widget */}
        <div style={{ display: "flex", gap: 10, background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "8px 14px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Freshness Status</span>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#475569" }}>Orders: <strong>{formatFreshness(syncStatus.orders)}</strong></span>
              <span style={{ fontSize: 9, color: "#475569" }}>Payments: <strong>{formatFreshness(syncStatus.payments)}</strong></span>
              <span style={{ fontSize: 9, color: "#475569" }}>Returns: <strong>{formatFreshness(syncStatus.returns)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* Grid containing Today's Business widget */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 16, marginBottom: 20 }}>
        {/* Today's Business widget */}
        <div style={{ background: "linear-gradient(135deg, #1e1b4b, #311042)", borderRadius: 16, padding: 20, color: "#ffffff", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={16} style={{ color: "#ec4899" }} />
              <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Today's Business Summary</h3>
            </div>
            <span style={{ fontSize: 10, padding: "3px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={10} />
              Ref: {todayStr}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Today's Revenue</span>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>₹{todayMetrics.revenue.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Today's Net Profit</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: todayMetrics.profit >= 0 ? "#4ade80" : "#f87171", marginTop: 4 }}>
                ₹{todayMetrics.profit.toLocaleString("en-IN")}
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Today's Orders</span>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{todayMetrics.orders} units</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Delivered / Returns</span>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{todayMetrics.delivered} Deliv / {todayMetrics.returns} Ret</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Today's RTO</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginTop: 4 }}>{todayMetrics.rto} units</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Ad Spend</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f472b6", marginTop: 4 }}>₹{todayMetrics.adsSpend.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Shipping / Commission</span>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>₹{todayMetrics.shipping} / ₹{todayMetrics.fees}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Claim Recovered</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginTop: 4 }}>₹{todayMetrics.claims.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", padding: 10, borderRadius: 10 }}>
              <span style={{ fontSize: 9, color: "#cbd5e1" }}>Expected Settlement</span>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>₹{todayMetrics.settlement.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>

        {/* Business timeline / activity feed */}
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", height: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Activity size={16} style={{ color: "#7c3aed" }} />
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Business Timeline</h3>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}>
            {timelineEvents.map((evt, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", position: "relative" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: "#64748b", background: "#f1f5f9", padding: "2px 4px", borderRadius: 4 }}>{evt.time}</span>
                  {idx !== timelineEvents.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 16, background: "#cbd5e1", marginTop: 4 }} />
                  )}
                </div>

                <div style={{ fontSize: 10, color: "#334155" }}>
                  <div style={{ fontWeight: 700 }}>{evt.title}</div>
                  <div style={{ color: "#64748b", fontSize: 9, marginTop: 1 }}>{evt.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (Range filtered) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Range Gross Sales" value={metrics.revenue.toLocaleString("en-IN")} prefix="₹" color="#7c3aed" icon={<IndianRupee size={16} />} />
        <KpiCard title="Range Net Profit" value={metrics.netProfit.toLocaleString("en-IN")} prefix="₹" isProfit color="#10b981" icon={<TrendingUp size={16} />} />
        <KpiCard title="Range Gross Profit" value={metrics.grossProfit.toLocaleString("en-IN")} prefix="₹" color="#3b82f6" icon={<Percent size={16} />} />
        <KpiCard title="Range Total Orders" value={metrics.totalOrders} color="#f59e0b" icon={<Package size={16} />} />
      </div>

      {/* Secondary KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Delivered Orders" value={metrics.deliveredOrders} color="#10b981" icon={<CheckCircle size={16} />} />
        <KpiCard title="Pending / Shipped" value={metrics.pendingOrders} color="#6366f1" icon={<Clock size={16} />} />
        <KpiCard title="Customer Returns" value={metrics.returns} color="#f97316" icon={<RotateCcw size={16} />} />
        <KpiCard title="RTO Count" value={metrics.rto} color="#ef4444" icon={<AlertOctagon size={16} />} />
      </div>

      {/* Tertiary Cost Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Ad Spend" value={metrics.adsSpend.toLocaleString("en-IN")} prefix="₹" color="#ec4899" icon={<Megaphone size={16} />} />
        <KpiCard title="Platform Fees" value={metrics.platformFees.toLocaleString("en-IN")} prefix="₹" color="#64748b" />
        <KpiCard title="Shipping Costs" value={metrics.shippingCharges.toLocaleString("en-IN")} prefix="₹" color="#0284c7" />
        <KpiCard title="Claim Recovery" value={metrics.claimRecovery.toLocaleString("en-IN")} prefix="₹" color="#14532d" />
      </div>

      {/* Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        <BarChart title="Daily Sales (Revenue Trend)" data={chartData} height={180} valuePrefix="₹" />
        <DonutChart title="Order Status Breakdown" data={statusDonutData} size={130} />
      </div>

      {/* Waterfall & Health Gauge */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <MoneyFlow
          revenue={metrics.revenue}
          cogs={metrics.cogs}
          platformFees={metrics.platformFees}
          shippingCharges={metrics.shippingCharges}
          adSpend={metrics.adsSpend}
          returnCharges={metrics.returnCharges}
          rtoLoss={metrics.rtoLoss}
          claimsRecovery={metrics.claimRecovery}
        />
        <HealthScoreMeter score={healthScore} />
      </div>

      {/* Upgraded AI Copilot Priority Insights */}
      <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <TrendingUp size={16} style={{ color: "#7c3aed" }} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>AI Recommendation Engine & Business Insights</h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {aiInsights.map((insight) => (
            <div
              key={insight.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${insight.priority === 'critical' ? '#fee2e2' : insight.priority === 'warning' ? '#fef3c7' : insight.priority === 'opportunity' ? '#dcfce7' : '#e0f2fe'}`,
                background: insight.priority === 'critical' ? '#fef2f2' : insight.priority === 'warning' ? '#fffbeb' : insight.priority === 'opportunity' ? '#f0fdf4' : '#f0f9ff',
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 4,
                      color: "#fff",
                      background: insight.priority === 'critical' ? '#ef4444' : insight.priority === 'warning' ? '#f59e0b' : insight.priority === 'opportunity' ? '#10b981' : '#3b82f6'
                    }}
                  >
                    {insight.priority}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1f2937" }}>{insight.title}</span>
                </div>
                <p style={{ fontSize: 9.5, color: "#4b5563", lineHeight: "1.4em" }}>{insight.message}</p>
              </div>

              {insight.actionText && insight.actionUrl && (
                <a
                  href={insight.actionUrl}
                  style={{
                    alignSelf: "flex-end",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#7c3aed",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 2
                  }}
                >
                  {insight.actionText} <ChevronRight size={10} />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
