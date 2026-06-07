"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";
import { Manufacturer, PurchaseOrder, PurchaseItem } from "@/lib/types";
import { gsap } from "gsap";
import {
  ArrowLeft, Edit2, Save, X, Phone, MapPin, Package,
  CheckCircle2, Clock, Truck, FileText, ChevronDown, ChevronRight,
  IndianRupee, ShoppingBag, AlertCircle, Upload,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────── */
function getItems(p: PurchaseOrder): PurchaseItem[] {
  if (p.items && p.items.length > 0) return p.items;
  return [{ productName: p.productName, qty: p.qty, rate: p.rate }];
}
function getSubtotal(p: PurchaseOrder): number {
  return getItems(p).reduce((s, i) => s + i.qty * i.rate, 0);
}
function getGrandTotal(p: PurchaseOrder): number {
  const sub = getSubtotal(p);
  const gst = p.gstAmount ?? (sub * (p.gstPercent ?? 0) / 100);
  return sub + gst + (p.transport ?? 0) + (p.roundingAmount ?? 0);
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
  const [viewingPdf, setViewingPdf] = useState<{ pdf: string; filename: string } | null>(null);
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
          pdf={viewingPdf.pdf}
          filename={viewingPdf.filename}
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
          <div className="divide-y divide-[#f5f5f5]">
            {mfgPurchases.map((p) => {
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
                        {isMulti ? (
                          <div>
                            <div className="font-semibold text-black text-sm">{items.length} products</div>
                            <div className="text-xs text-[#aaa] mt-0.5 truncate">
                              {items.map(i => i.productName).join(" · ")}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-black text-sm">{items[0].productName}</div>
                            <div className="text-xs text-[#aaa] mt-0.5">{items[0].qty} × ₹{items[0].rate.toLocaleString("en-IN")}</div>
                          </div>
                        )}
                      </div>

                      {/* Type badge */}
                      <span className={`hidden sm:block px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${p.orderType === "Sample" ? "bg-[#f0f0f0] text-[#555]" : "bg-black text-white"}`}>
                        {p.orderType === "Sample" ? "★ Sample" : "Bulk"}
                      </span>

                      {/* Total */}
                      <div className="text-right shrink-0">
                        <div className="font-bold text-black text-sm">₹{grandTotal.toLocaleString("en-IN")}</div>
                        {gstPct > 0 && <div className="text-[10px] text-[#aaa]">+{gstPct}% GST</div>}
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

                      {/* Bill PDF icon */}
                      {p.billPdf && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingPdf({ pdf: p.billPdf!, filename: p.billPdfName || "Bill.pdf" });
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors shrink-0"
                          title={p.billPdfName || "View Bill"}
                        >
                          <FileText size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded breakdown */}
                  {isMulti && isExpanded && (
                    <div className="px-16 pb-4 bg-[#fafafa] border-t border-[#f0f0f0]">
                      <table className="w-full text-sm mt-3">
                        <thead>
                          <tr className="text-[11px] font-bold text-[#bbb] uppercase tracking-wider border-b border-[#eee]">
                            <th className="pb-2 text-left w-6">#</th>
                            <th className="pb-2 text-left">Product</th>
                            <th className="pb-2 text-right">Qty</th>
                            <th className="pb-2 text-right">Rate</th>
                            <th className="pb-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f5f5f5]">
                          {items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-2 text-[#ccc] text-xs">{idx + 1}</td>
                              <td className="py-2 font-medium text-black">{it.productName}</td>
                              <td className="py-2 text-right text-[#888]">{it.qty.toLocaleString("en-IN")}</td>
                              <td className="py-2 text-right text-[#888]">₹{it.rate.toLocaleString("en-IN")}</td>
                              <td className="py-2 text-right font-semibold">₹{(it.qty * it.rate).toLocaleString("en-IN")}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-[#e8e8e8] text-[#999]">
                            <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">Sub Total</td>
                            <td className="py-1.5 text-right text-sm font-semibold">₹{subtotal.toLocaleString("en-IN")}</td>
                          </tr>
                          {gstPct > 0 && (
                            <tr className="text-[#999]">
                              <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">IGST {gstPct}%</td>
                              <td className="py-1.5 text-right text-sm font-semibold">₹{gstAmt.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          {transport > 0 && (
                            <tr className="text-[#999]">
                              <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">Transport</td>
                              <td className="py-1.5 text-right text-sm font-semibold">₹{transport.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          {rounding !== 0 && (
                            <tr className="text-[#999]">
                              <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider">Rounding</td>
                              <td className="py-1.5 text-right text-sm font-semibold">{rounding >= 0 ? "+" : ""}₹{rounding.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          <tr className="border-t border-[#e0e0e0]">
                            <td colSpan={4} className="py-2 text-right text-[12px] font-bold text-black uppercase tracking-wider">Total</td>
                            <td className="py-2 text-right text-base font-bold text-black">₹{grandTotal.toLocaleString("en-IN")}</td>
                          </tr>
                          {p.paymentStatus !== "Paid" && (
                            <>
                              <tr className="text-[#999]">
                                <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-right">Paid Amount</td>
                                <td className="py-1.5 text-right text-sm font-semibold text-green-600">₹{(p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0).toLocaleString("en-IN")}</td>
                              </tr>
                              <tr className="text-[#999]">
                                <td colSpan={4} className="py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-right">Balance Pending</td>
                                <td className="py-1.5 text-right text-sm font-semibold text-red-500">₹{(grandTotal - (p.paymentStatus === "Partial" ? (p.paidAmount ?? 0) : 0)).toLocaleString("en-IN")}</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
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
