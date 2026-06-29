"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData, filterByDate } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { BarChart } from "@/components/meesho/BarChart";
import { DonutChart } from "@/components/meesho/DonutChart";
import { DataTable } from "@/components/meesho/DataTable";
import { STATUS_META, DateFilter, MMOrder } from "@/components/meesho/types";

export default function OrdersPage() {
  const { orders, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredOrders = useMemo(() => filterByDate(orders, dateFilter), [orders, dateFilter]);

  const kpis = useMemo(() => {
    const total = filteredOrders.length;
    const del = filteredOrders.filter((o) => o.status === "delivered").length;
    const ship = filteredOrders.filter((o) => o.status === "shipped").length;
    const pack = filteredOrders.filter((o) => o.status === "packed").length;
    const rto = filteredOrders.filter((o) => o.status === "rto").length;
    const ret = filteredOrders.filter((o) => o.status === "returned").length;

    return { total, del, ship, pack, rto, ret };
  }, [filteredOrders]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      map[o.date] = (map[o.date] || 0) + o.qty;
    });

    const dates = Object.keys(map).sort();
    return dates.map((d) => ({
      label: d.slice(5),
      value: map[d],
    }));
  }, [filteredOrders]);

  const paymentSplit = useMemo(() => {
    const cod = filteredOrders.filter((o) => o.paymentType === "cod").length;
    const prepaid = filteredOrders.filter((o) => o.paymentType === "prepaid").length;

    return [
      { label: "COD", value: cod, color: "#f59e0b" },
      { label: "Prepaid", value: prepaid, color: "#3b82f6" },
    ].filter((d) => d.value > 0);
  }, [filteredOrders]);

  const courierSplit = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      map[o.courier] = (map[o.courier] || 0) + 1;
    });

    return Object.entries(map).map(([courier, count]) => ({
      label: courier,
      value: count,
    }));
  }, [filteredOrders]);

  const columns = [
    { key: "orderNo", label: "Order No", sortable: true },
    { key: "date", label: "Date", sortable: true },
    { key: "productName", label: "Product", sortable: true },
    {
      key: "sku",
      label: "SKU",
      sortable: true,
      render: (row: MMOrder) => (
        <a href={`/meesho-manage/product-360?sku=${row.sku}`} style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>
          {row.sku}
        </a>
      )
    },
    { key: "qty", label: "Qty", sortable: true, align: "center" as const },
    {
      key: "sellingPrice",
      label: "Price",
      sortable: true,
      align: "right" as const,
      render: (row: MMOrder) => `₹${row.sellingPrice}`,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: MMOrder) => {
        const meta = STATUS_META[row.status];
        return (
          <span
            style={{
              display: "inline-block",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 20,
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.border}`,
            }}
          >
            {meta.label}
          </span>
        );
      },
    },
    { key: "courier", label: "Courier" },
    { key: "city", label: "City" },
    {
      key: "paymentType",
      label: "Payment",
      render: (row: MMOrder) => (
        <span style={{ fontWeight: 600, color: row.paymentType === "prepaid" ? "#3b82f6" : "#f59e0b", textTransform: "uppercase", fontSize: 10 }}>
          {row.paymentType}
        </span>
      ),
    },
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading orders…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Orders Intelligence</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Detailed analysis of operational orders and states</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Total" value={kpis.total} color="#7c3aed" />
        <KpiCard title="Delivered" value={kpis.del} color="#10b981" />
        <KpiCard title="Shipped" value={kpis.ship} color="#6366f1" />
        <KpiCard title="Packed" value={kpis.pack} color="#3b82f6" />
        <KpiCard title="RTO" value={kpis.rto} color="#ef4444" />
        <KpiCard title="Returned" value={kpis.ret} color="#f97316" />
      </div>

      {/* Trend + Split Donut Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <BarChart title="Daily Orders Velocity (Quantity)" data={dailyTrend} height={180} />
        <DonutChart title="COD vs Prepaid Split" data={paymentSplit} size={120} />
      </div>

      {/* Courier Breakdown Chart */}
      <div style={{ marginBottom: 20 }}>
        <BarChart title="Shipment Share by Courier" data={courierSplit} horizontal height={160} />
      </div>

      {/* Detailed Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>All Order Records</div>
        <DataTable columns={columns} data={filteredOrders} pageSize={10} searchKeys={["orderNo", "productName", "sku", "city", "courier"]} />
      </div>
    </motion.div>
  );
}
