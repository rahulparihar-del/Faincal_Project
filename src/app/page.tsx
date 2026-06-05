"use client";

import React, { useMemo, useRef } from "react";
import { useData } from "@/context/DataContext";
import { CardGroup, StatCard, Card } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { wholesaleTotal } from "@/lib/wholesale";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  PackageX,
  ShoppingBag,
  Truck,
  Landmark,
  FileText,
} from "lucide-react";

export default function Dashboard() {
  const { ecomSales, wholesaleSales, purchases, transactions, isReady } = useData();
  const chartRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => {
    if (!isReady) return null;

    const ecomRev = ecomSales.reduce((acc, sale) => acc + (sale.isRTO ? 0 : sale.netPayout), 0);
    const wholesaleRev = wholesaleSales.reduce((acc, sale) => acc + wholesaleTotal(sale), 0);
    const totalRevenue = ecomRev + wholesaleRev;

    const totalPurchases = purchases.reduce((acc, p) => acc + p.qty * p.rate, 0);
    const debitTx = transactions
      .filter((t) => t.type === "Debit")
      .reduce((acc, t) => acc + t.amount, 0);
    const totalExpenses = totalPurchases + debitTx;

    const netProfit = totalRevenue - totalExpenses;

    const pendingPayments = purchases
      .filter((p) => p.paymentStatus !== "Paid")
      .reduce((acc, p) => acc + p.qty * p.rate, 0);

    const activeWholesale = wholesaleSales.filter((w) => {
      return w.paymentReceived < wholesaleTotal(w);
    }).length;

    const rtoLosses = ecomSales
      .filter((e) => e.isRTO)
      .reduce((acc, e) => acc + e.rtoLossAmount, 0);

    return { totalRevenue, totalExpenses, netProfit, pendingPayments, activeWholesale, rtoLosses };
  }, [ecomSales, wholesaleSales, purchases, transactions, isReady]);

  // Build monthly revenue data from actual data for bar chart
  const monthlyRevenue = useMemo(() => {
    if (!isReady) return [];
    const now = new Date();
    const months: { label: string; value: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-IN", { month: "short" });

      let rev = 0;
      ecomSales.forEach((s) => {
        if (s.date?.startsWith(yearMonth) && !s.isRTO) rev += s.netPayout;
      });
      wholesaleSales.forEach((w) => {
        if (w.date?.startsWith(yearMonth))
          rev += w.items.reduce((a, i) => a + i.qty * i.rate, 0);
      });

      months.push({ label, value: rev });
    }
    return months;
  }, [ecomSales, wholesaleSales, isReady]);

  // Recent activity feed
  const recentActivity = useMemo(() => {
    if (!isReady) return [];

    type Activity = { id: string; date: string; icon: React.ElementType; label: string; amount: number; type: "credit" | "debit" | "neutral" };
    const items: Activity[] = [];

    ecomSales.slice(0, 20).forEach((s) => {
      items.push({
        id: `ecom-${s.id}`,
        date: s.date,
        icon: ShoppingBag,
        label: `${s.platform} — ${s.productName}`,
        amount: s.isRTO ? -s.rtoLossAmount : s.netPayout,
        type: s.isRTO ? "debit" : "credit",
      });
    });

    wholesaleSales.slice(0, 20).forEach((w) => {
      const total = wholesaleTotal(w);
      items.push({
        id: `ws-${w.id}`,
        date: w.date,
        icon: Truck,
        label: `Wholesale — ${w.retailerName}`,
        amount: total,
        type: "credit",
      });
    });

    purchases.slice(0, 20).forEach((p) => {
      items.push({
        id: `po-${p.id}`,
        date: p.date,
        icon: FileText,
        label: `Purchase — ${p.productName}`,
        amount: p.qty * p.rate,
        type: "debit",
      });
    });

    transactions.slice(0, 20).forEach((t) => {
      items.push({
        id: `tx-${t.id}`,
        date: t.date,
        icon: Landmark,
        label: `${t.type === "Credit" ? "↑" : "↓"} ${t.description}`,
        amount: t.amount,
        type: t.type === "Credit" ? "credit" : "debit",
      });
    });

    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return items.slice(0, 10);
  }, [ecomSales, wholesaleSales, purchases, transactions, isReady]);

  useGSAP(() => {
    if (!chartRef.current) return;
    const bars = chartRef.current.querySelectorAll(".chart-bar");
    gsap.from(bars, {
      scaleY: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: "power2.out",
      transformOrigin: "bottom",
      delay: 0.3,
    });
  }, { scope: chartRef, dependencies: [monthlyRevenue] });

  if (!isReady || !metrics)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#888] text-sm font-medium">Loading Dashboard...</div>
      </div>
    );

  const maxBarValue = Math.max(...monthlyRevenue.map((m) => m.value), 1);

  return (
    <div className="space-y-6">
      <CardGroup cols="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Revenue"
          value={<AnimatedCounter value={metrics.totalRevenue} prefix="₹" isCurrency />}
          icon={DollarSign}
        />
        <StatCard
          title="Total Expenses"
          value={<AnimatedCounter value={metrics.totalExpenses} prefix="₹" isCurrency />}
          icon={TrendingDown}
        />
        <StatCard
          title="Net Profit"
          value={<AnimatedCounter value={metrics.netProfit} prefix="₹" isCurrency />}
          icon={TrendingUp}
          subtitle={metrics.netProfit >= 0 ? "Profitable" : "Loss"}
        />
        <StatCard
          title="Pending Payments"
          value={<AnimatedCounter value={metrics.pendingPayments} prefix="₹" isCurrency />}
          icon={AlertCircle}
          subtitle="Manufacturer dues"
        />
        <StatCard
          title="Active Wholesale"
          value={<AnimatedCounter value={metrics.activeWholesale} />}
          icon={ShoppingCart}
          subtitle="Unpaid orders"
        />
        <StatCard
          title="RTO Losses"
          value={<AnimatedCounter value={metrics.rtoLosses} prefix="₹" isCurrency />}
          icon={PackageX}
        />
      </CardGroup>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2">
          <Card className="h-[400px] flex flex-col">
            <h3 className="text-[13px] font-medium text-[#888] uppercase tracking-wider mb-6">
              Revenue — Last 6 Months
            </h3>
            <div
              ref={chartRef}
              className="flex-1 flex items-end gap-3 sm:gap-5 justify-between pb-2"
            >
              {monthlyRevenue.map((m) => {
                const pct = maxBarValue > 0 ? (m.value / maxBarValue) * 100 : 0;
                const barHeight = Math.max(pct, 2);
                return (
                  <div key={m.label} className="flex flex-col items-center flex-1 group">
                    <div className="w-full flex flex-col items-center justify-end h-[280px]">
                      <div className="text-[11px] font-bold text-[#888] mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        ₹{m.value.toLocaleString("en-IN")}
                      </div>
                      <div
                        className="chart-bar w-3/5 max-w-[48px] bg-black rounded-t-lg group-hover:bg-[#1a1a1a] transition-colors cursor-default"
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <div className="text-[11px] font-medium text-[#888] mt-3 uppercase tracking-wider">
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <Card className="h-[400px] flex flex-col">
            <h3 className="text-[13px] font-medium text-[#888] uppercase tracking-wider mb-4">
              Recent Activity
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1 -mx-1 pr-1">
              {recentActivity.length === 0 && (
                <div className="text-sm text-[#888] text-center py-8">No activity yet</div>
              )}
              {recentActivity.map((item) => {
                const IconComp = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-[#f5f5f5] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#f5f5f5] flex items-center justify-center shrink-0">
                      <IconComp size={14} className="text-[#666]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-black truncate">{item.label}</div>
                      <div className="text-[11px] text-[#888]">{item.date}</div>
                    </div>
                    <div
                      className={`text-sm font-bold shrink-0 ${
                        item.type === "credit" ? "text-black" : "text-[#888]"
                      }`}
                    >
                      {item.type === "credit" ? "+" : "−"}₹{Math.abs(item.amount).toLocaleString("en-IN")}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
