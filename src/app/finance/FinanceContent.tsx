"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useData } from "@/context/DataContext";
import {
  PersonalFinanceEntry, FinanceConfig, FinanceCategory, FinanceEntryType,
} from "@/lib/types";
import {
  Plus, Edit2, Trash2, IndianRupee, X, Settings,
  ChevronDown, Search, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";

/* ─── Helpers ─────────────────────────────────────────────── */
const CREDIT_CATEGORIES: FinanceCategory[] = [
  "Salary / Income", "Freelance", "Business Income",
  "Investment Return", "Gift / Bonus",
];
const DEBIT_CATEGORIES: FinanceCategory[] = [
  "Food & Dining", "Groceries", "Rent & Housing", "EMI / Loan",
  "Transport", "Shopping", "Healthcare", "Entertainment",
  "Utilities & Bills", "Education", "Travel", "Savings Transfer", "Other",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthLabel(y: number, m: number) { return `${MONTHS[m]} ${y}`; }

/* ─── Empty State ─────────────────────────────────────────── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
      <p className="text-sm font-bold text-black mb-1">No transaction records found</p>
      <p className="text-xs text-gray-400 mb-4">Start by adding your first credit or debit transaction</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-neutral-850 active:scale-95 transition-all"
      >
        <Plus size={14} />
        Add First Entry
      </button>
    </div>
  );
}

/* ─── Entry Form Drawer ───────────────────────────────────── */
const EMPTY_ENTRY: Omit<PersonalFinanceEntry, "id"> = {
  date: new Date().toISOString().slice(0, 10),
  type: "Debit",
  category: "Food & Dining",
  description: "",
  amount: 0,
  paymentMode: "UPI",
  tags: "",
  notes: "",
};

function EntryDrawer({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial?: PersonalFinanceEntry | null;
  onSave: (entry: PersonalFinanceEntry) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<PersonalFinanceEntry, "id">>(
    initial ? { ...initial } : { ...EMPTY_ENTRY }
  );

  React.useEffect(() => {
    setForm(initial ? { ...initial } : { ...EMPTY_ENTRY, date: new Date().toISOString().slice(0, 10) });
  }, [initial, open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const categories = form.type === "Credit" ? CREDIT_CATEGORIES : DEBIT_CATEGORIES;

  const handleSave = () => {
    if (!form.description.trim()) { alert("Please add a description."); return; }
    if (!form.amount || form.amount <= 0) { alert("Please enter a valid amount."); return; }
    onSave({ ...form, id: (initial as PersonalFinanceEntry | null)?.id ?? newId() });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right border-l border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              {initial ? "Edit Entry" : "Create New Entry"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-black hover:bg-gray-50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Type Toggle */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              {(["Credit", "Debit"] as FinanceEntryType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    set("type", t);
                    set("category", t === "Credit" ? "Salary / Income" : "Food & Dining");
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    form.type === t
                      ? "bg-black text-white shadow-sm"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-black">₹</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-black transition-all bg-white text-black"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Monthly salary, Zomato order…"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black transition-all bg-white text-black"
            />
          </div>

          {/* Date & Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black transition-all bg-white text-black"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Mode</label>
              <select
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value as PersonalFinanceEntry["paymentMode"])}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black bg-white text-black appearance-none"
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Card</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
            <div className="grid grid-cols-2 gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => set("category", cat)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all text-left truncate ${
                    form.category === cat
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-black"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tags</label>
              <input
                type="text"
                value={form.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="e.g. work, household"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black transition-all bg-white text-black"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
              <input
                type="text"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional note…"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black transition-all bg-white text-black"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-100 flex gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 bg-white hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Modal ──────────────────────────────────────── */
function SettingsModal({
  open,
  config,
  onSave,
  onClose,
}: {
  open: boolean;
  config: FinanceConfig;
  onSave: (c: FinanceConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FinanceConfig>({ ...config });
  React.useEffect(() => { setForm({ ...config }); }, [config, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black">Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <X size={14} />
          </button>
        </div>

        {[
          { label: "Starting Balance (₹)", key: "startingBalance" as const, placeholder: "e.g. 50000" },
          { label: "Savings Goal (₹)", key: "savingsGoal" as const, placeholder: "e.g. 100000" },
          { label: "Monthly Budget (₹)", key: "monthlyBudget" as const, placeholder: "e.g. 30000" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-black">₹</span>
              <input
                type="number"
                min={0}
                value={form[key] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                placeholder={placeholder}
                className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-black bg-white text-black"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            className="flex-1 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
const DEFAULT_CONFIG: FinanceConfig = {
  id: "config",
  savingsGoal: 100000,
  startingBalance: 0,
  monthlyBudget: 30000,
};

export default function FinanceContent() {
  const { financeEntries, setFinanceEntries, financeConfig, setFinanceConfig } = useData();

  const config: FinanceConfig = financeConfig.find((c) => c.id === "config") ?? DEFAULT_CONFIG;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalFinanceEntry | null>(null);
  const [filterType, setFilterType] = useState<"All" | "Credit" | "Debit">("All");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [search, setSearch] = useState("");

  /* ─── Computed Stats ─────────────────────────────────────── */
  const stats = useMemo(() => {
    const totalCredit = financeEntries.filter((e) => e.type === "Credit").reduce((s, e) => s + e.amount, 0);
    const totalDebit = financeEntries.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0);
    const currentBalance = config.startingBalance + totalCredit - totalDebit;

    // This month stats
    const now = new Date();
    const thisMonthEntries = financeEntries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthDebit = thisMonthEntries.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0);
    const thisMonthCredit = thisMonthEntries.filter((e) => e.type === "Credit").reduce((s, e) => s + e.amount, 0);

    return { totalCredit, totalDebit, currentBalance, thisMonthDebit, thisMonthCredit };
  }, [financeEntries, config]);

  /* ─── Month options for filter ───────────────────────────── */
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    financeEntries.forEach((e) => {
      const d = new Date(e.date);
      seen.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`);
    });
    return Array.from(seen).sort().reverse().map((k) => {
      const [y, m] = k.split("-").map(Number);
      return { key: k, label: monthLabel(y, m) };
    });
  }, [financeEntries]);

  /* ─── Filtered Entries ───────────────────────────────────── */
  const filtered = useMemo(() => {
    return financeEntries
      .filter((e) => filterType === "All" || e.type === filterType)
      .filter((e) => {
        if (filterMonth === "all") return true;
        const d = new Date(e.date);
        const [y, m] = filterMonth.split("-").map(Number);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.tags ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [financeEntries, filterType, filterMonth, search]);

  /* ─── CRUD ───────────────────────────────────────────────── */
  const saveEntry = useCallback((entry: PersonalFinanceEntry) => {
    setFinanceEntries((prev) => {
      const exists = prev.find((e) => e.id === entry.id);
      return exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev];
    });
  }, [setFinanceEntries]);

  const deleteEntry = useCallback((id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    setFinanceEntries((prev) => prev.filter((e) => e.id !== id));
  }, [setFinanceEntries]);

  const saveConfig = useCallback((cfg: FinanceConfig) => {
    setFinanceConfig((prev) => {
      const exists = prev.find((c) => c.id === "config");
      return exists ? prev.map((c) => (c.id === "config" ? cfg : c)) : [cfg, ...prev];
    });
  }, [setFinanceConfig]);

  const openEdit = (e: PersonalFinanceEntry) => {
    setEditing(e);
    setDrawerOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header Row ── */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl font-black text-black tracking-tight uppercase">
            Personal Finance
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Minimalist ledger & tracking dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-250 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Settings size={13} />
            Settings
          </button>
          <button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="flex items-center gap-1 px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={13} />
            Add Entry
          </button>
        </div>
      </div>

      {/* ── Clean Compact Stat Bar (Monochrome, no colors) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Opening Balance", value: fmt(config.startingBalance) },
          { label: "Current Balance", value: fmt(stats.currentBalance), highlight: true },
          { label: "Total Credited", value: `+${fmt(stats.totalCredit)}` },
          { label: "Total Debited", value: `-${fmt(stats.totalDebit)}` },
          { label: "This Month Spent", value: fmt(stats.thisMonthDebit) },
        ].map((s) => (
          <div
            key={s.label}
            className={`border border-gray-200 p-4 rounded-xl flex flex-col justify-between ${
              s.highlight ? "bg-black text-white border-black" : "bg-white text-black"
            }`}
          >
            <span className={`text-[9px] font-bold uppercase tracking-wider ${s.highlight ? "text-gray-400" : "text-gray-400"}`}>
              {s.label}
            </span>
            <p className="text-base font-black tracking-tight mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main Full-Width Table Layout ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-200 bg-gray-50">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description, category, tags..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-black bg-white text-black transition-all"
            />
          </div>

          {/* Type filters */}
          <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-xl">
            {(["All", "Credit", "Debit"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === t ? "bg-black text-white" : "text-gray-500 hover:text-black"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Month Dropdown */}
          <div className="relative bg-white border border-gray-200 rounded-xl overflow-hidden px-3 py-2 flex items-center">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="appearance-none pr-6 text-xs font-bold text-gray-600 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Months</option>
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Wide Monochrome Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState onAdd={() => { setEditing(null); setDrawerOpen(true); }} />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Payment Mode</th>
                  <th className="px-5 py-3 text-right">Type</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-900">
                {filtered.map((entry) => {
                  const isCredit = entry.type === "Credit";
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-3.5 text-gray-450 font-normal whitespace-nowrap">{entry.date}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-black">{entry.description}</span>
                          {entry.tags && (
                            <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                              Tags: {entry.tags}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold">
                          {entry.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{entry.paymentMode}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isCredit ? "bg-neutral-100 text-black" : "bg-neutral-50 text-gray-400"
                        }`}>
                          {isCredit ? (
                            <>
                              <ArrowUpRight size={10} className="stroke-[3]" />
                              Credit
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft size={10} className="stroke-[3]" />
                              Debit
                            </>
                          )}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-right font-black whitespace-nowrap ${isCredit ? "text-black" : "text-black/70"}`}>
                        {isCredit ? "+" : "-"}{fmt(entry.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1 rounded border border-gray-200 text-gray-500 hover:text-black hover:border-black transition-all"
                            title="Edit"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="p-1 rounded border border-gray-200 text-gray-400 hover:text-black hover:border-black transition-all"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer / Summary statistics */}
        {filtered.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Showing {filtered.length} entries
            </span>
            <div className="flex gap-4 text-xs font-black">
              <span className="text-black">
                Total Credit: +{fmt(filtered.filter((e) => e.type === "Credit").reduce((s, e) => s + e.amount, 0))}
              </span>
              <span className="text-black/60">
                Total Debit: -{fmt(filtered.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Drawer */}
      <EntryDrawer
        open={drawerOpen}
        initial={editing}
        onSave={saveEntry}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
      />
      <SettingsModal
        open={settingsOpen}
        config={config}
        onSave={saveConfig}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Minimal slide-in animation */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      `}</style>
    </div>
  );
}
