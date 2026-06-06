"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { PurchaseOrder, OrderType, PaymentStatus, ShipmentStatus } from "@/lib/types";
import { gsap } from "gsap";
import { Plus, Edit2, Trash2, Package, IndianRupee, FlaskConical, Boxes } from "lucide-react";

export default function PurchaseOrdersPage() {
  const { purchases, setPurchases, manufacturers } = useData();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let thisMonth = 0,
      sampleCosts = 0,
      bulkCosts = 0,
      pending = 0;

    purchases.forEach((p) => {
      const d = new Date(p.date);
      const val = p.qty * p.rate;
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        thisMonth += val;
      }
      if (p.orderType === "Sample") sampleCosts += val;
      if (p.orderType === "Bulk") bulkCosts += val;
      if (p.paymentStatus !== "Paid") pending += val;
    });
    return { thisMonth, sampleCosts, bulkCosts, pending };
  }, [purchases]);

  const advanceShipment = (p: PurchaseOrder, elId: string) => {
    const sequence: ShipmentStatus[] = ["Ordered", "Shipped", "Delivered"];
    const currentIndex = sequence.indexOf(p.shipmentStatus);
    if (currentIndex >= sequence.length - 1) return;

    const nextStatus = sequence[currentIndex + 1];
    const el = document.getElementById(elId);

    if (el) {
      gsap.to(el, {
        rotationX: 90,
        duration: 0.15,
        onComplete: () => {
          setPurchases((prev) =>
            prev.map((item) =>
              item.id === p.id ? { ...item, shipmentStatus: nextStatus } : item
            )
          );
          gsap.fromTo(el, { rotationX: -90 }, { rotationX: 0, duration: 0.15 });
        },
      });
    } else {
      setPurchases((prev) =>
        prev.map((item) =>
          item.id === p.id ? { ...item, shipmentStatus: nextStatus } : item
        )
      );
    }
  };

  const handleDelete = (id: string) => {
    const el = document.getElementById(`po-row-${id}`);
    if (el) {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.25,
        onComplete: () => {
          setPurchases((prev) => prev.filter((p) => p.id !== id));
          setDeletingId(null);
        },
      });
    } else {
      setPurchases((prev) => prev.filter((p) => p.id !== id));
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Purchase Orders</h2>
          <p className="text-sm text-[#888] mt-1">{purchases.length} orders</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setDrawerOpen(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          <Plus size={16} />
          Add Purchase
        </button>
      </div>

      <CardGroup>
        <StatCard title="This Month" value={`₹${stats.thisMonth.toLocaleString("en-IN")}`} icon={Package} />
        <StatCard title="Sample Costs" value={`₹${stats.sampleCosts.toLocaleString("en-IN")}`} icon={FlaskConical} />
        <StatCard title="Bulk Costs" value={`₹${stats.bulkCosts.toLocaleString("en-IN")}`} icon={Boxes} />
        <StatCard title="Pending Payments" value={`₹${stats.pending.toLocaleString("en-IN")}`} icon={IndianRupee} variant="loss" />
      </CardGroup>

      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#fafafa] border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Manufacturer</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Product</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Type</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Total</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Payment</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Shipment</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {purchases.map((p) => {
                const mfgName = manufacturers.find((m) => m.id === p.manufacturerId)?.name || "Unknown";
                const total = p.qty * p.rate;
                return (
                  <tr
                    key={p.id}
                    id={`po-row-${p.id}`}
                    className="hover:bg-[#fafafa] transition-colors relative"
                  >
                    <td className="px-5 py-3.5 text-[#888]">{p.date}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 font-semibold text-black">{mfgName}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{p.productName}</span>
                        {/* Mobile Order Type tag */}
                        <span
                          className={`lg:hidden px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            p.orderType === "Sample"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-black text-white"
                          }`}
                        >
                          {p.orderType === "Sample" ? "★ Sample" : "Bulk"}
                        </span>
                      </div>
                      <div className="text-xs text-[#888]">{p.qty} × ₹{p.rate.toLocaleString("en-IN")}</div>
                      {/* Manufacturer shown as sub-line on mobile */}
                      <div className="lg:hidden text-xs text-[#aaa] mt-0.5">{mfgName}</div>
                    </td>
                    <td className="hidden lg:table-cell px-5 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          p.orderType === "Sample"
                            ? "bg-[#f0f0f0] text-[#555]"
                            : "bg-black text-white"
                        }`}
                      >
                        {p.orderType === "Sample" ? "★ Sample" : "Bulk"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold">₹{total.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{
                          background: p.paymentStatus === "Paid"
                            ? "var(--color-profit-bg)"
                            : p.paymentStatus === "Partial"
                            ? "#f0f0f0"
                            : "var(--color-loss-bg)",
                          color: p.paymentStatus === "Paid"
                            ? "var(--color-profit)"
                            : p.paymentStatus === "Partial"
                            ? "#555"
                            : "var(--color-loss)",
                          border: p.paymentStatus === "Paid"
                            ? "1px solid var(--color-profit-border)"
                            : p.paymentStatus === "Partial"
                            ? "1px solid #e0e0e0"
                            : "1px solid var(--color-loss-border)",
                        }}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        id={`ship-badge-${p.id}`}
                        onClick={() => advanceShipment(p, `ship-badge-${p.id}`)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-block"
                        style={{
                          background: p.shipmentStatus === "Delivered"
                            ? "var(--color-profit-bg)"
                            : p.shipmentStatus === "Shipped"
                            ? "#e0e0e0"
                            : "#ffffff",
                          color: p.shipmentStatus === "Delivered"
                            ? "var(--color-profit)"
                            : p.shipmentStatus === "Shipped"
                            ? "#444"
                            : "#888",
                          border: p.shipmentStatus === "Delivered"
                            ? "1px solid var(--color-profit-border)"
                            : p.shipmentStatus === "Shipped"
                            ? "1px solid #e0e0e0"
                            : "1px solid #e0e0e0",
                        }}
                        title={p.shipmentStatus !== "Delivered" ? "Click to advance" : ""}
                      >
                        {p.shipmentStatus}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 relative">
                        <ConfirmDelete
                          isOpen={deletingId === p.id}
                          onConfirm={() => handleDelete(p.id)}
                          onCancel={() => setDeletingId(null)}
                        />
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setDrawerOpen(true);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(p.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[#888]">
                    No purchase orders yet. Click &quot;+ Add Purchase&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PurchaseFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingId={editingId}
        onSave={(newPo) => {
          if (editingId) {
            setPurchases((prev) => prev.map((p) => (p.id === editingId ? newPo : p)));
          } else {
            setPurchases((prev) => [newPo, ...prev]);
          }
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

function PurchaseFormDrawer({
  isOpen,
  onClose,
  editingId,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (po: PurchaseOrder) => void;
}) {
  const { purchases, manufacturers } = useData();
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    date: new Date().toISOString().split("T")[0],
    orderType: "Sample",
    paymentStatus: "Pending",
    shipmentStatus: "Ordered",
  });

  useEffect(() => {
    if (isOpen && editingId) {
      const po = purchases.find((p) => p.id === editingId);
      if (po) setFormData(po);
    } else if (isOpen) {
      setFormData({
        date: new Date().toISOString().split("T")[0],
        orderType: "Sample",
        paymentStatus: "Pending",
        shipmentStatus: "Ordered",
        manufacturerId: manufacturers.length > 0 ? manufacturers[0].id : "",
      });
    }
  }, [isOpen, editingId, purchases, manufacturers]);

  const totalValue = (formData.qty || 0) * (formData.rate || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.manufacturerId || !formData.productName || !formData.qty || formData.rate === undefined) {
      if (formRef.current)
        gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }

    const po: PurchaseOrder = {
      id: editingId || Date.now().toString(),
      date: formData.date || "",
      manufacturerId: formData.manufacturerId,
      orderType: formData.orderType as OrderType,
      productName: formData.productName,
      qty: Number(formData.qty),
      rate: Number(formData.rate),
      paymentStatus: formData.paymentStatus as PaymentStatus,
      paymentDate: formData.paymentDate || "",
      shipmentStatus: formData.shipmentStatus as ShipmentStatus,
      expectedDelivery: formData.expectedDelivery || "",
      actualReceiptDate: formData.actualReceiptDate || "",
      notes: formData.notes || "",
      gst: formData.gst || "",
    };
    onSave(po);
  };

  const inputCls =
    "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[13px] font-semibold text-[#555] mb-1.5";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editingId ? "Edit Purchase Order" : "Add Purchase Order"}>
      {manufacturers.length === 0 ? (
        <div className="p-5 bg-[#f5f5f5] border border-[#e8e8e8] rounded-2xl text-sm text-[#666]">
          Please add a manufacturer in the Manufacturers tab first.
        </div>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" required className={inputCls} value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Manufacturer *</label>
            <select required className={inputCls} value={formData.manufacturerId || ""} onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}>
              <option value="" disabled>Select Manufacturer</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Order Type</label>
              <select className={inputCls} value={formData.orderType} onChange={(e) => setFormData({ ...formData, orderType: e.target.value as OrderType })}>
                <option value="Sample">★ Sample</option>
                <option value="Bulk">Bulk</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Product Name *</label>
              <input type="text" required className={inputCls} value={formData.productName || ""} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Qty *</label>
              <input type="number" required min="1" className={inputCls} value={formData.qty || ""} onChange={(e) => setFormData({ ...formData, qty: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Rate/Unit (₹) *</label>
              <input type="number" required min="0" step="0.01" className={inputCls} value={formData.rate || ""} onChange={(e) => setFormData({ ...formData, rate: Number(e.target.value) })} />
            </div>
          </div>

          <div className="bg-[#f5f5f5] p-5 rounded-2xl border border-[#e8e8e8] flex justify-between items-center">
            <span className="text-[12px] font-medium text-[#888] uppercase tracking-wider">Total Value</span>
            <span className="text-2xl font-bold">₹{totalValue.toLocaleString("en-IN")}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Payment Status</label>
              <select className={inputCls} value={formData.paymentStatus} onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as PaymentStatus })}>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment Date</label>
              <input type="date" className={inputCls} value={formData.paymentDate || ""} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Shipment Status</label>
              <select className={inputCls} value={formData.shipmentStatus} onChange={(e) => setFormData({ ...formData, shipmentStatus: e.target.value as ShipmentStatus })}>
                <option value="Ordered">Ordered</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Expected Delivery</label>
              <input type="date" className={inputCls} value={formData.expectedDelivery || ""} onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Actual Receipt</label>
              <input type="date" className={inputCls} value={formData.actualReceiptDate || ""} onChange={(e) => setFormData({ ...formData, actualReceiptDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>GST (Optional)</label>
            <input type="text" className={inputCls} value={formData.gst || ""} onChange={(e) => setFormData({ ...formData, gst: e.target.value })} />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>

          <button type="submit" className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            {editingId ? "Update Order" : "Save Order"}
          </button>
        </form>
      )}
    </Drawer>
  );
}
