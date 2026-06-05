export type GstType = "CGST/SGST" | "IGST" | null;

/** Clean summary record — safe for accounting, GST reports, dashboards. No line items. */
export interface InvoiceSummary {
  vendorName: string | null;
  gstNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD when parseable, else raw
  city: string | null;
  state: string | null;
  subtotal: number | null;
  gstAmount: number | null;
  totalAmount: number | null;
  gstType: GstType;
}

export interface InvoiceLineItem {
  description: string;
  qty: number | null;
  rate: number | null;
  amount: number | null;
}

/** Stored summary row (the "main record"). */
export interface InvoiceRecord extends InvoiceSummary {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
}

/** Heavy details kept out of the main record / list. */
export interface InvoiceDetails {
  invoiceId: string;
  lineItems: InvoiceLineItem[];
  rawText: string;
  fileData: string; // data URL of the original file
}

export interface ExtractionResult {
  summary: InvoiceSummary;
  lineItems: InvoiceLineItem[];
  rawText: string;
  source: "pdf-text" | "ocr";
}

export const EMPTY_SUMMARY: InvoiceSummary = {
  vendorName: null,
  gstNumber: null,
  invoiceNumber: null,
  invoiceDate: null,
  city: null,
  state: null,
  subtotal: null,
  gstAmount: null,
  totalAmount: null,
  gstType: null,
};
