"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Manufacturer } from "@/lib/types";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Plus, Edit2, Trash2, ChevronDown, Users, Phone, MapPin } from "lucide-react";
/* ─── helpers ─────────────────────────────────────────────── */
function getPurchaseGrandTotal(p: any): number {
  if (p.items && p.items.length > 0) {
    const sub = p.items.reduce((s: number, i: any) => s + i.qty * i.rate, 0);
    const gst = p.gstAmount ?? (sub * (p.gstPercent ?? 0) / 100);
    return sub + gst + (p.transport ?? 0) + (p.localTransport ?? 0) + (p.roundingAmount ?? 0);
  }
  const sub = p.qty * p.rate;
  const gst = p.gstAmount ?? (sub * (p.gstPercent ?? 0) / 100);
  return sub + gst + (p.transport ?? 0) + (p.localTransport ?? 0) + (p.roundingAmount ?? 0);
}

function getPurchaseProductQty(p: any): number {
  if (p.items && p.items.length > 0) {
    return p.items.filter((i: any) => !i.type || i.type === "product").reduce((s: number, i: any) => s + i.qty, 0);
  }
  return p.qty;
}

export default function ManufacturersPage() {
  const { manufacturers, setManufacturers, purchases } = useData();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const mfgStats = useMemo(() => {
    const map = new Map<string, { orders: number; totalAmount: number; pending: number }>();
    purchases.forEach((p) => {
      const amount = getPurchaseGrandTotal(p);
      const paid = p.paymentStatus === "Paid" ? amount : (p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0);
      const pending = amount - paid;
      if (!map.has(p.manufacturerId)) {
        map.set(p.manufacturerId, { orders: 1, totalAmount: amount, pending });
      } else {
        const s = map.get(p.manufacturerId)!;
        s.orders += 1;
        s.totalAmount += amount;
        s.pending += pending;
      }
    });
    return map;
  }, [purchases]);

  const handleDelete = (id: string) => {
    const el = document.getElementById(`mfg-${id}`);
    if (el) {
      gsap.to(el, {
        scale: 0.95,
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
          setManufacturers((prev) => prev.filter((m) => m.id !== id));
          setDeletingId(null);
        },
      });
    } else {
      setManufacturers((prev) => prev.filter((m) => m.id !== id));
      setDeletingId(null);
    }
  };

  const handleEdit = (mfg: Manufacturer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(mfg.id);
    setDrawerOpen(true);
  };

  useGSAP(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll(".mfg-card");
    if (cards.length === 0) return;
    gsap.from(cards, {
      y: 24,
      opacity: 0,
      duration: 0.5,
      stagger: 0.07,
      ease: "power2.out",
    });
  }, { scope: gridRef, dependencies: [manufacturers.length] });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Manufacturers</h2>
          <p className="text-sm text-[#888] mt-1">{manufacturers.length} suppliers</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setDrawerOpen(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          <Plus size={16} />
          Add Manufacturer
        </button>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {manufacturers.map((mfg) => {
          const stats = mfgStats.get(mfg.id) || { orders: 0, totalAmount: 0, pending: 0 };
          return (
            <MfgCard
              key={mfg.id}
              mfg={mfg}
              stats={stats}
              onEdit={(e) => handleEdit(mfg, e)}
              isDeleting={deletingId === mfg.id}
              onDeleteRequest={(e) => { e.stopPropagation(); setDeletingId(mfg.id); }}
              onDeleteConfirm={() => handleDelete(mfg.id)}
              onDeleteCancel={() => setDeletingId(null)}
            />
          );
        })}
        {manufacturers.length === 0 && (
          <div className="col-span-full py-16 text-center text-[#888] bg-white border border-[#e8e8e8] rounded-2xl border-dashed">
            No manufacturers added yet. Click &quot;+ Add Manufacturer&quot; to create one.
          </div>
        )}
      </div>

      <MfgFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingId={editingId}
        onSave={(newMfg) => {
          if (editingId) {
            setManufacturers((prev) => prev.map((m) => (m.id === editingId ? newMfg : m)));
          } else {
            setManufacturers((prev) => [newMfg, ...prev]);
          }
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

function MfgCard({
  mfg,
  stats,
  onEdit,
  isDeleting,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  mfg: Manufacturer;
  stats: { orders: number; totalAmount: number; pending: number };
  onEdit: (e: React.MouseEvent) => void;
  isDeleting: boolean;
  onDeleteRequest: (e: React.MouseEvent) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);
  const { purchases } = useData();

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      gsap.to(contentRef.current, { height: "auto", opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.to(iconRef.current, { rotation: 180, duration: 0.3 });
    } else {
      gsap.to(contentRef.current, { height: 0, opacity: 0, duration: 0.3, ease: "power2.out" });
      gsap.to(iconRef.current, { rotation: 0, duration: 0.3 });
    }
  };

  const mfgPurchases = purchases.filter((p) => p.manufacturerId === mfg.id);

  return (
    <div
      id={`mfg-${mfg.id}`}
      className="mfg-card bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-300 relative"
    >
      <ConfirmDelete
        isOpen={isDeleting}
        onConfirm={onDeleteConfirm}
        onCancel={onDeleteCancel}
        message="Delete manufacturer?"
      />
      <div className="p-5 cursor-pointer hover:bg-[#fafafa] transition-colors" onClick={toggleExpand}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg text-black tracking-tight">{mfg.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-[#888]">
              <span className="flex items-center gap-1"><MapPin size={12} /> {mfg.city}</span>
              <span className="flex items-center gap-1"><Phone size={12} /> {mfg.phone}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors">
              <Edit2 size={14} />
            </button>
            <button onClick={onDeleteRequest} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {mfg.productsSupplied && (
          <div className="text-sm mt-1 mb-4">
            <span className="text-[12px] font-medium text-[#888] uppercase tracking-wider">Products:</span>
            <span className="ml-1 text-[#555]">{mfg.productsSupplied}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 border-t border-[#f0f0f0] pt-4 text-center text-sm">
          <div>
            <div className="text-[11px] text-[#888] uppercase tracking-wider mb-1 font-medium">Orders</div>
            <div className="font-bold text-black">{stats.orders}</div>
          </div>
          <div>
            <div className="text-[11px] text-[#888] uppercase tracking-wider mb-1 font-medium">Total</div>
            <div className="font-bold text-black">₹{stats.totalAmount.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-[11px] text-[#888] uppercase tracking-wider mb-1 font-medium">Pending</div>
            <div className={`font-bold ${stats.pending > 0 ? "text-[#555]" : "text-black"}`}>
              ₹{stats.pending.toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-3 pt-3 border-t border-[#f0f0f0] text-[#ccc]">
          <ChevronDown ref={iconRef} size={18} />
        </div>
      </div>

      {/* Expanded Order History */}
      <div ref={contentRef} className="h-0 opacity-0 overflow-hidden bg-[#fafafa] border-t border-[#e8e8e8]">
        <div className="p-4">
          <h4 className="font-bold text-[12px] text-[#888] uppercase tracking-wider mb-3">Order History</h4>
          {mfgPurchases.length > 0 ? (
            <div className="space-y-2">
              {mfgPurchases.map((p) => {
                const total = getPurchaseGrandTotal(p);
                const prodQty = getPurchaseProductQty(p);
                const itemsList = p.items || [];
                const prodItems = itemsList.filter((i: any) => !i.type || i.type === "product");
                const costItemsCount = itemsList.filter((i: any) => i.type === "cost").length;

                return (
                  <div key={p.id} className="bg-white p-3 rounded-xl border border-[#e8e8e8] text-sm flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-black">
                        {itemsList.length > 1 ? (
                          <span>
                            {prodItems.length} product{prodItems.length !== 1 ? "s" : ""}
                            {costItemsCount > 0 && (
                              <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">
                                +{costItemsCount} cost{costItemsCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </span>
                        ) : (
                          p.productName
                        )}
                        <span className="text-[#888] font-normal"> ({prodQty} units)</span>
                      </div>
                      <div className="text-xs text-[#888] mt-1">{p.date} · {p.orderType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-black">₹{total.toLocaleString("en-IN")}</div>
                      <div className={`text-xs font-bold mt-1 ${p.paymentStatus === "Paid" ? "text-black" : "text-[#888]"}`}>
                        {p.paymentStatus}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-[#888] text-center py-4">No orders placed yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MfgFormDrawer({
  isOpen,
  onClose,
  editingId,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (m: Manufacturer) => void;
}) {
  const { manufacturers } = useData();
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<Partial<Manufacturer>>({});

  useEffect(() => {
    if (isOpen && editingId) {
      const mfg = manufacturers.find((m) => m.id === editingId);
      if (mfg) setFormData(mfg);
    } else if (isOpen) {
      setFormData({ city: "Tiruppur" });
    }
  }, [isOpen, editingId, manufacturers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      if (formRef.current) gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }

    const mfg: Manufacturer = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      city: formData.city || "",
      phone: formData.phone,
      productsSupplied: formData.productsSupplied || "",
      notes: formData.notes || "",
    };
    onSave(mfg);
  };

  const inputCls = "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[13px] font-semibold text-[#555] mb-1.5";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editingId ? "Edit Manufacturer" : "Add Manufacturer"}>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className={labelCls}>Company / Name *</label>
          <input type="text" required className={inputCls} value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone *</label>
            <input type="text" required className={inputCls} value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <select className={inputCls} value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}>
              <option value="Tiruppur">Tiruppur</option>
              <option value="Delhi">Delhi</option>
              <option value="Kolkata">Kolkata</option>
              <option value="Jaipur">Jaipur</option>
              <option value="Surat">Surat</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Ahmedabad">Ahmedabad</option>
              <option value="Bangalore">Bangalore</option>
              <option value="Chennai">Chennai</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Products Supplied</label>
          <input type="text" placeholder="e.g. Cotton T-shirts, Denim Jackets" className={inputCls} value={formData.productsSupplied || ""} onChange={(e) => setFormData({ ...formData, productsSupplied: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea rows={3} className={`${inputCls} resize-none`} value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </div>

        <button type="submit" className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          {editingId ? "Update Manufacturer" : "Save Manufacturer"}
        </button>
      </form>
    </Drawer>
  );
}
