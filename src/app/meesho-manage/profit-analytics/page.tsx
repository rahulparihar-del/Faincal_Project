"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { MoneyFlow } from "@/components/meesho/MoneyFlow";
import { DonutChart } from "@/components/meesho/DonutChart";
import { DateFilter } from "@/components/meesho/types";

export default function ProfitAnalyticsPage() {
  const { orders, returns, claims, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);
  const filteredClaims = useMemo(() => filterByDate(claims, dateFilter), [claims, dateFilter]);

  const metrics = useMemo(() => {
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

    const margin = revenue ? (netProfit / revenue) * 100 : 0;
    const totalDeductions = cogs + platformFees + shippingCharges + adsSpend + returnCharges + rtoLoss;

    return {
      revenue,
      cogs,
      platformFees,
      shippingCharges,
      adsSpend,
      returnCharges,
      rtoLoss,
      claimRecovery,
      grossProfit,
      netProfit,
      margin,
      totalDeductions,
    };
  }, [filteredOrders, filteredReturns, filteredClaims]);

  const costBreakdown = useMemo(() => {
    return [
      { label: "COGS (Inventory Cost)", value: metrics.cogs, color: "#f59e0b" },
      { label: "Platform Fees", value: metrics.platformFees, color: "#64748b" },
      { label: "Shipping Fees", value: metrics.shippingCharges, color: "#0ea5e9" },
      { label: "Ad Spend", value: metrics.adsSpend, color: "#ec4899" },
      { label: "Return Charges", value: metrics.returnCharges, color: "#f97316" },
      { label: "RTO Losses", value: metrics.rtoLoss, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Evaluating profitability charts…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Profitability & COGS Audit</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Trace bottomline margins, transaction costs, and deductions</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPI stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Revenue (Delivered)" value={metrics.revenue.toLocaleString("en-IN")} prefix="₹" color="#7c3aed" />
        <KpiCard title="Cost of Goods (COGS)" value={metrics.cogs.toLocaleString("en-IN")} prefix="₹" color="#f59e0b" />
        <KpiCard title="Net Profit Earnings" value={metrics.netProfit.toLocaleString("en-IN")} prefix="₹" isProfit color="#10b981" />
        <KpiCard title="Net Margin %" value={`${metrics.margin.toFixed(1)}%`} color={metrics.margin >= 15 ? "#10b981" : "#f59e0b"} />
      </div>

      {/* Waterfall MoneyFlow component */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 16, marginBottom: 20 }}>
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
        {costBreakdown.length > 0 ? (
          <DonutChart title="Cost Structure Breakdown" data={costBreakdown} size={120} />
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
            No expense metrics
          </div>
        )}
      </div>

      {/* EBITDA Profit & Loss Summary grid */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", borderBottom: "1px solid #f0f0f0", paddingBottom: 10, marginBottom: 12 }}>
          EBITDA Profit & Loss Summary
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Gross Sales Revenue</span>
            <span style={{ fontWeight: 700, color: "#1a1a1a" }}>₹{metrics.revenue.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Less: Inventory COGS</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.cogs.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "#333" }}>Gross Profit Margin</span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>₹{metrics.grossProfit.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Less: Platform Fees / Comm.</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.platformFees.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Less: Shipping Costs</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.shippingCharges.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Less: Ad Spend (Marketing)</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.adsSpend.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Less: Return Shipping & Losses</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.returnCharges.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Less: Logistics RTO Losses</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-₹{metrics.rtoLoss.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid #f5f5f5", paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, color: "#555" }}>Add: Claims Approved / Recovered</span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>+₹{metrics.claimRecovery.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "2px solid #e8e8e8", paddingBottom: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 800, color: "#1a1a1a" }}>Net Earnings Payout</span>
            <span style={{ fontWeight: 800, color: metrics.netProfit >= 0 ? "#10b981" : "#ef4444" }}>
              ₹{metrics.netProfit.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
