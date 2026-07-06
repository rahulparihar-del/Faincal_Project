"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useData } from "@/context/DataContext";
import {
  PersonalFinanceEntry, FinanceConfig, FinanceCategory, FinanceEntryType,
} from "@/lib/types";
import {
  Plus, Edit2, Trash2, X, Settings,
  ChevronDown, Search, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";

/* ─── Helpers ─────────────────────────────────────────────── */
const CREDIT_CATEGORIES: FinanceCategory[] = [
  "Salary / Income", "Freelance", "Business Income",
  "Investment Return", "Gift / Bonus", "Received by Someone",
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
    <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-neutral-200 rounded-2xl">
      <div className="w-12 h-12 rounded-full border border-neutral-200 flex items-center justify-center mb-4">
        <Plus size={16} className="text-neutral-400" />
      </div>
      <p className="text-xs font-bold text-neutral-900 mb-1">No transactions recorded</p>
      <p className="text-[11px] text-neutral-400 mb-4 max-w-xs text-center">Your transaction ledger is empty. Add a credit or debit entry to start tracking.</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 bg-neutral-950 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black active:scale-95 transition-all shadow-sm"
      >
        <Plus size={13} />
        Add Transaction
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
  account: "Current",
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
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right border-l border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-900">
              {initial ? "Edit Record" : "Add Record"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:text-black hover:bg-neutral-50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Type Toggle */}
          <div>
            <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Transaction Type</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-xl">
              {(["Credit", "Debit"] as FinanceEntryType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    set("type", t);
                    set("category", t === "Credit" ? "Salary / Income" : "Food & Dining");
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    form.type === t
                      ? "bg-neutral-950 text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-950"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-950">₹</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-bold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Monthly salary, office lease, groceries..."
              className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
            />
          </div>

          {/* Date & Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Payment Method</label>
              <select
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value as PersonalFinanceEntry["paymentMode"])}
                className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Card</option>
              </select>
            </div>
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Account (Source/Destination)</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-xl">
              {(["Current", "Savings"] as const).map((acc) => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => set("account", acc)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    form.account === acc
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-905"
                  }`}
                >
                  {acc} Account
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-2">Category</label>
            <div className="grid grid-cols-2 gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => set("category", cat)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all text-left truncate ${
                    form.category === cat
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-black"
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
              <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Tags</label>
              <input
                type="text"
                value={form.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="Comma separated..."
                className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">Private Notes</label>
              <input
                type="text"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Internal memo..."
                className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-neutral-100 flex gap-3 bg-neutral-50/50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 bg-white hover:bg-neutral-100 hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-bold hover:bg-black transition-colors shadow-sm"
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
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 border border-neutral-200 animate-fade-in">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <h2 className="text-xs font-black uppercase tracking-widest text-neutral-950">Finance Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-neutral-250 flex items-center justify-center hover:bg-neutral-50 transition-colors text-neutral-500">
            <X size={14} />
          </button>
        </div>

        {[
          { label: "Starting Balance (Current Account) (₹)", key: "startingBalance" as const, placeholder: "e.g. 50000" },
          { label: "Savings Goal (₹)", key: "savingsGoal" as const, placeholder: "e.g. 100000" },
          { label: "Monthly Budget (₹)", key: "monthlyBudget" as const, placeholder: "e.g. 30000" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-950">₹</span>
              <input
                type="number"
                min={0}
                value={form[key] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                placeholder={placeholder}
                className="w-full pl-7 pr-4 py-2 border border-neutral-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-2 pt-2 border-t border-neutral-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50 hover:text-black transition-colors bg-white">
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-bold hover:bg-black transition-colors"
          >
            Save Changes
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
    const totalBalance = config.startingBalance + totalCredit - totalDebit;

    // Splits
    const currentCredit = financeEntries.filter((e) => e.type === "Credit" && (e.account === "Current" || !e.account)).reduce((s, e) => s + e.amount, 0);
    const currentDebit = financeEntries.filter((e) => e.type === "Debit" && (e.account === "Current" || !e.account)).reduce((s, e) => s + e.amount, 0);
    const currentBalance = config.startingBalance + currentCredit - currentDebit;

    const savingsCredit = financeEntries.filter((e) => e.type === "Credit" && e.account === "Savings").reduce((s, e) => s + e.amount, 0);
    const savingsDebit = financeEntries.filter((e) => e.type === "Debit" && e.account === "Savings").reduce((s, e) => s + e.amount, 0);
    const savingsBalance = savingsCredit - savingsDebit;

    const now = new Date();
    const thisMonthEntries = financeEntries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthDebit = thisMonthEntries.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0);

    return { totalCredit, totalDebit, totalBalance, currentBalance, savingsBalance, thisMonthDebit };
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
    if (!confirm("Delete this transaction record?")) return;
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
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-lg font-black tracking-widest uppercase text-neutral-900">
            Personal Finance
          </h1>
          <p className="text-[11px] font-semibold text-neutral-450 tracking-wide mt-0.5">Ledger bookkeeping & cash flow logs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-250 rounded-xl text-xs font-bold text-neutral-600 bg-white hover:bg-neutral-50 active:scale-95 transition-all"
          >
            <Settings size={13} />
            Configure
          </button>
          <button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="flex items-center gap-1 px-4 py-1.5 bg-neutral-950 text-white text-xs font-bold rounded-xl hover:bg-black active:scale-95 transition-all shadow-sm"
          >
            <Plus size={13} />
            Add Entry
          </button>
        </div>
      </div>

      {/* ── Compact Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {[
          { label: "Current Account", value: fmt(stats.currentBalance) },
          { label: "Savings Account", value: fmt(stats.savingsBalance) },
          { label: "Ledger Balance", value: fmt(stats.totalBalance), highlight: true },
          { label: "Total Income", value: `+${fmt(stats.totalCredit)}` },
          { label: "Total Expense", value: `-${fmt(stats.totalDebit)}` },
        ].map((s) => (
          <div
            key={s.label}
            className={`border border-neutral-200 p-4 rounded-xl flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
              s.highlight ? "bg-neutral-950 text-white border-neutral-950" : "bg-white text-neutral-900"
            }`}
          >
            <span className={`text-[9px] font-bold uppercase tracking-wider ${s.highlight ? "text-neutral-455" : "text-neutral-400"}`}>
              {s.label}
            </span>
            <p className="text-sm font-black mt-1 leading-none tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Table & Filter Area (Linear-inspired SaaS style) ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        
        {/* Unified Search & Filters Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-4 bg-neutral-50/50 border-b border-neutral-200">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, category, tags..."
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 bg-white text-neutral-900 placeholder-neutral-400 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
            />
          </div>

          {/* Filters Area */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented controls (clean outline pill controls) */}
            <div className="flex border border-neutral-200 p-0.5 bg-white rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
              {(["All", "Credit", "Debit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === t
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-500 hover:text-neutral-950"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Custom styled select box */}
            <div className="relative border border-neutral-200 bg-white rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex items-center pr-8 pl-3.5 py-1.5">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="appearance-none text-xs font-bold text-neutral-700 bg-transparent focus:outline-none cursor-pointer w-full"
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-450 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState onAdd={() => { setEditing(null); setDrawerOpen(true); }} />
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/20 text-[10px] font-bold text-neutral-455 uppercase tracking-widest select-none">
                  <th className="px-6 py-3.5 w-32">Date</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5 w-36">Category</th>
                  <th className="px-6 py-3.5 w-32">Account</th>
                  <th className="px-6 py-3.5 w-28">Method</th>
                  <th className="px-6 py-3.5 w-24 text-center">Type</th>
                  <th className="px-6 py-3.5 w-36 text-right">Amount</th>
                  <th className="px-6 py-3.5 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-900 bg-white">
                {filtered.map((entry) => {
                  const isCredit = entry.type === "Credit";
                  const acc = entry.account || "Current";
                  return (
                    <tr key={entry.id} className="hover:bg-neutral-50/30 transition-colors group">
                      {/* Date */}
                      <td className="px-6 py-4 text-neutral-400 font-mono tracking-tight whitespace-nowrap">
                        {entry.date}
                      </td>

                      {/* Description / Tags */}
                      <td className="px-6 py-4 max-w-xs md:max-w-md truncate">
                        <div className="flex flex-col">
                          <span className="font-bold text-neutral-900 tracking-tight">{entry.description}</span>
                          {entry.tags && (
                            <span className="text-[10px] text-neutral-400 font-normal mt-0.5 tracking-tight">
                              Tags: {entry.tags}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 bg-neutral-100 text-neutral-850 rounded-lg text-[10px] font-bold tracking-tight">
                          {entry.category}
                        </span>
                      </td>

                      {/* Account */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          acc === "Savings" 
                            ? "bg-neutral-900 text-white" 
                            : "bg-neutral-100 text-neutral-700"
                        }`}>
                          {acc}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="px-6 py-4 text-neutral-500 font-semibold whitespace-nowrap">
                        {entry.paymentMode}
                      </td>

                      {/* Type Badge */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border tracking-wider uppercase ${
                          isCredit 
                            ? "bg-neutral-950 text-white border-neutral-950" 
                            : "bg-white text-neutral-800 border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                        }`}>
                          {isCredit ? (
                            <>
                              <ArrowUpRight size={10} className="stroke-[2.5]" />
                              Credit
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft size={10} className="stroke-[2.5]" />
                              Debit
                            </>
                          )}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className={`px-6 py-4 text-right font-black text-sm tracking-tight whitespace-nowrap ${
                        isCredit ? "text-neutral-950 font-black" : "text-neutral-800 font-bold"
                      }`}>
                        {isCredit ? "+" : "-"}{fmt(entry.amount)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1 rounded-md border border-neutral-200 text-neutral-450 hover:text-neutral-900 hover:border-neutral-900 hover:bg-neutral-50 transition-all"
                            title="Edit record"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="p-1 rounded-md border border-neutral-200 text-neutral-440 hover:text-black hover:border-black hover:bg-neutral-50 transition-all"
                            title="Delete record"
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

        {/* Ledger Summary Stats Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50/20 select-none">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Ledger Page Summary · {filtered.length} active row(s)
            </span>
            <div className="flex items-center gap-4 text-xs font-extrabold tracking-tight">
              <div className="flex items-center gap-1 bg-white border border-neutral-200 px-3 py-1 rounded-lg">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Inflow:</span>
                <span className="text-neutral-900">
                  +{fmt(filtered.filter((e) => e.type === "Credit").reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-white border border-neutral-200 px-3 py-1 rounded-lg">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Outflow:</span>
                <span className="text-neutral-700">
                  -{fmt(filtered.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
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

      {/* minimal animations */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      `}</style>
    </div>
  );
}
