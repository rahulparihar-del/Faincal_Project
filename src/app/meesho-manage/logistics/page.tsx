"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DataTable } from "@/components/meesho/DataTable";
import { BarChart } from "@/components/meesho/BarChart";
import { DateFilter, CourierName, CourierStats } from "@/components/meesho/types";
import { calculateCourierStats } from "@/lib/data/analytics";
import { Truck, Star, AlertOctagon, TrendingUp, TrendingDown, HelpCircle, CheckCircle } from "lucide-react";

export default function LogisticsPage() {
  const { orders, returns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);
  const filteredReturns = useMemo(() => filterByDate(returns, dateFilter), [returns, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const delivered = filteredOrders.filter((o) => o.status === "delivered").length;
    const rto = filteredOrders.filter((o) => o.status === "rto").length;
    const cost = filteredOrders.reduce((sum, o) => sum + o.shippingCharge, 0);

    const deliveryOrdersWithTime = filteredOrders.filter((o) => o.status === "delivered" && o.deliveryDays);
    const avgDays = deliveryOrdersWithTime.length
      ? deliveryOrdersWithTime.reduce((sum, o) => sum + (o.deliveryDays || 0), 0) / deliveryOrdersWithTime.length
      : 0;

    return { total, delivered, rto, cost, avgDays };
  }, [filteredOrders]);

  // Use centralized calculations
  const courierStatsList = useMemo(() => {
    return calculateCourierStats(filteredOrders, filteredReturns);
  }, [filteredOrders, filteredReturns]);

  // Best/Worst Performing Courier Highlights
  const highlights = useMemo(() => {
    if (courierStatsList.length === 0) return null;
    const sorted = [...courierStatsList].sort((a, b) => b.successRate - a.successRate);
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
    };
  }, [courierStatsList]);

  const chartData = useMemo(() => {
    return courierStatsList.map((c) => ({
      label: c.courier,
      value: c.successRate,
    }));
  }, [courierStatsList]);

  const costChartData = useMemo(() => {
    return courierStatsList.map((c) => ({
      label: c.courier,
      value: c.totalCost,
    }));
  }, [courierStatsList]);

  // Comprehensive Columns for Courier Intelligence
  const columns = [
    {
      key: "rank",
      label: "Rank",
      render: (_: any, idx?: number) => {
        const rank = (idx ?? 0) + 1;
        if (rank === 1) return "🥇 1st";
        if (rank === 2) return "🥈 2nd";
        if (rank === 3) return "🥉 3rd";
        return `${rank}th`;
      },
    },
    { key: "courier", label: "Courier Partner", sortable: true },
    { key: "total", label: "Shipments", align: "center" as const, sortable: true },
    { key: "delivered", label: "Delivered", align: "center" as const },
    { key: "failed", label: "Failed", align: "center" as const, render: (row: CourierStats) => row.failed },
    { key: "rto", label: "RTO", align: "center" as const },
    { key: "returned", label: "Returns", align: "center" as const, render: (row: CourierStats) => row.returned },
    {
      key: "successRate",
      label: "Success Rate",
      align: "center" as const,
      sortable: true,
      render: (row: CourierStats) => (
        <span style={{ fontWeight: 700, color: row.successRate >= 80 ? "#10b981" : row.successRate >= 60 ? "#f59e0b" : "#ef4444" }}>
          {row.successRate.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "avgDeliveryDays",
      label: "Avg Days",
      align: "center" as const,
      render: (row: CourierStats) => (row.avgDeliveryDays ? `${row.avgDeliveryDays.toFixed(1)} days` : "-"),
    },
    {
      key: "avgShippingCost",
      label: "Avg Cost",
      align: "right" as const,
      render: (row: CourierStats) => `₹${Math.round(row.totalCost / row.total)}`,
    },
    {
      key: "financialLoss",
      label: "Loss",
      align: "right" as const,
      render: (row: CourierStats) => `₹${row.financialLoss.toLocaleString("en-IN")}`,
    },
    {
      key: "trend",
      label: "Trend",
      align: "center" as const,
      render: (row: CourierStats) => {
        const isUp = row.successRate >= 75;
        return (
          <span style={{ color: isUp ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 9.5, fontWeight: 700 }}>
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isUp ? "Stable" : "Risk"}
          </span>
        );
      }
    }
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading logistics report…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Logistics & Courier Performance</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Compare shipping rates, delivery speeds, and delivery success rates</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* Courier Highlights (Best / Worst Courier) */}
      {highlights && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* Best Courier */}
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "#dcfce7", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a", padding: 8 }}>
              <Star size={20} fill="#16a34a" />
            </div>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#16a34a", textTransform: "uppercase" }}>Best Performing Partner</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#14532d", marginTop: 2 }}>{highlights.best.courier}</div>
              <p style={{ fontSize: 10, color: "#15803d", marginTop: 2 }}>
                Delivering at <strong>{highlights.best.successRate.toFixed(1)}%</strong> success rate with an average delivery speed of <strong>{highlights.best.avgDeliveryDays.toFixed(1)} days</strong>.
              </p>
            </div>
          </div>

          {/* Worst Courier */}
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "#fee2e2", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", padding: 8 }}>
              <AlertOctagon size={20} />
            </div>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#dc2626", textTransform: "uppercase" }}>Worst Performing Partner</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#7f1d1d", marginTop: 2 }}>{highlights.worst.courier}</div>
              <p style={{ fontSize: 10, color: "#b91c1c", marginTop: 2 }}>
                RTO failure rate is high at <strong>{(100 - highlights.worst.successRate).toFixed(1)}%</strong>, causing a financial loss of <strong>₹{highlights.worst.financialLoss.toLocaleString("en-IN")}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Total Shipments" value={stats.total} color="#7c3aed" />
        <KpiCard title="Delivered Orders" value={stats.delivered} color="#10b981" />
        <KpiCard title="RTO Orders" value={stats.rto} color="#ef4444" />
        <KpiCard title="Avg Delivery Days" value={`${stats.avgDays.toFixed(1)} Days`} color="#0ea5e9" />
        <KpiCard title="Total Shipping Cost" value={stats.cost.toLocaleString("en-IN")} prefix="₹" color="#64748b" />
      </div>

      {/* Visual Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        <BarChart title="Courier Success Rate % (Higher is Better)" data={chartData} height={160} valueSuffix="%" />
        <BarChart title="Total Shipping Expense by Courier" data={costChartData} height={160} valuePrefix="₹" />
      </div>

      {/* Courier table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>3PL Partner Rankings</div>
        <DataTable columns={columns} data={courierStatsList} searchable={false} />
      </div>
    </motion.div>
  );
}
