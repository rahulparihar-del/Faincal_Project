"use client";

import React, { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { WholesaleSale, PaymentMode } from "@/lib/types";
import { wholesaleTotal } from "@/lib/wholesale";
import { gsap } from "gsap";
import { Plus, Trash2, Eye, ShoppingCart, IndianRupee, AlertTriangle } from "lucide-react";

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
  const { wholesaleSales, setWholesaleSales } = useData();
  const [selectedRetailer, setSelectedRetailer] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    let orders = wholesaleSales.length;
    let collected = 0;
    let totalValue = 0;
    wholesaleSales.forEach((w) => {
      collected += w.paymentReceived;
      totalValue += wholesaleTotal(w);
    });
    return { orders, collected, outstanding: totalValue - collected };
  }, [wholesaleSales]);

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
        <StatCard title="Total Collected" value={`₹${stats.collected.toLocaleString("en-IN")}`} icon={IndianRupee} />
        <StatCard title="Outstanding" value={`₹${Math.max(0, stats.outstanding).toLocaleString("en-IN")}`} icon={AlertTriangle} />
      </CardGroup>

      {/* Inline Add Bill */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-[#888]" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">Add Bill</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Orders</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Total Billed</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Outstanding</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {retailers.map((r) => {
                const status = r.outstanding <= 0 ? "Paid" : r.outstanding > 10000 ? "Overdue" : "Partial";
                const statusClass =
                  status === "Paid"
                    ? "bg-black text-white"
                    : status === "Overdue"
                    ? "bg-[#f0f0f0] text-[#444]"
                    : "border border-[#e0e0e0] text-[#666] bg-white";

                return (
                  <tr
                    key={r.key}
                    className="hover:bg-[#fafafa] transition-colors cursor-pointer"
                    onClick={() => setSelectedRetailer(r.key)}
                  >
                    <td className="px-5 py-3.5 font-semibold text-black">{r.name}</td>
                    <td className="px-5 py-3.5 text-center font-bold">{r.orders}</td>
                    <td className="px-5 py-3.5 text-right font-bold">₹{r.total.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-right font-bold">₹{Math.max(0, r.outstanding).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${statusClass}`}>{status}</span>
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
                  <span className={`font-bold ${balance > 0 ? "text-[#444]" : "text-black"}`}>
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
