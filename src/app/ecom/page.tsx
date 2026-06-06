"use client";

import React, { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EcomSale, Platform } from "@/lib/types";
import { gsap } from "gsap";
import { Plus, Trash2, ShoppingBag, TrendingUp, Receipt, PackageX, Filter } from "lucide-react";

const PLATFORMS: Platform[] = ["Amazon", "Flipkart", "Meesho", "Other"];

export default function EcomSales() {
  const { ecomSales, setEcomSales } = useData();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline "add" row state
  const today = new Date().toISOString().split("T")[0];
  const [draftDate, setDraftDate] = useState(today);
  const [draftPlatform, setDraftPlatform] = useState<Platform>("Meesho");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftStatus, setDraftStatus] = useState<"Received" | "RTO">("Received");

  // Filters
  const [platformFilter, setPlatformFilter] = useState<Platform | "All">("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const stats = useMemo(() => {
    let gross = 0, returns = 0, net = 0;
    ecomSales.forEach((s) => {
      gross += s.sellingPrice;
      if (s.isRTO) {
        returns += s.rtoLossAmount;
        net -= s.rtoLossAmount;
      } else {
        net += s.netPayout;
      }
    });
    return { gross, returns, net };
  }, [ecomSales]);

  const filteredSales = useMemo(() => {
    return ecomSales.filter((s) => {
      if (platformFilter !== "All" && s.platform !== platformFilter) return false;
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      return true;
    });
  }, [ecomSales, platformFilter, dateFrom, dateTo]);

  const handleAdd = () => {
    const amount = Number(draftAmount);
    if (!draftDate || !amount || amount <= 0) return;
    const isRTO = draftStatus === "RTO";
    const sale: EcomSale = {
      id: Date.now().toString(),
      date: draftDate,
      platform: draftPlatform,
      orderId: "",
      productName: "",
      sellingPrice: amount,
      commissionPercent: 0,
      adSpend: 0,
      isRTO,
      rtoLossAmount: isRTO ? amount : 0,
      netPayout: isRTO ? 0 : amount,
    };
    setEcomSales((prev) => [sale, ...prev]);
    // Keep date & platform so multiple entries are quick to add.
    setDraftAmount("");
    setDraftStatus("Received");
  };

  const handleDelete = (id: string) => {
    const el = document.getElementById(`row-${id}`);
    if (el) {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.25,
        onComplete: () => {
          setEcomSales((prev) => prev.filter((s) => s.id !== id));
          setDeletingId(null);
        },
      });
    } else {
      setEcomSales((prev) => prev.filter((s) => s.id !== id));
      setDeletingId(null);
    }
  };

  const cellInput =
    "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-black tracking-tight">E-commerce Sales</h2>
        <p className="text-sm text-[#888] mt-1">{ecomSales.length} total entries</p>
      </div>

      <CardGroup cols="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Gross Revenue" value={`₹${stats.gross.toLocaleString("en-IN")}`} icon={ShoppingBag} variant="profit" />
        <StatCard title="Net Payout" value={`₹${stats.net.toLocaleString("en-IN")}`} icon={TrendingUp} variant={stats.net >= 0 ? "profit" : "loss"} />
        <StatCard title="RTO Losses" value={`₹${stats.returns.toLocaleString("en-IN")}`} icon={PackageX} variant="loss" />
      </CardGroup>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#e8e8e8] p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <Filter size={16} className="text-[#888] shrink-0 mt-1 sm:mt-0" />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as Platform | "All")}
          className="bg-[#f5f5f5] border-0 rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="All">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#f5f5f5] border-0 rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
          />
          <span className="text-[#888] text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#f5f5f5] border-0 rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        {(platformFilter !== "All" || dateFrom || dateTo) && (
          <button
            onClick={() => { setPlatformFilter("All"); setDateFrom(""); setDateTo(""); }}
            className="text-xs font-bold text-[#888] hover:text-black transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Mobile: stacked add form ── */}
      <div className="lg:hidden bg-white border border-[#e8e8e8] rounded-2xl p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#555]">Add Sale</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1">Date</label>
            <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} className={cellInput} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1">Platform</label>
            <select value={draftPlatform} onChange={(e) => setDraftPlatform(e.target.value as Platform)} className={cellInput}>
              {PLATFORMS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1">Amount *</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={draftAmount} onChange={(e) => setDraftAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} className={`${cellInput} text-right`} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1">Status</label>
            <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as "Received" | "RTO")} className={cellInput}>
              <option value="Received">Received</option>
              <option value="RTO">RTO</option>
            </select>
          </div>
        </div>
        <button onClick={handleAdd} disabled={!draftAmount || Number(draftAmount) <= 0} className="w-full bg-black text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1a1a1a] transition-colors">
          <Plus size={16} /> Add Sale
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#fafafa] border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Platform</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Net Payout</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {/* Inline add row — hidden on mobile */}
              <tr className="bg-[#fafafa]/60 hidden lg:table-row">
                <td className="px-5 py-3">
                  <input
                    type="date"
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    className={cellInput}
                  />
                </td>
                <td className="px-5 py-3">
                  <select
                    value={draftPlatform}
                    onChange={(e) => setDraftPlatform(e.target.value as Platform)}
                    className={cellInput}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                    className={`${cellInput} text-right`}
                  />
                </td>
                <td className="px-5 py-3">
                  <select
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value as "Received" | "RTO")}
                    className={cellInput}
                  >
                    <option value="Received">Received</option>
                    <option value="RTO">RTO</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={handleAdd}
                    disabled={!draftAmount || Number(draftAmount) <= 0}
                    className="inline-flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </td>
              </tr>

              {filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  id={`row-${sale.id}`}
                  className="hover:bg-[#fafafa] transition-colors relative group"
                >
                  <td className="px-5 py-3.5 text-[#888]">{sale.date}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-black">{sale.platform}</div>
                    {/* Amount shown inline on mobile only (Net Payout column is hidden on mobile) */}
                    <div className="lg:hidden text-xs font-bold mt-0.5" style={{ color: sale.isRTO ? "var(--color-loss)" : "var(--color-profit)" }}>
                      ₹{sale.isRTO ? sale.rtoLossAmount.toLocaleString("en-IN") : sale.netPayout.toLocaleString("en-IN")}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-5 py-3.5 text-right font-bold" style={{ color: sale.isRTO ? "var(--color-loss)" : "var(--color-profit)" }}>
                    ₹{sale.isRTO ? sale.rtoLossAmount.toLocaleString("en-IN") : sale.netPayout.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {sale.isRTO ? (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{ background: "var(--color-loss-bg)", color: "var(--color-loss)", border: "1px solid var(--color-loss-border)" }}
                      >RTO</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{ background: "var(--color-profit-bg)", color: "var(--color-profit)", border: "1px solid var(--color-profit-border)" }}
                      >Received</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setDeletingId(sale.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ConfirmDelete
                      isOpen={deletingId === sale.id}
                      onConfirm={() => handleDelete(sale.id)}
                      onCancel={() => setDeletingId(null)}
                    />
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#888]">
                    No sales recorded yet. Add one using the row above.
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
