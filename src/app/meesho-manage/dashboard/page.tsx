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
} from "lucide-react";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { BarChart } from "@/components/meesho/BarChart";
import { DonutChart } from "@/components/meesho/DonutChart";
import { MoneyFlow } from "@/components/meesho/MoneyFlow";
import { HealthScoreMeter } from "@/components/meesho/HealthScoreMeter";
import { AiInsightPanel } from "@/components/meesho/AiInsightCard";
import { DateFilter } from "@/components/meesho/types";

export default function ExecutiveDashboard() {
  const { orders, returns, claims, adCampaigns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);
  const filteredClaims = useMemo(() => filterByDate(claims, dateFilter), [claims, dateFilter]);

  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const deliveredOrders = filteredOrders.filter((o) => o.status === "delivered").length;
    const pendingOrders = filteredOrders.filter((o) => o.status === "packed" || o.status === "shipped").length;
    const returnsCount = filteredReturns.filter((r) => !r.isRTO).length;
    const rtoCount = filteredReturns.filter((r) => r.isRTO).length;

    // Financial sums
    const revenue = filteredOrders
      .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + o.sellingPrice, 0);

    const platformFees = filteredOrders.reduce((sum, o) => sum + o.platformFee, 0);
    const shippingCharges = filteredOrders.reduce((sum, o) => sum + o.shippingCharge, 0);
    const adsSpend = filteredOrders.reduce((sum, o) => sum + o.adSpend, 0);
    const cogs = filteredOrders.reduce((sum, o) => sum + o.costOfGoods, 0);

    const returnCharges = filteredReturns
      .filter((r) => !r.isRTO)
      .reduce((sum, r) => sum + r.returnShippingCharge, 0);

    const rtoLoss = filteredReturns
      .filter((r) => r.isRTO)
      .reduce((sum, r) => sum + r.financialLoss, 0);

    const claimRecovery = filteredClaims
      .filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + c.amountApproved, 0);

    const grossProfit = revenue - cogs;
    const netProfit =
      revenue -
      cogs -
      platformFees -
      shippingCharges -
      adsSpend -
      returnCharges -
      rtoLoss +
      claimRecovery;

    const returnRate = totalOrders ? (returnsCount / totalOrders) * 100 : 0;
    const rtoRate = totalOrders ? (rtoCount / totalOrders) * 100 : 0;
    const roas = adsSpend ? revenue / adsSpend : 0;

    return {
      revenue,
      grossProfit,
      netProfit,
      totalOrders,
      deliveredOrders,
      pendingOrders,
      returns: returnsCount,
      rto: rtoCount,
      adsSpend,
      platformFees,
      shippingCharges,
      claimRecovery,
      returnRate,
      rtoRate,
      roas,
      cogs,
      returnCharges,
      rtoLoss,
    };
  }, [filteredOrders, filteredReturns, filteredClaims]);

  const healthScore = useMemo(() => {
    let score = 100;
    // Deduct for high returns
    if (metrics.returnRate > 15) score -= 25;
    else if (metrics.returnRate > 7) score -= 12;

    // Deduct for RTO
    if (metrics.rtoRate > 20) score -= 25;
    else if (metrics.rtoRate > 10) score -= 12;

    // Deduct for low ROAS
    if (metrics.roas < 1.5) score -= 20;
    else if (metrics.roas < 3) score -= 8;

    // Deduct for low net margin
    const netMargin = metrics.revenue ? (metrics.netProfit / metrics.revenue) * 100 : 0;
    if (netMargin < 5) score -= 20;
    else if (netMargin < 15) score -= 8;

    return Math.max(0, score);
  }, [metrics]);

  const chartData = useMemo(() => {
    // Generate daily sales data for the chart from filtered orders
    const map: Record<string, { rev: number; profit: number }> = {};
    filteredOrders.forEach((o) => {
      if (!map[o.date]) map[o.date] = { rev: 0, profit: 0 };
      if (o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned") {
        map[o.date].rev += o.sellingPrice;
        map[o.date].profit += o.sellingPrice - o.costOfGoods - o.platformFee;
      }
    });

    const dates = Object.keys(map).sort();
    return dates.map((d) => ({
      label: d.slice(5), // MM-DD
      value: map[d].rev,
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

  const insights = useMemo(() => {
    const list = [];
    if (metrics.returnRate > 10) {
      list.push({
        type: "danger" as const,
        title: `High Return Rate detected: ${metrics.returnRate.toFixed(1)}%`,
        description: "Customer returns are crossing the 10% healthy limit. Review SKU-specific return reasons in 'Customer Returns' sheet.",
        value: "Alert",
      });
    }
    if (metrics.rtoRate > 15) {
      list.push({
        type: "warning" as const,
        title: `RTO Rate elevated at ${metrics.rtoRate.toFixed(1)}%`,
        description: "Verify customer COD numbers or utilize pre-dispatch verification to optimize logistics cost.",
        value: "Logistics",
      });
    }
    if (metrics.roas > 3.5) {
      list.push({
        type: "success" as const,
        title: "Strong Ad ROAS Performance",
        description: `Your average ROAS is ${metrics.roas.toFixed(2)}x. Consider scaling budget on active high-performing campaigns.`,
        value: "Ads Option",
      });
    }
    // High performing SKU
    const skuMap: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      skuMap[o.sku] = (skuMap[o.sku] || 0) + o.sellingPrice;
    });
    const sortedSkus = Object.entries(skuMap).sort((a, b) => b[1] - a[1]);
    if (sortedSkus.length > 0) {
      list.push({
        type: "info" as const,
        title: `Top Selling SKU: ${sortedSkus[0][0]}`,
        description: `Contributed ₹${sortedSkus[0][1].toLocaleString("en-IN")} in gross revenue. Maintain stock levels.`,
      });
    }

    return list;
  }, [metrics]);

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading BI metrics…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Executive Dashboard</h1>
          <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>CEO business intelligence summary</p>
        </div>
      </div>

      {/* Date Filter */}
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* Primary KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Gross Sales" value={metrics.revenue.toLocaleString("en-IN")} prefix="₹" color="#7c3aed" icon={<IndianRupee size={16} />} />
        <KpiCard title="Net Profit" value={metrics.netProfit.toLocaleString("en-IN")} prefix="₹" isProfit color="#10b981" icon={<TrendingUp size={16} />} />
        <KpiCard title="Gross Profit" value={metrics.grossProfit.toLocaleString("en-IN")} prefix="₹" color="#3b82f6" icon={<Percent size={16} />} />
        <KpiCard title="Total Orders" value={metrics.totalOrders} color="#f59e0b" icon={<Package size={16} />} />
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

      {/* AI Copilot insights */}
      <AiInsightPanel insights={insights} />
    </motion.div>
  );
}
