"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { WholesaleSale, WholesaleItem, PaymentMode } from "@/lib/types";
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
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    let orders = wholesaleSales.length;
    let collected = 0;
    let totalValue = 0;
    wholesaleSales.forEach((w) => {
      collected += w.paymentReceived;
      totalValue += w.items.reduce((acc, i) => acc + i.qty * i.rate, 0);
    });
    return { orders, collected, outstanding: totalValue - collected };
  }, [wholesaleSales]);

  const retailers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; phone: string; city: string; orders: number; total: number; outstanding: number }>();
    wholesaleSales.forEach((w) => {
      const orderTotal = w.items.reduce((acc, i) => acc + i.qty * i.rate, 0);
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Wholesale Sales</h2>
          <p className="text-sm text-[#888] mt-1">{retailers.length} retailers · {stats.orders} orders</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          <Plus size={16} />
          Add Order
        </button>
      </div>

      <CardGroup>
        <StatCard title="Total Orders" value={stats.orders} icon={ShoppingCart} />
        <StatCard title="Total Collected" value={`₹${stats.collected.toLocaleString("en-IN")}`} icon={IndianRupee} />
        <StatCard title="Outstanding" value={`₹${Math.max(0, stats.outstanding).toLocaleString("en-IN")}`} icon={AlertTriangle} />
      </CardGroup>

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
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Phone</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">City</th>
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
                    <td className="px-5 py-3.5 text-[#888] font-mono text-xs">{r.phone}</td>
                    <td className="px-5 py-3.5 text-[#888]">{r.city}</td>
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
                  <td colSpan={8} className="px-5 py-12 text-center text-[#888]">
                    No retailers found. Click &quot;+ Add Order&quot; to create a wholesale order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <WholesaleFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={(newSale) => {
          setWholesaleSales((prev) => [newSale, ...prev]);
          setDrawerOpen(false);
        }}
      />

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

function WholesaleFormDrawer({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (sale: WholesaleSale) => void }) {
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<Partial<WholesaleSale>>({
    date: new Date().toISOString().split("T")[0],
    paymentMode: "UPI",
    items: [{ productName: "", qty: 1, rate: 0 }],
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: new Date().toISOString().split("T")[0],
        paymentMode: "UPI",
        items: [{ productName: "", qty: 1, rate: 0 }],
        paymentReceived: 0,
      });
    }
  }, [isOpen]);

  const updateItem = (index: number, field: keyof WholesaleItem, value: string | number) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => setFormData({ ...formData, items: [...(formData.items || []), { productName: "", qty: 1, rate: 0 }] });
  const removeItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const totalValue = (formData.items || []).reduce((acc, i) => acc + i.qty * i.rate, 0);
  const balanceDue = totalValue - (formData.paymentReceived || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.retailerName || !formData.phone || formData.items?.length === 0) {
      if (formRef.current) gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }

    const sale: WholesaleSale = {
      id: Date.now().toString(),
      date: formData.date || "",
      retailerName: formData.retailerName,
      phone: formData.phone,
      city: formData.city || "",
      items: formData.items as WholesaleItem[],
      paymentReceived: Number(formData.paymentReceived || 0),
      paymentMode: formData.paymentMode as PaymentMode,
    };
    onSave(sale);
  };

  const inputCls = "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[13px] font-semibold text-[#555] mb-1.5";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Add Wholesale Order">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" required className={inputCls} value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Retailer Name *</label>
            <input type="text" required className={inputCls} value={formData.retailerName || ""} onChange={(e) => setFormData({ ...formData, retailerName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Phone *</label>
            <input type="text" required className={inputCls} value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input type="text" className={inputCls} value={formData.city || ""} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>
        </div>

        <div className="border border-[#e8e8e8] rounded-2xl p-4 bg-[#fafafa]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-[#555]">Line Items</h3>
            <button type="button" onClick={addItem} className="text-xs flex items-center gap-1 font-bold text-black hover:underline">
              <Plus size={12} /> Add Item
            </button>
          </div>
          {formData.items?.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-end">
              <div className="flex-1">
                <input type="text" placeholder="Product" required className={inputCls} value={item.productName} onChange={(e) => updateItem(idx, "productName", e.target.value)} />
              </div>
              <div className="w-16">
                <input type="number" placeholder="Qty" required min="1" className={inputCls} value={item.qty || ""} onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} />
              </div>
              <div className="w-20">
                <input type="number" placeholder="Rate" required min="0" step="0.01" className={inputCls} value={item.rate || ""} onChange={(e) => updateItem(idx, "rate", Number(e.target.value))} />
              </div>
              {formData.items!.length > 1 && (
                <button type="button" onClick={() => removeItem(idx)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <div className="text-right text-sm font-bold mt-3 pt-2 border-t border-[#e8e8e8]">Total: ₹{totalValue.toLocaleString("en-IN")}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Payment Received (₹)</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={formData.paymentReceived || ""} onChange={(e) => setFormData({ ...formData, paymentReceived: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Payment Mode</label>
            <select className={inputCls} value={formData.paymentMode} onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value as PaymentMode })}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <div className="bg-[#f5f5f5] p-5 rounded-2xl border border-[#e8e8e8] flex justify-between items-center">
          <span className="text-[12px] font-medium text-[#888] uppercase tracking-wider">Balance Due</span>
          <span className={`text-2xl font-bold ${balanceDue > 0 ? "text-[#444]" : "text-black"}`}>
            ₹{balanceDue.toLocaleString("en-IN")}
          </span>
        </div>

        <button type="submit" className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          Save Order
        </button>
      </form>
    </Drawer>
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
  const retailerPhone = retailerSales.length > 0 ? retailerSales[0].phone : "";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={retailerName}>
      <div className="space-y-4">
        <div className="bg-[#f5f5f5] p-4 rounded-2xl border border-[#e8e8e8]">
          <div className="text-[12px] font-medium text-[#888] uppercase tracking-wider mb-1">Phone Number</div>
          <div className="font-bold text-black font-mono">{retailerPhone || "—"}</div>
        </div>

        <h3 className="font-bold text-sm uppercase tracking-wider text-[#555] border-b border-[#e8e8e8] pb-2">Order History</h3>
        {retailerSales.map((sale) => {
          const total = sale.items.reduce((acc, i) => acc + i.qty * i.rate, 0);
          const balance = total - sale.paymentReceived;
          return (
            <div key={sale.id} id={`ws-row-${sale.id}`} className="border border-[#e8e8e8] rounded-2xl p-4 bg-white relative overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <ConfirmDelete
                isOpen={deletingId === sale.id}
                onConfirm={() => onDeleteOrder(sale.id)}
                onCancel={() => setDeletingId(null)}
              />
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-sm">{sale.date}</span>
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
              <ul className="text-sm space-y-1 mb-3">
                {sale.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between text-[#666]">
                    <span>{item.qty}x {item.productName}</span>
                    <span>₹{(item.qty * item.rate).toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-3 border-t border-[#f0f0f0] flex justify-between items-end text-sm">
                <div className="text-[#888]">
                  Total: <span className="font-bold text-black">₹{total.toLocaleString("en-IN")}</span>
                  <br />
                  Paid: <span className="text-black">₹{sale.paymentReceived.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] block text-[#888] uppercase tracking-wider">Balance</span>
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
