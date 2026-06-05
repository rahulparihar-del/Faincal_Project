"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EcomSale, Platform } from "@/lib/types";
import { gsap } from "gsap";
import { Plus, Edit2, Trash2, ShoppingBag, TrendingUp, Receipt, PackageX, Filter } from "lucide-react";

const PLATFORMS: Platform[] = ["Amazon", "Flipkart", "Meesho", "Other"];

export default function EcomSales() {
  const { ecomSales, setEcomSales } = useData();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [platformFilter, setPlatformFilter] = useState<Platform | "All">("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const stats = useMemo(() => {
    let gross = 0, commission = 0, adSpend = 0, returns = 0, net = 0;
    ecomSales.forEach((s) => {
      gross += s.sellingPrice;
      commission += (s.sellingPrice * s.commissionPercent) / 100;
      adSpend += s.adSpend;
      if (s.isRTO) {
        returns += s.rtoLossAmount;
        net -= s.rtoLossAmount;
      } else {
        net += s.netPayout;
      }
    });
    return { gross, commission, adSpend, returns, net };
  }, [ecomSales]);

  const filteredSales = useMemo(() => {
    return ecomSales.filter((s) => {
      if (platformFilter !== "All" && s.platform !== platformFilter) return false;
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      return true;
    });
  }, [ecomSales, platformFilter, dateFrom, dateTo]);

  const handleDelete = (id: string) => {
    const el = document.getElementById(`row-${id}`);
    if (el) {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.25,
        onComplete: () => {
          setEcomSales((prev) => prev.filter((s) => s.id !== id));
          setDeletingId(null);
        },
      });
    } else {
      setEcomSales((prev) => prev.filter((s) => s.id !== id));
      setDeletingId(null);
    }
  };

  const handleEdit = (sale: EcomSale) => {
    setEditingId(sale.id);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">E-commerce Sales</h2>
          <p className="text-sm text-[#888] mt-1">{ecomSales.length} total orders</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setDrawerOpen(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          <Plus size={16} />
          Add Sale
        </button>
      </div>

      <CardGroup>
        <StatCard title="Gross Revenue" value={`₹${stats.gross.toLocaleString("en-IN")}`} icon={ShoppingBag} />
        <StatCard title="Net Profit" value={`₹${stats.net.toLocaleString("en-IN")}`} icon={TrendingUp} />
        <StatCard title="Total Deductions" value={`₹${(stats.commission + stats.adSpend).toLocaleString("en-IN")}`} icon={Receipt} />
        <StatCard title="RTO Losses" value={`₹${stats.returns.toLocaleString("en-IN")}`} icon={PackageX} />
      </CardGroup>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#e8e8e8] p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <Filter size={16} className="text-[#888] shrink-0 mt-1 sm:mt-0" />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as Platform | "All")}
          className="bg-[#f5f5f5] border-0 rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="All">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#f5f5f5] border-0 rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
          />
          <span className="text-[#888] text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#f5f5f5] border-0 rounded-lg px-3 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        {(platformFilter !== "All" || dateFrom || dateTo) && (
          <button
            onClick={() => { setPlatformFilter("All"); setDateFrom(""); setDateTo(""); }}
            className="text-xs font-bold text-[#888] hover:text-black transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#fafafa] border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Platform</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Order ID</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Product</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Selling Price</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Net Payout</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  id={`row-${sale.id}`}
                  className="hover:bg-[#fafafa] transition-colors relative group"
                >
                  <td className="px-5 py-3.5 text-[#888]">{sale.date}</td>
                  <td className="px-5 py-3.5 font-semibold text-black">{sale.platform}</td>
                  <td className="px-5 py-3.5 text-[#888] font-mono text-xs">{sale.orderId}</td>
                  <td className="px-5 py-3.5 text-black">{sale.productName}</td>
                  <td className="px-5 py-3.5 text-right">₹{sale.sellingPrice.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5 text-right font-bold">₹{sale.netPayout.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5 text-center">
                    {sale.isRTO ? (
                      <span className="bg-[#f0f0f0] text-[#666] px-2.5 py-1 rounded-lg text-xs font-bold">RTO</span>
                    ) : (
                      <span className="bg-black text-white px-2.5 py-1 rounded-lg text-xs font-bold">Delivered</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(sale)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingId(sale.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ConfirmDelete
                      isOpen={deletingId === sale.id}
                      onConfirm={() => handleDelete(sale.id)}
                      onCancel={() => setDeletingId(null)}
                    />
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[#888]">
                    No sales recorded yet. Click &quot;+ Add Sale&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EcomFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingId={editingId}
        onSave={(newSale) => {
          if (editingId) {
            setEcomSales((prev) => prev.map((s) => (s.id === editingId ? newSale : s)));
          } else {
            setEcomSales((prev) => [newSale, ...prev]);
          }
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

function EcomFormDrawer({
  isOpen,
  onClose,
  editingId,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (sale: EcomSale) => void;
}) {
  const { ecomSales } = useData();
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<Partial<EcomSale>>({
    platform: "Amazon",
    isRTO: false,
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (isOpen && editingId) {
      const sale = ecomSales.find((s) => s.id === editingId);
      if (sale) setFormData(sale);
    } else if (isOpen) {
      setFormData({
        platform: "Amazon",
        isRTO: false,
        date: new Date().toISOString().split("T")[0],
        sellingPrice: 0,
        commissionPercent: 0,
        adSpend: 0,
        rtoLossAmount: 0,
      });
    }
  }, [isOpen, editingId, ecomSales]);

  const calculateNet = () => {
    const sp = formData.sellingPrice || 0;
    const cp = formData.commissionPercent || 0;
    const ad = formData.adSpend || 0;
    const commAmt = (sp * cp) / 100;
    return sp - commAmt - ad;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orderId || !formData.productName || formData.sellingPrice === undefined) {
      if (formRef.current)
        gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }

    const sale: EcomSale = {
      id: editingId || Date.now().toString(),
      date: formData.date || "",
      platform: formData.platform as Platform,
      orderId: formData.orderId,
      productName: formData.productName,
      sellingPrice: Number(formData.sellingPrice),
      commissionPercent: Number(formData.commissionPercent || 0),
      adSpend: Number(formData.adSpend || 0),
      isRTO: !!formData.isRTO,
      rtoLossAmount: !!formData.isRTO ? Number(formData.rtoLossAmount || 0) : 0,
      netPayout: !!formData.isRTO ? 0 : calculateNet(),
    };
    onSave(sale);
  };

  const inputCls = "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[13px] font-semibold text-[#555] mb-1.5";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editingId ? "Edit Sale" : "Add Sale"}>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" required className={inputCls} value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Platform *</label>
          <select className={inputCls} value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value as Platform })}>
            <option value="Amazon">Amazon</option>
            <option value="Flipkart">Flipkart</option>
            <option value="Meesho">Meesho</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Order ID *</label>
          <input type="text" required className={inputCls} value={formData.orderId || ""} onChange={(e) => setFormData({ ...formData, orderId: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Product Name *</label>
          <input type="text" required className={inputCls} value={formData.productName || ""} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Selling Price (₹) *</label>
            <input type="number" required min="0" step="0.01" className={inputCls} value={formData.sellingPrice || ""} onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Commission %</label>
            <input type="number" min="0" max="100" step="0.1" className={inputCls} value={formData.commissionPercent || ""} onChange={(e) => setFormData({ ...formData, commissionPercent: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Ad Spend (₹)</label>
          <input type="number" min="0" step="0.01" className={inputCls} value={formData.adSpend || ""} onChange={(e) => setFormData({ ...formData, adSpend: Number(e.target.value) })} />
        </div>

        <div className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            id="isRTO"
            className="w-4 h-4 rounded border-[#e0e0e0] accent-black"
            checked={formData.isRTO}
            onChange={(e) => setFormData({ ...formData, isRTO: e.target.checked })}
          />
          <label htmlFor="isRTO" className="text-sm font-semibold text-[#444]">
            Order was RTO / Returned
          </label>
        </div>

        {formData.isRTO && (
          <div>
            <label className={labelCls}>RTO Loss Amount (₹) *</label>
            <input type="number" required min="0" step="0.01" className={inputCls} value={formData.rtoLossAmount || ""} onChange={(e) => setFormData({ ...formData, rtoLossAmount: Number(e.target.value) })} />
          </div>
        )}

        {!formData.isRTO && (
          <div className="bg-[#f5f5f5] p-5 rounded-2xl border border-[#e8e8e8]">
            <span className="text-[12px] font-medium text-[#888] uppercase tracking-wider block mb-1">Auto-calculated Net Payout</span>
            <span className="text-2xl font-bold text-black">₹{calculateNet().toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          {editingId ? "Update Sale" : "Save Sale"}
        </button>
      </form>
    </Drawer>
  );
}
