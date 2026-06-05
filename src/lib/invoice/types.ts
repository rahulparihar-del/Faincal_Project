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
  confidence?: Record<string, number>;
}

export interface ExtractionResult {
  fields: ExtractedFields;
  lineItems: InvoiceLineItem[];
  rawText: string;
  source: "pdf-text" | "ocr";
}

/** Per-field extraction result with a 0..1 confidence score. */
export interface FieldResult<T> {
  value: T | null;
  confidence: number;
}

export interface ExtractedFields {
  vendorName: FieldResult<string>;
  gstNumber: FieldResult<string>;
  invoiceNumber: FieldResult<string>;
  invoiceDate: FieldResult<string>;
  city: FieldResult<string>;
  state: FieldResult<string>;
  subtotal: FieldResult<number>;
  gstAmount: FieldResult<number>;
  totalAmount: FieldResult<number>;
  gstType: FieldResult<GstType>;
}

/** Fields below this confidence are flagged for manual review before saving. */
export const CONFIDENCE_THRESHOLD = 0.8;

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
