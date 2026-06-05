import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { InvoiceDetails, InvoiceRecord } from "./types";

const detailsKey = (id: string) => `biztrack_invoice_details_${id}`;

/** Persist the heavy details (original file + line items) separate from the summary. */
export async function saveInvoiceDetails(details: InvoiceDetails): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    try {
      localStorage.setItem(detailsKey(details.invoiceId), JSON.stringify(details));
    } catch (e) {
      console.warn("Could not cache invoice details locally", e);
    }
    return;
  }
  const { error } = await supabase
    .from("invoice_details")
    .upsert({ id: details.invoiceId, data: details }, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteInvoiceDetails(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    try { localStorage.removeItem(detailsKey(id)); } catch { /* ignore */ }
    return;
  }
  await supabase.from("invoice_details").delete().eq("id", id);
}

/** Fetch a single invoice's summary + details for the View Details page. */
export async function fetchInvoice(
  id: string
): Promise<{ summary: InvoiceRecord | null; details: InvoiceDetails | null }> {
  if (!isSupabaseConfigured || !supabase) {
    let summary: InvoiceRecord | null = null;
    let details: InvoiceDetails | null = null;
    try {
      const list = JSON.parse(localStorage.getItem("biztrack_invoices") || "[]") as InvoiceRecord[];
      summary = list.find((x) => x.id === id) ?? null;
      const d = localStorage.getItem(detailsKey(id));
      details = d ? (JSON.parse(d) as InvoiceDetails) : null;
    } catch { /* ignore */ }
    return { summary, details };
  }

  const [s, d] = await Promise.all([
    supabase.from("invoices").select("data").eq("id", id).maybeSingle(),
    supabase.from("invoice_details").select("data").eq("id", id).maybeSingle(),
  ]);
  return {
    summary: (s.data?.data as InvoiceRecord) ?? null,
    details: (d.data?.data as InvoiceDetails) ?? null,
  };
}
