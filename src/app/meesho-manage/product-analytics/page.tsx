"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DataTable } from "@/components/meesho/DataTable";
import { BarChart } from "@/components/meesho/BarChart";
import { DateFilter, SkuStats, MMInventoryItem } from "@/components/meesho/types";
import { calculateSkuStats } from "@/lib/data/analytics";
import { AlertTriangle, ShieldCheck, Warehouse } from "lucide-react";

export default function ProductAnalyticsPage() {
  const { orders, returns, inventory, settings, adCampaigns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);

  // Use centralized calculation
  const skuStatsList = useMemo(() => {
    return calculateSkuStats(filteredOrders, filteredReturns, settings, adCampaigns);
  }, [filteredOrders, filteredReturns, settings, adCampaigns]);

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

  // Clickable SKU and Name Columns
  const columns = [
    {
      key: "sku",
      label: "SKU",
      sortable: true,
      render: (row: SkuStats) => (
        <a
          href={`/meesho-manage/product-360?sku=${row.sku}`}
          style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}
        >
          {row.sku}
        </a>
      )
    },
    {
      key: "productName",
      label: "Product Name",
      sortable: true,
      render: (row: SkuStats) => (
        <a
          href={`/meesho-manage/product-360?sku=${row.sku}`}
          style={{ color: "#1e293b", fontWeight: 600, textDecoration: "none" }}
        >
          {row.productName}
        </a>
      )
    },
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

  // Inventory Table Columns
  const inventoryColumns = [
    {
      key: "sku",
      label: "SKU",
      sortable: true,
      render: (row: MMInventoryItem) => (
        <a
          href={`/meesho-manage/product-360?sku=${row.sku}`}
          style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}
        >
          {row.sku}
        </a>
      )
    },
    {
      key: "productName",
      label: "Product Name",
      sortable: true,
      render: (row: MMInventoryItem) => (
        <a
          href={`/meesho-manage/product-360?sku=${row.sku}`}
          style={{ color: "#1e293b", fontWeight: 600, textDecoration: "none" }}
        >
          {row.productName}
        </a>
      )
    },
    { key: "currentStock", label: "Current Stock", align: "center" as const, sortable: true },
    { key: "reservedStock", label: "Reserved", align: "center" as const },
    { key: "availableStock", label: "Available", align: "center" as const, sortable: true },
    { key: "avgDailySales", label: "Daily Sales", align: "center" as const, render: (row: MMInventoryItem) => `${row.avgDailySales.toFixed(1)}/day` },
    {
      key: "daysRemaining",
      label: "Days Left",
      align: "center" as const,
      sortable: true,
      render: (row: MMInventoryItem) => (
        <span style={{ fontWeight: 700, color: row.daysRemaining < 7 ? "#ef4444" : "#10b981" }}>
          {row.daysRemaining} days
        </span>
      )
    },
    {
      key: "suggestedReorderDate",
      label: "Sug. Reorder Date",
      align: "center" as const,
      render: (row: MMInventoryItem) => (
        <span style={{ color: row.suggestedReorderDate ? "#d97706" : "#64748b", fontWeight: row.suggestedReorderDate ? 800 : 400 }}>
          {row.suggestedReorderDate || "Stock Optimal"}
        </span>
      )
    },
    {
      key: "health",
      label: "Status",
      align: "center" as const,
      render: (row: MMInventoryItem) => {
        const isLow = row.health === "low_stock";
        const isOut = row.health === "out_of_stock";
        const bg = isOut ? "#fee2e2" : isLow ? "#fffbeb" : "#f0fdf4";
        const color = isOut ? "#b91c1c" : isLow ? "#b45309" : "#15803d";
        const text = isOut ? "Out of Stock" : isLow ? "Low Stock" : "Healthy";
        return (
          <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, background: bg, color, borderRadius: 12 }}>
            {text}
          </span>
        );
      }
    }
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

      {/* SKU Product Ledger Table */}
      <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Product Ledger Metrics</div>
        <DataTable columns={columns} data={skuStatsList} pageSize={10} searchKeys={["sku", "productName"]} />
      </div>

      {/* NEW Section: Inventory Intelligence */}
      <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Warehouse size={16} style={{ color: "#7c3aed" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Inventory Intelligence & Stock Replenishment</span>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 9, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={12} style={{ color: "#f59e0b" }} /> Low Stock Trigger: &lt; 7 Days
            </span>
            <span style={{ fontSize: 9, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
              <ShieldCheck size={12} style={{ color: "#10b981" }} /> Safe Lead Time: 3 Days
            </span>
          </div>
        </div>
        <DataTable columns={inventoryColumns} data={inventory} pageSize={10} searchKeys={["sku", "productName"]} />
      </div>
    </motion.div>
  );
}
