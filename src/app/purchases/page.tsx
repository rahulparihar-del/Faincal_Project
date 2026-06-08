"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { PurchaseOrder, PurchaseItem, OrderType, PaymentStatus, ShipmentStatus } from "@/lib/types";
import { gsap } from "gsap";
import {
  Plus, Edit2, Trash2, Package, IndianRupee, Boxes,
  X, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Truck, FileText,
  Upload, Eye, Paperclip, AlertCircle, Tag, Calculator,
} from "lucide-react";

const GST_RATE = 5;

/* ─── Bill math helpers ─────────────────────────────────────── */
function getItems(p: PurchaseOrder): PurchaseItem[] {
  if (p.items && p.items.length > 0) return p.items;
  return [{ productName: p.productName, qty: p.qty, rate: p.rate, type: "product" }];
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

/** Items that are inventory products */
function getProductItems(items: PurchaseItem[]): PurchaseItem[] {
  return items.filter(i => !isCostItem(i));
}
/** Items that are additional charges (fusing, packing, labour etc.) */
function getCostItems(items: PurchaseItem[]): PurchaseItem[] {
  return items.filter(i => isCostItem(i));
}

/** ALL items subtotal (product rows + cost rows) — used for invoice total */
function getSubtotal(p: PurchaseOrder): number {
  return getItems(p).reduce((s, i) => s + i.qty * i.rate, 0);
}
/** Final payable = subtotal + GST + transport(fields) + localTransport + rounding */
function getGrandTotal(p: PurchaseOrder): number {
  const sub = getSubtotal(p);
  const gst = p.gstAmount ?? (sub * (p.gstPercent ?? 0) / 100);
  return sub + gst + (p.transport ?? 0) + (p.localTransport ?? 0) + (p.roundingAmount ?? 0);
}

/** Landed cost breakdown — distributes all additional costs across product items */
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

/* ─── Toast ─────────────────────────────────────────────────── */
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, transform: `translateX(-50%) translateY(${visible ? "0" : "12px"})` }}
    >
      <div className="flex items-center gap-2.5 bg-black text-white px-5 py-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] text-sm font-semibold whitespace-nowrap">
        <CheckCircle2 size={16} className="text-green-400 shrink-0" />
        {message}
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

/* ─── Page ──────────────────────────────────────────────────── */
export default function PurchaseOrdersPage() {
  const { purchases, setPurchases, manufacturers } = useData();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{
    files: { url: string; filename: string }[];
    activeIndex: number;
  } | null>(null);

  const stats = useMemo(() => {
    const cm = new Date().getMonth(), cy = new Date().getFullYear();
    let thisMonth = 0, bulkCosts = 0, pending = 0;
    purchases.forEach((p) => {
      const val = getGrandTotal(p);
      const d = new Date(p.date);
      if (d.getMonth() === cm && d.getFullYear() === cy) thisMonth += val;
      if (p.orderType === "Bulk") bulkCosts += val;
      if (p.paymentStatus === "Pending") pending += val;
      else if (p.paymentStatus === "Partial") pending += (val - (p.paidAmount ?? 0));
    });
    return { thisMonth, bulkCosts, pending };
  }, [purchases]);

  const advanceShipment = (p: PurchaseOrder, elId: string) => {
    const seq: ShipmentStatus[] = ["Ordered", "Shipped", "Delivered"];
    const idx = seq.indexOf(p.shipmentStatus);
    if (idx >= seq.length - 1) return;
    const next = seq[idx + 1];
    const el = document.getElementById(elId);
    if (el) {
      gsap.to(el, { rotationX: 90, duration: 0.15, onComplete: () => {
        setPurchases((prev) => prev.map((item) => item.id === p.id ? { ...item, shipmentStatus: next } : item));
        gsap.fromTo(el, { rotationX: -90 }, { rotationX: 0, duration: 0.15 });
      }});
    } else {
      setPurchases((prev) => prev.map((item) => item.id === p.id ? { ...item, shipmentStatus: next } : item));
    }
  };

  const handleDelete = (id: string) => {
    const el = document.getElementById(`po-row-${id}`);
    if (el) {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.25, onComplete: () => {
        setPurchases((prev) => prev.filter((p) => p.id !== id));
        setDeletingId(null);
      }});
    } else {
      setPurchases((prev) => prev.filter((p) => p.id !== id));
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <PdfViewerModal
          files={viewingPdf.files}
          initialActiveIndex={viewingPdf.activeIndex}
          onClose={() => setViewingPdf(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Purchase Orders</h2>
          <p className="text-sm text-[#888] mt-1">{purchases.length} orders</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        >
          <Plus size={16} /> Add Purchase
        </button>
      </div>

      <CardGroup>
        <StatCard title="This Month" value={`₹${stats.thisMonth.toLocaleString("en-IN")}`} icon={Package} />
        <StatCard title="Bulk Costs" value={`₹${stats.bulkCosts.toLocaleString("en-IN")}`} icon={Boxes} />
        <StatCard title="Pending Payments" value={`₹${stats.pending.toLocaleString("en-IN")}`} icon={IndianRupee} variant="loss" />
      </CardGroup>

      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#fafafa] border-b border-[#e8e8e8]">
              <tr>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider w-6"></th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Manufacturer</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Items</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Type</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Total</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Payment</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Shipment</th>
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Bill/Receipt</th>
                <th className="px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {purchases.map((p) => {
                const mfgName = manufacturers.find((m) => m.id === p.manufacturerId)?.name || "Unknown";
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
                  <React.Fragment key={p.id}>
                    <tr id={`po-row-${p.id}`} className="hover:bg-[#fafafa] transition-colors relative">
                      <td className="pl-4 pr-0 py-3.5">
                        {isMulti ? (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : p.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#888] hover:text-black hover:bg-[#f0f0f0] transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : <span className="w-6 inline-block" />}
                      </td>

                      <td className="px-5 py-3.5 text-[#888]">{p.date}</td>
                      <td className="hidden lg:table-cell px-5 py-3.5">
                        <Link
                          href={`/manufacturers/${p.manufacturerId}`}
                          className="font-semibold text-black hover:underline underline-offset-2 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {mfgName}
                        </Link>
                      </td>

                      <td className="px-5 py-3.5">
                        {(() => {
                          const prodItems = getProductItems(items);
                          const costItemsInList = getCostItems(items);
                          return isMulti ? (
                            <div>
                              <div className="font-medium text-black">
                                {prodItems.length} product{prodItems.length !== 1 ? "s" : ""}
                                {costItemsInList.length > 0 && (
                                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">
                                    +{costItemsInList.length} cost{costItemsInList.length !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#888] mt-0.5 hidden lg:block">
                                {prodItems.map(i => i.productName).join(" · ").slice(0, 50)}
                                {prodItems.map(i => i.productName).join(" · ").length > 50 ? "…" : ""}
                              </div>
                              <div className="lg:hidden text-xs text-[#aaa] mt-0.5">{mfgName}</div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium">{items[0].productName}</span>
                                <span className={`lg:hidden px-1.5 py-0.5 rounded text-[10px] font-bold ${p.orderType === "Sample" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-black text-white"}`}>
                                  {p.orderType === "Sample" ? "★ Sample" : "Bulk"}
                                </span>
                              </div>
                              <div className="text-xs text-[#888]">{items[0].qty} × ₹{items[0].rate.toLocaleString("en-IN")}</div>
                              <div className="lg:hidden text-xs text-[#aaa] mt-0.5">{mfgName}</div>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="hidden lg:table-cell px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.orderType === "Sample" ? "bg-[#f0f0f0] text-[#555]" : "bg-black text-white"}`}>
                          {p.orderType === "Sample" ? "★ Sample" : "Bulk"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="font-bold text-black">₹{grandTotal.toLocaleString("en-IN")}</div>
                        <div className="text-[11px] text-[#aaa] mt-0.5">
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
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{
                            background: p.paymentStatus === "Paid" ? "var(--color-profit-bg)" : p.paymentStatus === "Partial" ? "#f5f5f5" : "var(--color-loss-bg)",
                            color: p.paymentStatus === "Paid" ? "var(--color-profit)" : p.paymentStatus === "Partial" ? "#555" : "var(--color-loss)",
                            border: p.paymentStatus === "Paid" ? "1px solid var(--color-profit-border)" : p.paymentStatus === "Partial" ? "1px solid #e0e0e0" : "1px solid var(--color-loss-border)",
                          }}>
                            {p.paymentStatus}
                          </span>
                          {p.paymentStatus === "Partial" && (
                            <span className="text-[10px] text-[#888] font-medium">
                              ₹{(p.paidAmount ?? 0).toLocaleString("en-IN")} paid
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="hidden lg:table-cell px-5 py-3.5 text-center">
                        <button
                          id={`ship-badge-${p.id}`}
                          onClick={() => advanceShipment(p, `ship-badge-${p.id}`)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-block"
                          style={{
                            background: p.shipmentStatus === "Delivered" ? "var(--color-profit-bg)" : p.shipmentStatus === "Shipped" ? "#e0e0e0" : "#ffffff",
                            color: p.shipmentStatus === "Delivered" ? "var(--color-profit)" : p.shipmentStatus === "Shipped" ? "#444" : "#888",
                            border: p.shipmentStatus === "Delivered" ? "1px solid var(--color-profit-border)" : "1px solid #e0e0e0",
                          }}
                          title={p.shipmentStatus !== "Delivered" ? "Click to advance" : ""}
                        >
                          {p.shipmentStatus}
                        </button>
                      </td>

                      {/* Bill / Receipt — its own column, only visible on lg+ */}
                      <td className="hidden lg:table-cell px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          {p.billPdf ? (
                            <button
                              onClick={() => {
                                const files = getPoAttachments(p);
                                const idx = files.findIndex((f) => f.url === p.billPdf);
                                setViewingPdf({ files, activeIndex: idx !== -1 ? idx : 0 });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors border border-red-100 shadow-sm cursor-pointer"
                              title={p.billPdfName || "View Bill"}
                            >
                              <FileText size={12} />
                              Bill
                            </button>
                          ) : null}
                          {p.txnImages && p.txnImages.length > 0 ? (
                            <button
                              onClick={() => {
                                const files = getPoAttachments(p);
                                const firstReceiptUrl = p.txnImages![0];
                                const activeIdx = files.findIndex((f) => f.url === firstReceiptUrl);
                                setViewingPdf({ files, activeIndex: activeIdx !== -1 ? activeIdx : 0 });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-500 hover:text-blue-700 rounded-lg text-xs font-semibold transition-colors border border-blue-100 shadow-sm cursor-pointer"
                              title={`View Receipts (${p.txnImages.length})`}
                            >
                              <Eye size={12} />
                              {p.txnImages.length > 1 ? `Receipts (${p.txnImages.length})` : "Receipt"}
                            </button>
                          ) : (
                            p.txnImage ? (
                              <button
                                onClick={() => {
                                  const files = getPoAttachments(p);
                                  const idx = files.findIndex((f) => f.url === p.txnImage);
                                  setViewingPdf({ files, activeIndex: idx !== -1 ? idx : 0 });
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-500 hover:text-blue-700 rounded-lg text-xs font-semibold transition-colors border border-blue-100 shadow-sm cursor-pointer"
                                title={p.txnImageName || "View Receipt"}
                              >
                                <Eye size={12} />
                                Receipt
                              </button>
                            ) : null
                          )}
                          {!p.billPdf && !p.txnImage && (!p.txnImages || p.txnImages.length === 0) && (
                            <span className="text-[#ddd] text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ConfirmDelete isOpen={deletingId === p.id} onConfirm={() => handleDelete(p.id)} onCancel={() => setDeletingId(null)} />
                          <button onClick={() => { setEditingId(p.id); setDrawerOpen(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeletingId(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded breakdown */}
                    {isMulti && isExpanded && (() => {
                      const lc = getLandedBreakdown(p, purchases);
                      const prodItems = getProductItems(items);
                      const extraCostItems = getCostItems(items);
                      return (
                        <tr>
                          <td colSpan={10} className="px-0 py-0 bg-[#fafafa] border-b border-[#e8e8e8] expanded-row-cell">
                            <div className="px-6 lg:px-16 py-4 space-y-4">

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
                                          <td colSpan={4} className="py-1 text-right text-[11px] font-semibold uppercase tracking-wider">Paid Amount</td>
                                          <td className="py-1 text-right font-semibold text-green-600">₹{(p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0).toLocaleString("en-IN")}</td>
                                        </tr>
                                        <tr className="text-[#888]">
                                          <td colSpan={4} className="py-1 text-right text-[11px] font-semibold uppercase tracking-wider">Balance Pending</td>
                                          <td className="py-1 text-right font-semibold text-red-500">₹{(grandTotal - (p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0)).toLocaleString("en-IN")}</td>
                                        </tr>
                                      </>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Landed Cost Summary Section */}
                              {lc.hasAdditionalCosts && (
                                <div className="bg-green-50/60 border border-green-100 rounded-xl p-4 mt-3">
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
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[#888]">
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
        onViewPdf={(files, activeIndex) => setViewingPdf({ files, activeIndex })}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Purchase Form Drawer
   Bill order: Items → GST(on items only) → +Transport → +Rounding
───────────────────────────────────────────────────────────── */

const EMPTY_ITEM: PurchaseItem = { productName: "", qty: 1, rate: 0 };

type FormMeta = {
  date: string;
  manufacturerId: string;
  orderType: OrderType;
  paymentStatus: PaymentStatus;
  paymentDate: string;
  paidAmount: number;
  shipmentStatus: ShipmentStatus;
  expectedDelivery: string;
  actualReceiptDate: string;
  notes: string;
  gst: string;
  applyGst: boolean;
  gstPercent: number;
  transport: number;
  localTransport: number;
  roundingAmount: number;
  shareCosts: boolean;
  shareWithBillId: string;
};

function PurchaseFormDrawer({
  isOpen, onClose, editingId, onSave, onViewPdf,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (po: PurchaseOrder) => void;
  onViewPdf: (files: { url: string; filename: string }[], activeIndex: number) => void;
}) {
  const { purchases, manufacturers } = useData();
  const formRef = useRef<HTMLFormElement>(null);

  const defaultMeta: FormMeta = {
    date: new Date().toISOString().split("T")[0],
    manufacturerId: "",
    orderType: "Sample",
    paymentStatus: "Pending",
    paymentDate: "",
    paidAmount: 0,
    shipmentStatus: "Ordered",
    expectedDelivery: "",
    actualReceiptDate: "",
    notes: "",
    gst: "",
    applyGst: true,
    gstPercent: GST_RATE,
    transport: 0,
    localTransport: 0,
    roundingAmount: 0,
    shareCosts: true,
    shareWithBillId: "all",
  };

  const [meta, setMeta] = useState<FormMeta>(defaultMeta);
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }]);

  // PDF state
  const [billPdf, setBillPdf] = useState<string | null>(null);
  const [billPdfName, setBillPdfName] = useState("");
  const [pdfSizeWarning, setPdfSizeWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transaction Receipt state (multiple)
  const [txnImages, setTxnImages] = useState<string[]>([]);
  const [txnImageNames, setTxnImageNames] = useState<string[]>([]);
  const txnFileInputRef = useRef<HTMLInputElement>(null);

  // Local Transport Receipt state (multiple)
  const [localTxnImages, setLocalTxnImages] = useState<string[]>([]);
  const [localTxnImageNames, setLocalTxnImageNames] = useState<string[]>([]);
  const localTxnFileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState({ visible: false, message: "" });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message: msg });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2000);
  }, []);

  const getDrawerAttachments = () => {
    const files: { url: string; filename: string }[] = [];
    if (billPdf) {
      files.push({ url: billPdf, filename: billPdfName || "Bill.pdf" });
    }
    txnImages.forEach((img, idx) => {
      files.push({
        url: img,
        filename: txnImageNames[idx] || `Receipt ${idx + 1}`,
      });
    });
    localTxnImages.forEach((img, idx) => {
      files.push({
        url: img,
        filename: localTxnImageNames[idx] || `Local Transport ${idx + 1}`,
      });
    });
    return files;
  };

  useEffect(() => {
    if (isOpen && editingId) {
      const po = purchases.find((p) => p.id === editingId);
      if (po) {
        const gstPct = po.gstPercent ?? 0;
        setMeta({
          date: po.date,
          manufacturerId: po.manufacturerId,
          orderType: po.orderType,
          paymentStatus: po.paymentStatus,
          paymentDate: po.paymentDate,
          paidAmount: po.paidAmount ?? 0,
          shipmentStatus: po.shipmentStatus,
          expectedDelivery: po.expectedDelivery,
          actualReceiptDate: po.actualReceiptDate,
          notes: po.notes,
          gst: po.gst || "",
          applyGst: gstPct > 0,
          gstPercent: gstPct > 0 ? gstPct : GST_RATE,
          transport: po.transport ?? 0,
          localTransport: po.localTransport ?? 0,
          roundingAmount: po.roundingAmount ?? 0,
          shareCosts: po.shareCosts !== false,
          shareWithBillId: po.shareWithBillId || "all",
        });
        const loadedItems = getItems(po).map((i) => {
          const detectedType = i.type || (isCostItem(i) ? "cost" : "product");
          const costCategory = i.costCategory || (detectedType === "cost" ? getCostCategoryByName(i.productName) : undefined);
          return {
            ...i,
            type: detectedType,
            costCategory,
          };
        });
        setItems(loadedItems);
        setBillPdf(po.billPdf || null);
        setBillPdfName(po.billPdfName || "");
        setPdfSizeWarning(false);
        setTxnImages(po.txnImages || (po.txnImage ? [po.txnImage] : []));
        setTxnImageNames(po.txnImageNames || (po.txnImageName ? [po.txnImageName] : []));
        setLocalTxnImages(po.localTxnImages || []);
        setLocalTxnImageNames(po.localTxnImageNames || []);
      }
    } else if (isOpen) {
      setMeta({ ...defaultMeta, manufacturerId: manufacturers.length > 0 ? manufacturers[0].id : "" });
      setItems([{ ...EMPTY_ITEM }]);
      setBillPdf(null);
      setBillPdfName("");
      setPdfSizeWarning(false);
      setTxnImages([]);
      setTxnImageNames([]);
      setLocalTxnImages([]);
      setLocalTxnImageNames([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  /* ── Live bill calculations (mirrors actual bill structure) ── */
  const itemsSubtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const gstAmount = meta.applyGst ? Math.round(itemsSubtotal * meta.gstPercent / 100 * 100) / 100 : 0;
  // GST is calculated ONLY on items, transport is added AFTER
  const grandTotal = itemsSubtotal + gstAmount + (meta.transport || 0) + (meta.localTransport || 0) + (meta.roundingAmount || 0);

  /* ── Item helpers ── */
  const updateItem = (idx: number, field: keyof PurchaseItem, value: string | number | undefined) =>
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    showToast("Item added");
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    const name = items[idx].productName || `Item ${idx + 1}`;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    showToast(`"${name}" removed`);
  };

  /* ─── PDF helpers ─── */
  const handlePdfSelect = (file: File) => {
    if (!file || file.type !== "application/pdf") {
      showToast("Please select a PDF file");
      return;
    }
    const sizeMb = file.size / (1024 * 1024);
    setPdfSizeWarning(sizeMb > 3);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBillPdf(ev.target?.result as string);
      setBillPdfName(file.name);
      showToast(`✅ "${file.name}" uploaded`);
    };
    reader.readAsDataURL(file);
  };

  /* ─── Transaction Image helpers (multiple) ─── */
  const handleTxnImagesSelect = (files: FileList) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImg = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
      if (!isPdf && !isImg) {
        showToast(`"${file.name}" is not an Image or PDF`);
        return;
      }
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > 3) showToast(`"${file.name}" is too large (>3MB)`);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setTxnImages((prev) => [...prev, dataUrl]);
        setTxnImageNames((prev) => [...prev, file.name]);
        showToast(`✅ "${file.name}" uploaded`);
      };
      reader.readAsDataURL(file);
    });
  };

  /* ─── Local Transport Image helpers (multiple) ─── */
  const handleLocalTxnImagesSelect = (files: FileList) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImg = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
      if (!isPdf && !isImg) {
        showToast(`"${file.name}" is not an Image or PDF`);
        return;
      }
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > 3) showToast(`"${file.name}" is too large (>3MB)`);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setLocalTxnImages((prev) => [...prev, dataUrl]);
        setLocalTxnImageNames((prev) => [...prev, file.name]);
        showToast(`✅ "${file.name}" uploaded`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedItems = items.map((it) =>
      it.type === "cost" ? { ...it, qty: 1 } : it
    );
    const validItems = normalizedItems.filter((it) => it.productName.trim() !== "" && it.qty > 0);
    if (!meta.manufacturerId || validItems.length === 0) {
      if (formRef.current)
        gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }
    const gstPct = meta.applyGst ? meta.gstPercent : 0;
    const sub = validItems.reduce((s, i) => s + i.qty * i.rate, 0);
    const gstAmt = Math.round(sub * gstPct / 100 * 100) / 100;
    const firstProduct = validItems.find((it) => !it.type || it.type === "product") || validItems[0];
    const firstItem = firstProduct;

    const grandTotal = sub + gstAmt + (meta.transport || 0) + (meta.localTransport || 0) + (meta.roundingAmount || 0);

    const po: PurchaseOrder = {
      id: editingId || Date.now().toString(),
      date: meta.date,
      manufacturerId: meta.manufacturerId,
      orderType: meta.orderType,
      items: validItems,
      productName: firstItem.productName,
      qty: firstItem.qty,
      rate: firstItem.rate,
      gstPercent: gstPct,
      gstAmount: gstAmt,
      transport: meta.transport || 0,
      localTransport: meta.localTransport || 0,
      roundingAmount: meta.roundingAmount || 0,
      billPdf: billPdf || undefined,
      billPdfName: billPdfName || undefined,
      txnImage: txnImages.length > 0 ? txnImages[0] : undefined,
      txnImageName: txnImageNames.length > 0 ? txnImageNames[0] : undefined,
      txnImages: txnImages.length > 0 ? txnImages : undefined,
      txnImageNames: txnImageNames.length > 0 ? txnImageNames : undefined,
      localTxnImages: localTxnImages.length > 0 ? localTxnImages : undefined,
      localTxnImageNames: localTxnImageNames.length > 0 ? localTxnImageNames : undefined,
      paymentStatus: meta.paymentStatus,
      paymentDate: meta.paymentDate,
      paidAmount: meta.paymentStatus === "Paid" ? grandTotal : (meta.paymentStatus === "Partial" ? meta.paidAmount : 0),
      shipmentStatus: meta.shipmentStatus,
      expectedDelivery: meta.expectedDelivery,
      actualReceiptDate: meta.actualReceiptDate,
      notes: meta.notes,
      gst: meta.gst,
      shareCosts: meta.shareCosts,
      shareWithBillId: meta.shareWithBillId,
    };
    onSave(po);
  };

  const inputCls = "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl px-4 py-2.5 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[13px] font-semibold text-[#555] mb-1.5";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={editingId ? "Edit Purchase Order" : "Add Purchase Order"}>
      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />

      {manufacturers.length === 0 ? (
        <div className="p-5 bg-[#f5f5f5] border border-[#e8e8e8] rounded-2xl text-sm text-[#666]">
          Please add a manufacturer in the Manufacturers tab first.
        </div>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Date */}
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" required className={inputCls} value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
          </div>

          {/* Manufacturer */}
          <div>
            <label className={labelCls}>Manufacturer *</label>
            <select required className={inputCls} value={meta.manufacturerId} onChange={(e) => setMeta({ ...meta, manufacturerId: e.target.value })}>
              <option value="" disabled>Select Manufacturer</option>
              {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Order Type */}
          <div>
            <label className={labelCls}>Order Type</label>
            <select className={inputCls} value={meta.orderType} onChange={(e) => setMeta({ ...meta, orderType: e.target.value as OrderType })}>
              <option value="Sample">★ Sample</option>
              <option value="Bulk">Bulk</option>
            </select>
          </div>

          {/* ─── Items ─── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + " mb-0"}>Items *</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-black bg-[#f0f0f0] hover:bg-[#e8e8e8] px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Add Item
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-[#f9f9f9] border border-[#e8e8e8] rounded-xl p-4 relative">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)}
                      className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-[#eee] hover:bg-red-100 hover:text-red-600 text-[#888] transition-colors"
                      title="Remove item"
                    >
                      <X size={12} />
                    </button>
                  )}
                  <div className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-3">Item {idx + 1}</div>

                  {/* Type Selection */}
                  <div className="mb-3">
                    <label className={labelCls}>Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          updateItem(idx, "type", "product");
                          updateItem(idx, "costCategory", undefined);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          !item.type || item.type === "product"
                            ? "bg-black text-white border-black"
                            : "bg-white text-[#555] border-[#e8e8e8] hover:bg-gray-50"
                        }`}
                      >
                        Product
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateItem(idx, "type", "cost");
                          updateItem(idx, "costCategory", item.costCategory || "Fusing");
                          updateItem(idx, "qty", 1);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          item.type === "cost"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-[#555] border-[#e8e8e8] hover:bg-gray-50"
                        }`}
                      >
                        Additional Cost
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className={labelCls}>
                      {item.type === "cost" ? "Description / Cost Name *" : "Product Name *"}
                    </label>
                    <input type="text" required
                      placeholder={item.type === "cost" ? "e.g. Fusing Fit Charges" : "e.g. Musline Fabric"}
                      className={inputCls}
                      value={item.productName} onChange={(e) => updateItem(idx, "productName", e.target.value)} />
                  </div>

                  {(!item.type || item.type === "product") ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Qty *</label>
                        <input type="number" required min="1" placeholder="0" className={inputCls}
                          value={item.qty || ""} onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} />
                      </div>
                      <div>
                        <label className={labelCls}>Rate/Unit (₹) *</label>
                        <input type="number" required min="0" step="0.01" placeholder="0.00" className={inputCls}
                          value={item.rate || ""} onChange={(e) => updateItem(idx, "rate", Number(e.target.value))} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Cost Category *</label>
                        <select required className={inputCls} value={item.costCategory || "Fusing"}
                          onChange={(e) => updateItem(idx, "costCategory", e.target.value)}>
                          <option value="Fusing">Fusing</option>
                          <option value="Stitching">Stitching</option>
                          <option value="Packing">Packing</option>
                          <option value="Labour">Labour</option>
                          <option value="Supplier Transport">Supplier Transport</option>
                          <option value="Local Transport">Local Transport</option>
                          <option value="Manufacturing">Manufacturing</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Amount (₹) *</label>
                        <input type="number" required min="0" step="0.01" placeholder="0.00" className={inputCls}
                          value={item.rate || ""} onChange={(e) => {
                            updateItem(idx, "rate", Number(e.target.value));
                            updateItem(idx, "qty", 1);
                          }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex justify-between items-center text-[12px] text-[#888]">
                    <span>Subtotal</span>
                    <span className="font-bold text-black text-sm">₹{(item.qty * item.rate).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── GST Toggle ─── */}
          <div className="bg-[#f9f9f9] border border-[#e8e8e8] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-black">Apply GST</div>
                <div className="text-[11px] text-[#888] mt-0.5">Calculated on items only (not transport)</div>
              </div>
              <button
                type="button"
                onClick={() => setMeta({ ...meta, applyGst: !meta.applyGst })}
                className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${meta.applyGst ? "bg-black" : "bg-[#ddd]"}`}
                role="switch" aria-checked={meta.applyGst}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${meta.applyGst ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
            {meta.applyGst && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[#555] whitespace-nowrap">GST Rate:</span>
                <div className="flex gap-2">
                  {[5, 12, 18, 28].map((r) => (
                    <button key={r} type="button" onClick={() => setMeta({ ...meta, gstPercent: r })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${meta.gstPercent === r ? "bg-black text-white" : "bg-[#eee] text-[#555] hover:bg-[#e0e0e0]"}`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── Cost Sharing Toggle ─── */}
          <div className="bg-[#f9f9f9] border border-[#e8e8e8] rounded-xl px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-black">Share Transport & Additional Costs</div>
                <div className="text-[11px] text-[#888] mt-0.5">Pool costs with other bills of this manufacturer on this date</div>
              </div>
              <button
                type="button"
                onClick={() => setMeta({ ...meta, shareCosts: !meta.shareCosts })}
                className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${meta.shareCosts ? "bg-black" : "bg-[#ddd]"}`}
                role="switch" aria-checked={meta.shareCosts}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${meta.shareCosts ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
            {meta.shareCosts && (
              <div className="pt-2.5 border-t border-[#e8e8e8]">
                <label className="block text-[12px] font-semibold text-[#555] mb-1.5">Share Cost With</label>
                {(() => {
                  const otherBills = purchases.filter(po =>
                    po.id !== editingId &&
                    po.manufacturerId &&
                    meta.manufacturerId &&
                    po.manufacturerId === meta.manufacturerId &&
                    po.date === meta.date
                  );
                  return (
                    <select
                      className={inputCls}
                      value={meta.shareWithBillId}
                      onChange={(e) => setMeta({ ...meta, shareWithBillId: e.target.value })}
                    >
                      <option value="all">★ All bills of this manufacturer on this date</option>
                      {otherBills.map((po) => {
                        const poItems = getItems(po);
                        const poProducts = getProductItems(poItems);
                        const productNames = poProducts.map(i => i.productName).join(", ") || "No Products";
                        const truncatedProducts = productNames.length > 30 ? productNames.substring(0, 30) + "..." : productNames;
                        const poTotal = getGrandTotal(po);
                        return (
                          <option key={po.id} value={po.id}>
                            {truncatedProducts} (₹{poTotal.toLocaleString("en-IN")})
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ─── Transport Charges ─── */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-[#aaa] uppercase tracking-wider">Transport Costs</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  <span className="flex items-center gap-1.5"><Truck size={13} /> Supplier Transport (₹)</span>
                </label>
                <input type="number" min="0" step="0.01" placeholder="Factory to office"
                  className={inputCls}
                  value={meta.transport || ""}
                  onChange={(e) => setMeta({ ...meta, transport: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className={labelCls}>
                  <span className="flex items-center gap-1.5"><Truck size={13} /> Local Transport (₹)</span>
                </label>
                <input type="number" min="0" step="0.01" placeholder="Office to my location"
                  className={inputCls}
                  value={meta.localTransport || ""}
                  onChange={(e) => setMeta({ ...meta, localTransport: Number(e.target.value) })}
                />
              </div>
            </div>
            <p className="text-[11px] text-[#aaa] ml-1">Both charges are added after GST — not taxable</p>

            {/* ─── Local Transport Receipt Upload ─── */}
            <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-orange-800 flex items-center gap-1.5">
                    <Truck size={13} /> Local Transport Receipts
                  </div>
                  <div className="text-[11px] text-orange-600 mt-0.5">Upload bills/receipts paid at delivery (multiple allowed)</div>
                </div>
                <button
                  type="button"
                  onClick={() => localTxnFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                  <Upload size={12} /> Add
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={localTxnFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleLocalTxnImagesSelect(e.target.files);
                  e.target.value = "";
                }}
              />

              {localTxnImages.length > 0 && (
                <div className="grid grid-cols-1 gap-2">
                  {localTxnImages.map((img, idx) => {
                    const name = localTxnImageNames[idx] || `Local Transport ${idx + 1}`;
                    const isImg = img.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
                    return (
                      <div key={idx} className="bg-white border border-orange-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg border border-orange-100 overflow-hidden flex items-center justify-center shrink-0 bg-orange-50">
                            {isImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <FileText size={18} className="text-orange-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-black truncate">{name}</div>
                            <div className="text-[10px] text-[#888] mt-0.5">{isImg ? "Image" : "PDF"} · Local Transport</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const files = getDrawerAttachments();
                              const activeIdx = files.findIndex((f) => f.url === img);
                              onViewPdf(files, activeIdx !== -1 ? activeIdx : 0);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-50 text-orange-500 hover:bg-orange-100 transition-colors border border-orange-100"
                            title="Preview"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLocalTxnImages((prev) => prev.filter((_, i) => i !== idx));
                              setLocalTxnImageNames((prev) => prev.filter((_, i) => i !== idx));
                              showToast("Local receipt removed");
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-[#888] hover:bg-red-50 hover:text-red-600 transition-colors border border-orange-100"
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {localTxnImages.length === 0 && (
                <button
                  type="button"
                  onClick={() => localTxnFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files) handleLocalTxnImagesSelect(e.dataTransfer.files);
                  }}
                  className="w-full border-2 border-dashed border-orange-200 hover:border-orange-400 bg-white hover:bg-orange-50 rounded-xl px-5 py-4 flex flex-col items-center gap-1.5 transition-colors cursor-pointer group"
                >
                  <Upload size={16} className="text-orange-400" />
                  <div className="text-xs font-semibold text-orange-700">Upload delivery receipts</div>
                  <div className="text-[10px] text-orange-400">Click or drag screenshots/PDFs here</div>
                </button>
              )}
            </div>
          </div>

          {/* ─── Rounding ─── */}
          <div>
            <label className={labelCls}>Rounding (₹)</label>
            <input type="number" step="0.01" placeholder="e.g. 0.50 or -0.50"
              className={inputCls}
              value={meta.roundingAmount || ""}
              onChange={(e) => setMeta({ ...meta, roundingAmount: Number(e.target.value) })}
            />
          </div>

          {/* ─── Bill Summary ─── */}
          {(() => {
            const prodItems = items.filter(i => !i.type || i.type === "product");
            const costItems = items.filter(i => i.type === "cost");
            const prodSubtotal = prodItems.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0);
            const costSubtotal = costItems.reduce((s, i) => s + (i.rate || 0), 0);
            const transportTotal = (meta.transport || 0) + (meta.localTransport || 0);
            const totalAdditionalCosts = costSubtotal + transportTotal;

            return (
              <div className="space-y-4">
                <div className="bg-black text-white rounded-2xl overflow-hidden">
                  {/* Products Sub Total */}
                  <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
                    <span className="text-[11px] font-medium uppercase tracking-wider opacity-50">
                      Sub Total ({prodItems.length} Product{prodItems.length !== 1 ? "s" : ""})
                    </span>
                    <span className="font-semibold opacity-80">₹{prodSubtotal.toLocaleString("en-IN")}</span>
                  </div>
                  {/* GST */}
                  {meta.applyGst && (
                    <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
                      <span className="text-[11px] font-medium uppercase tracking-wider opacity-50">
                        IGST ({meta.gstPercent}%)
                      </span>
                      <span className="font-semibold text-amber-300">+ ₹{gstAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {/* Additional Costs list */}
                  {totalAdditionalCosts > 0 && (
                    <div className="px-5 py-3 border-b border-white/10 space-y-2">
                      <div className="text-[11px] font-medium uppercase tracking-wider opacity-50">
                        Additional Costs ({costItems.length + (meta.transport ? 1 : 0) + (meta.localTransport ? 1 : 0)} charge{costItems.length + (meta.transport ? 1 : 0) + (meta.localTransport ? 1 : 0) !== 1 ? "s" : ""})
                      </div>
                      <div className="text-xs space-y-1.5 pl-3 border-l border-white/10">
                        {costItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-white/70">
                            <span>├ {item.productName || "Cost item"} {item.costCategory ? `(${item.costCategory})` : ""}</span>
                            <span>₹{item.rate.toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                        {meta.transport > 0 && (
                          <div className="flex justify-between items-center text-white/70">
                            <span>├ Supplier Transport</span>
                            <span>₹{meta.transport.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {meta.localTransport > 0 && (
                          <div className="flex justify-between items-center text-white/70">
                            <span>└ Local Transport</span>
                            <span>₹{meta.localTransport.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Total Additional Costs */}
                  {totalAdditionalCosts > 0 && (
                    <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
                      <span className="text-[11px] font-medium uppercase tracking-wider opacity-50">
                        Total Additional Costs
                      </span>
                      <span className="font-semibold text-amber-400">+ ₹{totalAdditionalCosts.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {/* Rounding */}
                  {(meta.roundingAmount || 0) !== 0 && (
                    <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
                      <span className="text-[11px] font-medium uppercase tracking-wider opacity-50">Rounding</span>
                      <span className="font-semibold opacity-80">
                        {(meta.roundingAmount || 0) >= 0 ? "+" : ""}₹{(meta.roundingAmount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                  {/* Grand Total */}
                  <div className="px-5 py-4 flex justify-between items-center">
                    <span className="text-[12px] font-medium uppercase tracking-wider opacity-60">Total Invoice Value</span>
                    <span className="text-2xl font-bold">₹{grandTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Landed Cost Breakdown Preview */}
                {(() => {
                  const validItems = items.filter((it) => it.productName.trim() !== "");
                  const tempPo: PurchaseOrder = {
                    id: "temp",
                    date: meta.date,
                    manufacturerId: meta.manufacturerId,
                    orderType: meta.orderType,
                    items: validItems,
                    productName: validItems[0]?.productName || "",
                    qty: validItems[0]?.qty || 0,
                    rate: validItems[0]?.rate || 0,
                    gstPercent: meta.applyGst ? meta.gstPercent : 0,
                    gstAmount: gstAmount,
                    transport: meta.transport || 0,
                    localTransport: meta.localTransport || 0,
                    roundingAmount: meta.roundingAmount || 0,
                    paymentStatus: meta.paymentStatus,
                    paymentDate: meta.paymentDate,
                    shipmentStatus: meta.shipmentStatus,
                    expectedDelivery: meta.expectedDelivery,
                    actualReceiptDate: meta.actualReceiptDate,
                    notes: meta.notes,
                    shareCosts: meta.shareCosts,
                    shareWithBillId: meta.shareWithBillId,
                  };
                  const lc = getLandedBreakdown(tempPo, purchases);
                  if (!lc.hasAdditionalCosts || lc.productRows.length === 0) return null;

                  return (
                    <div className="bg-[#fafafa] border border-[#e8e8e8] rounded-xl p-4 space-y-3">
                      <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Calculator size={12} /> Landed Cost Breakdown (Preview)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="text-[10px] font-bold text-[#999] uppercase border-b border-[#eee]">
                              <th className="pb-1.5 text-left">Product</th>
                              <th className="pb-1.5 text-right">Qty</th>
                              <th className="pb-1.5 text-right">Rate</th>
                              <th className="pb-1.5 text-right text-amber-600">Alloc. Cost</th>
                              <th className="pb-1.5 text-right text-green-700">Landed/Unit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#eee]">
                            {lc.productRows.map((row, idx) => (
                              <tr key={idx} className="text-[#333]">
                                <td className="py-2 font-medium sm:truncate sm:max-w-[120px]">{row.item.productName || "Unnamed"}</td>
                                <td className="py-2 text-right">{row.item.qty}</td>
                                <td className="py-2 text-right">₹{row.item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                                <td className="py-2 text-right text-amber-700 font-medium">+₹{row.allocated.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                                <td className="py-2 text-right font-bold text-green-700">₹{row.landedPerUnit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="pt-2 border-t border-[#eee] space-y-1.5 text-xs">
                        <div className="flex justify-between text-[#666]">
                          <span>Product Value:</span>
                          <span className="font-medium text-black">₹{lc.totalProductValue.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between text-[#666]">
                          <span>Additional Costs:</span>
                          <span className="font-medium text-amber-700">₹{lc.totalAdditionalCosts.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-bold text-green-700 pt-1 border-t border-[#eee]/60">
                          <span>Total Landed Value:</span>
                          <span>₹{lc.totalLandedValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[#666] pt-0.5">
                          <span>Total Inventory Quantity:</span>
                          <span className="font-semibold text-black">{lc.totalInventoryQty.toLocaleString("en-IN")} units</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Payment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Payment Status</label>
              <select className={inputCls} value={meta.paymentStatus} onChange={(e) => setMeta({ ...meta, paymentStatus: e.target.value as PaymentStatus })}>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment Date</label>
              <input type="date" className={inputCls} value={meta.paymentDate} onChange={(e) => setMeta({ ...meta, paymentDate: e.target.value })} />
            </div>
          </div>

          {/* Partial payment amount input */}
          {meta.paymentStatus === "Partial" && (
            <div>
              <label className={labelCls}>Amount Paid (₹) *</label>
              <input
                type="number"
                min="0"
                max={grandTotal}
                step="0.01"
                className={inputCls}
                value={meta.paidAmount || ""}
                onChange={(e) => setMeta({ ...meta, paidAmount: Math.min(grandTotal, Number(e.target.value) || 0) })}
                placeholder="Enter paid amount"
              />
            </div>
          )}

          {/* Shipment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Shipment Status</label>
              <select className={inputCls} value={meta.shipmentStatus} onChange={(e) => setMeta({ ...meta, shipmentStatus: e.target.value as ShipmentStatus })}>
                <option value="Ordered">Ordered</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Expected Delivery</label>
              <input type="date" className={inputCls} value={meta.expectedDelivery} onChange={(e) => setMeta({ ...meta, expectedDelivery: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Actual Receipt</label>
              <input type="date" className={inputCls} value={meta.actualReceiptDate} onChange={(e) => setMeta({ ...meta, actualReceiptDate: e.target.value })} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
          </div>

          {/* ─── Bill PDF Upload ─── */}
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5">
                <Paperclip size={13} /> Manufacturer Bill (PDF)
              </span>
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePdfSelect(f);
                e.target.value = "";
              }}
            />

            {billPdf ? (
              /* PDF attached — preview card */
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl border border-red-100 flex items-center justify-center shrink-0 shadow-sm">
                    <FileText size={20} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-black truncate">{billPdfName}</div>
                    <div className="text-[11px] text-[#888] mt-0.5">PDF attached — will be saved with this order</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const files = getDrawerAttachments();
                        const idx = files.findIndex((f) => f.url === billPdf);
                        onViewPdf(files, idx !== -1 ? idx : 0);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-red-500 hover:bg-red-100 transition-colors border border-red-100"
                      title="Preview PDF"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBillPdf(null); setBillPdfName(""); setPdfSizeWarning(false); showToast("Bill removed"); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-[#888] hover:bg-red-50 hover:text-red-600 transition-colors border border-red-100"
                      title="Remove PDF"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {pdfSizeWarning && (
                  <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-snug">
                      This PDF is large (&gt;3MB). It will be saved but may slow down syncing. Consider compressing it.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Upload drop zone */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handlePdfSelect(f);
                }}
                className="w-full border-2 border-dashed border-[#ddd] hover:border-[#aaa] bg-[#fafafa] hover:bg-[#f5f5f5] rounded-xl px-5 py-6 flex flex-col items-center gap-2 transition-colors cursor-pointer group"
              >
                <div className="w-10 h-10 bg-[#f0f0f0] group-hover:bg-[#e8e8e8] rounded-xl flex items-center justify-center transition-colors">
                  <Upload size={18} className="text-[#888]" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-black">Upload Manufacturer Bill</div>
                  <div className="text-[11px] text-[#aaa] mt-0.5">Click to browse or drag &amp; drop a PDF</div>
                </div>
              </button>
            )}
          </div>

          {/* ─── Transaction Image/PDF Upload ─── */}
          <div className="space-y-2.5">
            <label className={labelCls}>
              <span className="flex items-center gap-1.5">
                <Paperclip size={13} /> Transaction Receipt(s) (Image / PDF)
              </span>
            </label>

            {/* Hidden file input */}
            <input
              ref={txnFileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              multiple
              onChange={(e) => {
                if (e.target.files) handleTxnImagesSelect(e.target.files);
                e.target.value = "";
              }}
            />

            {txnImages.length > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {txnImages.map((img, idx) => {
                  const name = txnImageNames[idx] || `Receipt ${idx + 1}`;
                  const isImg = img.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
                  return (
                    <div key={idx} className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Thumbnail / file icon */}
                        <div className="w-10 h-10 bg-white rounded-lg border border-blue-100 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                          {isImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText size={18} className="text-blue-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-black truncate">{name}</div>
                          <div className="text-[10px] text-[#888] mt-0.5">{isImg ? "Image Receipt" : "PDF Receipt"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const files = getDrawerAttachments();
                            const activeIdx = files.findIndex((f) => f.url === img);
                            onViewPdf(files, activeIdx !== -1 ? activeIdx : 0);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-blue-500 hover:bg-blue-50 transition-colors border border-blue-100"
                          title="Preview"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTxnImages((prev) => prev.filter((_, i) => i !== idx));
                            setTxnImageNames((prev) => prev.filter((_, i) => i !== idx));
                            showToast("Receipt removed");
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-[#888] hover:bg-red-50 hover:text-red-600 transition-colors border border-blue-100"
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload drop zone */}
            <button
              type="button"
              onClick={() => txnFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleTxnImagesSelect(e.dataTransfer.files);
              }}
              className="w-full border-2 border-dashed border-[#ddd] hover:border-[#aaa] bg-[#fafafa] hover:bg-[#f5f5f5] rounded-xl px-5 py-5 flex flex-col items-center gap-2 transition-colors cursor-pointer group"
            >
              <div className="w-9 h-9 bg-[#f0f0f0] group-hover:bg-[#e8e8e8] rounded-xl flex items-center justify-center transition-colors">
                <Upload size={16} className="text-[#888]" />
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-black">Upload Transaction Receipt(s)</div>
                <div className="text-[10px] text-[#aaa] mt-0.5">Click to browse or drag screenshots/PDFs (multiple allowed)</div>
              </div>
            </button>
          </div>

          <button type="submit" className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            {editingId ? "Update Order" : "Save Order"}
          </button>
        </form>
      )}
    </Drawer>
  );
}
