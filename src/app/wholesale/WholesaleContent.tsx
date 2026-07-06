"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { WholesaleSale, PaymentMode } from "@/lib/types";
import { wholesaleTotal } from "@/lib/wholesale";
import { gsap } from "gsap";
import { Plus, Trash2, Eye, ShoppingCart, IndianRupee, AlertTriangle } from "lucide-react";

/* ─── Tax-invoice seed data (added once, matched by bill no) ─── */
type SeedRow = [billNo: string, date: string, buyer: string, total: number, paid: boolean];
const WHOLESALE_SEED_ROWS: SeedRow[] = [
  ["WHL/2026-27/0028", "2026-06-09", "WEEBERRY", 1440, false],
  ["WHL/2026-27/0027", "2026-06-03", "Tanisha Fashion", 5985, false],
  ["WHL/2026-27/0026", "2026-05-31", "K Creation Kids Wear", 9090, false],
  ["WHL/2026-27/0025", "2026-05-28", "New Good Luck", 1080, false],
  ["WHL/2026-27/0024", "2026-05-24", "Just Kids", 2220, false],
  ["WHL/2026-27/0023", "2026-05-21", "Smart Kid's", 1440, false],
  ["WHL/2026-27/0022", "2026-05-17", "K Creation Kids Wear", 12470, false],
  ["WHL/2026-27/0021", "2026-05-16", "New Good Luck", 2160, false],
  ["WHL/2026-27/0020", "2026-05-15", "Good Luck Kids and Co", 2340, false],
  ["WHL/2026-27/0019", "2026-05-15", "Just Kids", 2130, false],
  ["WHL/2026-27/0018", "2026-05-06", "Little Champs", 8100, false],
  ["WHL/2026-27/0017", "2026-05-06", "Amar Womens And Kids", 1350, false],
  ["WHL/2026-27/0016", "2026-05-02", "Kids City", 16465, false],
  ["WHL/2026-27/0015", "2026-05-02", "Kids Zone", 7300, false],
  ["WHL/2026-27/0014", "2026-04-20", "Amar Womens And Kids", 4860, false],
  ["WHL/2026-27/0013", "2026-04-19", "RASPBERRY FASHION", 600, false],
  ["WHL/2026-27/0012", "2026-04-19", "Good Luck Kids and Co", 2250, true],
  ["WHL/2026-27/0011", "2026-04-17", "Amar Womens And Kids", 2220, false],
  ["WHL/2026-27/0010", "2026-04-17", "Ammy", 635, false],
  ["WHL/2026-27/0009", "2026-04-16", "K Creation Kids Wear", 12240, false],
  ["WHL/2026-27/0008", "2026-04-17", "Dwarka Kids & Ladies", 2520, false],
  ["WHL/2026-27/0007", "2026-04-17", "Shree Balaji Collection", 12600, false],
  ["WHL/2026-27/0006", "2026-04-15", "Kids Zone", 4560, false],
  ["WHL/2026-27/0005", "2026-04-15", "Just Kids", 3420, false],
  ["WHL/2026-27/0004", "2026-04-15", "Naughty Kids", 15720, true],
  ["WHL/2026-27/0003", "2026-04-14", "Ravi Parihar", 335, false],
  ["WHL/2026-27/0002", "2026-04-13", "Shree Gopal Kabra", 1200, true],
  ["WHL/2026-27/0001", "2026-04-03", "Kids City", 720, true],
];
const WHOLESALE_SEED: WholesaleSale[] = WHOLESALE_SEED_ROWS.map(([billNo, date, buyer, total, paid]) => ({
  id: `ws-${billNo.replace(/[^0-9]/g, "")}`,
  date,
  billNo,
  retailerName: buyer,
  phone: "",
  city: "",
  billAmount: total,
  receivedDate: paid ? date : "",
  paymentReceived: paid ? total : 0,
  paymentMode: "UPI" as PaymentMode,
}));

/**
 * Stable identity for a retailer. Prefers the phone number (so two shops with
 * the same name stay separate), but falls back to the normalised name when no
 * phone is recorded — otherwise phone-less records all collapse into one.
 */
function getRetailerKey(w: { phone: string; retailerName: string }): string {
  const phone = (w.phone || "").trim();
  return phone || `name:${(w.retailerName || "").trim().toLowerCase()}`;
}

export default function WholesaleSalesPage() {
  const { wholesaleSales, setWholesaleSales, isReady } = useData();
  const [selectedRetailer, setSelectedRetailer] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const seededRef = useRef(false);

  // Add the tax-invoice data once. Matched by bill no so it never duplicates;
  // if any of these bills already exist we leave the data untouched.
  useEffect(() => {
    if (!isReady || seededRef.current) return;
    seededRef.current = true;
    const existing = new Set(wholesaleSales.map((w) => w.billNo));
    const anyPresent = WHOLESALE_SEED.some((s) => existing.has(s.billNo));
    if (!anyPresent) {
      setWholesaleSales((prev) => [...WHOLESALE_SEED, ...prev]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // Inline "add bill" form state
  const today = new Date().toISOString().split("T")[0];
  const [draft, setDraft] = useState({
    date: today,
    billNo: "",
    retailerName: "",
    billAmount: "",
    receivedDate: "",
    paymentReceived: "",
    paymentMode: "UPI" as PaymentMode,
  });

  const stats = useMemo(() => {
    const orders = wholesaleSales.length;
    let collected = 0;
    let totalValue = 0;
    wholesaleSales.forEach((w) => {
      collected += w.paymentReceived;
      totalValue += wholesaleTotal(w);
    });
    return { orders, collected, outstanding: totalValue - collected };
  }, [wholesaleSales]);

  // Flat list of every invoice, newest first.
  const sortedSales = useMemo(
    () => [...wholesaleSales].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.billNo || "").localeCompare(a.billNo || "")),
    [wholesaleSales]
  );

  const retailers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; phone: string; city: string; orders: number; total: number; outstanding: number }>();
    wholesaleSales.forEach((w) => {
      const orderTotal = wholesaleTotal(w);
      const balance = orderTotal - w.paymentReceived;
      const key = getRetailerKey(w);
      if (!map.has(key)) {
        map.set(key, { key, name: w.retailerName, phone: w.phone, city: w.city, orders: 1, total: orderTotal, outstanding: balance });
      } else {
        const r = map.get(key)!;
        r.orders += 1;
        r.total += orderTotal;
        r.outstanding += balance;
      }
    });
    return Array.from(map.values());
  }, [wholesaleSales]);

  const handleDeleteOrder = (id: string) => {
    const el = document.getElementById(`ws-row-${id}`);
    if (el) {
      gsap.to(el, {
        height: 0, opacity: 0, duration: 0.25, onComplete: () => {
          setWholesaleSales((prev) => prev.filter((s) => s.id !== id));
          setDeletingId(null);
        },
      });
    } else {
      setWholesaleSales((prev) => prev.filter((s) => s.id !== id));
      setDeletingId(null);
    }
  };

  const draftPending = (Number(draft.billAmount) || 0) - (Number(draft.paymentReceived) || 0);
  const canAdd = !!draft.date && !!draft.billNo.trim() && !!draft.retailerName.trim() && Number(draft.billAmount) > 0;

  const handleAddBill = () => {
    if (!canAdd) return;
    const sale: WholesaleSale = {
      id: Date.now().toString(),
      date: draft.date,
      billNo: draft.billNo.trim(),
      retailerName: draft.retailerName.trim(),
      phone: "",
      city: "",
      billAmount: Number(draft.billAmount),
      receivedDate: draft.receivedDate,
      paymentReceived: Number(draft.paymentReceived) || 0,
      paymentMode: draft.paymentMode,
    };
    setWholesaleSales((prev) => [sale, ...prev]);
    setDraft({ date: today, billNo: "", retailerName: "", billAmount: "", receivedDate: "", paymentReceived: "", paymentMode: "UPI" });
  };

  const inputCls = "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-lg px-3 py-2 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-black tracking-tight">Wholesale Sales</h2>
        <p className="text-sm text-[#888] mt-1">{retailers.length} retailers · {stats.orders} orders</p>
      </div>

      <CardGroup>
        <StatCard title="Total Orders" value={stats.orders} icon={ShoppingCart} />
        <StatCard title="Total Collected" value={`₹${stats.collected.toLocaleString("en-IN")}`} icon={IndianRupee} variant="profit" />
        <StatCard title="Outstanding" value={`₹${Math.max(0, stats.outstanding).toLocaleString("en-IN")}`} icon={AlertTriangle} variant={stats.outstanding > 0 ? "loss" : "neutral"} />
      </CardGroup>

      {/* Inline Add Bill */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-[#888]" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">Add Bill</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Bill Date *</label>
            <input type="date" className={inputCls} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Bill No *</label>
            <input type="text" placeholder="WHL/2026-27/0001" className={inputCls} value={draft.billNo} onChange={(e) => setDraft({ ...draft, billNo: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Shop Name *</label>
            <input type="text" placeholder="Shop name" className={inputCls} value={draft.retailerName} onChange={(e) => setDraft({ ...draft, retailerName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Bill Amount (₹) *</label>
            <input type="number" min="0" step="0.01" placeholder="0" className={inputCls} value={draft.billAmount} onChange={(e) => setDraft({ ...draft, billAmount: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Received Date</label>
            <input type="date" className={inputCls} value={draft.receivedDate} onChange={(e) => setDraft({ ...draft, receivedDate: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Received Amount (₹)</label>
            <input type="number" min="0" step="0.01" placeholder="0" className={inputCls} value={draft.paymentReceived} onChange={(e) => setDraft({ ...draft, paymentReceived: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Payment Mode</label>
            <select className={inputCls} value={draft.paymentMode} onChange={(e) => setDraft({ ...draft, paymentMode: e.target.value as PaymentMode })}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="text-sm text-[#888]">
            Pending: <span className="font-bold text-black">₹{draftPending.toLocaleString("en-IN")}</span>
          </div>
          <button
            onClick={handleAddBill}
            disabled={!canAdd}
            className="inline-flex items-center gap-1.5 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Add Bill
          </button>
        </div>
      </div>

      {/* All Invoices — flat list of every bill entry */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-[#e8e8e8] bg-[#fafafa] flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">All Invoices</h3>
          <span className="text-xs font-semibold text-[#888]">{wholesaleSales.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Bill No</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Buyer</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {sortedSales.map((sale) => {
                const total = wholesaleTotal(sale);
                const balance = total - sale.paymentReceived;
                const status = balance <= 0 ? "Paid" : sale.paymentReceived > 0 ? "Partial" : "Pending";
                const statusStyle =
                  status === "Paid"
                    ? { background: "var(--color-profit-bg)", color: "var(--color-profit)", border: "1px solid var(--color-profit-border)" }
                    : status === "Pending"
                    ? { background: "var(--color-loss-bg)", color: "var(--color-loss)", border: "1px solid var(--color-loss-border)" }
                    : { background: "#f0f0f0", color: "#666", border: "1px solid #e0e0e0" };
                return (
                  <tr key={sale.id} id={`ws-row-${sale.id}`} className="hover:bg-[#fafafa] transition-colors relative">
                    <td className="px-5 py-3.5 font-semibold text-black">{sale.billNo || "—"}</td>
                    <td className="px-5 py-3.5 text-[#888]">{sale.date}</td>
                    <td className="px-5 py-3.5 text-black">{sale.retailerName}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-black">₹{total.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={statusStyle}>{status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setDeletingId(sale.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        aria-label="Delete invoice"
                      >
                        <Trash2 size={14} />
                      </button>
                      <ConfirmDelete
                        isOpen={deletingId === sale.id}
                        onConfirm={() => handleDeleteOrder(sale.id)}
                        onCancel={() => setDeletingId(null)}
                      />
                    </td>
                  </tr>
                );
              })}
              {wholesaleSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#888]">No invoices yet. Add a bill above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retailer Directory */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-[#e8e8e8] bg-[#fafafa]">
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">Retailer Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Retailer</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Orders</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Total Billed</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Outstanding</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {retailers.map((r) => {
                const status = r.outstanding <= 0 ? "Paid" : r.outstanding > 10000 ? "Overdue" : "Partial";
                const statusStyle =
                  status === "Paid"
                    ? { background: "var(--color-profit-bg)", color: "var(--color-profit)", border: "1px solid var(--color-profit-border)" }
                    : status === "Overdue"
                    ? { background: "var(--color-loss-bg)", color: "var(--color-loss)", border: "1px solid var(--color-loss-border)" }
                    : { background: "#f0f0f0", color: "#666", border: "1px solid #e0e0e0" };

                return (
                  <tr
                    key={r.key}
                    className="hover:bg-[#fafafa] transition-colors cursor-pointer"
                    onClick={() => setSelectedRetailer(r.key)}
                  >
                    <td className="px-5 py-3.5 font-semibold text-black">{r.name}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-center font-bold">{r.orders}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-right font-bold">₹{r.total.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-right font-bold" style={{ color: r.outstanding > 0 ? "var(--color-loss)" : "var(--color-profit)" }}>₹{Math.max(0, r.outstanding).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={statusStyle}>{status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        onClick={(e) => { e.stopPropagation(); setSelectedRetailer(r.key); }}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {retailers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#888]">
                    No retailers found. Add a bill using the form above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RetailerHistoryDrawer
        isOpen={selectedRetailer !== null}
        onClose={() => { setSelectedRetailer(null); setDeletingId(null); }}
        retailerKey={selectedRetailer}
        sales={wholesaleSales}
        deletingId={deletingId}
        setDeletingId={setDeletingId}
        onDeleteOrder={handleDeleteOrder}
      />
    </div>
  );
}

function RetailerHistoryDrawer({
  isOpen,
  onClose,
  retailerKey,
  sales,
  deletingId,
  setDeletingId,
  onDeleteOrder,
}: {
  isOpen: boolean;
  onClose: () => void;
  retailerKey: string | null;
  sales: WholesaleSale[];
  deletingId: string | null;
  setDeletingId: (id: string | null) => void;
  onDeleteOrder: (id: string) => void;
}) {
  const retailerSales = useMemo(
    () => sales.filter((s) => getRetailerKey(s) === retailerKey),
    [sales, retailerKey]
  );
  const retailerName = retailerSales.length > 0 ? retailerSales[0].retailerName : "Retailer Details";
  const totalBusiness = retailerSales.reduce((a, s) => a + wholesaleTotal(s), 0);
  const totalReceived = retailerSales.reduce((a, s) => a + s.paymentReceived, 0);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={retailerName}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f5f5f5] p-4 rounded-2xl border border-[#e8e8e8]">
            <div className="text-[11px] font-medium text-[#888] uppercase tracking-wider mb-1">Total Billed</div>
            <div className="font-bold text-black">₹{totalBusiness.toLocaleString("en-IN")}</div>
          </div>
          <div className="bg-[#f5f5f5] p-4 rounded-2xl border border-[#e8e8e8]">
            <div className="text-[11px] font-medium text-[#888] uppercase tracking-wider mb-1">Outstanding</div>
            <div className="font-bold text-black">₹{Math.max(0, totalBusiness - totalReceived).toLocaleString("en-IN")}</div>
          </div>
        </div>

        <h3 className="font-bold text-sm uppercase tracking-wider text-[#555] border-b border-[#e8e8e8] pb-2">Order History</h3>
        {retailerSales.map((sale) => {
          const total = wholesaleTotal(sale);
          const balance = total - sale.paymentReceived;
          return (
            <div key={sale.id} id={`ws-row-${sale.id}`} className="border border-[#e8e8e8] rounded-2xl p-4 bg-white relative overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <ConfirmDelete
                isOpen={deletingId === sale.id}
                onConfirm={() => onDeleteOrder(sale.id)}
                onCancel={() => setDeletingId(null)}
              />
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="font-semibold text-sm">{sale.billNo || sale.date}</span>
                  <div className="text-[11px] text-[#888]">
                    Bill: {sale.date}{sale.receivedDate ? ` · Received: ${sale.receivedDate}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#f5f5f5] text-[#666] px-2 py-1 rounded-lg font-bold">{sale.paymentMode}</span>
                  <button
                    onClick={() => setDeletingId(sale.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="pt-3 border-t border-[#f0f0f0] flex justify-between items-end text-sm">
                <div className="text-[#888]">
                  Bill Amount: <span className="font-bold text-black">₹{total.toLocaleString("en-IN")}</span>
                  <br />
                  Received: <span className="text-black">₹{sale.paymentReceived.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] block text-[#888] uppercase tracking-wider">Pending</span>
                  <span className="font-bold" style={{ color: balance > 0 ? "var(--color-loss)" : "var(--color-profit)" }}>
                    ₹{balance.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
