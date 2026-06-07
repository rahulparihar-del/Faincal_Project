"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useData } from "@/context/DataContext";
import { Drawer } from "@/components/ui/Drawer";
import { CardGroup, StatCard } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { PurchaseOrder, PurchaseItem, OrderType, PaymentStatus, ShipmentStatus } from "@/lib/types";
import { gsap } from "gsap";
import {
  Plus, Edit2, Trash2, Package, IndianRupee, FlaskConical, Boxes,
  X, ChevronDown, ChevronRight, CheckCircle2, Truck, FileText,
  Upload, Eye, Paperclip, AlertCircle,
} from "lucide-react";

const GST_RATE = 5;

/* ─── Bill math helpers ─────────────────────────────────────── */
function getItems(p: PurchaseOrder): PurchaseItem[] {
  if (p.items && p.items.length > 0) return p.items;
  return [{ productName: p.productName, qty: p.qty, rate: p.rate }];
}
/** Items subtotal BEFORE GST and transport */
function getSubtotal(p: PurchaseOrder): number {
  return getItems(p).reduce((s, i) => s + i.qty * i.rate, 0);
}
/** Final payable = subtotal + GST(on subtotal only) + transport + rounding */
function getGrandTotal(p: PurchaseOrder): number {
  const sub = getSubtotal(p);
  const gst = p.gstAmount ?? (sub * (p.gstPercent ?? 0) / 100);
  return sub + gst + (p.transport ?? 0) + (p.roundingAmount ?? 0);
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
  pdf,
  filename,
  onClose,
}: {
  pdf: string;
  filename: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: "min(92vw, 900px)", height: "min(92vh, 800px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e8e8] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-red-500" />
            </div>
            <div>
              <div className="font-semibold text-sm text-black truncate max-w-[320px]">{filename}</div>
              <div className="text-[11px] text-[#888]">Manufacturer Bill</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Download button */}
            <a
              href={pdf}
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

        {/* PDF iframe */}
        <div className="flex-1 overflow-hidden rounded-b-2xl">
          <iframe
            src={pdf}
            className="w-full h-full"
            title={filename}
            style={{ border: "none" }}
          />
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
  const [viewingPdf, setViewingPdf] = useState<{ pdf: string; filename: string } | null>(null);

  const stats = useMemo(() => {
    const cm = new Date().getMonth(), cy = new Date().getFullYear();
    let thisMonth = 0, sampleCosts = 0, bulkCosts = 0, pending = 0;
    purchases.forEach((p) => {
      const val = getGrandTotal(p);
      const d = new Date(p.date);
      if (d.getMonth() === cm && d.getFullYear() === cy) thisMonth += val;
      if (p.orderType === "Sample") sampleCosts += val;
      if (p.orderType === "Bulk") bulkCosts += val;
      if (p.paymentStatus !== "Paid") pending += val;
    });
    return { thisMonth, sampleCosts, bulkCosts, pending };
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
          pdf={viewingPdf.pdf}
          filename={viewingPdf.filename}
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
        <StatCard title="Sample Costs" value={`₹${stats.sampleCosts.toLocaleString("en-IN")}`} icon={FlaskConical} />
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
                <th className="hidden lg:table-cell px-5 py-3.5 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-center">Bill</th>
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
                const rounding = p.roundingAmount ?? 0;
                const grandTotal = subtotal + gstAmt + transport + rounding;
                const isMulti = items.length > 1;
                const isExpanded = expandedId === p.id;

                return (
                  <React.Fragment key={p.id}>
                    <tr id={`po-row-${p.id}`} className="hover:bg-[#fafafa] transition-colors">
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
                      <td className="hidden lg:table-cell px-5 py-3.5 font-semibold text-black">{mfgName}</td>

                      <td className="px-5 py-3.5">
                        {isMulti ? (
                          <div>
                            <div className="font-medium text-black">{items.length} products</div>
                            <div className="text-xs text-[#888] mt-0.5 hidden lg:block">
                              {items.map(i => i.productName).join(" · ").slice(0, 50)}
                              {items.map(i => i.productName).join(" · ").length > 50 ? "…" : ""}
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
                        )}
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
                          {transport > 0 && <span>{gstPct > 0 ? " · " : ""}+Transport</span>}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{
                          background: p.paymentStatus === "Paid" ? "var(--color-profit-bg)" : p.paymentStatus === "Partial" ? "#f0f0f0" : "var(--color-loss-bg)",
                          color: p.paymentStatus === "Paid" ? "var(--color-profit)" : p.paymentStatus === "Partial" ? "#555" : "var(--color-loss)",
                          border: p.paymentStatus === "Paid" ? "1px solid var(--color-profit-border)" : p.paymentStatus === "Partial" ? "1px solid #e0e0e0" : "1px solid var(--color-loss-border)",
                        }}>
                          {p.paymentStatus}
                        </span>
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

                      {/* Bill PDF — its own column, only visible on lg+ */}
                      <td className="hidden lg:table-cell px-5 py-3.5 text-center">
                        {p.billPdf ? (
                          <button
                            onClick={() => setViewingPdf({ pdf: p.billPdf!, filename: p.billPdfName || "Bill.pdf" })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors border border-red-100"
                            title={p.billPdfName || "View Bill"}
                          >
                            <FileText size={13} />
                            View
                          </button>
                        ) : (
                          <span className="text-[#ddd] text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 relative">
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
                    {isMulti && isExpanded && (
                      <tr>
                        <td colSpan={9} className="px-0 py-0 bg-[#fafafa] border-b border-[#e8e8e8]">
                          <div className="px-16 py-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[11px] font-semibold text-[#999] uppercase tracking-wider border-b border-[#eee]">
                                  <th className="pb-2 text-left w-8">#</th>
                                  <th className="pb-2 text-left">Product</th>
                                  <th className="pb-2 text-right">Qty</th>
                                  <th className="pb-2 text-right">Rate</th>
                                  <th className="pb-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#f0f0f0]">
                                {items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="py-2 text-[#bbb] text-xs">{idx + 1}</td>
                                    <td className="py-2 font-medium">{item.productName}</td>
                                    <td className="py-2 text-right text-[#555]">{item.qty.toLocaleString("en-IN")}</td>
                                    <td className="py-2 text-right text-[#555]">₹{item.rate.toLocaleString("en-IN")}</td>
                                    <td className="py-2 text-right font-semibold">₹{(item.qty * item.rate).toLocaleString("en-IN")}</td>
                                  </tr>
                                ))}
                                <tr className="border-t border-[#e8e8e8] text-[#888]">
                                  <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">Sub Total</td>
                                  <td className="py-1.5 text-right font-semibold">₹{subtotal.toLocaleString("en-IN")}</td>
                                </tr>
                                {gstPct > 0 && (
                                  <tr className="text-[#888]">
                                    <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">IGST {gstPct}%</td>
                                    <td className="py-1.5 text-right font-semibold">₹{gstAmt.toLocaleString("en-IN")}</td>
                                  </tr>
                                )}
                                {transport > 0 && (
                                  <tr className="text-[#888]">
                                    <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">Transport</td>
                                    <td className="py-1.5 text-right font-semibold">₹{transport.toLocaleString("en-IN")}</td>
                                  </tr>
                                )}
                                {rounding !== 0 && (
                                  <tr className="text-[#888]">
                                    <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">Rounding</td>
                                    <td className="py-1.5 text-right font-semibold">{rounding >= 0 ? "+" : ""}₹{rounding.toLocaleString("en-IN")}</td>
                                  </tr>
                                )}
                                <tr className="border-t border-[#e0e0e0]">
                                  <td colSpan={4} className="py-2 text-right text-[12px] font-bold text-black uppercase tracking-wider">Total</td>
                                  <td className="py-2 text-right font-bold text-black text-base">₹{grandTotal.toLocaleString("en-IN")}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
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
  shipmentStatus: ShipmentStatus;
  expectedDelivery: string;
  actualReceiptDate: string;
  notes: string;
  gst: string;
  applyGst: boolean;
  gstPercent: number;
  transport: number;
  roundingAmount: number;
};

function PurchaseFormDrawer({
  isOpen, onClose, editingId, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  onSave: (po: PurchaseOrder) => void;
}) {
  const { purchases, manufacturers } = useData();
  const formRef = useRef<HTMLFormElement>(null);

  const defaultMeta: FormMeta = {
    date: new Date().toISOString().split("T")[0],
    manufacturerId: "",
    orderType: "Sample",
    paymentStatus: "Pending",
    paymentDate: "",
    shipmentStatus: "Ordered",
    expectedDelivery: "",
    actualReceiptDate: "",
    notes: "",
    gst: "",
    applyGst: true,
    gstPercent: GST_RATE,
    transport: 0,
    roundingAmount: 0,
  };

  const [meta, setMeta] = useState<FormMeta>(defaultMeta);
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }]);
  const [showTransport, setShowTransport] = useState(false);
  const [showRounding, setShowRounding] = useState(false);

  // PDF state
  const [billPdf, setBillPdf] = useState<string | null>(null);
  const [billPdfName, setBillPdfName] = useState("");
  const [pdfSizeWarning, setPdfSizeWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message: msg });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2000);
  }, []);

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
          shipmentStatus: po.shipmentStatus,
          expectedDelivery: po.expectedDelivery,
          actualReceiptDate: po.actualReceiptDate,
          notes: po.notes,
          gst: po.gst || "",
          applyGst: gstPct > 0,
          gstPercent: gstPct > 0 ? gstPct : GST_RATE,
          transport: po.transport ?? 0,
          roundingAmount: po.roundingAmount ?? 0,
        });
        setItems(getItems(po).map((i) => ({ ...i })));
        setShowTransport((po.transport ?? 0) > 0);
        setShowRounding((po.roundingAmount ?? 0) !== 0);
        setBillPdf(po.billPdf || null);
        setBillPdfName(po.billPdfName || "");
        setPdfSizeWarning(false);
      }
    } else if (isOpen) {
      setMeta({ ...defaultMeta, manufacturerId: manufacturers.length > 0 ? manufacturers[0].id : "" });
      setItems([{ ...EMPTY_ITEM }]);
      setShowTransport(false);
      setShowRounding(false);
      setBillPdf(null);
      setBillPdfName("");
      setPdfSizeWarning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingId]);

  /* ── Live bill calculations (mirrors actual bill structure) ── */
  const itemsSubtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const gstAmount = meta.applyGst ? Math.round(itemsSubtotal * meta.gstPercent / 100 * 100) / 100 : 0;
  // GST is calculated ONLY on items, transport is added AFTER
  const grandTotal = itemsSubtotal + gstAmount + (meta.transport || 0) + (meta.roundingAmount || 0);

  /* ── Item helpers ── */
  const updateItem = (idx: number, field: keyof PurchaseItem, value: string | number) =>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.productName.trim() !== "" && it.qty > 0);
    if (!meta.manufacturerId || validItems.length === 0) {
      if (formRef.current)
        gsap.fromTo(formRef.current, { x: -8 }, { x: 0, ease: "elastic.out(1, 0.3)", duration: 0.5, clearProps: "x" });
      return;
    }
    const gstPct = meta.applyGst ? meta.gstPercent : 0;
    const sub = validItems.reduce((s, i) => s + i.qty * i.rate, 0);
    const gstAmt = Math.round(sub * gstPct / 100 * 100) / 100;
    const firstItem = validItems[0];

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
      roundingAmount: meta.roundingAmount || 0,
      billPdf: billPdf || undefined,
      billPdfName: billPdfName || undefined,
      paymentStatus: meta.paymentStatus,
      paymentDate: meta.paymentDate,
      shipmentStatus: meta.shipmentStatus,
      expectedDelivery: meta.expectedDelivery,
      actualReceiptDate: meta.actualReceiptDate,
      notes: meta.notes,
      gst: meta.gst,
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
                  <div className="mb-3">
                    <label className={labelCls}>Product Name *</label>
                    <input type="text" required placeholder="e.g. Musline Fabric" className={inputCls}
                      value={item.productName} onChange={(e) => updateItem(idx, "productName", e.target.value)} />
                  </div>
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
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${meta.applyGst ? "bg-black" : "bg-[#ddd]"}`}
                role="switch" aria-checked={meta.applyGst}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${meta.applyGst ? "translate-x-7" : "translate-x-1"}`} />
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

          {/* ─── Transport ─── */}
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><Truck size={13} /> Transport Charges (₹)</span>
            </label>
            <input type="number" min="0" step="0.01" placeholder="0 — added after GST"
              className={inputCls}
              value={meta.transport || ""}
              onChange={(e) => setMeta({ ...meta, transport: Number(e.target.value) })}
            />
            <p className="text-[11px] text-[#aaa] mt-1 ml-1">Transport is added after GST — not taxable</p>
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
          <div className="bg-black text-white rounded-2xl overflow-hidden">
            {/* Sub Total */}
            <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
              <span className="text-[11px] font-medium uppercase tracking-wider opacity-50">
                Sub Total ({items.length} item{items.length > 1 ? "s" : ""})
              </span>
              <span className="font-semibold opacity-80">₹{itemsSubtotal.toLocaleString("en-IN")}</span>
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
            {/* Transport */}
            {(meta.transport || 0) > 0 && (
              <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
                <span className="text-[11px] font-medium uppercase tracking-wider opacity-50">Transport</span>
                <span className="font-semibold opacity-80">+ ₹{(meta.transport || 0).toLocaleString("en-IN")}</span>
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
              <span className="text-[12px] font-medium uppercase tracking-wider opacity-60">Total</span>
              <span className="text-2xl font-bold">₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

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
                      onClick={() => window.open(billPdf!, "_blank")}
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

          <button type="submit" className="w-full bg-black text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-[#1a1a1a] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            {editingId ? "Update Order" : "Save Order"}
          </button>
        </form>
      )}
    </Drawer>
  );
}
