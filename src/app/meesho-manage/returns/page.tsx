"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DonutChart } from "@/components/meesho/DonutChart";
import { BarChart } from "@/components/meesho/BarChart";
import { DataTable } from "@/components/meesho/DataTable";
import { DateFilter, MMReturn, RETURN_REASONS } from "@/components/meesho/types";

export default function ReturnsPage() {
  const { orders, returns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);

  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalReturns = filteredReturns.filter((r) => !r.isRTO).length;
    const totalRTO = filteredReturns.filter((r) => r.isRTO).length;

    const returnRate = totalOrders ? (totalReturns / totalOrders) * 100 : 0;
    const rtoRate = totalOrders ? (totalRTO / totalOrders) * 100 : 0;

    const returnLoss = filteredReturns.reduce((sum, r) => sum + r.financialLoss, 0);
    const shippingCharges = filteredReturns.reduce((sum, r) => sum + r.returnShippingCharge, 0);

    return { totalReturns, totalRTO, returnRate, rtoRate, returnLoss, shippingCharges };
  }, [filteredOrders, filteredReturns]);

  const reasonSplit = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReturns.forEach((r) => {
      if (!r.isRTO) {
        const label = RETURN_REASONS[r.reason] || r.reason;
        map[label] = (map[label] || 0) + 1;
      }
    });

    const colors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#64748b"];
    return Object.entries(map).map(([label, val], idx) => ({
      label,
      value: val,
      color: colors[idx % colors.length],
    }));
  }, [filteredReturns]);

  const courierSplit = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReturns.forEach((r) => {
      map[r.courier] = (map[r.courier] || 0) + 1;
    });

    return Object.entries(map).map(([courier, val]) => ({
      label: courier,
      value: val,
    }));
  }, [filteredReturns]);

  const columns = [
    { key: "orderId", label: "Order ID", sortable: true },
    { key: "date", label: "Return Date", sortable: true },
    { key: "productName", label: "Product", sortable: true },
    { key: "sku", label: "SKU" },
    {
      key: "reason",
      label: "Reason",
      render: (row: MMReturn) => (row.isRTO ? "RTO" : RETURN_REASONS[row.reason] || row.reason),
    },
    { key: "courier", label: "Courier" },
    {
      key: "isRTO",
      label: "Type",
      render: (row: MMReturn) => (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: row.isRTO ? "#ef4444" : "#f97316",
            background: row.isRTO ? "#fef2f2" : "#fff7ed",
            padding: "2px 8px",
            borderRadius: 20,
            border: `1px solid ${row.isRTO ? "#fecaca" : "#ffedd5"}`,
          }}
        >
          {row.isRTO ? "RTO" : "Customer Return"}
        </span>
      ),
    },
    { key: "rtoAttempts", label: "Attempts", align: "center" as const },
    {
      key: "financialLoss",
      label: "Financial Loss",
      align: "right" as const,
      render: (row: MMReturn) => `₹${row.financialLoss}`,
    },
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading returns dashboard…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Returns & RTO Dashboard</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Trace logistics loss, customer returns and claims</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Customer Returns" value={stats.totalReturns} color="#f97316" />
        <KpiCard title="RTO Count" value={stats.totalRTO} color="#ef4444" />
        <KpiCard title="Return Rate" value={`${stats.returnRate.toFixed(1)}%`} color="#f97316" />
        <KpiCard title="RTO Rate" value={`${stats.rtoRate.toFixed(1)}%`} color="#ef4444" />
        <KpiCard title="Return Shipping" value={stats.shippingCharges.toLocaleString("en-IN")} prefix="₹" color="#64748b" />
        <KpiCard title="Total Return Loss" value={stats.returnLoss.toLocaleString("en-IN")} prefix="₹" color="#b91c1c" />
      </div>

      {/* Charts Split */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        {reasonSplit.length > 0 ? (
          <DonutChart title="Customer Return Reasons" data={reasonSplit} size={120} />
        ) : (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e8e8e8",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "#aaa",
            }}
          >
            No customer return reason distribution available
          </div>
        )}
        <BarChart title="Returns Share by Courier" data={courierSplit} horizontal height={140} />
      </div>

      {/* Detailed returns list */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Logged Return & RTO Transactions</div>
        <DataTable columns={columns} data={filteredReturns} pageSize={10} searchKeys={["orderId", "productName", "sku", "courier"]} />
      </div>
    </motion.div>
  );
}
