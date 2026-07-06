"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useData } from "@/context/DataContext";
import {
  PersonalFinanceEntry, FinanceConfig, FinanceCategory, FinanceEntryType,
} from "@/lib/types";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Edit2, Trash2,
  Target, IndianRupee, ArrowUpCircle, ArrowDownCircle, X, Settings,
  ChevronDown, Calendar, Tag, FileText, CreditCard, Banknote,
  Smartphone, AlertCircle, CheckCircle2, Filter, Search,
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

const CATEGORY_ICONS: Partial<Record<FinanceCategory, string>> = {
  "Salary / Income": "💼",
  "Freelance": "💻",
  "Business Income": "🏪",
  "Investment Return": "📈",
  "Gift / Bonus": "🎁",
  "Food & Dining": "🍽️",
  "Groceries": "🛒",
  "Rent & Housing": "🏠",
  "EMI / Loan": "🏦",
  "Transport": "🚗",
  "Shopping": "🛍️",
  "Healthcare": "🏥",
  "Entertainment": "🎬",
  "Utilities & Bills": "⚡",
  "Education": "📚",
  "Travel": "✈️",
  "Savings Transfer": "💰",
  "Other": "📋",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthLabel(y: number, m: number) { return `${MONTHS[m]} ${y}`; }

/* ─── Empty State ─────────────────────────────────────────── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl">
          <Wallet size={40} className="text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
          <Plus size={16} className="text-white" />
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Start Tracking Your Finances</h3>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          Add your income, expenses, and savings to get a clear picture of your financial health.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-lg hover:shadow-xl hover:bg-gray-900 transition-all duration-200 active:scale-95"
      >
        <Plus size={16} />
        Add First Entry
      </button>
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────── */
function FinStatCard({
  label, value, sub, icon, gradient, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} shadow-sm border border-white/20`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
          {icon}
        </div>
        {trend === "up" && <TrendingUp size={14} className="text-white/70 mt-1" />}
        {trend === "down" && <TrendingDown size={14} className="text-white/70 mt-1" />}
      </div>
      <p className="text-white/75 text-xs font-semibold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white text-2xl font-black tracking-tight leading-none">{value}</p>
      {sub && <p className="text-white/65 text-xs mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}

/* ─── Progress Bar ────────────────────────────────────────── */
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── Entry Row ───────────────────────────────────────────── */
function EntryRow({
  entry, onEdit, onDelete,
}: {
  entry: PersonalFinanceEntry;
  onEdit: (e: PersonalFinanceEntry) => void;
  onDelete: (id: string) => void;
}) {
  const isCredit = entry.type === "Credit";
  const emoji = CATEGORY_ICONS[entry.category] ?? "📋";

  return (
    <div className="flex items-center gap-3 p-3.5 hover:bg-gray-50 rounded-2xl transition-all duration-150 group">
      {/* Icon */}
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 ${
        isCredit ? "bg-emerald-50" : "bg-red-50"
      }`}>
        {emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-gray-900 truncate">{entry.description || entry.category}</p>
          {entry.tags && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded-full">
              <Tag size={9} />
              {entry.tags.split(",")[0].trim()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{entry.category}</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">{entry.date}</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">{entry.paymentMode}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className={`font-bold text-sm ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
          {isCredit ? "+" : "-"}{fmt(entry.amount)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <button
          onClick={() => onEdit(entry)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {initial ? "Edit Entry" : "Add Entry"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Record an income or expense</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-2xl">
              {(["Credit", "Debit"] as FinanceEntryType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    set("type", t);
                    set("category", t === "Credit" ? "Salary / Income" : "Food & Dining");
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                    form.type === t
                      ? t === "Credit"
                        ? "bg-emerald-500 text-white shadow-md"
                        : "bg-red-500 text-white shadow-md"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {t === "Credit" ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Amount (₹)</label>
            <div className="relative">
              <IndianRupee size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                min={0}
                step={1}
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Monthly salary, Zomato order…"
              className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
            />
          </div>

          {/* Date & Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Payment</label>
              <select
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value as PersonalFinanceEntry["paymentMode"])}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all appearance-none bg-white"
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
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => set("category", cat)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 text-left ${
                    form.category === cat
                      ? "border-black bg-black text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-base leading-none">{CATEGORY_ICONS[cat] ?? "📋"}</span>
                  <span className="truncate leading-tight">{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tags</label>
              <input
                type="text"
                value={form.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="e.g. work, family"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Notes</label>
              <input
                type="text"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional note…"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-2xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors shadow-lg"
          >
            {initial ? "Save Changes" : "Add Entry"}
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Finance Settings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Set your goals and starting balance</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {[
          { label: "Starting Balance (₹)", key: "startingBalance" as const, placeholder: "e.g. 50000" },
          { label: "Savings Goal (₹)", key: "savingsGoal" as const, placeholder: "e.g. 100000" },
          { label: "Monthly Budget (₹)", key: "monthlyBudget" as const, placeholder: "e.g. 20000" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{label}</label>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                min={0}
                value={form[key] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                placeholder={placeholder}
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-3 mt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            className="flex-1 py-3 rounded-2xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors shadow-lg"
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
    const savings = currentBalance;
    const savingsPct = config.savingsGoal > 0 ? Math.min(100, (savings / config.savingsGoal) * 100) : 0;

    // This month
    const now = new Date();
    const thisMonthEntries = financeEntries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthDebit = thisMonthEntries.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0);
    const thisMonthCredit = thisMonthEntries.filter((e) => e.type === "Credit").reduce((s, e) => s + e.amount, 0);
    const budgetLeft = config.monthlyBudget - thisMonthDebit;
    const budgetPct = config.monthlyBudget > 0 ? Math.min(100, (thisMonthDebit / config.monthlyBudget) * 100) : 0;

    return { totalCredit, totalDebit, currentBalance, savings, savingsPct, thisMonthDebit, thisMonthCredit, budgetLeft, budgetPct };
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

  /* ─── Category breakdown for this month ─────────────────── */
  const categoryBreakdown = useMemo(() => {
    const now = new Date();
    const map: Record<string, number> = {};
    financeEntries
      .filter((e) => {
        const d = new Date(e.date);
        return e.type === "Debit" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .forEach((e) => {
        map[e.category] = (map[e.category] ?? 0) + e.amount;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [financeEntries]);

  /* ─── CRUD ───────────────────────────────────────────────── */
  const saveEntry = useCallback((entry: PersonalFinanceEntry) => {
    setFinanceEntries((prev) => {
      const exists = prev.find((e) => e.id === entry.id);
      return exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev];
    });
  }, [setFinanceEntries]);

  const deleteEntry = useCallback((id: string) => {
    if (!confirm("Delete this entry?")) return;
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Wallet size={20} className="text-white" />
            </div>
            Personal Finance
          </h1>
          <p className="text-sm text-gray-400 mt-1 ml-[52px]">Track your savings, income and spending</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Settings size={15} />
            Settings
          </button>
          <button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <Plus size={15} />
            Add Entry
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FinStatCard
          label="Current Balance"
          value={fmtShort(stats.currentBalance)}
          sub={stats.currentBalance >= 0 ? "Surplus" : "Deficit"}
          icon={<Wallet size={18} className="text-white" />}
          gradient={stats.currentBalance >= 0 ? "bg-gradient-to-br from-violet-600 to-purple-700" : "bg-gradient-to-br from-rose-500 to-red-600"}
          trend={stats.currentBalance >= 0 ? "up" : "down"}
        />
        <FinStatCard
          label="Total Income"
          value={fmtShort(stats.totalCredit)}
          sub={`${financeEntries.filter((e) => e.type === "Credit").length} entries`}
          icon={<TrendingUp size={18} className="text-white" />}
          gradient="bg-gradient-to-br from-emerald-500 to-green-600"
          trend="up"
        />
        <FinStatCard
          label="Total Spent"
          value={fmtShort(stats.totalDebit)}
          sub={`${financeEntries.filter((e) => e.type === "Debit").length} entries`}
          icon={<TrendingDown size={18} className="text-white" />}
          gradient="bg-gradient-to-br from-rose-500 to-red-600"
          trend="down"
        />
        <FinStatCard
          label="Savings Goal"
          value={`${stats.savingsPct.toFixed(0)}%`}
          sub={`${fmt(stats.savings)} / ${fmt(config.savingsGoal)}`}
          icon={<PiggyBank size={18} className="text-white" />}
          gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          trend="up"
        />
      </div>

      {/* ── Progress Bars ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Savings Progress */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-violet-500" />
              <span className="text-sm font-bold text-gray-800">Savings Goal</span>
            </div>
            <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
              {stats.savingsPct.toFixed(1)}%
            </span>
          </div>
          <ProgressBar value={stats.savings} max={config.savingsGoal} color="bg-gradient-to-r from-violet-500 to-purple-600" />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-400">Saved: {fmt(stats.savings)}</span>
            <span className="text-xs text-gray-400">Goal: {fmt(config.savingsGoal)}</span>
          </div>
        </div>

        {/* Monthly Budget */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className={stats.budgetPct > 90 ? "text-red-500" : "text-emerald-500"} />
              <span className="text-sm font-bold text-gray-800">Monthly Budget</span>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              stats.budgetPct > 90 ? "text-red-600 bg-red-50" :
              stats.budgetPct > 70 ? "text-amber-600 bg-amber-50" :
              "text-emerald-600 bg-emerald-50"
            }`}>
              {stats.budgetPct.toFixed(1)}% used
            </span>
          </div>
          <ProgressBar
            value={stats.thisMonthDebit}
            max={config.monthlyBudget}
            color={stats.budgetPct > 90 ? "bg-gradient-to-r from-red-500 to-rose-600" : stats.budgetPct > 70 ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-green-600"}
          />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-400">Spent: {fmt(stats.thisMonthDebit)}</span>
            <span className={`text-xs font-semibold ${stats.budgetLeft < 0 ? "text-red-500" : "text-gray-400"}`}>
              Left: {fmt(Math.abs(stats.budgetLeft))}{stats.budgetLeft < 0 ? " over!" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "This Month Income", value: stats.thisMonthCredit, color: "text-emerald-600", bg: "bg-emerald-50", icon: <ArrowUpCircle size={14} className="text-emerald-500" /> },
          { label: "This Month Spent", value: stats.thisMonthDebit, color: "text-red-500", bg: "bg-red-50", icon: <ArrowDownCircle size={14} className="text-red-500" /> },
          { label: "Net This Month", value: stats.thisMonthCredit - stats.thisMonthDebit, color: stats.thisMonthCredit - stats.thisMonthDebit >= 0 ? "text-violet-600" : "text-red-500", bg: stats.thisMonthCredit - stats.thisMonthDebit >= 0 ? "bg-violet-50" : "bg-red-50", icon: <Wallet size={14} className="text-violet-500" /> },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 flex flex-col gap-1`}>
            <div className="flex items-center gap-1.5">{s.icon}<span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{s.label}</span></div>
            <p className={`text-lg font-black ${s.color}`}>{fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid: Entries + Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entries List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries…"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
              />
            </div>
            {/* Type filter */}
            <div className="flex gap-1.5 p-1 bg-gray-100 rounded-2xl">
              {(["All", "Credit", "Debit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterType === t ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Month filter */}
            <div className="relative">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2.5 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 bg-white transition-all"
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Entries */}
          <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {filtered.length === 0 ? (
              financeEntries.length === 0 ? (
                <EmptyState onAdd={() => { setEditing(null); setDrawerOpen(true); }} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <Search size={32} className="text-gray-200" />
                  <p className="text-sm font-medium">No entries match your filters</p>
                </div>
              )
            ) : (
              <div className="px-2 py-2">
                {filtered.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onEdit={openEdit} onDelete={deleteEntry} />
                ))}
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">{filtered.length} entries</span>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="text-emerald-600">
                  +{fmt(filtered.filter((e) => e.type === "Credit").reduce((s, e) => s + e.amount, 0))}
                </span>
                <span className="text-red-500">
                  -{fmt(filtered.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Category Breakdown + Quick Info */}
        <div className="flex flex-col gap-4">
          {/* Category breakdown */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Tag size={14} className="text-gray-400" />
              Top Spending (This Month)
            </h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No spending data yet</p>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.map(([cat, amt]) => {
                  const pct = stats.thisMonthDebit > 0 ? (amt / stats.thisMonthDebit) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{CATEGORY_ICONS[cat as FinanceCategory] ?? "📋"}</span>
                          <span className="text-xs font-semibold text-gray-700 truncate max-w-[110px]">{cat}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-800">{fmtShort(amt)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Info Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <IndianRupee size={14} className="text-white/80" />
              </div>
              <span className="text-sm font-bold opacity-90">Balance Overview</span>
            </div>

            {[
              { label: "Opening Balance", value: fmt(config.startingBalance), color: "text-white/80" },
              { label: "Total Credited", value: `+${fmt(stats.totalCredit)}`, color: "text-emerald-400" },
              { label: "Total Debited", value: `-${fmt(stats.totalDebit)}`, color: "text-red-400" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between items-center">
                <span className="text-xs text-white/50 font-medium">{r.label}</span>
                <span className={`text-sm font-bold ${r.color}`}>{r.value}</span>
              </div>
            ))}

            <div className="h-px bg-white/10" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60 font-bold uppercase tracking-wider">Current Balance</span>
              <span className={`text-lg font-black ${stats.currentBalance >= 0 ? "text-white" : "text-red-400"}`}>
                {fmt(stats.currentBalance)}
              </span>
            </div>

            {stats.budgetLeft < 0 && (
              <div className="flex items-center gap-2 bg-red-500/20 rounded-xl px-3 py-2">
                <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300 font-medium">Over budget by {fmt(Math.abs(stats.budgetLeft))}</span>
              </div>
            )}
            {stats.savingsPct >= 100 && (
              <div className="flex items-center gap-2 bg-emerald-500/20 rounded-xl px-3 py-2">
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-300 font-medium">Savings goal reached! 🎉</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
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

      {/* Slide-in animation */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.28s cubic-bezier(0.32,0.72,0,1);
        }
      `}</style>
    </div>
  );
}
