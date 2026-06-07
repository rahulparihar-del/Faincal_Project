"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useData } from "@/context/DataContext";
import { MeeshoOrder } from "@/lib/types";
import {
  ScanLine,
  X,
  Package,
  CheckCircle2,
  Truck,
  ChevronDown,
  Trash2,
  AlertCircle,
  ClipboardList,
  CalendarDays,
  IndianRupee,
  Hash,
  User,
  Tag,
  Ruler,
  Palette,
  MessageSquare,
  Camera,
  FileImage,
  Loader2,
  Sparkles,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayDate = () => new Date().toISOString().split("T")[0];
const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const STATUS_CONFIG = {
  Packed: { label: "Packed", bg: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  Shipped: { label: "Shipped", bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.25)" },
  RTO: { label: "RTO", bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.25)" },
} as const;

// ─── OCR Parser: Extract Meesho Bill Data from Raw Text ───────────────────────
interface ParsedBill {
  orderNo: string;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerPincode: string;
  sku: string;
  size: string;
  color: string;
  qty: number;
  courier: string;
}

function parseMeeshoBill(rawText: string): ParsedBill {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ParsedBill = {
    orderNo: "",
    customerName: "",
    customerAddress: "",
    customerCity: "",
    customerPincode: "",
    sku: "",
    size: "",
    color: "",
    qty: 1,
    courier: "",
  };

  // ── Order Number ──
  // The long numeric barcode number (13-20 digits) at the bottom
  const orderNoMatch = rawText.match(/\b(\d{13,20})\b/);
  if (orderNoMatch) result.orderNo = orderNoMatch[1];

  // Also try "Order No." pattern
  const orderNoLabel = rawText.match(/order\s*no\.?\s*[:\-]?\s*([A-Z0-9_\-]{8,})/i);
  if (orderNoLabel) result.orderNo = orderNoLabel[1];

  // ── Customer Name ──
  // On Meesho bills, "Customer Address" appears as a bold section header
  // The name is usually the first bold/ALL-CAPS line after it
  const custAddrIdx = lines.findIndex((l) => /customer\s*address/i.test(l));
  if (custAddrIdx >= 0 && custAddrIdx + 1 < lines.length) {
    // Next non-empty line after "Customer Address" is the name
    const nameLine = lines[custAddrIdx + 1];
    if (nameLine && !/prepaid|do not|xpress|shadowfax|delhivery|shiprocket|pickup|destination|return code/i.test(nameLine)) {
      result.customerName = nameLine;
    }
  }

  // ── Pincode ──
  const pincodeMatch = rawText.match(/\b(\d{6})\b/g);
  if (pincodeMatch) {
    // Pick the one that appears after customer address section
    const afterCustomer = rawText.slice(rawText.search(/customer\s*address/i));
    const pinInSection = afterCustomer.match(/\b(\d{6})\b/);
    if (pinInSection) result.customerPincode = pinInSection[1];
    else result.customerPincode = pincodeMatch[0];
  }

  // ── Address (lines between name and "If undelivered") ──
  if (custAddrIdx >= 0) {
    const addrLines: string[] = [];
    const endIdx = lines.findIndex((l, i) => i > custAddrIdx && /if undelivered|return to|prepaid|xpress|destination/i.test(l));
    const stop = endIdx > 0 ? endIdx : Math.min(custAddrIdx + 6, lines.length);
    for (let i = custAddrIdx + 2; i < stop; i++) {
      const l = lines[i];
      if (l && !/customer address/i.test(l)) addrLines.push(l);
    }
    const addrText = addrLines.join(", ");
    // Extract city (usually last part before pincode)
    const cityPinMatch = addrText.match(/([A-Za-z\s]+),?\s*(\d{6})/);
    if (cityPinMatch) {
      result.customerCity = cityPinMatch[1].trim();
    } else {
      // Try to find city from District pattern
      const districtMatch = addrText.match(/([A-Za-z\s]+)\s*district/i);
      if (districtMatch) result.customerCity = districtMatch[1].trim();
    }
    result.customerAddress = addrLines.slice(0, -1).join(", ").replace(/,\s*$/, "");
  }

  // ── Courier ──
  if (/xpress\s*bees/i.test(rawText)) result.courier = "Xpress Bees";
  else if (/delhivery/i.test(rawText)) result.courier = "Delhivery";
  else if (/shadowfax/i.test(rawText)) result.courier = "Shadowfax";
  else if (/ecom\s*express/i.test(rawText)) result.courier = "Ecom Express";
  else if (/shiprocket/i.test(rawText)) result.courier = "Shiprocket";
  else if (/bluedart/i.test(rawText)) result.courier = "BlueDart";
  else if (/dtdc/i.test(rawText)) result.courier = "DTDC";

  // ── SKU ──
  // Usually in "Product Details" section. Meesho SKU format: letters-letters-letters
  const skuMatch = rawText.match(/\b([A-Z]{2,}-[A-Z0-9\-]{2,})\b/);
  if (skuMatch) result.sku = skuMatch[1];

  // ── Size ──
  const sizePatterns = [
    /\b(\d{1,2}\s*-\s*\d{1,2}\s*(?:years?|yrs?|months?|mos?|m))\b/i,
    /\bsize\s*[:\-]?\s*([A-Z0-9\/]+)\b/i,
    /\b(XS|S|M|L|XL|XXL|XXXL|2XL|3XL)\b/,
    /\b(\d{1,2}\s*-\s*\d{1,2}\s*(?:Y|Yr))\b/i,
    /\b(Free\s*Size)\b/i,
  ];
  for (const p of sizePatterns) {
    const m = rawText.match(p);
    if (m) { result.size = m[1].trim(); break; }
  }

  // ── Color ──
  const colorMatch = rawText.match(/\bcolor\s*[:\-]?\s*([A-Za-z\s]+?)(?:\n|$|\|)/i);
  if (colorMatch && !/^(na|nil|none|n\/a)$/i.test(colorMatch[1].trim())) {
    result.color = colorMatch[1].trim();
  }

  // ── Qty ──
  const qtyMatch = rawText.match(/\bqty\s*[:\-]?\s*(\d+)\b/i);
  if (qtyMatch) result.qty = parseInt(qtyMatch[1], 10) || 1;

  return result;
}

// ─── Bill Scanner (Camera + OCR) ──────────────────────────────────────────────
type ScanMode = "choose" | "ocr" | "barcode";

function BillScanner({
  onResult,
  onClose,
}: {
  onResult: (parsed: Partial<ParsedBill> & { rawText?: string }) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ScanMode>("choose");
  const [ocrStatus, setOcrStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeScanning, setBarcodeScanning] = useState(false);

  // ── Stop stream on unmount ──
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── Start camera for OCR photo ──
  const startOcrCamera = useCallback(async () => {
    setMode("ocr");
    setOcrStatus("idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setOcrStatus("error");
    }
  }, []);

  // ── Capture frame and run OCR ──
  const captureAndOcr = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setOcrStatus("processing");
    setOcrProgress(0);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setOcrPreview(dataUrl);

    // Stop camera stream to save battery
    streamRef.current?.getTracks().forEach((t) => t.stop());

    try {
      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(dataUrl, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const rawText = data.text;
      const parsed = parseMeeshoBill(rawText);
      setOcrStatus("done");

      setTimeout(() => {
        onResult({ ...parsed, rawText });
      }, 600);
    } catch {
      setOcrStatus("error");
    }
  }, [onResult]);

  // ── Upload image for OCR ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMode("ocr");
    setOcrStatus("processing");
    setOcrProgress(0);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setOcrPreview(dataUrl);
      try {
        const Tesseract = await import("tesseract.js");
        const { data } = await Tesseract.recognize(dataUrl, "eng", {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100));
          },
        });
        const parsed = parseMeeshoBill(data.text);
        setOcrStatus("done");
        setTimeout(() => onResult({ ...parsed, rawText: data.text }), 600);
      } catch {
        setOcrStatus("error");
      }
    };
    reader.readAsDataURL(file);
  }, [onResult]);

  // ── Barcode scan mode ──
  const startBarcodeMode = useCallback(async () => {
    setMode("barcode");
    setBarcodeScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { NotFoundException } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      let cancelled = false;

      const decode = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const result = await reader.decodeOnceFromVideoElement(videoRef.current);
          if (!cancelled) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            onResult({ orderNo: result.getText() });
          }
        } catch (e) {
          if (e instanceof NotFoundException || (e as Error)?.name === "NotFoundException") {
            if (!cancelled) setTimeout(decode, 300);
          } else {
            if (!cancelled) setTimeout(decode, 500);
          }
        }
      };
      decode();
    } catch {
      setBarcodeError("Camera access denied. Please allow camera access.");
      setBarcodeScanning(false);
    }
  }, [onResult]);

  // ── Choose screen ──
  if (mode === "choose") {
    return (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
        <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
            <div className="font-bold text-black">Scan Meesho Bill</div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f5]">
              <X size={16} className="text-[#666]" />
            </button>
          </div>
          <div className="px-5 py-5 space-y-3">
            {/* Option 1 — OCR (recommended) */}
            <button
              onClick={startOcrCamera}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-black bg-black text-white hover:bg-[#111] transition-colors active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Camera size={22} className="text-white" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm flex items-center gap-2">
                  Scan Full Bill <Sparkles size={12} className="text-yellow-300" />
                </div>
                <div className="text-[11px] text-white/60 mt-0.5">
                  Take a photo → auto-fills all details (name, address, SKU, size…)
                </div>
              </div>
            </button>

            {/* Option 2 — Upload image */}
            <label className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#e8e8e8] bg-white hover:bg-[#fafafa] transition-colors cursor-pointer active:scale-[0.98]">
              <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center shrink-0">
                <FileImage size={22} className="text-[#555]" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-black">Upload Bill Photo</div>
                <div className="text-[11px] text-[#888] mt-0.5">
                  Choose existing photo from gallery
                </div>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>

            {/* Option 3 — Barcode only */}
            <button
              onClick={startBarcodeMode}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#e8e8e8] bg-white hover:bg-[#fafafa] transition-colors active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center shrink-0">
                <ScanLine size={22} className="text-[#555]" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-black">Scan Barcode Only</div>
                <div className="text-[11px] text-[#888] mt-0.5">
                  Scans order number only — fill rest manually
                </div>
              </div>
            </button>

            <p className="text-center text-[11px] text-[#bbb] pb-1">
              💡 Tip: &quot;Scan Full Bill&quot; reads all printed text automatically
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── OCR Camera / Processing ──
  if (mode === "ocr") {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-black/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Camera size={16} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">
                {ocrStatus === "processing" ? "Reading Bill…" :
                 ocrStatus === "done" ? "Done! ✓" :
                 ocrStatus === "error" ? "Error" :
                 "Point at full Meesho bill"}
              </div>
              <div className="text-white/50 text-[11px]">
                {ocrStatus === "idle" ? "Fit entire bill in frame, then tap capture" :
                 ocrStatus === "processing" ? `Scanning text… ${ocrProgress}%` :
                 ocrStatus === "done" ? "Details extracted successfully!" :
                 "Could not read text. Try better lighting."}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10">
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Camera / Preview */}
        <div className="flex-1 relative overflow-hidden">
          {/* Preview image when processing */}
          {ocrPreview && (
            <img src={ocrPreview} alt="Bill preview" className="absolute inset-0 w-full h-full object-contain bg-black" />
          )}

          {/* Live video (hidden once captured) */}
          {!ocrPreview && (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Bill frame guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-dashed border-white/40 rounded-2xl"
                  style={{ width: "85%", height: "65%" }}>
                  <div className="absolute -top-5 left-0 right-0 text-center">
                    <span className="text-white/60 text-xs font-medium bg-black/40 px-3 py-1 rounded-full">
                      Fit entire Meesho bill inside
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Processing overlay */}
          {ocrStatus === "processing" && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-4">
              <Loader2 size={36} className="text-white animate-spin" />
              <div className="text-white font-bold text-sm">Reading bill text…</div>
              <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
              <div className="text-white/60 text-xs">{ocrProgress}%</div>
            </div>
          )}

          {/* Done overlay */}
          {ocrStatus === "done" && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <div className="text-white font-bold">Details extracted!</div>
            </div>
          )}

          {/* Error overlay */}
          {ocrStatus === "error" && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 px-8 text-center">
              <AlertCircle size={36} className="text-red-400" />
              <div className="text-white font-bold">Could not read text</div>
              <div className="text-white/60 text-sm">Ensure the bill is well-lit and in focus</div>
              <button
                onClick={() => { setOcrStatus("idle"); setOcrPreview(null); startOcrCamera(); }}
                className="px-6 py-2.5 bg-white text-black font-bold rounded-xl text-sm"
              >Try Again</button>
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Capture button */}
        {ocrStatus === "idle" && (
          <div className="p-6 flex justify-center bg-black">
            <button
              onClick={captureAndOcr}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_0_4px_rgba(255,255,255,0.3)] active:scale-95 transition-transform"
            >
              <Camera size={28} className="text-black" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Barcode scan mode ──
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <ScanLine size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Scan Barcode</div>
            <div className="text-white/50 text-[11px]">Point at bottom barcode on Meesho bill</div>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10">
          <X size={18} className="text-white" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {barcodeError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-white/80 text-sm">{barcodeError}</p>
            <button onClick={onClose} className="px-6 py-2.5 bg-white text-black font-bold rounded-xl text-sm">Go Back</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-72 h-40">
                {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => (
                  <div key={pos} className={`absolute w-8 h-8 border-white/80 border-[3px] ${
                    pos === "top-left" ? "top-0 left-0 border-r-0 border-b-0 rounded-tl-md" :
                    pos === "top-right" ? "top-0 right-0 border-l-0 border-b-0 rounded-tr-md" :
                    pos === "bottom-left" ? "bottom-0 left-0 border-r-0 border-t-0 rounded-bl-md" :
                    "bottom-0 right-0 border-l-0 border-t-0 rounded-br-md"
                  }`} />
                ))}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
                    style={{ animation: "scanLine 2s ease-in-out infinite" }} />
                </div>
              </div>
            </div>
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <div className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full flex items-center gap-2">
                {barcodeScanning && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                <span className="text-white/80 text-xs font-medium">
                  {barcodeScanning ? "Scanning… hold steady" : "Starting…"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes scanLine { 0% { top: 4px; } 50% { top: calc(100% - 4px); } 100% { top: 4px; } }`}</style>
    </div>
  );
}

// ─── Order Form ────────────────────────────────────────────────────────────────
type DraftOrder = Omit<MeeshoOrder, "id" | "scannedAt">;

function OrderForm({
  prefill,
  rawOcrText,
  onSave,
  onClose,
}: {
  prefill: Partial<ParsedBill>;
  rawOcrText?: string;
  onSave: (draft: DraftOrder) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DraftOrder>({
    date: todayDate(),
    orderNo: prefill.orderNo ?? "",
    customerName: prefill.customerName ?? "",
    customerAddress: prefill.customerAddress ?? "",
    customerCity: prefill.customerCity ?? "",
    customerPincode: prefill.customerPincode ?? "",
    sku: prefill.sku ?? "",
    productName: "",
    size: prefill.size ?? "",
    color: prefill.color ?? "",
    qty: prefill.qty ?? 1,
    sellingPrice: 0,
    courier: prefill.courier ?? "Xpress Bees",
    status: "Packed",
    notes: "",
  });

  const [showRaw, setShowRaw] = useState(false);

  const set = <K extends keyof DraftOrder>(key: K, val: DraftOrder[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const inputCls =
    "w-full bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3.5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#bbb] transition-colors placeholder-[#bbb]";
  const labelCls = "flex items-center gap-1.5 text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1.5";

  // Count how many fields were auto-filled
  const autoFilledCount = [
    prefill.orderNo, prefill.customerName, prefill.customerAddress,
    prefill.customerCity, prefill.customerPincode,
    prefill.sku, prefill.size, prefill.color, prefill.courier,
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] bg-white sticky top-0 z-10">
          <div>
            <div className="font-bold text-black text-base">Order Details</div>
            {autoFilledCount > 0 ? (
              <div className="text-[11px] text-green-600 mt-0.5 font-semibold flex items-center gap-1">
                <Sparkles size={10} />
                {autoFilledCount} fields auto-filled from bill
              </div>
            ) : (
              <div className="text-[11px] text-[#888] mt-0.5">Fill in details from the Meesho bill</div>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f5] hover:bg-[#eee] transition-colors">
            <X size={16} className="text-[#666]" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Auto-fill banner */}
          {autoFilledCount > 0 && (
            <div className="bg-gradient-to-r from-[#f0fdf4] to-[#eff6ff] border border-[#bbf7d0] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={13} className="text-green-600" />
                <div className="text-xs font-bold text-green-700">Auto-filled from bill scan</div>
              </div>
              <div className="text-[11px] text-[#555]">
                Review and correct any fields below. Highlighted fields were read from your bill.
              </div>
              {rawOcrText && (
                <button onClick={() => setShowRaw(!showRaw)} className="mt-2 text-[10px] text-blue-500 font-semibold underline">
                  {showRaw ? "Hide" : "Show"} raw scan text
                </button>
              )}
              {showRaw && rawOcrText && (
                <pre className="mt-2 text-[10px] text-[#666] bg-white/60 rounded-lg p-2 overflow-auto max-h-28 whitespace-pre-wrap font-mono">
                  {rawOcrText}
                </pre>
              )}
            </div>
          )}

          {/* Order No */}
          <div>
            <label className={labelCls}><Hash size={11} /> Order Number</label>
            <input
              className={`${inputCls} ${prefill.orderNo ? "border-green-300 bg-[#f0fdf4]" : ""}`}
              value={form.orderNo}
              onChange={(e) => set("orderNo", e.target.value)}
              placeholder="e.g. 29489332911..."
            />
          </div>

          {/* Date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><CalendarDays size={11} /> Pack Date</label>
              <input type="date" className={inputCls} value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}><CheckCircle2 size={11} /> Status</label>
              <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value as MeeshoOrder["status"])}>
                <option value="Packed">Packed</option>
                <option value="Shipped">Shipped</option>
                <option value="RTO">RTO</option>
              </select>
            </div>
          </div>

          <div className="border-t border-dashed border-[#eee] pt-3">
            <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-widest mb-3">Customer Info</div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}><User size={11} /> Customer Name</label>
                <input
                  className={`${inputCls} ${prefill.customerName ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                  value={form.customerName}
                  onChange={(e) => set("customerName", e.target.value)}
                  placeholder="e.g. Kundan Kumar"
                />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input
                  className={`${inputCls} ${prefill.customerAddress ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                  value={form.customerAddress}
                  onChange={(e) => set("customerAddress", e.target.value)}
                  placeholder="Street / Area"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>City</label>
                  <input
                    className={`${inputCls} ${prefill.customerCity ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                    value={form.customerCity}
                    onChange={(e) => set("customerCity", e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className={labelCls}>Pincode</label>
                  <input
                    className={`${inputCls} ${prefill.customerPincode ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                    value={form.customerPincode}
                    onChange={(e) => set("customerPincode", e.target.value)}
                    placeholder="6-digit"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-[#eee] pt-3">
            <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-widest mb-3">Product Info</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><Tag size={11} /> SKU</label>
                  <input
                    className={`${inputCls} ${prefill.sku ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                    placeholder="e.g. KDK-YELLOW-BOY"
                  />
                </div>
                <div>
                  <label className={labelCls}><Ruler size={11} /> Size</label>
                  <input
                    className={`${inputCls} ${prefill.size ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                    value={form.size}
                    onChange={(e) => set("size", e.target.value)}
                    placeholder="e.g. 3-4 Years"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Product Name</label>
                <input className={inputCls} value={form.productName} onChange={(e) => set("productName", e.target.value)} placeholder="e.g. Boys Yellow T-Shirt" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}><Palette size={11} /> Color</label>
                  <input
                    className={`${inputCls} ${prefill.color ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                    value={form.color}
                    onChange={(e) => set("color", e.target.value)}
                    placeholder="NA"
                  />
                </div>
                <div>
                  <label className={labelCls}>Qty</label>
                  <input
                    className={`${inputCls} ${prefill.qty && prefill.qty > 1 ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                    type="number" min={1}
                    value={form.qty}
                    onChange={(e) => set("qty", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className={labelCls}><IndianRupee size={11} /> Price</label>
                  <input type="number" min={0} className={inputCls} value={form.sellingPrice || ""} onChange={(e) => set("sellingPrice", Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className={labelCls}><Truck size={11} /> Courier</label>
                <input
                  className={`${inputCls} ${prefill.courier ? "border-green-300 bg-[#f0fdf4]" : ""}`}
                  value={form.courier}
                  onChange={(e) => set("courier", e.target.value)}
                  placeholder="e.g. Xpress Bees"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-[#eee] pt-3">
            <label className={labelCls}><MessageSquare size={11} /> Notes</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes…" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#f0f0f0] bg-white flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#e8e8e8] text-sm font-bold text-[#666] hover:bg-[#f5f5f5] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.orderNo && !form.customerName}
            className="flex-grow py-3 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Package size={15} /> Save Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onDelete }: { order: MeeshoOrder; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];
  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition-shadow">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left px-4 py-3.5 flex items-start gap-3">
        <div className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-black text-sm leading-tight truncate">{order.customerName || "—"}</div>
              <div className="text-[11px] text-[#888] mt-0.5 font-mono truncate">#{order.orderNo || "—"}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>{cfg.label}</span>
              <ChevronDown size={14} className={`text-[#aaa] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {order.sku && <span className="text-[11px] bg-[#f5f5f5] text-[#666] px-2 py-0.5 rounded-md font-medium">{order.sku}</span>}
            {order.size && <span className="text-[11px] text-[#888]">Size: {order.size}</span>}
            {order.qty > 0 && <span className="text-[11px] text-[#888]">Qty: {order.qty}</span>}
            {order.sellingPrice > 0 && <span className="text-[11px] font-bold text-black">₹{order.sellingPrice.toLocaleString("en-IN")}</span>}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#f5f5f5] space-y-3">
          {(order.customerAddress || order.customerCity || order.customerPincode) && (
            <div className="bg-[#fafafa] rounded-xl p-3">
              <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-1">Delivery Address</div>
              <div className="text-sm text-[#333] leading-relaxed">
                {[order.customerAddress, order.customerCity, order.customerPincode].filter(Boolean).join(", ")}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {order.productName && (
              <div className="col-span-2 bg-[#fafafa] rounded-xl p-3">
                <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Product</div>
                <div className="font-semibold text-black">{order.productName}</div>
              </div>
            )}
            {order.color && (
              <div className="bg-[#fafafa] rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Color</div>
                <div className="font-semibold text-black">{order.color}</div>
              </div>
            )}
            {order.courier && (
              <div className="bg-[#fafafa] rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-0.5">Courier</div>
                <div className="font-semibold text-black">{order.courier}</div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#aaa]">Scanned {fmtTime(order.scannedAt)}</span>
            <button onClick={onDelete} className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-600 transition-colors">
              <Trash2 size={12} /> Delete
            </button>
          </div>
          {order.notes && <div className="text-[12px] text-[#777] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3 py-2">{order.notes}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MeeshoOrders() {
  const { meeshoOrders, setMeeshoOrders } = useData();
  const [showScanner, setShowScanner] = useState(false);
  const [prefillData, setPrefillData] = useState<(Partial<ParsedBill> & { rawText?: string }) | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "all">("today");
  const [dateFilter, setDateFilter] = useState(todayDate());

  const todayStr = todayDate();
  const todayOrders = useMemo(() => meeshoOrders.filter((o) => o.date === todayStr), [meeshoOrders, todayStr]);
  const filteredOrders = useMemo(() => {
    if (activeTab === "today") return todayOrders;
    if (dateFilter) return meeshoOrders.filter((o) => o.date === dateFilter);
    return meeshoOrders;
  }, [meeshoOrders, todayOrders, activeTab, dateFilter]);

  const todayStats = useMemo(() => ({
    count: todayOrders.length,
    qty: todayOrders.reduce((s, o) => s + o.qty, 0),
    revenue: todayOrders.filter((o) => o.status !== "RTO").reduce((s, o) => s + o.sellingPrice, 0),
  }), [todayOrders]);

  const handleScanResult = useCallback((data: Partial<ParsedBill> & { rawText?: string }) => {
    setShowScanner(false);
    setPrefillData(data);
  }, []);

  const handleSaveOrder = (draft: DraftOrder) => {
    const order: MeeshoOrder = { ...draft, id: Date.now().toString(), scannedAt: new Date().toISOString() };
    setMeeshoOrders((prev) => [order, ...prev]);
    setPrefillData(null);
  };

  const groupedByDate = useMemo(() => {
    if (activeTab === "today") return null;
    const groups: Record<string, MeeshoOrder[]> = {};
    filteredOrders.forEach((o) => { if (!groups[o.date]) groups[o.date] = []; groups[o.date].push(o); });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredOrders, activeTab]);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Meesho Orders</h2>
          <p className="text-sm text-[#888] mt-1">Daily packing tracker</p>
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
        >
          <ScanLine size={16} />
          <span className="hidden sm:inline">Scan Bill</span>
          <span className="sm:hidden">Scan</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: ClipboardList, color: "text-blue-500", bg: "bg-[#eff6ff]", label: "Today", value: todayStats.count, sub: "Orders packed" },
          { icon: Package, color: "text-green-500", bg: "bg-[#f0fdf4]", label: "Qty", value: todayStats.qty, sub: "Items packed" },
          { icon: IndianRupee, color: "text-purple-500", bg: "bg-[#fdf4ff]", label: "Revenue", value: `₹${todayStats.revenue.toLocaleString("en-IN")}`, sub: "Today's value" },
        ].map(({ icon: Icon, color, bg, label, value, sub }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-xl font-black text-black leading-tight">{value}</div>
            <div className="text-[11px] text-[#aaa] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {meeshoOrders.length === 0 && (
        <div className="bg-gradient-to-br from-[#f8f4ff] to-[#eff6ff] border border-[#e0d5ff] rounded-2xl p-6 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center">
            <Camera size={28} className="text-[#7c3aed]" />
          </div>
          <div>
            <div className="font-bold text-black">Start Scanning!</div>
            <div className="text-sm text-[#666] mt-1 leading-relaxed">
              Tap <strong>Scan</strong> and take a photo of any Meesho bill.<br />
              <span className="text-[#7c3aed] font-semibold">All customer & product details will be auto-filled ✨</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {meeshoOrders.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-[#f5f5f5] p-1 rounded-xl gap-1">
            {(["today", "all"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === t ? "bg-white text-black shadow-sm" : "text-[#888] hover:text-black"}`}>
                {t === "today" ? `Today (${todayStats.count})` : `All (${meeshoOrders.length})`}
              </button>
            ))}
          </div>
          {activeTab === "all" && (
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-[#e8e8e8] rounded-xl px-3 py-1.5 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10" />
          )}
          {activeTab === "all" && dateFilter && (
            <button onClick={() => setDateFilter("")} className="text-xs text-[#888] hover:text-black font-semibold transition-colors">Clear date</button>
          )}
        </div>
      )}

      {/* Orders List */}
      {activeTab === "today" ? (
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-10 text-[#aaa] text-sm">No orders packed today yet. Tap <strong className="text-black">Scan</strong> to begin!</div>
          ) : filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} onDelete={() => setMeeshoOrders((p) => p.filter((o) => o.id !== order.id))} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate?.length === 0 && <div className="text-center py-10 text-[#aaa] text-sm">No orders found.</div>}
          {groupedByDate?.map(([date, orders]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays size={13} className="text-[#aaa]" />
                  <span className="text-xs font-bold text-[#888] uppercase tracking-wider">{formatDate(date)}</span>
                </div>
                <div className="flex-1 h-px bg-[#f0f0f0]" />
                <span className="text-xs font-bold text-black">{orders.length} orders · {orders.reduce((s, o) => s + o.qty, 0)} pcs</span>
              </div>
              <div className="space-y-3">
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} onDelete={() => setMeeshoOrders((p) => p.filter((o) => o.id !== order.id))} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overlays */}
      {showScanner && <BillScanner onResult={handleScanResult} onClose={() => setShowScanner(false)} />}
      {prefillData !== null && (
        <OrderForm prefill={prefillData} rawOcrText={prefillData.rawText} onSave={handleSaveOrder} onClose={() => setPrefillData(null)} />
      )}

      {/* Manual add button */}
      {meeshoOrders.length > 0 && prefillData === null && !showScanner && (
        <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40">
          <button onClick={() => setPrefillData({})}
            className="flex items-center gap-2 bg-white border border-[#e8e8e8] text-[#666] px-3.5 py-2 rounded-xl font-semibold text-xs shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:bg-[#f5f5f5] transition-colors">
            <ClipboardList size={13} /> Add manually
          </button>
        </div>
      )}
    </div>
  );
}
