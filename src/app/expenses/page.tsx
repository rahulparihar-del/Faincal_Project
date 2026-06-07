"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { BusinessExpense, ExpenseCategory, PaymentMode } from "@/lib/types";
import { gsap } from "gsap";
import {
  Plus, Edit2, Trash2, Receipt, Monitor, Package,
  Wrench, Wifi, Megaphone, Truck, FileCode, MoreHorizontal, X
} from "lucide-react";

/* ─── Category config ────────────────────────────────────────── */
const CATEGORIES: { value: ExpenseCategory; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: "Equipment & Electronics", label: "Equipment & Electronics", icon: Monitor,      color: "#4f46e5", bg: "#eef2ff" },
  { value: "Packaging & Supplies",    label: "Packaging & Supplies",    icon: Package,      color: "#0891b2", bg: "#ecfeff" },
  { value: "Office & Furniture",      label: "Office & Furniture",      icon: Receipt,      color: "#7c3aed", bg: "#f5f3ff" },
  { value: "Marketing & Advertising", label: "Marketing & Advertising", icon: Megaphone,    color: "#db2777", bg: "#fdf2f8" },
  { value: "Shipping & Logistics",    label: "Shipping & Logistics",    icon: Truck,        color: "#d97706", bg: "#fffbeb" },
  { value: "Software & Subscriptions",label: "Software & Subscriptions",icon: FileCode,     color: "#059669", bg: "#ecfdf5" },
  { value: "Utilities & Internet",    label: "Utilities & Internet",    icon: Wifi,         color: "#0284c7", bg: "#f0f9ff" },
  { value: "Repairs & Maintenance",   label: "Repairs & Maintenance",   icon: Wrench,       color: "#ea580c", bg: "#fff7ed" },
  { value: "Other Business Expense",  label: "Other Business Expense",  icon: MoreHorizontal,color:"#6b7280", bg: "#f9fafb" },
];

const PLATFORMS = ["Amazon", "Flipkart", "Meesho", "Ecom General", "Wholesale", "All Platforms", "N/A"];
const PAYMENT_MODES: PaymentMode[] = ["Cash", "UPI", "Bank Transfer"];

function getCategoryMeta(cat: ExpenseCategory) {
  return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function ExpensesPage() {
  const { businessExpenses, setBusinessExpenses } = useData();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<ExpenseCategory | "All">("All");

  /* ── Stats ── */
  const stats = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth(), cy = now.getFullYear();
    let thisMonth = 0, totalSpend = 0, equipmentSpend = 0, packagingSpend = 0;

    businessExpenses.forEach((e) => {
      const val = e.quantity * e.unitCost;
      totalSpend += val;
      const d = new Date(e.date);
      if (d.getMonth() === cm && d.getFullYear() === cy) thisMonth += val;
      if (e.category === "Equipment & Electronics") equipmentSpend += val;
      if (e.category === "Packaging & Supplies") packagingSpend += val;
    });
    return { thisMonth, totalSpend, equipmentSpend, packagingSpend };
  }, [businessExpenses]);

  /* ── Category breakdown for mini chart ── */
  const categoryBreakdown = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    businessExpenses.forEach((e) => {
      const val = e.quantity * e.unitCost;
      map.set(e.category, (map.get(e.category) ?? 0) + val);
    });
    return Array.from(map.entries())
      .map(([cat, total]) => ({ cat, total, meta: getCategoryMeta(cat) }))
      .sort((a, b) => b.total - a.total);
  }, [businessExpenses]);

  const maxCat = categoryBreakdown[0]?.total ?? 1;

  /* ── Filtered list ── */
  const filtered = useMemo(() =>
    filterCat === "All"
      ? businessExpenses
      : businessExpenses.filter((e) => e.category === filterCat),
    [businessExpenses, filterCat]
  );

  const handleDelete = (id: string) => {
    const el = document.getElementById(`exp-row-${id}`);
    if (el) {
      gsap.to(el, {
        height: 0, opacity: 0, duration: 0.25,
        onComplete: () => { setBusinessExpenses((prev) => prev.filter((e) => e.id !== id)); setDeletingId(null); },
      });
    } else {
      setBusinessExpenses((prev) => prev.filter((e) => e.id !== id));
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Business Expenses</h2>
          <p className="text-sm text-[#888] mt-1">{businessExpenses.length} expense records</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>

      {/* Stat cards */}
      <CardGroup>
        <StatCard title="This Month" value={`₹${stats.thisMonth.toLocaleString("en-IN")}`} icon={Receipt} />
        <StatCard title="Total Spend" value={`₹${stats.totalSpend.toLocaleString("en-IN")}`} icon={Receipt} variant="loss" />
        <StatCard title="Equipment" value={`₹${stats.equipmentSpend.toLocaleString("en-IN")}`} icon={Monitor} />
        <StatCard title="Packaging" value={`₹${stats.packagingSpend.toLocaleString("en-IN")}`} icon={Package} />
      </CardGroup>

      {/* Category breakdown bar */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[12px] font-semibold text-[#888] uppercase tracking-wider mb-4">Spend by Category</h3>
          <div className="space-y-3">
            {categoryBreakdown.map(({ cat, total, meta }) => {
              const pct = maxCat > 0 ? (total / maxCat) * 100 : 0;
              const Icon = meta.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCat(filterCat === cat ? "All" : cat)}
                  className={`w-full flex items-center gap-3 group text-left transition-all rounded-xl px-2 py-1 -mx-2 -my-1 ${filterCat === cat ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"}`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: meta.bg }}
                  >
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[13px] font-medium text-black">{cat}</span>
                      <span className="text-[13px] font-bold text-black">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: meta.color }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filterCat !== "All" && (
            <button
              onClick={() => setFilterCat("All")}
              className="mt-3 text-[12px] font-semibold text-[#888] hover:text-black transition-colors flex items-center gap-1"
            >
              <X size={11} /> Clear filter
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Filter pills */}
        <div className="px-5 pt-4 pb-3 border-b border-[#f0f0f0] flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat("All")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterCat === "All" ? "bg-black text-white" : "bg-[#f5f5f5] text-[#555] hover:bg-[#eee]"}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCat(filterCat === c.value ? "All" : c.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterCat === c.value ? "text-white" : "bg-[#f5f5f5] text-[#555] hover:bg-[#eee]"}`}
              style={filterCat === c.value ? { background: c.color } : {}}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#fafafa] border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Category</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Item</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Vendor</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Platform</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Amount</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Payment</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filtered.map((e) => {
                const meta = getCategoryMeta(e.category);
                const Icon = meta.icon;
                const amount = e.quantity * e.unitCost;
                return (
                  <tr
                    key={e.id}
                    id={`exp-row-${e.id}`}
                    className="hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[#888]">{e.date}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: meta.bg }}
                        >
                          <Icon size={13} style={{ color: meta.color }} />
                        </div>
                        <span className="text-xs font-semibold hidden lg:block" style={{ color: meta.color }}>
                          {e.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-black">{e.itemName}</div>
                      <div className="text-xs text-[#888] mt-0.5">
                        {e.quantity} × ₹{e.unitCost.toLocaleString("en-IN")}
                        {e.vendor && <span className="lg:hidden"> · {e.vendor}</span>}
                      </div>
                      <div className="lg:hidden text-xs mt-0.5">
                        <span className="text-xs font-semibold" style={{ color: meta.color }}>{e.category}</span>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-[#555]">{e.vendor || "—"}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-center">
                      {e.platform && e.platform !== "N/A" ? (
                        <span className="px-2 py-0.5 bg-[#f0f0f0] text-[#555] rounded-md text-xs font-semibold">{e.platform}</span>
                      ) : (
                        <span className="text-[#ccc]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="font-bold text-black">₹{(amount + (e.gstAmount ?? 0)).toLocaleString("en-IN")}</div>
                      {(e.gstPercent ?? 0) > 0 && (
                        <div className="text-[11px] text-[#888] mt-0.5">
                          ₹{amount.toLocaleString("en-IN")} + {e.gstPercent}% GST
                        </div>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f5f5f5] text-[#555]">
                        {e.paymentMode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 relative">
                        <ConfirmDelete
                          isOpen={deletingId === e.id}
                          onConfirm={() => handleDelete(e.id)}
                          onCancel={() => setDeletingId(null)}
                        />
                        <button
                          onClick={() => { setEditingId(e.id); setDrawerOpen(true); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(e.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[#888]">
                    {filterCat === "All"
                      ? "No expenses yet. Click \"+ Add Expense\" to record one."
                      : `No expenses in "${filterCat}".`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals footer */}
      {filtered.length > 0 && (
        <div className="flex justify-end">
          <div className="bg-black text-white px-6 py-3 rounded-xl flex items-center gap-4">
            <span className="text-[12px] font-medium uppercase tracking-wider opacity-60">
              {filterCat === "All" ? "Total Spend" : filterCat} ({filtered.length} items)
            </span>
            <span className="text-lg font-bold">
              ₹{filtered.reduce((s, e) => s + e.quantity * e.unitCost + (e.gstAmount ?? 0), 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      <ExpenseFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingId={editingId}
        onSave={(exp) => {
          if (editingId) {
            setBusinessExpenses((prev) => prev.map((e) => (e.id === editingId ? exp : e)));
          } else {
            setBusinessExpenses((prev) => [exp, ...prev]);
          }
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Expense Form Drawer
───────────────────────────────────────────────────────────── */

const GST_RATE = 5;

const DEFAULT_FORM: Omit<BusinessExpense, "id"> = {
  date: new Date().toISOString().split("T")[0],
  category: "Equipment & Electronics",
  itemName: "",
  quantity: 1,
  unitCost: 0,
  vendor: "",
  paymentMode: "UPI",
  notes: "",
  gstPercent: GST_RATE,
  gstAmount: 0,
  platform: "N/A",
};

function ExpenseFormDrawer({
  isOpen,
  onClose,
  editingId,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (exp: BusinessExpense) => void;
}) {
  const { businessExpenses } = useData();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Omit<BusinessExpense, "id">>({ ...DEFAULT_FORM });
  const [applyGst, setApplyGst] = useState(true);
  const [gstPercent, setGstPercent] = useState(GST_RATE);

  useEffect(() => {
    if (isOpen && editingId) {
      const exp = businessExpenses.find((e) => e.id === editingId);
      if (exp) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = exp;
        setForm(rest);
        setApplyGst((exp.gstPercent ?? 0) > 0);
        setGstPercent((exp.gstPercent ?? 0) > 0 ? (exp.gstPercent ?? GST_RATE) : GST_RATE);
      }
    } else if (isOpen) {
      setForm({ ...DEFAULT_FORM, date: new Date().toISOString().split("T")[0] });
      setApplyGst(true);
      setGstPercent(GST_RATE);
    }
  }, [isOpen, editingId, businessExpenses]);

  const totalAmount = form.quantity * form.unitCost;
  const gstAmt = applyGst ? Math.round(totalAmount * gstPercent / 100 * 100) / 100 : 0;
  const grandTotal = totalAmount + gstAmt;
  const showPlatform = form.category === "Packaging & Supplies" || form.category === "Marketing & Advertising" || form.category === "Shipping & Logistics";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemName.trim() || form.unitCost <= 0) {
      if (formRef.current)
        gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }
    const gstPct = applyGst ? gstPercent : 0;
    const sub = form.quantity * form.unitCost;
    const computedGst = Math.round(sub * gstPct / 100 * 100) / 100;
    onSave({ id: editingId || Date.now().toString(), ...form, gstPercent: gstPct, gstAmount: computedGst });
  };

  const inputCls = "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[13px] font-semibold text-[#555] mb-1.5";

  const activeMeta = getCategoryMeta(form.category);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editingId ? "Edit Expense" : "Add Expense"}>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Date */}
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" required className={inputCls} value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>

        {/* Category — visual grid picker */}
        <div>
          <label className={labelCls}>Category *</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const isSelected = form.category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: c.value })}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                    isSelected
                      ? "border-black bg-black text-white"
                      : "border-[#e8e8e8] bg-[#f9f9f9] text-[#555] hover:border-[#ccc]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-[10px] font-semibold leading-tight">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Item name */}
        <div>
          <label className={labelCls}>Item / Description *</label>
          <input
            type="text"
            required
            placeholder={
              form.category === "Equipment & Electronics"
                ? "e.g. Dell Monitor 24 inch"
                : form.category === "Packaging & Supplies"
                ? "e.g. Poly Bag 10×14 inch (500 pcs)"
                : "Describe the expense..."
            }
            className={inputCls}
            value={form.itemName}
            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
          />
        </div>

        {/* Qty + Unit Cost */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Quantity *</label>
            <input
              type="number" required min="1"
              className={inputCls}
              value={form.quantity || ""}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls}>Unit Cost (₹) *</label>
            <input
              type="number" required min="0" step="0.01"
              className={inputCls}
              value={form.unitCost || ""}
              onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Total */}
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: activeMeta.color + "40" }}
        >
          {/* Subtotal row */}
          <div className="px-4 py-3 flex justify-between items-center" style={{ background: activeMeta.bg }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: activeMeta.color + "99" }}>Subtotal</span>
            <span className="font-semibold" style={{ color: activeMeta.color }}>₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>

          {/* GST Toggle */}
          <div className="px-4 py-3 bg-[#f9f9f9] border-t" style={{ borderColor: activeMeta.color + "25" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-black">Apply GST</div>
                <div className="text-[11px] text-[#888]">Tax on this expense</div>
              </div>
              <button
                type="button"
                onClick={() => setApplyGst((v) => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${applyGst ? "bg-black" : "bg-[#ddd]"}`}
                role="switch" aria-checked={applyGst}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${applyGst ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
            {applyGst && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[#555]">Rate:</span>
                <div className="flex gap-2">
                  {[5, 12, 18, 28].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setGstPercent(r)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${gstPercent === r ? "bg-black text-white" : "bg-[#eee] text-[#555] hover:bg-[#e0e0e0]"}`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="px-4 py-3 bg-black text-white flex justify-between items-center">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider opacity-50">Grand Total</div>
              {applyGst && <div className="text-[10px] opacity-40 mt-0.5">{form.quantity} × ₹{form.unitCost.toLocaleString("en-IN")} + {gstPercent}% GST</div>}
            </div>
            <span className="text-2xl font-bold">₹{grandTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Vendor */}
        <div>
          <label className={labelCls}>Vendor / Source</label>
          <input
            type="text"
            placeholder="e.g. Amazon, Local Market, Daraz..."
            className={inputCls}
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          />
        </div>

        {/* Platform — only for Packaging / Marketing / Logistics */}
        {showPlatform && (
          <div>
            <label className={labelCls}>Platform (for this expense)</label>
            <select
              className={inputCls}
              value={form.platform || "N/A"}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        {/* Payment Mode */}
        <div>
          <label className={labelCls}>Payment Mode</label>
          <select
            className={inputCls}
            value={form.paymentMode}
            onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}
          >
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            rows={2}
            className={`${inputCls} resize-none`}
            placeholder="Any extra details..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          {editingId ? "Update Expense" : "Save Expense"}
        </button>
      </form>
    </Drawer>
  );
}
