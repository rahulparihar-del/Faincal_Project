"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";
import { Manufacturer, PurchaseOrder, PurchaseItem } from "@/lib/types";
import { gsap } from "gsap";
import {
  ArrowLeft, Edit2, Save, X, Phone, MapPin, Package,
  CheckCircle2, Clock, Truck, FileText, ChevronDown, ChevronLeft, ChevronRight,
  IndianRupee, ShoppingBag, AlertCircle, Upload, Eye, Tag, Calculator,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────── */
function getItems(p: PurchaseOrder): PurchaseItem[] {
  if (p.items && p.items.length > 0) return p.items;
  return [{ productName: p.productName, qty: p.qty, rate: p.rate }];
}
function isCostItem(item: PurchaseItem): boolean {
  if (item.type === "cost") return true;
  if (item.type === "product") return false;
  // Fallback to name analysis for legacy data/untyped rows
  const name = (item.productName || "").toLowerCase();
  const costKeywords = ["charge", "fusing", "fushing", "stitching", "packing", "labour", "transport", "freight", "delivery"];
  return costKeywords.some(keyword => name.includes(keyword));
}

function getCostCategoryByName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("fusing") || n.includes("fushing")) return "Fusing";
  if (n.includes("stitching")) return "Stitching";
  if (n.includes("packing")) return "Packing";
  if (n.includes("labour")) return "Labour";
  if (n.includes("transport") || n.includes("freight") || n.includes("delivery")) {
    if (n.includes("local")) return "Local Transport";
    return "Supplier Transport";
  }
  return "Other";
}

function getProductItems(items: PurchaseItem[]): PurchaseItem[] {
  return items.filter(i => !isCostItem(i));
}
function getCostItems(items: PurchaseItem[]): PurchaseItem[] {
  return items.filter(i => isCostItem(i));
}
function getSubtotal(p: PurchaseOrder): number {
  return getItems(p).reduce((s, i) => s + i.qty * i.rate, 0);
}
function getGrandTotal(p: PurchaseOrder): number {
  const sub = getSubtotal(p);
  const gst = p.gstAmount ?? (sub * (p.gstPercent ?? 0) / 100);
  return sub + gst + (p.transport ?? 0) + (p.localTransport ?? 0) + (p.roundingAmount ?? 0);
}

interface LandedBreakdown {
  productRows: { item: PurchaseItem; itemValue: number; allocated: number; landedTotal: number; landedPerUnit: number }[];
  costRows: PurchaseItem[];
  totalProductValue: number;
  costItemsTotal: number;
  transportTotal: number;
  totalAdditionalCosts: number;
  totalLandedValue: number;
  hasAdditionalCosts: boolean;
  totalInventoryQty: number;
  pooledAdditionalCosts: { name: string; amount: number; isShared: boolean; category?: string }[];
}
function getLandedBreakdown(p: PurchaseOrder, allPurchases: PurchaseOrder[] = []): LandedBreakdown {
  const allItems = getItems(p);
  const productItems = getProductItems(allItems);
  const costItems = getCostItems(allItems);
  
  // Find all purchase orders from the same manufacturer on the same date that participate in sharing
  const otherPurchases = allPurchases.filter(po => po.id !== p.id);
  const relatedPos = p.shareCosts === false
    ? [p]
    : [
        p,
        ...otherPurchases.filter(po =>
          po.manufacturerId &&
          p.manufacturerId &&
          po.manufacturerId === p.manufacturerId &&
          po.date === p.date &&
          po.shareCosts !== false &&
          (po.shareWithBillId === "all" || !po.shareWithBillId || po.shareWithBillId === p.id) &&
          (p.shareWithBillId === "all" || !p.shareWithBillId || p.shareWithBillId === po.id)
        )
      ];
  
  // Calculate combined values across all related bills
  let combinedProductValue = 0;
  let pooledTransportCosts = 0;
  const pooledAdditionalCosts: { name: string; amount: number; isShared: boolean; category?: string }[] = [];
  
  // 1. Direct cost items (only from the current PO)
  costItems.forEach(item => {
    pooledAdditionalCosts.push({
      name: item.productName || "Cost item",
      amount: item.qty * item.rate,
      isShared: false,
      category: item.costCategory,
    });
  });

  // 2. Accumulate values across all related bills
  relatedPos.forEach(po => {
    const isCurrentPo = po.id === p.id;
    const poItems = getItems(po);
    const poProducts = getProductItems(poItems);
    
    combinedProductValue += poProducts.reduce((s, i) => s + i.qty * i.rate, 0);
    pooledTransportCosts += (po.transport ?? 0) + (po.localTransport ?? 0);
    
    // Add transport costs to the pooled array
    if (po.transport && po.transport > 0) {
      pooledAdditionalCosts.push({
        name: "Supplier Transport",
        amount: po.transport,
        isShared: !isCurrentPo,
      });
    }
    if (po.localTransport && po.localTransport > 0) {
      pooledAdditionalCosts.push({
        name: "Local Transport",
        amount: po.localTransport,
        isShared: !isCurrentPo,
      });
    }
  });
  
  const totalProductValue = productItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const costItemsTotal = costItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const transportTotal = (p.transport ?? 0) + (p.localTransport ?? 0);
  const totalInventoryQty = productItems.reduce((s, i) => s + i.qty, 0);
  
  // Allocate direct costs to p's products, and transport costs across all related products
  const productRows = productItems.map(item => {
    const itemValue = item.qty * item.rate;
    
    // Direct cost allocation
    const directAllocated = totalProductValue > 0 ? (itemValue / totalProductValue) * costItemsTotal : 0;
    
    // Transport cost allocation (proportional to combined product value)
    const transportAllocated = combinedProductValue > 0 ? (itemValue / combinedProductValue) * pooledTransportCosts : 0;
    
    const allocated = directAllocated + transportAllocated;
    const landedTotal = itemValue + allocated;
    const landedPerUnit = item.qty > 0 ? landedTotal / item.qty : 0;
    return { item, itemValue, allocated, landedTotal, landedPerUnit };
  });
  
  // Calculate the share of additional costs that this PO receives
  const totalAllocatedToThisPo = productRows.reduce((s, r) => s + r.allocated, 0);
  
  return {
    productRows,
    costRows: costItems,
    totalProductValue,
    costItemsTotal,
    transportTotal,
    totalAdditionalCosts: totalAllocatedToThisPo,
    totalLandedValue: totalProductValue + totalAllocatedToThisPo,
    hasAdditionalCosts: pooledAdditionalCosts.length > 0,
    totalInventoryQty,
    pooledAdditionalCosts,
  };
}

function getPoAttachments(p: PurchaseOrder): { url: string; filename: string }[] {
  const attachments: { url: string; filename: string }[] = [];
  if (p.billPdf) {
    attachments.push({ url: p.billPdf, filename: p.billPdfName || "Bill.pdf" });
  }
  if (p.txnImages && p.txnImages.length > 0) {
    p.txnImages.forEach((img, idx) => {
      attachments.push({
        url: img,
        filename: p.txnImageNames?.[idx] || `Receipt ${idx + 1}`,
      });
    });
  } else if (p.txnImage) {
    attachments.push({
      url: p.txnImage,
      filename: p.txnImageName || "Receipt.png",
    });
  }
  if (p.localTxnImages && p.localTxnImages.length > 0) {
    p.localTxnImages.forEach((img, idx) => {
      attachments.push({
        url: img,
        filename: p.localTxnImageNames?.[idx] || `Local Transport ${idx + 1}`,
      });
    });
  }
  return attachments;
}

const CITIES = [
  "Tiruppur","Delhi","Kolkata","Jaipur","Surat",
  "Mumbai","Ahmedabad","Bangalore","Chennai","Hyderabad","Other",
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function ManufacturerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const { manufacturers, setManufacturers, purchases } = useData();
  const mfg = manufacturers.find((m) => m.id === id);

  /* edit state */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Manufacturer>>({});
  const [saved, setSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{
    files: { url: string; filename: string }[];
    activeIndex: number;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mfg) setDraft(mfg);
  }, [mfg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (headerRef.current) {
      gsap.from(headerRef.current, { y: -16, opacity: 0, duration: 0.4, ease: "power2.out" });
    }
  }, []);

  const mfgPurchases = useMemo(
    () => purchases.filter((p) => p.manufacturerId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [purchases, id]
  );

  const stats = useMemo(() => {
    let totalSpend = 0, pending = 0, paid = 0;
    mfgPurchases.forEach((p) => {
      const val = getGrandTotal(p);
      totalSpend += val;
      const pPaid = p.paymentStatus === "Paid" ? val : (p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0);
      paid += pPaid;
      pending += (val - pPaid);
    });
    return { totalSpend, pending, paid, orders: mfgPurchases.length };
  }, [mfgPurchases]);

  const handleSave = () => {
    if (!draft.name?.trim() || !draft.phone?.trim()) {
      if (formRef.current)
        gsap.fromTo(formRef.current, { x: -6 }, { x: 0, ease: "elastic.out(1,0.3)", duration: 0.5, clearProps: "x" });
      return;
    }
    const updated: Manufacturer = {
      id,
      name: draft.name!,
      city: draft.city || "",
      phone: draft.phone!,
      productsSupplied: draft.productsSupplied || "",
      notes: draft.notes || "",
    };
    setManufacturers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCancel = () => {
    if (mfg) setDraft(mfg);
    setEditing(false);
  };

  if (!mfg) {
    return (
      <div className="space-y-6">
        <Link href="/purchases" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#888] hover:text-black transition-colors">
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-16 text-center text-[#888]">
          <AlertCircle size={32} className="mx-auto mb-3 opacity-30" />
          Manufacturer not found.
        </div>
      </div>
    );
  }

  const inputCls = "w-full bg-white border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors disabled:bg-[#f8f8f8] disabled:text-[#888] disabled:cursor-default";
  const labelCls = "block text-[11px] font-bold text-[#aaa] uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <PdfViewerModal
          files={viewingPdf.files}
          initialActiveIndex={viewingPdf.activeIndex}
          onClose={() => setViewingPdf(null)}
        />
      )}

      {/* ── Back + header ── */}
      <div ref={headerRef}>
        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#888] hover:text-black transition-colors mb-4 group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Purchases
        </button>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-black tracking-tight leading-tight">{mfg.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-[#888]">
              <span className="flex items-center gap-1.5"><MapPin size={13} />{mfg.city || "—"}</span>
              <span className="flex items-center gap-1.5"><Phone size={13} />{mfg.phone}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                <CheckCircle2 size={14} /> Saved
              </span>
            )}
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[#555] bg-[#f0f0f0] hover:bg-[#e8e8e8] transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-black hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                >
                  <Save size={14} /> Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-black bg-[#f0f0f0] hover:bg-[#e8e8e8] transition-colors"
              >
                <Edit2 size={14} /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: stats.orders, icon: ShoppingBag, color: "text-black" },
          { label: "Total Spend", value: `₹${stats.totalSpend.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-black" },
          { label: "Paid", value: `₹${stats.paid.toLocaleString("en-IN")}`, icon: CheckCircle2, color: "text-green-600" },
          { label: "Pending", value: `₹${stats.pending.toLocaleString("en-IN")}`, icon: Clock, color: stats.pending > 0 ? "text-red-500" : "text-black" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={15} className={`${color} opacity-70`} />
              <span className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Manufacturer details (editable) ── */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[13px] font-bold text-[#555] uppercase tracking-wider">Manufacturer Details</h2>
          {editing && (
            <span className="text-[11px] text-[#aaa] font-medium bg-[#f5f5f5] px-2.5 py-1 rounded-lg">Editing…</span>
          )}
        </div>

        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Name */}
            <div className="md:col-span-2">
              <label className={labelCls}>Company / Name *</label>
              <input
                className={inputCls}
                value={draft.name || ""}
                disabled={!editing}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Company name"
              />
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>Phone *</label>
              <input
                className={inputCls}
                value={draft.phone || ""}
                disabled={!editing}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>

            {/* City */}
            <div>
              <label className={labelCls}>City</label>
              {editing ? (
                <select
                  className={inputCls}
                  value={draft.city || ""}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                >
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input className={inputCls} value={draft.city || "—"} disabled />
              )}
            </div>

            {/* Products supplied */}
            <div className="md:col-span-2">
              <label className={labelCls}>Products Supplied</label>
              <input
                className={inputCls}
                value={draft.productsSupplied || ""}
                disabled={!editing}
                onChange={(e) => setDraft({ ...draft, productsSupplied: e.target.value })}
                placeholder="e.g. Cotton T-shirts, Hooded Towels"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                rows={3}
                className={`${inputCls} resize-none`}
                value={draft.notes || ""}
                disabled={!editing}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Any notes about this manufacturer…"
              />
            </div>
          </div>

          {editing && (
            <div className="flex gap-3 mt-5 pt-5 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#555] bg-[#f0f0f0] hover:bg-[#e8e8e8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-black hover:bg-[#1a1a1a] transition-colors"
              >
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ── Purchase History ── */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-6 py-4 border-b border-[#e8e8e8] bg-[#fafafa] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={15} className="text-[#888]" />
            <h2 className="text-[13px] font-bold text-[#555] uppercase tracking-wider">Purchase History</h2>
          </div>
          <span className="text-xs font-semibold text-[#888] bg-[#f0f0f0] px-2.5 py-1 rounded-lg">
            {mfgPurchases.length} order{mfgPurchases.length !== 1 ? "s" : ""}
          </span>
        </div>

        {mfgPurchases.length === 0 ? (
          <div className="px-6 py-16 text-center text-[#aaa]">
            <ShoppingBag size={32} className="mx-auto mb-3 opacity-20" />
            No purchase orders from this manufacturer yet.
          </div>
        ) : (
          <div className="divide-y divide-[#f5f5f5] mobile-responsive-list">
            {mfgPurchases.map((p) => {
              const items = getItems(p);
              const subtotal = getSubtotal(p);
              const gstPct = p.gstPercent ?? 0;
              const gstAmt = p.gstAmount ?? Math.round(subtotal * gstPct / 100 * 100) / 100;
              const transport = p.transport ?? 0;
              const localTransport = p.localTransport ?? 0;
              const rounding = p.roundingAmount ?? 0;
              const grandTotal = subtotal + gstAmt + transport + localTransport + rounding;
              const isMulti = items.length > 1;
              const isExpanded = expandedId === p.id;

              return (
                <div key={p.id}>
                  {/* Main row */}
                  <div
                    className="px-6 py-4 hover:bg-[#fafafa] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Expand chevron */}
                      <div className="w-5 h-5 flex items-center justify-center text-[#ccc] shrink-0">
                        {isMulti ? (
                          isExpanded ? <ChevronDown size={15} className="text-[#888]" /> : <ChevronRight size={15} />
                        ) : null}
                      </div>

                      {/* Date */}
                      <div className="text-sm text-[#888] w-24 shrink-0">{p.date}</div>

                      {/* Items */}
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const prodItems = getProductItems(items);
                          const costItemsInList = getCostItems(items);
                          return isMulti ? (
                            <div>
                              <div className="font-semibold text-black text-sm">
                                {prodItems.length} product{prodItems.length !== 1 ? "s" : ""}
                                {costItemsInList.length > 0 && (
                                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">
                                    +{costItemsInList.length} cost{costItemsInList.length !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#aaa] mt-0.5 truncate">
                                {prodItems.map(i => i.productName).join(" · ").slice(0, 50)}
                                {prodItems.map(i => i.productName).join(" · ").length > 50 ? "…" : ""}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-black text-sm">{items[0].productName}</div>
                              <div className="text-xs text-[#aaa] mt-0.5">{items[0].qty} × ₹{items[0].rate.toLocaleString("en-IN")}</div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Type badge */}
                      <span className={`hidden sm:block px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${p.orderType === "Sample" ? "bg-[#f0f0f0] text-[#555]" : "bg-black text-white"}`}>
                        {p.orderType === "Sample" ? "★ Sample" : "Bulk"}
                      </span>

                      {/* Total */}
                      <div className="text-right shrink-0">
                        <div className="font-bold text-black text-sm">₹{grandTotal.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-[#aaa] mt-0.5">
                          {gstPct > 0 && <span>+{gstPct}% GST</span>}
                          {(transport > 0 || localTransport > 0) && (
                            <span>
                              {gstPct > 0 ? " · " : ""}
                              {transport > 0 && localTransport > 0
                                ? "+2 Transports"
                                : transport > 0
                                ? "+Supplier Trans"
                                : "+Local Trans"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status badges */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0 w-24">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                          style={{
                            background: p.paymentStatus === "Paid" ? "var(--color-profit-bg)" : p.paymentStatus === "Partial" ? "#f0f0f0" : "var(--color-loss-bg)",
                            color: p.paymentStatus === "Paid" ? "var(--color-profit)" : p.paymentStatus === "Partial" ? "#555" : "var(--color-loss)",
                            border: p.paymentStatus === "Paid" ? "1px solid var(--color-profit-border)" : p.paymentStatus === "Partial" ? "1px solid #e0e0e0" : "1px solid var(--color-loss-border)",
                          }}
                        >
                          {p.paymentStatus}
                        </span>
                        {p.paymentStatus === "Partial" && (
                          <span className="text-[9px] text-[#888] font-medium">
                            ₹{(p.paidAmount ?? 0).toLocaleString("en-IN")} paid
                          </span>
                        )}
                        <span className="text-[10px] text-[#bbb] flex items-center gap-1 mt-0.5">
                          <Truck size={9} />{p.shipmentStatus}
                        </span>
                      </div>

                      {/* Bill / Receipt icons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.billPdf && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const files = getPoAttachments(p);
                              const idx = files.findIndex((f) => f.url === p.billPdf);
                              setViewingPdf({ files, activeIndex: idx !== -1 ? idx : 0 });
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                            title={p.billPdfName || "View Bill"}
                          >
                            <FileText size={12} />
                          </button>
                        )}
                        {p.txnImages && p.txnImages.length > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const files = getPoAttachments(p);
                              const firstReceiptUrl = p.txnImages![0];
                              const activeIdx = files.findIndex((f) => f.url === firstReceiptUrl);
                              setViewingPdf({ files, activeIndex: activeIdx !== -1 ? activeIdx : 0 });
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer relative"
                            title={`View Receipts (${p.txnImages.length})`}
                          >
                            <Eye size={12} />
                            {p.txnImages.length > 1 && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center border border-white">
                                {p.txnImages.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          p.txnImage ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const files = getPoAttachments(p);
                                const idx = files.findIndex((f) => f.url === p.txnImage);
                                setViewingPdf({ files, activeIndex: idx !== -1 ? idx : 0 });
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                              title={p.txnImageName || "View Receipt"}
                            >
                              <Eye size={12} />
                            </button>
                          ) : null
                        )}
                        {/* Local Transport Receipts badge */}
                        {p.localTxnImages && p.localTxnImages.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const files = getPoAttachments(p);
                              const firstLocalUrl = p.localTxnImages![0];
                              const activeIdx = files.findIndex((f) => f.url === firstLocalUrl);
                              setViewingPdf({ files, activeIndex: activeIdx !== -1 ? activeIdx : 0 });
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-50 text-orange-400 hover:text-orange-600 hover:bg-orange-100 transition-colors cursor-pointer relative"
                            title={`Local Transport Receipts (${p.localTxnImages.length})`}
                          >
                            <Truck size={12} />
                            {p.localTxnImages.length > 1 && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center border border-white">
                                {p.localTxnImages.length}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded breakdown */}
                  {isMulti && isExpanded && (() => {
                    const lc = getLandedBreakdown(p, purchases);
                    const prodItems = getProductItems(items);
                    const extraCostItems = getCostItems(items);
                    return (
                      <div className="px-6 lg:px-16 pb-6 pt-4 bg-[#fafafa] border-t border-[#f0f0f0] space-y-4">
                        {/* ── Products table ── */}
                        <div>
                          <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Package size={11} /> Inventory Products
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[11px] font-semibold text-[#999] uppercase tracking-wider border-b border-[#eee]">
                                <th className="pb-1.5 text-left w-7">#</th>
                                <th className="pb-1.5 text-left">Product</th>
                                <th className="pb-1.5 text-right">Qty</th>
                                <th className="pb-1.5 text-right">Rate</th>
                                <th className="pb-1.5 text-right">Value</th>
                                {lc.hasAdditionalCosts && <th className="pb-1.5 text-right text-amber-600">Alloc. Cost</th>}
                                {lc.hasAdditionalCosts && <th className="pb-1.5 text-right text-green-700">Landed/Unit</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0f0f0]">
                              {lc.productRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-white/60">
                                  <td className="py-2 text-[#bbb] text-xs">{idx + 1}</td>
                                  <td className="py-2 font-medium text-black">{row.item.productName}</td>
                                  <td className="py-2 text-right text-[#555]">{row.item.qty.toLocaleString("en-IN")}</td>
                                  <td className="py-2 text-right text-[#555]">₹{row.item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                                  <td className="py-2 text-right font-semibold">₹{row.itemValue.toLocaleString("en-IN")}</td>
                                  {lc.hasAdditionalCosts && (
                                    <td className="py-2 text-right text-amber-700 font-medium text-xs">+₹{row.allocated.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                                  )}
                                  {lc.hasAdditionalCosts && (
                                    <td className="py-2 text-right font-bold text-green-700">₹{row.landedPerUnit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                                  )}
                                </tr>
                              ))}
                              {/* Product subtotal */}
                              {prodItems.length > 0 && (
                                <tr className="border-t border-[#e8e8e8] text-[#888]">
                                  <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">Product Subtotal</td>
                                  <td className="py-1.5 text-right font-semibold">₹{lc.totalProductValue.toLocaleString("en-IN")}</td>
                                  {lc.hasAdditionalCosts && <td />}
                                  {lc.hasAdditionalCosts && (
                                    <td className="py-1.5 text-right font-bold text-green-700">₹{lc.totalLandedValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                                  )}
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* ── Additional Costs ── */}
                        {lc.pooledAdditionalCosts.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Tag size={11} /> Additional Costs
                            </div>
                            <table className="w-full text-sm">
                              <tbody className="divide-y divide-[#fdf0e0]">
                                {lc.pooledAdditionalCosts.map((cost, idx) => (
                                  <tr key={idx} className="text-[#888]">
                                    <td className="py-1.5 w-7"></td>
                                    <td className="py-1.5">
                                      <span className={`text-xs font-medium ${cost.isShared ? "text-[#777] italic" : "text-[#555]"}`}>
                                        {cost.name}
                                      </span>
                                      {cost.category && (
                                        <span className="ml-1.5 text-[10px] text-[#aaa]">[{cost.category}]</span>
                                      )}
                                      {cost.isShared && (
                                        <span className="ml-2 text-[9px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full normal-case not-italic">
                                          Shared Shipment Cost
                                        </span>
                                      )}
                                    </td>
                                    <td colSpan={2} />
                                    <td className={`py-1.5 text-right font-semibold ${cost.isShared ? "text-[#777]" : "text-[#555]"}`}>
                                      ₹{cost.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t border-amber-200">
                                  <td colSpan={4} className="py-1.5 text-right text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                                    {lc.pooledAdditionalCosts.some(c => c.isShared) ? "Total Shared & Direct Costs" : "Total Additional Costs"}
                                  </td>
                                  <td className="py-1.5 text-right font-bold text-amber-700">₹{lc.totalAdditionalCosts.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* ── Invoice totals ── */}
                        <div className="border-t border-[#e8e8e8] pt-3">
                          <table className="w-full text-sm">
                            <tbody>
                              {gstPct > 0 && (
                                <tr className="text-[#888]">
                                  <td colSpan={4} className="py-1 text-right text-[11px] font-semibold uppercase tracking-wider">IGST {gstPct}%</td>
                                  <td className="py-1 text-right font-semibold">₹{gstAmt.toLocaleString("en-IN")}</td>
                                </tr>
                              )}
                              {rounding !== 0 && (
                                <tr className="text-[#888]">
                                  <td colSpan={4} className="py-1 text-right text-[11px] font-semibold uppercase tracking-wider">Rounding</td>
                                  <td className="py-1 text-right font-semibold">{rounding >= 0 ? "+" : ""}₹{rounding.toLocaleString("en-IN")}</td>
                                </tr>
                              )}
                               <tr>
                                <td colSpan={4} className="py-2 text-right text-[12px] font-bold text-black uppercase tracking-wider">Grand Total (Invoice)</td>
                                <td className="py-2 text-right font-bold text-black text-base">₹{grandTotal.toLocaleString("en-IN")}</td>
                              </tr>
                              {p.paymentStatus !== "Paid" && (
                                <>
                                  <tr className="text-[#888]">
                                    <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-right">Paid Amount</td>
                                    <td className="py-1.5 text-right font-semibold text-green-600">₹{(p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0).toLocaleString("en-IN")}</td>
                                  </tr>
                                  <tr className="text-[#888]">
                                    <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-right">Balance Pending</td>
                                    <td className="py-1.5 text-right font-semibold text-red-500">₹{(grandTotal - (p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0)).toLocaleString("en-IN")}</td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Landed Cost Summary Section */}
                        {lc.hasAdditionalCosts && (
                          <div className="bg-green-50/60 border border-green-100 rounded-xl p-4 mt-3 text-left">
                            <div className="text-[11px] font-bold text-green-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                              <Calculator size={12} className="text-green-700" /> Landed Cost Summary
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                              <div>
                                <div className="text-[#666] mb-0.5">Product Value</div>
                                <div className="font-bold text-black text-sm">₹{lc.totalProductValue.toLocaleString("en-IN")}</div>
                              </div>
                              <div>
                                <div className="text-[#666] mb-0.5">Additional Costs</div>
                                <div className="font-bold text-amber-700 text-sm">₹{lc.totalAdditionalCosts.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                              </div>
                              <div>
                                <div className="text-[#666] mb-0.5">Total Landed Value</div>
                                <div className="font-bold text-green-700 text-sm">₹{lc.totalLandedValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                              </div>
                              <div>
                                <div className="text-[#666] mb-0.5">Total Inventory Quantity</div>
                                <div className="font-bold text-black text-sm">{lc.totalInventoryQty.toLocaleString("en-IN")} units</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PDF Viewer Modal ───────────────────────────── */
function PdfViewerModal({
  files,
  initialActiveIndex,
  onClose,
}: {
  files: { url: string; filename: string }[];
  initialActiveIndex: number;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  
  // Guard if files is empty or index out of bounds
  const activeFile = files[activeIndex] || files[0];
  if (!activeFile) return null;
  
  const { url, filename } = activeFile;
  const isImage = url.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ width: "min(92vw, 900px)", height: "min(92vh, 800px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e8e8] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 ${isImage ? "bg-blue-50" : "bg-red-50"} rounded-xl flex items-center justify-center shrink-0`}>
              <FileText size={18} className={isImage ? "text-blue-500" : "text-red-500"} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-black truncate max-w-[280px] sm:max-w-[400px]">{filename}</div>
              <div className="text-[11px] text-[#888] flex items-center gap-1.5 mt-0.5">
                <span>{isImage ? "Transaction Receipt Image" : "Manufacturer Bill PDF"}</span>
                {files.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold text-[10px]">
                    {activeIndex + 1} of {files.length}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Download button */}
            <a
              href={url}
              download={filename}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f5] hover:bg-[#eee] text-[#555] rounded-lg text-xs font-semibold transition-colors"
            >
              <Upload size={12} className="rotate-180" /> Download
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f5f5f5] hover:bg-[#e8e8e8] text-[#666] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-[#fafafa] flex flex-col min-h-0">
          {/* Main Viewer container */}
          <div className="flex-1 overflow-hidden relative flex items-center justify-center">
            {isImage ? (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={filename}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] bg-white"
                />
              </div>
            ) : (
              <iframe
                src={url}
                className="w-full h-full"
                title={filename}
                style={{ border: "none" }}
              />
            )}

            {/* Navigation Arrows overlay */}
            {files.length > 1 && (
              <>
                <button
                  onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-gray-700 hover:text-black flex items-center justify-center shadow-lg transition-all border border-gray-100 z-10 hover:scale-105"
                  title="Previous"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setActiveIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-gray-700 hover:text-black flex items-center justify-center shadow-lg transition-all border border-gray-100 z-10 hover:scale-105"
                  title="Next"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails strip */}
          {files.length > 1 && (
            <div className="shrink-0 bg-white border-t border-[#e8e8e8] px-5 py-3.5 flex items-center gap-3 overflow-x-auto">
              {files.map((file, idx) => {
                const fileIsImage = file.url.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.filename);
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveIndex(idx)}
                    className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all flex items-center justify-center shadow-sm bg-gray-50 relative group ${
                      isActive ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-400"
                    }`}
                    title={file.filename}
                  >
                    {fileIsImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full w-full p-1">
                        <FileText size={16} className="text-red-500 shrink-0" />
                        <span className="text-[8px] font-bold text-red-500 truncate max-w-full mt-0.5 uppercase shrink-0">PDF</span>
                      </div>
                    )}
                    {/* Overlay badge with index */}
                    <span className="absolute bottom-0.5 right-0.5 px-1 bg-black/60 text-white text-[8px] rounded font-medium">
                      {idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
