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

export default function CustomerAnalyticsPage() {
  const { orders, returns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);

  const stats = useMemo(() => {
    const totalReturns = filteredReturns.filter((r) => !r.isRTO).length;
    const rto = filteredReturns.filter((r) => r.isRTO).length;

    // COD vs Prepaid returns
    const codReturns = filteredReturns.filter((r) => {
      const order = orders.find((o) => o.id === r.orderId);
      return order?.paymentType === "cod";
    }).length;

    const prepaidReturns = filteredReturns.filter((r) => {
      const order = orders.find((o) => o.id === r.orderId);
      return order?.paymentType === "prepaid";
    }).length;

    // Unique returning cities
    const returningCities = Array.from(new Set(filteredReturns.map((r) => r.city))).length;

    return { totalReturns, rto, codReturns, prepaidReturns, returningCities };
  }, [filteredReturns, orders]);

  const paymentSplit = useMemo(() => {
    return [
      { label: "COD Returns", value: stats.codReturns, color: "#f59e0b" },
      { label: "Prepaid Returns", value: stats.prepaidReturns, color: "#3b82f6" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const reasonSplit = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReturns.forEach((r) => {
      if (!r.isRTO) {
        const label = RETURN_REASONS[r.reason] || r.reason;
        map[label] = (map[label] || 0) + 1;
      }
    });

    return Object.entries(map).map(([label, value]) => ({
      label,
      value,
      color: label.includes("Size") ? "#ef4444" : "#8b5cf6",
    }));
  }, [filteredReturns]);

  const cityChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReturns.forEach((r) => {
      map[r.city] = (map[r.city] || 0) + 1;
    });

    return Object.entries(map).map(([label, value]) => ({
      label,
      value,
    }));
  }, [filteredReturns]);

  const columns = [
    { key: "city", label: "Customer City", sortable: true },
    {
      key: "orders",
      label: "Total Orders",
      align: "center" as const,
      render: (row: any) => {
        const count = filteredOrders.filter((o) => o.city === row.city).length;
        return count;
      },
    },
    {
      key: "returns",
      label: "Returns / RTO",
      align: "center" as const,
      render: (row: any) => {
        const count = filteredReturns.filter((r) => r.city === row.city).length;
        return count;
      },
    },
  ];

  const cityTableData = useMemo(() => {
    const cities = Array.from(new Set(filteredReturns.map((r) => r.city)));
    return cities.map((city) => ({ city }));
  }, [filteredReturns]);

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Aggregating geographical parameters…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Customer Return Analytics</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Audit regional behavior, COD checkout failures and customer return reasons</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Total Customer Returns" value={stats.totalReturns} color="#f97316" />
        <KpiCard title="RTO (Courier Cancellations)" value={stats.rto} color="#ef4444" />
        <KpiCard title="COD return counts" value={stats.codReturns} color="#f59e0b" />
        <KpiCard title="Prepaid return counts" value={stats.prepaidReturns} color="#3b82f6" />
        <KpiCard title="Cities with Returns" value={stats.returningCities} color="#64748b" />
      </div>

      {/* Donut Splits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        {paymentSplit.length > 0 ? (
          <DonutChart title="COD vs Prepaid Return Ratio" data={paymentSplit} size={120} />
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
            No payment split stats
          </div>
        )}
        {reasonSplit.length > 0 ? (
          <DonutChart title="Customer Claim Reasons" data={reasonSplit} size={120} />
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
            No customer return stats
          </div>
        )}
      </div>

      {/* City Chart */}
      <div style={{ marginBottom: 20 }}>
        <BarChart title="Returns Share by City" data={cityChartData} horizontal height={150} />
      </div>

      {/* Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Geographical Return Analysis</div>
        <DataTable columns={columns} data={cityTableData} searchable={false} />
      </div>
    </motion.div>
  );
}
