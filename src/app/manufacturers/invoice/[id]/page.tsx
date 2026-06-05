"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchInvoice } from "@/lib/invoice/store";
import { InvoiceRecord, InvoiceDetails } from "@/lib/invoice/types";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

export default function InvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<InvoiceRecord | null>(null);
  const [details, setDetails] = useState<InvoiceDetails | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetchInvoice(id);
        if (!active) return;
        setSummary(res.summary);
        setDetails(res.details);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const money = (n: number | null | undefined) =>
    n != null ? `₹${n.toLocaleString("en-IN")}` : "—";

  const field = (label: string, value: React.ReactNode) => (
    <div className="bg-[#f5f5f5] border border-[#e8e8e8] rounded-xl p-4">
      <div className="text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1">{label}</div>
      <div className="font-bold text-black break-words">{value ?? "—"}</div>
    </div>
  );

  const isPdf = details?.fileData?.startsWith("data:application/pdf") || summary?.fileType?.includes("pdf");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/manufacturers" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#888] hover:text-black transition-colors mb-2">
            <ArrowLeft size={15} /> Back to Manufacturers
          </Link>
          <h2 className="text-2xl font-bold text-black tracking-tight">Invoice Details</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[#888]">
          <Loader2 size={20} className="animate-spin" /> Loading…
        </div>
      ) : !summary ? (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-10 text-center text-[#888]">
          Invoice not found.
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[#555] mb-4">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {field("Vendor / Manufacturer", summary.vendorName)}
              {field("GST Number", summary.gstNumber)}
              {field("Invoice No", summary.invoiceNumber)}
              {field("Invoice Date", summary.invoiceDate)}
              {field("City", summary.city)}
              {field("State", summary.state)}
              {field("GST Type", summary.gstType)}
              {field("Subtotal", money(summary.subtotal))}
              {field("GST Amount", money(summary.gstAmount))}
              {field("Total Amount", money(summary.totalAmount))}
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#e8e8e8] bg-[#fafafa]">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">Product Line Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white border-b border-[#e8e8e8]">
                  <tr>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider">Description</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider text-right">Qty</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider text-right">Rate</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#888] uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {(details?.lineItems ?? []).map((it, i) => (
                    <tr key={i} className="hover:bg-[#fafafa]">
                      <td className="px-5 py-3 text-black">{it.description}</td>
                      <td className="px-5 py-3 text-right text-[#888]">{it.qty ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-[#888]">{it.rate != null ? `₹${it.rate.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="px-5 py-3 text-right font-bold">{it.amount != null ? `₹${it.amount.toLocaleString("en-IN")}` : "—"}</td>
                    </tr>
                  ))}
                  {(!details || details.lineItems.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-[#888]">No line items were detected for this invoice.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Original document */}
          <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#e8e8e8] bg-[#fafafa] flex items-center gap-2">
              <FileText size={15} className="text-[#888]" />
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">Original Document</h3>
              <span className="text-xs text-[#888] ml-auto truncate">{summary.fileName}</span>
            </div>
            <div className="p-5">
              {!details?.fileData ? (
                <p className="text-sm text-[#888]">Original file is not available.</p>
              ) : isPdf ? (
                <iframe src={details.fileData} title="Invoice PDF" className="w-full h-[640px] rounded-xl border border-[#e8e8e8]" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={details.fileData} alt={summary.fileName} className="max-w-full rounded-xl border border-[#e8e8e8]" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
