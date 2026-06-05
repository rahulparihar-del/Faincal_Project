"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Transaction, AccountType, TransactionType, Category } from "@/lib/types";
import { gsap } from "gsap";
import { Plus, Edit2, Trash2, Search, ArrowUpRight, ArrowDownRight, Wallet, CreditCard } from "lucide-react";

const CATEGORIES: Category[] = [
  "Business Income", "Manufacturer Payment", "Ad Spend",
  "Platform Payout", "Wholesale Collection", "Personal",
  "Household", "Transfer", "Other",
];

export default function BankTransactionsPage() {
  const { transactions, setTransactions } = useData();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Bank Transactions</h2>
          <p className="text-sm text-[#888] mt-1">{transactions.length} transactions</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setDrawerOpen(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          <Plus size={16} />
          Add Transaction
        </button>
      </div>

      <CardGroup>
        <StatCard title="Business Credits" value={`₹${stats.bizCredits.toLocaleString("en-IN")}`} icon={ArrowUpRight} />
        <StatCard title="Business Debits" value={`₹${stats.bizDebits.toLocaleString("en-IN")}`} icon={ArrowDownRight} />
        <StatCard title="Personal Spend" value={`₹${stats.personalSpend.toLocaleString("en-IN")}`} icon={Wallet} />
        <StatCard title="Current A/C" value={`₹${stats.currentBalance.toLocaleString("en-IN")}`} icon={CreditCard} subtitle="IDFC Current" />
      </CardGroup>

      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Filters */}
        <div className="p-4 border-b border-[#e8e8e8] bg-[#fafafa] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeCategory === "All"
                  ? "bg-black text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
                  : "bg-white border border-[#e0e0e0] text-[#666] hover:bg-[#f5f5f5]"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
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
                          onClick={() => { setEditingId(t.id); setDrawerOpen(true); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(t.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
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
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TxFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingId={editingId}
        onSave={(newTx) => {
          if (editingId) {
            setTransactions((prev) => prev.map((t) => (t.id === editingId ? newTx : t)));
          } else {
            setTransactions((prev) => [newTx, ...prev]);
          }
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

function TxFormDrawer({
  isOpen,
  onClose,
  editingId,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (tx: Transaction) => void;
}) {
  const { transactions } = useData();
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split("T")[0],
    account: "IDFC Current",
    type: "Debit",
    category: "Other",
  });

  useEffect(() => {
    if (isOpen && editingId) {
      const tx = transactions.find((t) => t.id === editingId);
      if (tx) setFormData(tx);
    } else if (isOpen) {
      setFormData({
        date: new Date().toISOString().split("T")[0],
        account: "IDFC Current",
        type: "Debit",
        category: "Other",
      });
    }
  }, [isOpen, editingId, transactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) {
      if (formRef.current)
        gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }

    const tx: Transaction = {
      id: editingId || Date.now().toString(),
      date: formData.date || "",
      account: formData.account as AccountType,
      type: formData.type as TransactionType,
      amount: Number(formData.amount),
      category: formData.category as Category,
      description: formData.description,
      utr: formData.utr || "",
    };
    onSave(tx);
  };

  const inputCls =
    "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[13px] font-semibold text-[#555] mb-1.5";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editingId ? "Edit Transaction" : "Add Transaction"}>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" required className={inputCls} value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Account</label>
            <select className={inputCls} value={formData.account} onChange={(e) => setFormData({ ...formData, account: e.target.value as AccountType })}>
              <option value="IDFC Current">IDFC Current</option>
              <option value="IDFC Savings">IDFC Savings</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Type</label>
            <div className="flex rounded-xl overflow-hidden border border-[#e8e8e8]">
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                  formData.type === "Credit" ? "bg-black text-white" : "bg-[#f5f5f5] text-[#888]"
                }`}
                onClick={() => setFormData({ ...formData, type: "Credit" })}
              >
                Credit ↑
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                  formData.type === "Debit" ? "bg-black text-white" : "bg-[#f5f5f5] text-[#888]"
                }`}
                onClick={() => setFormData({ ...formData, type: "Debit" })}
              >
                Debit ↓
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Amount (₹) *</label>
            <input type="number" required min="0.01" step="0.01" className={inputCls} value={formData.amount || ""} onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Description *</label>
          <input type="text" required placeholder="What was this for?" className={inputCls} value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
        </div>

        <div>
          <label className={labelCls}>UTR / Ref Number</label>
          <input type="text" placeholder="Optional" className={`${inputCls} font-mono`} value={formData.utr || ""} onChange={(e) => setFormData({ ...formData, utr: e.target.value })} />
        </div>

        <button type="submit" className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          {editingId ? "Update Transaction" : "Save Transaction"}
        </button>
      </form>
    </Drawer>
  );
}
