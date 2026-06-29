"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DataTable } from "@/components/meesho/DataTable";
import { BarChart } from "@/components/meesho/BarChart";
import { DateFilter, SkuStats } from "@/components/meesho/types";

export default function ProductAnalyticsPage() {
  const { orders, returns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);

  const skuStatsList = useMemo(() => {
    // Extract unique SKUs
    const skus = Array.from(new Set(filteredOrders.map((o) => o.sku)));

    const list: SkuStats[] = skus.map((sku) => {
      const oList = filteredOrders.filter((o) => o.sku === sku);
      const rList = filteredReturns.filter((r) => r.sku === sku);

      const name = oList[0]?.productName || "Unknown Product";
      const ordersCount = oList.length;

      const revenue = oList
        .filter((o) => o.status !== "rto" && o.status !== "cancelled" && o.status !== "returned")
        .reduce((sum, o) => sum + o.sellingPrice, 0);

      const returnsCount = rList.filter((r) => !r.isRTO).length;
      const rto = rList.filter((r) => r.isRTO).length;

      const adsCost = oList.reduce((sum, o) => sum + o.adSpend, 0);
      const shippingCost = oList.reduce((sum, o) => sum + o.shippingCharge, 0);
      const platformFees = oList.reduce((sum, o) => sum + o.platformFee, 0);
      const cogs = oList.reduce((sum, o) => sum + o.costOfGoods, 0);

      const returnLoss = rList.reduce((sum, r) => sum + r.financialLoss, 0);
      const netProfit = revenue - adsCost - shippingCost - platformFees - cogs - returnLoss;

      const returnRate = ordersCount ? (returnsCount / ordersCount) * 100 : 0;
      const rtoRate = ordersCount ? (rto / ordersCount) * 100 : 0;

      // Product Health score logic
      let healthScore = 100;
      healthScore -= returnRate * 2.5;
      healthScore -= rtoRate * 1.5;
      const margin = revenue ? (netProfit / revenue) * 100 : 0;
      if (margin < 10) healthScore -= 20;
      else if (margin < 20) healthScore -= 5;
      healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

      return {
        sku,
        productName: name,
        revenue,
        orders: ordersCount,
        returns: returnsCount,
        rto,
        adsCost,
        shippingCost,
        platformFees,
        cogs,
        netProfit,
        returnRate,
        rtoRate,
        healthScore,
      };
    });

    return list;
  }, [filteredOrders, filteredReturns]);

  const bestWorstProducts = useMemo(() => {
    if (skuStatsList.length === 0) return { best: "-", worst: "-" };
    const sorted = [...skuStatsList].sort((a, b) => b.netProfit - a.netProfit);
    const worstProduct = [...skuStatsList].sort((a, b) => b.returnRate - a.returnRate)[0];

    return {
      best: sorted[0]?.productName || "-",
      worst: worstProduct && worstProduct.returnRate > 0 ? worstProduct.productName : "-",
    };
  }, [skuStatsList]);

  const revenueChartData = useMemo(() => {
    return skuStatsList.map((s) => ({
      label: s.sku,
      value: s.revenue,
    }));
  }, [skuStatsList]);

  const profitChartData = useMemo(() => {
    return skuStatsList.map((s) => ({
      label: s.sku,
      value: s.netProfit,
    }));
  }, [skuStatsList]);

  const columns = [
    { key: "sku", label: "SKU", sortable: true },
    { key: "productName", label: "Product Name", sortable: true },
    { key: "orders", label: "Orders", align: "center" as const, sortable: true },
    {
      key: "revenue",
      label: "Revenue",
      align: "right" as const,
      sortable: true,
      render: (row: SkuStats) => `₹${row.revenue.toLocaleString("en-IN")}`,
    },
    {
      key: "netProfit",
      label: "Net Profit",
      align: "right" as const,
      sortable: true,
      render: (row: SkuStats) => (
        <span style={{ fontWeight: 700, color: row.netProfit >= 0 ? "#10b981" : "#ef4444" }}>
          ₹{row.netProfit.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "returnRate",
      label: "Returns %",
      align: "center" as const,
      render: (row: SkuStats) => `${row.returnRate.toFixed(1)}%`,
    },
    {
      key: "rtoRate",
      label: "RTO %",
      align: "center" as const,
      render: (row: SkuStats) => `${row.rtoRate.toFixed(1)}%`,
    },
    {
      key: "healthScore",
      label: "Health Index",
      align: "center" as const,
      sortable: true,
      render: (row: SkuStats) => {
        const c = row.healthScore >= 80 ? "#10b981" : row.healthScore >= 50 ? "#f59e0b" : "#ef4444";
        return (
          <span style={{ display: "inline-block", width: 44, padding: "2px 4px", fontSize: 10, fontWeight: 700, textAlign: "center", color: "#fff", background: c, borderRadius: 6 }}>
            {row.healthScore}
          </span>
        );
      },
    },
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Analyzing product health…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Product & SKU Intelligence</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Breakdown operational parameters for each individual SKU code</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPI summaries */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Total Monitored SKUs" value={skuStatsList.length} color="#7c3aed" />
        <KpiCard title="Best Contributor (Net Profit)" value={bestWorstProducts.best} color="#10b981" />
        <KpiCard title="Highest Return Hazard" value={bestWorstProducts.worst} color="#ef4444" />
      </div>

      {/* Chart comparing SKUs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        <BarChart title="Gross Sales by SKU" data={revenueChartData} height={160} valuePrefix="₹" />
        <BarChart title="Net Contribution (Profit) by SKU" data={profitChartData} height={160} valuePrefix="₹" />
      </div>

      {/* Grid listing SKUs details */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Product Ledger Metrics</div>
        <DataTable columns={columns} data={skuStatsList} pageSize={10} searchKeys={["sku", "productName"]} />
      </div>
    </motion.div>
  );
}
