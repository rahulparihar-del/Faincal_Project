"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useData } from "@/context/DataContext";
import {
  PersonalFinanceEntry, FinanceConfig, FinanceCategory, FinanceEntryType,
} from "@/lib/types";
import {
  Plus, Edit2, Trash2, X, Settings,
  ChevronDown, Search, ArrowUpRight, ArrowDownLeft, ArrowRight, Star,
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
    <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-gray-200 rounded-xl">
      <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center mb-3">
        <Plus size={16} className="text-gray-400" />
      </div>
      <p className="text-xs font-bold text-gray-900 mb-1">No transactions</p>
      <p className="text-[11px] text-gray-400 mb-4 text-center max-w-xs leading-relaxed">Your ledger is currently empty. Record a new credit, debit, or transfer entry.</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black active:scale-95 transition-all shadow-sm"
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
  isImportant: false,
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
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right border-l border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-900">
              {initial ? "Edit Entry" : "Create Entry"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-250 text-gray-500 hover:text-black hover:bg-gray-50 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Type Toggle */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-gray-100 rounded-lg">
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
                      ? "bg-white text-gray-950 shadow-sm"
                      : "text-gray-500 hover:text-gray-950"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-900">₹</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-gray-900 bg-white text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={form.type === "Transfer" ? "Account transfer description..." : "Zomato, Client payment, Office rent..."}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-gray-900 bg-white text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Date & Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-gray-900 bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Method</label>
              <select
                value={form.paymentMode}
                onChange={(e) => set("paymentMode", e.target.value as PersonalFinanceEntry["paymentMode"])}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-gray-900 bg-white text-gray-900"
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
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">From Account</label>
                <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-gray-100 rounded-lg">
                  {(["Current", "Savings"] as const).map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        set("account", acc);
                        set("transferTo", acc === "Current" ? "Savings" : "Current");
                      }}
                      className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${
                        form.account === acc
                          ? "bg-white text-gray-950 shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">To Account</label>
                <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-gray-100 rounded-lg">
                  {(["Current", "Savings"] as const).map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        set("transferTo", acc);
                        set("account", acc === "Current" ? "Savings" : "Current");
                      }}
                      className={`py-1.5 rounded-md text-[11px] font-bold transition-all ${
                        form.transferTo === acc
                          ? "bg-white text-gray-950 shadow-sm"
                          : "text-gray-500"
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
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Account</label>
              <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-gray-100 rounded-lg">
                {(["Current", "Savings"] as const).map((acc) => (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => set("account", acc)}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                      form.account === acc
                        ? "bg-white text-gray-950 shadow-sm"
                        : "text-gray-500"
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
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => set("category", cat)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all text-left truncate ${
                      form.category === cat
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-black"
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
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Tags</label>
              <input
                type="text"
                value={form.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="work, travel..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-gray-900 bg-white text-gray-950 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Notes</label>
              <input
                type="text"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Memo..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-gray-900 bg-white text-gray-955 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Important Toggle Option */}
          <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                Mark as Important
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5">Highlight and pin this entry in the ledger</span>
            </div>
            <button
              type="button"
              onClick={() => set("isImportant", !form.isImportant)}
              className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 ${
                form.isImportant ? "bg-amber-500" : "bg-gray-200"
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  form.isImportant ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4.5 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 bg-white hover:bg-gray-100 hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-black transition-colors shadow-sm"
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
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 border border-gray-200 animate-fade-in">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-950">Settings</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-gray-250 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-500">
            <X size={13} />
          </button>
        </div>

        {[
          { label: "Starting Balance (Current Account) (₹)", key: "startingBalance" as const, placeholder: "e.g. 50000" },
          { label: "Savings Goal (₹)", key: "savingsGoal" as const, placeholder: "e.g. 100000" },
          { label: "Monthly Budget (₹)", key: "monthlyBudget" as const, placeholder: "e.g. 30000" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-950">₹</span>
              <input
                type="number"
                min={0}
                value={form[key] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                placeholder={placeholder}
                className="w-full pl-6 pr-4 py-2 border border-gray-205 rounded-lg text-xs font-semibold focus:outline-none focus:border-gray-950 bg-white text-gray-950 placeholder-gray-400"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-650 hover:bg-gray-50 hover:text-black transition-colors bg-white">
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-black transition-colors"
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
  const [filterImportant, setFilterImportant] = useState(false);
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
        if (!filterImportant) return true;
        return e.isImportant === true;
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
  }, [financeEntries, filterAccount, filterType, filterMonth, filterImportant, search]);

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
    <div className="w-full space-y-7 px-1 md:px-3 text-gray-900">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 leading-tight">
            Personal Finance Ledger
          </h1>
          <p className="text-xs font-semibold text-gray-400 tracking-wider mt-1">Bookkeeping list, splits & cash flow logs</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <Settings size={14} className="text-gray-400" />
            Configure
          </button>
          <button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all active:scale-95 shadow-md cursor-pointer"
          >
            <Plus size={14} />
            Add Transaction
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Current Balance", value: fmt(stats.currentBalance) },
          { label: "Savings Balance", value: fmt(stats.savingsBalance) },
          { label: "Ledger Total", value: fmt(stats.totalBalance), highlight: true },
          { label: "Total Inflow", value: `+${fmt(stats.totalCredit)}`, textStyle: "text-emerald-600 dark:text-emerald-450" },
          { label: "Total Outflow", value: `-${fmt(stats.totalDebit)}`, textStyle: "text-red-500 dark:text-red-450" },
        ].map((s) => (
          <div
            key={s.label}
            className={`border rounded-xl flex flex-col justify-between p-4.5 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${
              s.highlight
                ? "bg-white text-gray-900 border-gray-900 border-l-4 border-l-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                : "bg-white text-gray-900 border-gray-200"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450">
              {s.label}
            </span>
            <p className={`text-lg md:text-xl font-extrabold mt-2 leading-none tracking-tight font-mono ${s.textStyle || "text-gray-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Table & Filter Area (Linear-inspired SaaS style) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full">
        
        {/* Unified Search & Filters Row (Stack layout to prevent squeeze bugs) */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-200 space-y-3.5">
          {/* Row 1: Full-Width Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, tags, category..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 bg-white text-gray-900 placeholder-gray-400 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
            />
          </div>

          {/* Row 2: Filters toolbar (fully responsive wrapping layout) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            {/* Left side filters (Account & Type Selection) */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Account Selector */}
              <div className="flex border border-gray-200 p-0.5 bg-gray-50 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                {[
                  { key: "All" as const, label: "All Accounts" },
                  { key: "Current" as const, label: "Current" },
                  { key: "Savings" as const, label: "Savings" }
                ].map((acc) => (
                  <button
                    key={acc.key}
                    type="button"
                    onClick={() => setFilterAccount(acc.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      filterAccount === acc.key
                        ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>

              {/* Type Selector */}
              <div className="flex border border-gray-200 p-0.5 bg-gray-50 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                {(["All", "Credit", "Debit", "Transfer"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      filterType === t
                        ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Right side filters (Month selector & Important toggle) */}
            <div className="flex items-center gap-2.5">
              {/* Month Select Dropdown */}
              <div className="relative border border-gray-200 bg-white rounded-lg flex items-center pr-8 pl-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.01)] shrink-0">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="appearance-none -webkit-appearance-none -moz-appearance-none bg-transparent border-none outline-none ring-0 p-0 text-xs font-bold text-gray-700 cursor-pointer focus:ring-0 focus:outline-none"
                >
                  <option value="all">All Months</option>
                  {monthOptions.map((m) => (
                    <option key={m.key} value={m.key} className="bg-white text-gray-900">
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Important Only Toggle Button */}
              <button
                type="button"
                onClick={() => setFilterImportant(!filterImportant)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] shrink-0 ${
                  filterImportant
                    ? "bg-amber-50 text-amber-700 border-amber-250 font-bold"
                    : "bg-white text-gray-500 border-gray-200 hover:text-gray-900"
                }`}
              >
                <Star size={12} className={filterImportant ? "fill-amber-500 text-amber-500" : "text-gray-400"} />
                Important
              </button>
            </div>
          </div>
        </div>

        {/* High-End Ledger Table */}
        <div className="overflow-x-auto w-full">
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState onAdd={() => { setEditing(null); setDrawerOpen(true); }} />
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-auto min-w-[900px] lg:min-w-0">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/20 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
                  <th className="px-6 py-4 w-32 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Description</th>
                  <th className="px-6 py-4 w-36 font-semibold">Category</th>
                  <th className="px-6 py-4 w-44 font-semibold">Account Route</th>
                  <th className="px-6 py-4 w-28 font-semibold">Method</th>
                  <th className="px-6 py-4 w-28 font-semibold text-center">Type</th>
                  <th className="px-6 py-4 w-40 font-semibold text-right">Amount</th>
                  <th className="px-6 py-4 w-24 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-900 bg-white">
                {filtered.map((entry) => {
                  const isCredit = entry.type === "Credit";
                  const isTransfer = entry.type === "Transfer";
                  const acc = entry.account || "Current";
                  const toAcc = entry.transferTo || "Current";
                  const isImp = entry.isImportant === true;
                  
                  let transferIndicator: React.ReactNode = null;
                  let customAmountStyle = isCredit ? "text-emerald-600 font-extrabold" : "text-red-500 font-bold";
                  let amountPrefix = isTransfer ? "" : isCredit ? "+" : "-";

                  if (filterAccount !== "All" && isTransfer) {
                    if (toAcc === filterAccount) {
                      transferIndicator = (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950 px-2 py-0.5 rounded mr-2 bg-emerald-50 dark:bg-emerald-950/30">
                          inflow
                        </span>
                      );
                      amountPrefix = "+";
                      customAmountStyle = "text-emerald-600 font-extrabold";
                    } else if (acc === filterAccount) {
                      transferIndicator = (
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-red-700 dark:text-red-400 border border-red-150 dark:border-red-950 px-2 py-0.5 rounded mr-2 bg-red-50 dark:bg-red-950/30">
                          outflow
                        </span>
                      );
                      amountPrefix = "-";
                      customAmountStyle = "text-red-500 font-bold";
                    }
                  }

                  return (
                    <tr 
                      key={entry.id} 
                      className={`transition-colors group border-l-4 ${
                        isImp 
                          ? "bg-amber-50/25 dark:bg-amber-950/10 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 border-l-amber-500" 
                          : "hover:bg-gray-50/20 dark:hover:bg-gray-800/10 border-l-transparent"
                      }`}
                    >
                      {/* Date */}
                      <td className="px-6 py-4.5 text-gray-400 font-mono tracking-tight whitespace-nowrap text-xs">
                        {entry.date}
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 tracking-tight text-sm flex items-center gap-1.5">
                            {entry.description}
                            {isImp && (
                              <Star size={12} className="text-amber-550 fill-amber-450 flex-shrink-0" />
                            )}
                          </span>
                          {entry.tags && (
                            <span className="text-[10px] text-gray-400 font-normal mt-1 tracking-tight font-mono">
                              #{entry.tags.split(",").map(t=>t.trim()).join(" #")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 bg-gray-50 text-gray-700 rounded border border-gray-200 text-xs font-bold tracking-tight">
                          {entry.category}
                        </span>
                      </td>

                      {/* Account Route */}
                      <td className="px-6 py-4.5 whitespace-nowrap">
                        {isTransfer ? (
                          <div className="flex items-center gap-2 text-[10px] font-bold tracking-tight">
                            <span className="px-2 py-0.5 rounded border border-gray-200 text-gray-700 font-mono">
                              {acc.toUpperCase()}
                            </span>
                            <ArrowRight size={10} className="text-gray-400 stroke-[3]" />
                            <span className="px-2 py-0.5 rounded border border-gray-300 text-gray-950 font-mono bg-gray-55">
                              {toAcc.toUpperCase()}
                            </span>
                          </div>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider font-mono ${
                            acc === "Savings" 
                              ? "bg-gray-900 text-white border-gray-900" 
                              : "bg-white text-gray-600 border-gray-200"
                          }`}>
                            {acc.toUpperCase()}
                          </span>
                        )}
                      </td>

                      {/* Method */}
                      <td className="px-6 py-4.5 text-gray-500 font-bold whitespace-nowrap text-xs">
                        {entry.paymentMode}
                      </td>

                      {/* Type Label */}
                      <td className="px-6 py-4.5 text-center whitespace-nowrap select-none text-xs">
                        {isTransfer ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-gray-200 text-gray-600 bg-gray-50 tracking-wider uppercase font-mono">
                            Transfer
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border tracking-wider uppercase font-mono ${
                            isCredit 
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border-emerald-100 dark:border-emerald-900/30" 
                              : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-450 border-red-100 dark:border-red-900/30"
                          }`}>
                            {isCredit ? "Credit" : "Debit"}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className={`px-6 py-4.5 text-right font-mono text-sm tracking-tight whitespace-nowrap ${
                        isTransfer ? "text-gray-600 font-bold" : customAmountStyle
                      }`}>
                        <div className="inline-flex items-center justify-end">
                          {transferIndicator}
                          <span className="font-extrabold">{amountPrefix}{fmt(entry.amount)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1 rounded text-gray-400 hover:text-gray-900 transition-colors hover:bg-gray-50 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="p-1 rounded text-gray-400 hover:text-gray-900 transition-colors hover:bg-gray-50 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={12} />
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
          <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/20 select-none">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Ledger Summary · {filtered.length} row(s)
            </span>
            <div className="flex items-center gap-3.5 text-xs font-extrabold tracking-tight">
              <div className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-100 px-3 py-1.5 rounded-md">
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider">
                  {filterAccount === "All" ? "Inflow" : `${filterAccount} Inflow`}:
                </span>
                <span className="text-emerald-700 font-mono font-bold">
                  +{fmt(flowSummary.inflow)}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-red-50/50 border border-red-100 px-3 py-1.5 rounded-md">
                <span className="text-[9px] font-bold text-red-600 dark:text-red-450 uppercase tracking-wider">
                  {filterAccount === "All" ? "Outflow" : `${filterAccount} Outflow`}:
                </span>
                <span className="text-red-705 dark:text-red-400 font-mono font-bold">
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
