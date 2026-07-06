"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useData } from "@/context/DataContext";
import {
  PersonalFinanceEntry, FinanceConfig, FinanceCategory, FinanceEntryType,
} from "@/lib/types";
import {
  Plus, Edit2, Trash2, X, Settings,
  ChevronDown, Search, ArrowUpRight, ArrowDownLeft, ArrowRight,
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
    <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-neutral-200 rounded-xl">
      <div className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center mb-3">
        <Plus size={14} className="text-neutral-400" />
      </div>
      <p className="text-xs font-bold text-neutral-900 mb-1">No transactions</p>
      <p className="text-[11px] text-neutral-400 mb-4 text-center max-w-xs leading-relaxed">Your ledger is currently empty. Record a new credit, debit, or transfer entry.</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 bg-neutral-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-black active:scale-95 transition-all shadow-sm"
      >
        <Plus size={12} />
        Add Entry
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
  transferTo: "Savings",
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
    
    const finalForm = { ...form };
    if (finalForm.type === "Transfer") {
      finalForm.category = "Savings Transfer";
      if (!finalForm.transferTo) {
        finalForm.transferTo = finalForm.account === "Current" ? "Savings" : "Current";
      }
    }
    
    onSave({ ...finalForm, id: (initial as PersonalFinanceEntry | null)?.id ?? newId() });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex">
      <div className="absolute inset-0 bg-black/15 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right border-l border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-neutral-100">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-900">
              {initial ? "Edit Entry" : "Create Entry"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:text-black hover:bg-neutral-50 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Type Toggle */}
          <div>
            <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-neutral-100 rounded-lg">
              {(["Credit", "Debit", "Transfer"] as FinanceEntryType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    set("type", t);
                    set("category", t === "Credit" ? "Salary / Income" : t === "Transfer" ? "Savings Transfer" : "Food & Dining");
                    if (t === "Transfer") {
                      set("account", "Savings");
                      set("transferTo", "Current");
                    }
                  }}
                  className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${
                    form.type === t
                      ? "bg-white text-neutral-950 shadow-sm"
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
            <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-900">₹</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-7 pr-4 py-2 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={form.type === "Transfer" ? "Account transfer description..." : "Zomato, Client payment, Office rent..."}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
            />
          </div>

          {/* Date & Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Method</label>
              <select
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value as PersonalFinanceEntry["paymentMode"])}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Card</option>
              </select>
            </div>
          </div>

          {/* Account Selection */}
          {form.type === "Transfer" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">From Account</label>
                <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-neutral-100 rounded-lg">
                  {(["Current", "Savings"] as const).map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        set("account", acc);
                        set("transferTo", acc === "Current" ? "Savings" : "Current");
                      }}
                      className={`py-1 rounded-md text-[10px] font-bold transition-all ${
                        form.account === acc
                          ? "bg-white text-neutral-950 shadow-sm"
                          : "text-neutral-500"
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">To Account</label>
                <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-neutral-100 rounded-lg">
                  {(["Current", "Savings"] as const).map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        set("transferTo", acc);
                        set("account", acc === "Current" ? "Savings" : "Current");
                      }}
                      className={`py-1 rounded-md text-[10px] font-bold transition-all ${
                        form.transferTo === acc
                          ? "bg-white text-neutral-950 shadow-sm"
                          : "text-neutral-500"
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Account</label>
              <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-neutral-100 rounded-lg">
                {(["Current", "Savings"] as const).map((acc) => (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => set("account", acc)}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                      form.account === acc
                        ? "bg-white text-neutral-950 shadow-sm"
                        : "text-neutral-500"
                    }`}
                  >
                    {acc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          {form.type !== "Transfer" && (
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Category</label>
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => set("category", cat)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all text-left truncate ${
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
          )}

          {/* Tags & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Tags</label>
              <input
                type="text"
                value={form.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="work, travel..."
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Notes</label>
              <input
                type="text"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Memo..."
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex gap-2.5 bg-neutral-50/50">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-neutral-200 text-xs font-bold text-neutral-600 bg-white hover:bg-neutral-100 hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-neutral-950 text-white text-xs font-bold hover:bg-black transition-colors shadow-sm"
          >
            Save
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
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 border border-neutral-200 animate-fade-in">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <h2 className="text-xs font-black uppercase tracking-widest text-neutral-950">Settings</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors text-neutral-500">
            <X size={13} />
          </button>
        </div>

        {[
          { label: "Starting Balance (Current Account) (₹)", key: "startingBalance" as const, placeholder: "e.g. 50000" },
          { label: "Savings Goal (₹)", key: "savingsGoal" as const, placeholder: "e.g. 100000" },
          { label: "Monthly Budget (₹)", key: "monthlyBudget" as const, placeholder: "e.g. 30000" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-950">₹</span>
              <input
                type="number"
                min={0}
                value={form[key] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                placeholder={placeholder}
                className="w-full pl-6 pr-4 py-1.5 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-neutral-950 bg-white text-neutral-950"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-2 pt-2 border-t border-neutral-100">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50 hover:text-black transition-colors bg-white">
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            className="flex-1 py-2 rounded-lg bg-neutral-950 text-white text-xs font-bold hover:bg-black transition-colors"
          >
            Save
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
  
  // Filtering States
  const [filterAccount, setFilterAccount] = useState<"All" | "Current" | "Savings">("All");
  const [filterType, setFilterType] = useState<"All" | "Credit" | "Debit" | "Transfer">("All");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [search, setSearch] = useState("");

  /* ─── Computed Stats ─────────────────────────────────────── */
  const stats = useMemo(() => {
    const totalCredit = financeEntries.filter((e) => e.type === "Credit").reduce((s, e) => s + e.amount, 0);
    const totalDebit = financeEntries.filter((e) => e.type === "Debit").reduce((s, e) => s + e.amount, 0);
    const totalBalance = config.startingBalance + totalCredit - totalDebit;

    // Splits: Current Balance
    const currentCredit = financeEntries.filter((e) => e.type === "Credit" && (e.account === "Current" || !e.account)).reduce((s, e) => s + e.amount, 0);
    const currentDebit = financeEntries.filter((e) => e.type === "Debit" && (e.account === "Current" || !e.account)).reduce((s, e) => s + e.amount, 0);
    
    const currentTransfersIn = financeEntries.filter((e) => e.type === "Transfer" && e.transferTo === "Current").reduce((s, e) => s + e.amount, 0);
    const currentTransfersOut = financeEntries.filter((e) => e.type === "Transfer" && e.account === "Current").reduce((s, e) => s + e.amount, 0);
    
    const currentBalance = config.startingBalance + currentCredit - currentDebit + currentTransfersIn - currentTransfersOut;

    // Splits: Savings Balance
    const savingsCredit = financeEntries.filter((e) => e.type === "Credit" && e.account === "Savings").reduce((s, e) => s + e.amount, 0);
    const savingsDebit = financeEntries.filter((e) => e.type === "Debit" && e.account === "Savings").reduce((s, e) => s + e.amount, 0);
    
    const savingsTransfersIn = financeEntries.filter((e) => e.type === "Transfer" && e.transferTo === "Savings").reduce((s, e) => s + e.amount, 0);
    const savingsTransfersOut = financeEntries.filter((e) => e.type === "Transfer" && e.account === "Savings").reduce((s, e) => s + e.amount, 0);
    
    const savingsBalance = savingsCredit - savingsDebit + savingsTransfersIn - savingsTransfersOut;

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
      .filter((e) => {
        if (filterAccount === "All") return true;
        if (e.type === "Transfer") {
          return e.account === filterAccount || e.transferTo === filterAccount;
        }
        const acc = e.account || "Current";
        return acc === filterAccount;
      })
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
  }, [financeEntries, filterAccount, filterType, filterMonth, search]);

  /* ─── Filtered Inflow / Outflow Summary calculations ────── */
  const flowSummary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;

    filtered.forEach((e) => {
      const isCredit = e.type === "Credit";
      const isDebit = e.type === "Debit";
      const isTransfer = e.type === "Transfer";

      if (filterAccount === "All") {
        if (isCredit) inflow += e.amount;
        if (isDebit) outflow += e.amount;
      } else {
        if (isTransfer) {
          if (e.transferTo === filterAccount) inflow += e.amount;
          if (e.account === filterAccount) outflow += e.amount;
        } else {
          if (isCredit) inflow += e.amount;
          if (isDebit) outflow += e.amount;
        }
      }
    });

    return { inflow, outflow };
  }, [filtered, filterAccount]);

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
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div>
          <h1 className="text-sm font-black tracking-widest uppercase text-neutral-900 leading-none">
            Ledger & Finance
          </h1>
          <p className="text-[10px] font-semibold text-neutral-450 tracking-wider mt-1.5">Bookkeeping list, splits & cash flow logs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 border border-neutral-200 rounded-lg text-[10px] font-bold text-neutral-600 bg-white hover:bg-neutral-50 transition-all active:scale-95"
          >
            <Settings size={12} />
            Configure
          </button>
          <button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-neutral-950 text-white text-[10px] font-bold rounded-lg hover:bg-black transition-all active:scale-95 shadow-sm"
          >
            <Plus size={12} />
            Add Entry
          </button>
        </div>
      </div>

      {/* ── Compact Stat Cards (Super clean dashboard style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Current Balance", value: fmt(stats.currentBalance) },
          { label: "Savings Balance", value: fmt(stats.savingsBalance) },
          { label: "Ledger Total", value: fmt(stats.totalBalance), highlight: true },
          { label: "Total Inflow", value: `+${fmt(stats.totalCredit)}` },
          { label: "Total Outflow", value: `-${fmt(stats.totalDebit)}` },
        ].map((s) => (
          <div
            key={s.label}
            className={`border border-neutral-150 p-3.5 rounded-lg flex flex-col justify-between ${
              s.highlight ? "bg-neutral-950 text-white border-neutral-950" : "bg-white text-neutral-900"
            }`}
          >
            <span className={`text-[8px] font-bold uppercase tracking-widest ${s.highlight ? "text-neutral-400" : "text-neutral-400"}`}>
              {s.label}
            </span>
            <p className="text-sm font-black mt-1 font-mono leading-none tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Table & Filter Area (Linear-inspired SaaS style) ── */}
      <div className="bg-white rounded-xl border border-neutral-150 shadow-sm overflow-hidden">
        
        {/* Unified Search & Filters Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3.5 p-3.5 bg-neutral-50/50 border-b border-neutral-150">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ledger by description or tags..."
              className="w-full pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 bg-white text-neutral-900 placeholder-neutral-400 transition-all"
            />
          </div>

          {/* Filters Area */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Account Selector Segmented Control */}
            <div className="flex border border-neutral-200 p-0.5 bg-neutral-100/50 rounded-lg">
              {[
                { key: "All" as const, label: "All Accounts" },
                { key: "Current" as const, label: "Current" },
                { key: "Savings" as const, label: "Savings" }
              ].map((acc) => (
                <button
                  key={acc.key}
                  onClick={() => setFilterAccount(acc.key)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                    filterAccount === acc.key
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {acc.label}
                </button>
              ))}
            </div>

            {/* Type Filter Control */}
            <div className="flex border border-neutral-200 p-0.5 bg-neutral-100/50 rounded-lg">
              {(["All", "Credit", "Debit", "Transfer"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                    filterType === t
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-950"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Month select dropdown */}
            <div className="relative border border-neutral-200 bg-white rounded-lg flex items-center pr-7 pl-3 py-1">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="appearance-none text-[10px] font-bold text-neutral-600 bg-transparent focus:outline-none cursor-pointer w-full"
              >
                <option value="all">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-450 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* High-End Ledger Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState onAdd={() => { setEditing(null); setDrawerOpen(true); }} />
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-neutral-150 bg-neutral-50/20 text-[9px] font-bold text-neutral-400 uppercase tracking-widest select-none">
                  <th className="px-6 py-3 w-28 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Description</th>
                  <th className="px-6 py-3 w-32 font-semibold">Category</th>
                  <th className="px-6 py-3 w-40 font-semibold">Account Route</th>
                  <th className="px-6 py-3 w-24 font-semibold">Method</th>
                  <th className="px-6 py-3 w-24 font-semibold text-center">Type</th>
                  <th className="px-6 py-3 w-36 font-semibold text-right">Amount</th>
                  <th className="px-6 py-3 w-20 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs font-semibold text-neutral-900 bg-white">
                {filtered.map((entry) => {
                  const isCredit = entry.type === "Credit";
                  const isTransfer = entry.type === "Transfer";
                  const acc = entry.account || "Current";
                  const toAcc = entry.transferTo || "Current";
                  
                  let transferIndicator: React.ReactNode = null;
                  let customAmountStyle = isCredit ? "text-neutral-950 font-black" : "text-neutral-800 font-bold";
                  let amountPrefix = isTransfer ? "" : isCredit ? "+" : "-";

                  if (filterAccount !== "All" && isTransfer) {
                    if (toAcc === filterAccount) {
                      transferIndicator = (
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-900 border border-neutral-200 px-1 py-0.2 rounded mr-1.5 bg-neutral-50">
                          inflow
                        </span>
                      );
                      amountPrefix = "+";
                      customAmountStyle = "text-neutral-950 font-black";
                    } else if (acc === filterAccount) {
                      transferIndicator = (
                        <span className="text-[8px] uppercase tracking-wider font-semibold text-neutral-400 border border-neutral-150 px-1 py-0.2 rounded mr-1.5 bg-neutral-50/50">
                          outflow
                        </span>
                      );
                      amountPrefix = "-";
                      customAmountStyle = "text-neutral-800 font-bold";
                    }
                  }

                  return (
                    <tr key={entry.id} className="hover:bg-neutral-50/20 transition-colors group">
                      {/* Date */}
                      <td className="px-6 py-3.5 text-neutral-450 font-mono tracking-tight whitespace-nowrap">
                        {entry.date}
                      </td>

                      {/* Description */}
                      <td className="px-6 py-3.5 max-w-xs md:max-w-md truncate">
                        <div className="flex flex-col">
                          <span className="font-bold text-neutral-900 tracking-tight">{entry.description}</span>
                          {entry.tags && (
                            <span className="text-[9px] text-neutral-400 font-normal mt-0.5 tracking-tight font-mono">
                              #{entry.tags.split(",").map(t=>t.trim()).join(" #")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 bg-neutral-50 text-neutral-700 rounded border border-neutral-200 text-[10px] font-bold tracking-tight">
                          {entry.category}
                        </span>
                      </td>

                      {/* Account Route */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {isTransfer ? (
                          <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-tight">
                            <span className={`px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-700 font-mono`}>
                              {acc.toUpperCase()}
                            </span>
                            <ArrowRight size={8} className="text-neutral-400 stroke-[3]" />
                            <span className={`px-1.5 py-0.5 rounded border border-neutral-300 text-neutral-950 font-mono bg-neutral-50`}>
                              {toAcc.toUpperCase()}
                            </span>
                          </div>
                        ) : (
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wider font-mono ${
                            acc === "Savings" 
                              ? "bg-neutral-950 text-white border-neutral-950" 
                              : "bg-white text-neutral-600 border-neutral-200"
                          }`}>
                            {acc.toUpperCase()}
                          </span>
                        )}
                      </td>

                      {/* Method */}
                      <td className="px-6 py-3.5 text-neutral-500 font-bold whitespace-nowrap">
                        {entry.paymentMode}
                      </td>

                      {/* Type Label (Text indicator instead of heavy badges) */}
                      <td className="px-6 py-3.5 text-center whitespace-nowrap select-none">
                        {isTransfer ? (
                          <span className="text-[9px] font-bold text-neutral-400 font-mono tracking-wider uppercase">
                            Transfer
                          </span>
                        ) : (
                          <span className={`text-[9px] font-extrabold font-mono tracking-wider uppercase ${
                            isCredit ? "text-neutral-900" : "text-neutral-400"
                          }`}>
                            {isCredit ? "Credit" : "Debit"}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className={`px-6 py-3.5 text-right font-mono text-xs tracking-tight whitespace-nowrap ${customAmountStyle}`}>
                        <div className="inline-flex items-center justify-end">
                          {transferIndicator}
                          <span className="font-bold">{amountPrefix}{fmt(entry.amount)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-0.5 rounded text-neutral-400 hover:text-neutral-950 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="p-0.5 rounded text-neutral-400 hover:text-neutral-950 transition-colors"
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

        {/* Ledger Summary Stats Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-neutral-150 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50/20 select-none">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
              Ledger Page Summary · {filtered.length} row(s)
            </span>
            <div className="flex items-center gap-3 text-[10px] font-extrabold tracking-tight">
              <div className="flex items-center gap-1.5 bg-white border border-neutral-200 px-2.5 py-1 rounded-md">
                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                  {filterAccount === "All" ? "Inflow" : `${filterAccount} Inflow`}:
                </span>
                <span className="text-neutral-900 font-mono font-bold">
                  +{fmt(flowSummary.inflow)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-neutral-200 px-2.5 py-1 rounded-md">
                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                  {filterAccount === "All" ? "Outflow" : `${filterAccount} Outflow`}:
                </span>
                <span className="text-neutral-700 font-mono font-bold">
                  -{fmt(flowSummary.outflow)}
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
          animation: slide-in-right 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.12s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      `}</style>
    </div>
  );
}
