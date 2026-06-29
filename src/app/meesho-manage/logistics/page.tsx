"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { DataTable } from "@/components/meesho/DataTable";
import { BarChart } from "@/components/meesho/BarChart";
import { DateFilter, CourierName, CourierStats } from "@/components/meesho/types";

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

  const courierStatsList = useMemo(() => {
    const couriers: CourierName[] = ["Xpressbees", "Delhivery", "Shadowfax", "Ekart", "Bluedart", "Valmo", "Other"];

    const list: CourierStats[] = couriers.map((courier) => {
      const cOrders = filteredOrders.filter((o) => o.courier === courier);
      const cReturns = filteredReturns.filter((r) => r.courier === courier);

      const total = cOrders.length;
      const delivered = cOrders.filter((o) => o.status === "delivered").length;
      const rto = cOrders.filter((o) => o.status === "rto").length;
      const returned = cOrders.filter((o) => o.status === "returned").length;
      const failed = rto + returned;

      const successRate = total ? (delivered / total) * 100 : 0;

      const ordersWithDays = cOrders.filter((o) => o.status === "delivered" && o.deliveryDays);
      const avgDeliveryDays = ordersWithDays.length
        ? ordersWithDays.reduce((sum, o) => sum + (o.deliveryDays || 0), 0) / ordersWithDays.length
        : 0;

      const totalCost = cOrders.reduce((sum, o) => sum + o.shippingCharge, 0);
      const financialLoss = cReturns.reduce((sum, r) => sum + r.financialLoss, 0);

      return {
        courier,
        total,
        delivered,
        failed,
        rto,
        returned,
        successRate,
        avgDeliveryDays,
        totalCost,
        financialLoss,
      };
    });

    // Filter out couriers with 0 shipments
    const activeCouriers = list.filter((c) => c.total > 0);

    // Sort by success rate desc
    return activeCouriers.sort((a, b) => b.successRate - a.successRate);
  }, [filteredOrders, filteredReturns]);

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
    { key: "rto", label: "RTO", align: "center" as const },
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
      key: "totalCost",
      label: "Shipping Cost",
      align: "right" as const,
      render: (row: CourierStats) => `₹${row.totalCost.toLocaleString("en-IN")}`,
    },
    {
      key: "financialLoss",
      label: "RTO Loss",
      align: "right" as const,
      render: (row: CourierStats) => `₹${row.financialLoss.toLocaleString("en-IN")}`,
    },
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
