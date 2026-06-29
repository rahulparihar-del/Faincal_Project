"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMMData } from "@/components/meesho/useMeeshoData";
import { DateRangeFilter } from "@/components/meesho/DateRangeFilter";
import { KpiCard } from "@/components/meesho/KpiCard";
import { BarChart } from "@/components/meesho/BarChart";
import { DataTable } from "@/components/meesho/DataTable";
import { DateFilter, MMAdCampaign } from "@/components/meesho/types";

export default function AdvertisementPage() {
  const { adCampaigns, isLoaded } = useMMData();

  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: "30days",
    from: "",
    to: "",
  });

  const filteredCampaigns = useMemo(() => {
    // Custom filter for campaigns (based on startDate/endDate)
    const fromTime = dateFilter.from ? new Date(dateFilter.from + "T00:00:00").getTime() : 0;
    const toTime = dateFilter.to ? new Date(dateFilter.to + "T23:59:59").getTime() : Infinity;

    return adCampaigns.filter((c) => {
      const time = new Date(c.startDate + "T12:00:00").getTime();
      return time >= fromTime && time <= toTime;
    });
  }, [adCampaigns, dateFilter]);

  const stats = useMemo(() => {
    let spend = 0;
    let rev = 0;
    let clicks = 0;
    let orders = 0;
    let active = 0;

    filteredCampaigns.forEach((c) => {
      spend += c.spend;
      rev += c.revenue;
      clicks += c.clicks;
      orders += c.orders;
      if (c.status === "active") active++;
    });

    const roas = spend ? rev / spend : 0;
    const cpc = clicks ? spend / clicks : 0;
    const cpo = orders ? spend / orders : 0;

    return { spend, rev, roas, cpc, cpo, active, total: filteredCampaigns.length };
  }, [filteredCampaigns]);

  const chartData = useMemo(() => {
    return filteredCampaigns.map((c) => ({
      label: c.name,
      value: c.spend,
    }));
  }, [filteredCampaigns]);

  const getRecommendation = (roas: number) => {
    if (roas >= 4) return { label: "Scale", color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0" };
    if (roas >= 2.5) return { label: "Optimize", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" };
    return { label: "Pause Campaign", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
  };

  const columns = [
    { key: "name", label: "Campaign Name", sortable: true },
    { key: "startDate", label: "Start Date" },
    {
      key: "status",
      label: "Status",
      render: (row: MMAdCampaign) => (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 20,
            background: row.status === "active" ? "#f0fdf4" : "#f5f5f5",
            color: row.status === "active" ? "#16a34a" : "#888",
            border: `1px solid ${row.status === "active" ? "#bbf7d0" : "#e8e8e8"}`,
          }}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "spend",
      label: "Spend",
      align: "right" as const,
      render: (row: MMAdCampaign) => `₹${row.spend.toLocaleString("en-IN")}`,
    },
    {
      key: "revenue",
      label: "Returns (Revenue)",
      align: "right" as const,
      render: (row: MMAdCampaign) => `₹${row.revenue.toLocaleString("en-IN")}`,
    },
    {
      key: "roas",
      label: "ROAS",
      align: "center" as const,
      render: (row: MMAdCampaign) => {
        const roas = row.spend ? row.revenue / row.spend : 0;
        return `${roas.toFixed(2)}x`;
      },
    },
    {
      key: "recommendation",
      label: "Action",
      render: (row: MMAdCampaign) => {
        const roas = row.spend ? row.revenue / row.spend : 0;
        const rec = getRecommendation(roas);
        return (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: rec.bg,
              color: rec.color,
              border: `1px solid ${rec.border}`,
            }}
          >
            {rec.label}
          </span>
        );
      },
    },
  ];

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Loading ad campaigns…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Ad Strategy & ROI</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Monitor campaign budgets, click analytics, and ROAS performance</p>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      {/* KPI stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <KpiCard title="Ad Spend" value={stats.spend.toLocaleString("en-IN")} prefix="₹" color="#ec4899" />
        <KpiCard title="Ad Revenue" value={stats.rev.toLocaleString("en-IN")} prefix="₹" color="#10b981" />
        <KpiCard title="Average ROAS" value={`${stats.roas.toFixed(2)}x`} color={stats.roas >= 3 ? "#10b981" : "#ef4444"} />
        <KpiCard title="Cost Per Order" value={stats.cpo.toFixed(0)} prefix="₹" color="#64748b" />
        <KpiCard title="Cost Per Click" value={stats.cpc.toFixed(1)} prefix="₹" color="#0ea5e9" />
        <KpiCard title="Active Campaigns" value={`${stats.active} / ${stats.total}`} color="#7c3aed" />
      </div>

      {/* BarChart: Spend by Campaign */}
      <div style={{ marginBottom: 20 }}>
        <BarChart title="Spend distribution per Campaign" data={chartData} horizontal height={150} valuePrefix="₹" />
      </div>

      {/* DataTable */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>All Marketing Campaigns</div>
        <DataTable columns={columns} data={filteredCampaigns} pageSize={10} searchKeys={["name"]} />
      </div>
    </motion.div>
  );
}
