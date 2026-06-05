"use client";

import React, { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Transaction, AccountType, TransactionType, Category } from "@/lib/types";
import { gsap } from "gsap";
import { Plus, Trash2, Search, ArrowUpRight, ArrowDownRight, Wallet, CreditCard, ChevronDown, PiggyBank } from "lucide-react";

const CATEGORIES: Category[] = [
  "Business Income", "Manufacturer Payment", "Ad Spend",
  "Platform Payout", "Wholesale Collection", "Personal",
  "Household", "Transfer", "Other",
];

export default function BankTransactionsPage() {
  const { transactions, setTransactions } = useData();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategories, setShowCategories] = useState(false);

  // Inline "add transaction" state
  const today = new Date().toISOString().split("T")[0];
  const [draft, setDraft] = useState({
    date: today,
    account: "IDFC Current" as AccountType,
    type: "Debit" as TransactionType,
    category: "Other" as Category,
    description: "",
    utr: "",
    amount: "",
  });

  const stats = useMemo(() => {
    let bizCredits = 0, bizDebits = 0, personalSpend = 0;
    let currentBalance = 0, savingsBalance = 0;

    transactions.forEach((t) => {
      const isBizCredit = t.type === "Credit" && ["Business Income", "Platform Payout", "Wholesale Collection"].includes(t.category);
      const isBizDebit = t.type === "Debit" && ["Manufacturer Payment", "Ad Spend"].includes(t.category);
      const isPersonal = t.type === "Debit" && ["Personal", "Household"].includes(t.category);

      if (isBizCredit) bizCredits += t.amount;
      if (isBizDebit) bizDebits += t.amount;
      if (isPersonal) personalSpend += t.amount;

      if (t.account === "IDFC Current") {
        currentBalance += t.type === "Credit" ? t.amount : -t.amount;
      } else {
        savingsBalance += t.type === "Credit" ? t.amount : -t.amount;
      }
    });

    return { bizCredits, bizDebits, personalSpend, currentBalance, savingsBalance };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (activeCategory !== "All" && t.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return t.description?.toLowerCase().includes(q) || t.utr?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [transactions, activeCategory, searchQuery]);

  const canAdd = Number(draft.amount) > 0 && draft.description.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    const tx: Transaction = {
      id: Date.now().toString(),
      date: draft.date,
      account: draft.account,
      type: draft.type,
      amount: Number(draft.amount),
      category: draft.category,
      description: draft.description.trim(),
      utr: draft.utr.trim(),
    };
    setTransactions((prev) => [tx, ...prev]);
    // Keep date/account/type/category for fast repeated entry.
    setDraft((d) => ({ ...d, description: "", utr: "", amount: "" }));
  };

  const handleDelete = (id: string) => {
    const el = document.getElementById(`tx-row-${id}`);
    if (el) {
      gsap.to(el, {
        height: 0, opacity: 0, duration: 0.25, onComplete: () => {
          setTransactions((prev) => prev.filter((t) => t.id !== id));
          setDeletingId(null);
        },
      });
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setDeletingId(null);
    }
  };

  const cellInput =
    "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-lg px-2.5 py-2 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-black tracking-tight">Bank Transactions</h2>
        <p className="text-sm text-[#888] mt-1">{transactions.length} transactions</p>
      </div>

      <CardGroup cols="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <StatCard title="Business Credits" value={`₹${stats.bizCredits.toLocaleString("en-IN")}`} icon={ArrowUpRight} />
        <StatCard title="Business Debits" value={`₹${stats.bizDebits.toLocaleString("en-IN")}`} icon={ArrowDownRight} />
        <StatCard title="Personal Spend" value={`₹${stats.personalSpend.toLocaleString("en-IN")}`} icon={Wallet} />
        <StatCard title="Current A/C" value={`₹${stats.currentBalance.toLocaleString("en-IN")}`} icon={CreditCard} subtitle="IDFC Current" />
        <StatCard title="Savings A/C" value={`₹${stats.savingsBalance.toLocaleString("en-IN")}`} icon={PiggyBank} subtitle="IDFC Savings" />
      </CardGroup>

      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Filters */}
        <div className="p-4 border-b border-[#e8e8e8] bg-[#fafafa] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => { setShowCategories((v) => !v); setActiveCategory("All"); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeCategory === "All"
                  ? "bg-black text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
                  : "bg-white border border-[#e0e0e0] text-[#666] hover:bg-[#f5f5f5]"
              }`}
            >
              All
              <ChevronDown size={13} className={`transition-transform ${showCategories ? "rotate-180" : ""}`} />
            </button>
            {showCategories && CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-black text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
                    : "bg-white border border-[#e0e0e0] text-[#666] hover:bg-[#f5f5f5]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" size={14} />
            <input
              type="text"
              placeholder="Search desc or UTR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] placeholder:text-[#aaa]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Account</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Description</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">UTR/Ref</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Category</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {/* Inline add row */}
              <tr className="bg-[#fafafa]/60 align-top">
                <td className="px-3 py-3">
                  <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={cellInput} />
                </td>
                <td className="px-3 py-3">
                  <select value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value as AccountType })} className={cellInput}>
                    <option value="IDFC Current">IDFC Current</option>
                    <option value="IDFC Savings">IDFC Savings</option>
                  </select>
                </td>
                <td className="px-3 py-3 min-w-[180px]">
                  <input
                    type="text"
                    placeholder="What was this for?"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                    className={cellInput}
                  />
                </td>
                <td className="px-3 py-3">
                  <input type="text" placeholder="UTR" value={draft.utr} onChange={(e) => setDraft({ ...draft, utr: e.target.value })} className={`${cellInput} font-mono`} />
                </td>
                <td className="px-3 py-3 min-w-[150px]">
                  <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })} className={cellInput}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5 justify-end">
                    <select
                      value={draft.type}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value as TransactionType })}
                      className={`${cellInput} w-[68px]`}
                      aria-label="Credit or Debit"
                    >
                      <option value="Credit">Cr ↑</option>
                      <option value="Debit">Dr ↓</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                      className={`${cellInput} text-right w-[110px]`}
                    />
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={handleAdd}
                    disabled={!canAdd}
                    className="inline-flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </td>
              </tr>

              {filteredTransactions.map((t) => {
                const isCredit = t.type === "Credit";
                return (
                  <tr key={t.id} id={`tx-row-${t.id}`} className="hover:bg-[#fafafa] transition-colors relative">
                    <td className="px-5 py-3.5 text-[#888]">{t.date}</td>
                    <td className="px-5 py-3.5 text-[#666] font-medium text-xs">{t.account}</td>
                    <td className="px-5 py-3.5 text-black font-medium max-w-xs truncate">{t.description}</td>
                    <td className="px-5 py-3.5 text-[#aaa] text-xs font-mono">{t.utr || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="bg-[#f5f5f5] text-[#555] px-2.5 py-1 rounded-lg text-xs font-bold">{t.category}</span>
                    </td>
                    <td className={`px-5 py-3.5 text-right font-bold ${isCredit ? "text-black" : "text-[#aaa]"}`}>
                      {isCredit ? "↑" : "↓"} ₹{t.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 relative">
                        <ConfirmDelete
                          isOpen={deletingId === t.id}
                          onConfirm={() => handleDelete(t.id)}
                          onCancel={() => setDeletingId(null)}
                        />
                        <button
                          onClick={() => setDeletingId(t.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                          aria-label="Delete transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#888]">
                    No transactions found. Add one using the row above.
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
