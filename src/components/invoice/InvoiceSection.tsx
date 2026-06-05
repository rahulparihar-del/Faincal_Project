"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { extractInvoice, fileToDataUrl } from "@/lib/invoice/extract";
import { saveInvoiceDetails, deleteInvoiceDetails } from "@/lib/invoice/store";
import { InvoiceRecord, InvoiceLineItem, GstType } from "@/lib/invoice/types";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { UploadCloud, FileText, Loader2, Trash2, Eye, X, Sparkles } from "lucide-react";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

interface Draft {
  vendorName: string;
  gstNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  city: string;
  state: string;
  subtotal: string;
  gstAmount: string;
  totalAmount: string;
  gstType: string;
}

const emptyDraft: Draft = {
  vendorName: "", gstNumber: "", invoiceNumber: "", invoiceDate: "",
  city: "", state: "", subtotal: "", gstAmount: "", totalAmount: "", gstType: "",
};

const numOrNull = (s: string): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export function InvoiceSection() {
  const [invoices, setInvoices, ready] = useSupabaseTable<InvoiceRecord>("invoices", "biztrack_invoices", []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Extracted draft awaiting review/save
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState<{
    lineItems: InvoiceLineItem[];
    rawText: string;
    fileData: string;
    fileName: string;
    fileType: string;
    source: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    setProgress("Preparing…");
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File is larger than 10 MB.");
      }
      const [result, dataUrl] = await Promise.all([
        extractInvoice(file, setProgress),
        fileToDataUrl(file),
      ]);
      const s = result.summary;
      setDraft({
        vendorName: s.vendorName ?? "",
        gstNumber: s.gstNumber ?? "",
        invoiceNumber: s.invoiceNumber ?? "",
        invoiceDate: s.invoiceDate ?? "",
        city: s.city ?? "",
        state: s.state ?? "",
        subtotal: s.subtotal != null ? String(s.subtotal) : "",
        gstAmount: s.gstAmount != null ? String(s.gstAmount) : "",
        totalAmount: s.totalAmount != null ? String(s.totalAmount) : "",
        gstType: s.gstType ?? "",
      });
      setPending({
        lineItems: result.lineItems,
        rawText: result.rawText,
        fileData: dataUrl,
        fileName: file.name,
        fileType: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image"),
        source: result.source,
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not read the document. Try a clearer file.");
    } finally {
      setBusy(false);
      setProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const discardDraft = () => {
    setDraft(null);
    setPending(null);
  };

  const saveDraft = async () => {
    if (!draft || !pending) return;
    setSaving(true);
    try {
      const id = Date.now().toString();
      const record: InvoiceRecord = {
        id,
        vendorName: draft.vendorName.trim() || null,
        gstNumber: draft.gstNumber.trim().toUpperCase() || null,
        invoiceNumber: draft.invoiceNumber.trim() || null,
        invoiceDate: draft.invoiceDate || null,
        city: draft.city.trim() || null,
        state: draft.state.trim() || null,
        subtotal: numOrNull(draft.subtotal),
        gstAmount: numOrNull(draft.gstAmount),
        totalAmount: numOrNull(draft.totalAmount),
        gstType: (draft.gstType || null) as GstType,
        fileName: pending.fileName,
        fileType: pending.fileType,
        uploadedAt: new Date().toISOString(),
      };
      await saveInvoiceDetails({
        invoiceId: id,
        lineItems: pending.lineItems,
        rawText: pending.rawText,
        fileData: pending.fileData,
      });
      setInvoices((prev) => [record, ...prev]);
      discardDraft();
    } catch (e) {
      console.error(e);
      setError("Saved fields but failed to store the file. Is the invoices table set up in Supabase?");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setInvoices((prev) => prev.filter((x) => x.id !== id));
    setDeletingId(null);
    await deleteInvoiceDetails(id);
  };

  const set = (k: keyof Draft, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const inputCls =
    "w-full bg-[#f5f5f5] border border-[#e8e8e8] rounded-lg px-3 py-2 text-sm font-medium text-black placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#ccc] transition-colors";
  const labelCls = "block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1";

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="px-5 py-4 border-b border-[#e8e8e8] bg-[#fafafa] flex items-center gap-2">
        <Sparkles size={15} className="text-[#888]" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">Invoice / Bill Scanner</h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Upload zone */}
        {!draft && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              dragOver ? "border-black bg-[#f5f5f5]" : "border-[#e0e0e0]"
            } ${busy ? "opacity-70 pointer-events-none" : ""}`}
          >
            {busy ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-[#666] animate-spin" />
                <p className="text-sm font-medium text-[#666]">{progress || "Analyzing…"}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
                  <UploadCloud size={22} className="text-[#666]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-black">Drop an invoice here, or click to upload</p>
                  <p className="text-xs text-[#888] mt-1">PDF, JPG, JPEG or PNG — scanned, digital, or phone photo</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors"
                >
                  Choose File
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Extracted draft — editable preview */}
        {draft && pending && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-black">
                <FileText size={16} className="text-[#666]" />
                {pending.fileName}
                <span className="text-[11px] font-medium text-[#888] uppercase tracking-wider bg-[#f5f5f5] px-2 py-0.5 rounded">
                  {pending.source === "ocr" ? "OCR" : "PDF text"}
                </span>
              </div>
              <button onClick={discardDraft} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5]" aria-label="Discard">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[#888]">Review the auto-extracted fields and correct anything before saving.</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Vendor / Manufacturer</label>
                <input className={inputCls} value={draft.vendorName} onChange={(e) => set("vendorName", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>GST Number</label>
                <input className={inputCls} value={draft.gstNumber} onChange={(e) => set("gstNumber", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Invoice No</label>
                <input className={inputCls} value={draft.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Invoice Date</label>
                <input type="date" className={inputCls} value={draft.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={draft.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input className={inputCls} value={draft.state} onChange={(e) => set("state", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Subtotal (₹)</label>
                <input type="number" step="0.01" className={inputCls} value={draft.subtotal} onChange={(e) => set("subtotal", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>GST Amount (₹)</label>
                <input type="number" step="0.01" className={inputCls} value={draft.gstAmount} onChange={(e) => set("gstAmount", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Total (₹)</label>
                <input type="number" step="0.01" className={inputCls} value={draft.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>GST Type</label>
                <select className={inputCls} value={draft.gstType} onChange={(e) => set("gstType", e.target.value)}>
                  <option value="">—</option>
                  <option value="CGST/SGST">CGST/SGST</option>
                  <option value="IGST">IGST</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs text-[#888]">
                {pending.lineItems.length} line item(s) detected — saved to View Details, not the summary.
              </span>
              <div className="flex items-center gap-2">
                <button onClick={discardDraft} className="px-4 py-2.5 rounded-xl font-bold text-sm border border-[#e0e0e0] text-[#444] hover:bg-[#f5f5f5] transition-colors">
                  Discard
                </button>
                <button
                  onClick={saveDraft}
                  disabled={saving}
                  className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Invoice"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoices list */}
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-y border-[#e8e8e8] bg-[#fafafa]">
              <tr>
                <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider">Vendor</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider">GST No</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider">Invoice No</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider text-right">Total</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider text-center">GST</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#fafafa] transition-colors relative">
                  <td className="px-5 py-3 font-semibold text-black">{inv.vendorName || "—"}</td>
                  <td className="px-5 py-3 text-[#888] font-mono text-xs">{inv.gstNumber || "—"}</td>
                  <td className="px-5 py-3 text-[#888]">{inv.invoiceNumber || "—"}</td>
                  <td className="px-5 py-3 text-[#888]">{inv.invoiceDate || "—"}</td>
                  <td className="px-5 py-3 text-right font-bold">
                    {inv.totalAmount != null ? `₹${inv.totalAmount.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {inv.gstType ? (
                      <span className="bg-[#f0f0f0] text-[#555] px-2 py-1 rounded-lg text-xs font-bold">{inv.gstType}</span>
                    ) : (
                      <span className="text-[#aaa]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/manufacturers/invoice/${inv.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        aria-label="View details"
                      >
                        <Eye size={14} />
                      </Link>
                      <button
                        onClick={() => setDeletingId(inv.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:text-black hover:bg-[#f5f5f5] transition-colors"
                        aria-label="Delete invoice"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ConfirmDelete
                      isOpen={deletingId === inv.id}
                      onConfirm={() => handleDelete(inv.id)}
                      onCancel={() => setDeletingId(null)}
                      message="Delete invoice?"
                    />
                  </td>
                </tr>
              ))}
              {ready && invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[#888]">
                    No invoices yet. Upload a bill above to extract its details automatically.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
