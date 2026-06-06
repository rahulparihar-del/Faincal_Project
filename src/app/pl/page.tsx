"use client";

import React, { useMemo } from "react";
import { useData } from "@/context/DataContext";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { wholesaleTotal } from "@/lib/wholesale";
import { Download, FileSpreadsheet, TrendingUp, TrendingDown, DollarSign, MinusCircle, BarChart3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { exportExcelReport } from "@/lib/export/excelReport";

export default function ProfitAndLossPage() {
  const { ecomSales, wholesaleSales, manufacturers, purchases, transactions } = useData();
  const [isExporting, setIsExporting] = React.useState(false);

  const { overall, monthly } = useMemo(() => {
    const monthlyMap = new Map<string, {
      ecomRev: number; wholesaleRev: number; cogs: number; deductions: number; rto: number; otherExpenses: number;
    }>();

    const getMonthKey = (dateStr: string) => {
      if (!dateStr) return "1970-01";
      return dateStr.substring(0, 7);
    };

    const ensureMonth = (k: string) => {
      if (!monthlyMap.has(k)) {
        monthlyMap.set(k, { ecomRev: 0, wholesaleRev: 0, cogs: 0, deductions: 0, rto: 0, otherExpenses: 0 });
      }
      return monthlyMap.get(k)!;
    };

    let totalEcomRev = 0, totalWholesaleRev = 0, totalCogs = 0, totalDeductions = 0, totalRTO = 0, totalOtherExpenses = 0;

    ecomSales.forEach((s) => {
      const mk = getMonthKey(s.date);
      const m = ensureMonth(mk);
      const comm = (s.sellingPrice * s.commissionPercent) / 100;

      if (!s.isRTO) {
        totalEcomRev += s.sellingPrice;
        m.ecomRev += s.sellingPrice;
        totalDeductions += comm + s.adSpend;
        m.deductions += comm + s.adSpend;
      } else {
        totalRTO += s.rtoLossAmount;
        m.rto += s.rtoLossAmount;
      }
    });

    wholesaleSales.forEach((w) => {
      const mk = getMonthKey(w.date);
      const m = ensureMonth(mk);
      const orderTotal = wholesaleTotal(w);
      totalWholesaleRev += orderTotal;
      m.wholesaleRev += orderTotal;
    });

    purchases.forEach((p) => {
      if (p.orderType === "Bulk") {
        const mk = getMonthKey(p.date);
        const m = ensureMonth(mk);
        const val = p.qty * p.rate;
        totalCogs += val;
        m.cogs += val;
      }
    });

    transactions.forEach((t) => {
      if (t.type === "Debit" && !["Personal", "Household", "Transfer", "Manufacturer Payment", "Ad Spend"].includes(t.category)) {
        const mk = getMonthKey(t.date);
        const m = ensureMonth(mk);
        totalOtherExpenses += t.amount;
        m.otherExpenses += t.amount;
      }
    });

    const totalRevenue = totalEcomRev + totalWholesaleRev;
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalDeductions - totalRTO - totalOtherExpenses;

    const sortedMonths = Array.from(monthlyMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => {
        const rev = v.ecomRev + v.wholesaleRev;
        const gp = rev - v.cogs;
        const np = gp - v.deductions - v.rto - v.otherExpenses;
        return { monthStr: k, rev, gp, np, ...v };
      });

    return {
      overall: { totalRevenue, totalCogs, grossProfit, totalDeductions: totalDeductions + totalRTO + totalOtherExpenses, netProfit },
      monthly: sortedMonths,
    };
  }, [ecomSales, wholesaleSales, purchases, transactions]);

  const exportCSV = () => {
    let csv = "Month,E-com Revenue,Wholesale Revenue,Total Revenue,COGS (Bulk),Gross Profit,Deductions & Ads,RTO Losses,Other Expenses,Net Profit\n";
    monthly.forEach((m) => {
      const formattedMonth = format(parseISO(`${m.monthStr}-01`), "MMM yyyy");
      csv += `${formattedMonth},${m.ecomRev},${m.wholesaleRev},${m.rev},${m.cogs},${m.gp},${m.deductions},${m.rto},${m.otherExpenses},${m.np}\n`;
    });
    csv += `OVERALL,${monthly.reduce((a, b) => a + b.ecomRev, 0)},${monthly.reduce((a, b) => a + b.wholesaleRev, 0)},${overall.totalRevenue},${overall.totalCogs},${overall.grossProfit},${monthly.reduce((a, b) => a + b.deductions, 0)},${monthly.reduce((a, b) => a + b.rto, 0)},${monthly.reduce((a, b) => a + b.otherExpenses, 0)},${overall.netProfit}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", `BizTrack_PL_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportExcelReport({
        ecomSales,
        wholesaleSales,
        manufacturers,
        purchases,
        transactions,
        overall,
        monthly,
      });
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Could not generate the Excel report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Profit & Loss</h2>
          <p className="text-sm text-[#888] mt-1">Auto-calculated from all modules</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-white text-black border border-[#e0e0e0] px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#f5f5f5] transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} />
            {isExporting ? "Generating…" : "Export Excel"}
          </button>
        </div>
      </div>

      <CardGroup cols="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Total Revenue"
          value={<AnimatedCounter value={overall.totalRevenue} prefix="₹" isCurrency />}
          icon={DollarSign}
          variant="profit"
        />
        <StatCard
          title="COGS"
          value={<AnimatedCounter value={overall.totalCogs} prefix="₹" isCurrency />}
          icon={TrendingDown}
          variant="loss"
          subtitle="Bulk purchases only"
        />
        <StatCard
          title="Gross Profit"
          value={<AnimatedCounter value={overall.grossProfit} prefix="₹" isCurrency />}
          icon={BarChart3}
          variant={overall.grossProfit >= 0 ? "profit" : "loss"}
        />
        <StatCard
          title="Deductions"
          value={<AnimatedCounter value={overall.totalDeductions} prefix="₹" isCurrency />}
          icon={MinusCircle}
          variant="loss"
          subtitle="Commissions + Ads + RTO"
        />
        <StatCard
          title="Net Profit"
          value={
            <span style={{ color: overall.netProfit >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
              <AnimatedCounter value={overall.netProfit} prefix="₹" isCurrency />
            </span>
          }
          icon={TrendingUp}
          variant={overall.netProfit >= 0 ? "profit" : "loss"}
          subtitle={overall.netProfit >= 0 ? "Profitable" : "Loss"}
        />
      </CardGroup>

      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-[#e8e8e8] bg-[#fafafa]">
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">Month-by-Month Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Month</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Revenue</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">COGS</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Gross Profit</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Deductions</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {monthly.map((m) => {
                const isPositive = m.np >= 0;
                return (
                  <tr key={m.monthStr} className="hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-3.5 font-bold text-black">
                      {format(parseISO(`${m.monthStr}-01`), "MMMM yyyy")}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">₹{m.rev.toLocaleString("en-IN")}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-right text-[#888]">₹{m.cogs.toLocaleString("en-IN")}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-right font-bold" style={{ color: m.gp >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>₹{m.gp.toLocaleString("en-IN")}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-right text-[#888]">
                      ₹{(m.deductions + m.rto + m.otherExpenses).toLocaleString("en-IN")}
                    </td>
                    <td
                      className="px-5 py-3.5 text-right font-bold"
                      style={{ color: isPositive ? "var(--color-profit)" : "var(--color-loss)" }}
                    >
                      ₹{m.np.toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
              {monthly.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#888]">
                    No financial data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
