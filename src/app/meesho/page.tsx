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
  PackageX,
  ChevronDown,
  Trash2,
  Camera,
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
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const STATUS_CONFIG = {
  Packed: { label: "Packed", bg: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  Shipped: { label: "Shipped", bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.25)" },
  RTO: { label: "RTO", bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.25)" },
} as const;

// ─── Scanner Component ─────────────────────────────────────────────────────────
function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const startScan = async () => {
      setScanning(true);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { NotFoundException } = await import("@zxing/library");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Prefer back camera
        const device =
          devices.find((d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
          ) ?? devices[devices.length - 1];

        if (!device) {
          setError("No camera found on this device.");
          return;
        }

        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: device.deviceId ? { exact: device.deviceId } : undefined,
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Continuously decode
        const decode = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const result = await reader.decodeOnceFromVideoElement(videoRef.current);
            if (!cancelled) onResult(result.getText());
          } catch (e) {
            if (e instanceof NotFoundException || (e as Error)?.name === "NotFoundException") {
              // No barcode found yet — keep trying
              if (!cancelled) setTimeout(decode, 300);
            } else {
              console.warn("Scan error:", e);
              if (!cancelled) setTimeout(decode, 500);
            }
          }
        };
        decode();
      } catch (e) {
        if (!cancelled) {
          const msg = (e as Error)?.message || "Camera access denied.";
          setError(msg.includes("Permission") || msg.includes("NotAllowed")
            ? "Camera permission denied. Please allow camera access and try again."
            : msg);
        }
      }
    };

    startScan();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // BrowserMultiFormatReader doesn't need explicit reset; stopping tracks is sufficient
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <ScanLine size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Scan Meesho Bill</div>
            <div className="text-white/50 text-[11px]">Point at barcode or QR code</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <p className="text-white/80 text-sm leading-relaxed">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white text-black font-bold rounded-xl text-sm"
            >
              Go Back
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-72 h-56">
                {/* Corner markers */}
                {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => (
                  <div
                    key={pos}
                    className={`absolute w-8 h-8 border-white/80 border-[3px] ${
                      pos === "top-left" ? "top-0 left-0 border-r-0 border-b-0 rounded-tl-md" :
                      pos === "top-right" ? "top-0 right-0 border-l-0 border-b-0 rounded-tr-md" :
                      pos === "bottom-left" ? "bottom-0 left-0 border-r-0 border-t-0 rounded-bl-md" :
                      "bottom-0 right-0 border-l-0 border-t-0 rounded-br-md"
                    }`}
                  />
                ))}
                {/* Scan line animation */}
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-90"
                    style={{ animation: "scanLine 2s ease-in-out infinite" }}
                  />
                </div>
              </div>
            </div>
            {/* Hint */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <div className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full flex items-center gap-2">
                {scanning && (
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                )}
                <span className="text-white/80 text-xs font-medium">
                  {scanning ? "Scanning… hold steady" : "Starting camera…"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 4px; }
          50% { top: calc(100% - 4px); }
          100% { top: 4px; }
        }
      `}</style>
    </div>
  );
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────
type DraftOrder = Omit<MeeshoOrder, "id" | "scannedAt">;

function OrderForm({
  initialOrderNo,
  onSave,
  onClose,
}: {
  initialOrderNo: string;
  onSave: (draft: DraftOrder) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DraftOrder>({
    date: today(),
    orderNo: initialOrderNo,
    customerName: "",
    customerAddress: "",
    customerCity: "",
    customerPincode: "",
    sku: "",
    productName: "",
    size: "",
    color: "",
    qty: 1,
    sellingPrice: 0,
    courier: "Xpress Bees",
    status: "Packed",
    notes: "",
  });

  const set = <K extends keyof DraftOrder>(key: K, val: DraftOrder[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const inputCls =
    "w-full bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3.5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-[#bbb] transition-colors placeholder-[#bbb]";

  const labelCls = "flex items-center gap-1.5 text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] bg-white sticky top-0 z-10">
          <div>
            <div className="font-bold text-black text-base">Order Details</div>
            <div className="text-[11px] text-[#888] mt-0.5">Fill in details from the Meesho bill</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f5] hover:bg-[#eee] transition-colors"
          >
            <X size={16} className="text-[#666]" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Order No banner */}
          {initialOrderNo && (
            <div className="bg-gradient-to-r from-[#f8f4ff] to-[#f0f8ff] border border-[#e0d5ff] rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#7c3aed]/10 rounded-xl flex items-center justify-center shrink-0">
                <ScanLine size={14} className="text-[#7c3aed]" />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#7c3aed] uppercase tracking-wider">Scanned Order No.</div>
                <div className="text-sm font-bold text-black font-mono">{initialOrderNo}</div>
              </div>
            </div>
          )}

          {/* Order No (editable) */}
          <div>
            <label className={labelCls}><Hash size={11} /> Order Number</label>
            <input className={inputCls} value={form.orderNo} onChange={(e) => set("orderNo", e.target.value)} placeholder="e.g. 29489332911..." />
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
                <input className={inputCls} value={form.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="e.g. Kundan Kumar" />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input className={inputCls} value={form.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} placeholder="Street / Area" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={form.customerCity} onChange={(e) => set("customerCity", e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label className={labelCls}>Pincode</label>
                  <input className={inputCls} value={form.customerPincode} onChange={(e) => set("customerPincode", e.target.value)} placeholder="6-digit" maxLength={6} />
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
                  <input className={inputCls} value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="e.g. KDK-YELLOW-BOY" />
                </div>
                <div>
                  <label className={labelCls}><Ruler size={11} /> Size</label>
                  <input className={inputCls} value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 3-4 Years" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Product Name</label>
                <input className={inputCls} value={form.productName} onChange={(e) => set("productName", e.target.value)} placeholder="e.g. Boys Yellow T-Shirt" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}><Palette size={11} /> Color</label>
                  <input className={inputCls} value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="NA" />
                </div>
                <div>
                  <label className={labelCls}>Qty</label>
                  <input type="number" min={1} className={inputCls} value={form.qty} onChange={(e) => set("qty", Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}><IndianRupee size={11} /> Price</label>
                  <input type="number" min={0} className={inputCls} value={form.sellingPrice || ""} onChange={(e) => set("sellingPrice", Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className={labelCls}><Truck size={11} /> Courier</label>
                <input className={inputCls} value={form.courier} onChange={(e) => set("courier", e.target.value)} placeholder="e.g. Xpress Bees" />
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-[#eee] pt-3">
            <label className={labelCls}><MessageSquare size={11} /> Notes</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#f0f0f0] bg-white flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[#e8e8e8] text-sm font-bold text-[#666] hover:bg-[#f5f5f5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.orderNo}
            className="flex-2 flex-grow py-3 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Package size={15} />
            Save Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onDelete,
}: {
  order: MeeshoOrder;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition-shadow">
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-start gap-3"
      >
        {/* Status dot */}
        <div
          className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: cfg.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-black text-sm leading-tight truncate">
                {order.customerName || "—"}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5 font-mono truncate">
                #{order.orderNo || "—"}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold border"
                style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
              >
                {cfg.label}
              </span>
              <ChevronDown
                size={14}
                className={`text-[#aaa] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>
          {/* Quick info row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {order.sku && (
              <span className="text-[11px] bg-[#f5f5f5] text-[#666] px-2 py-0.5 rounded-md font-medium">
                {order.sku}
              </span>
            )}
            {order.size && (
              <span className="text-[11px] text-[#888]">Size: {order.size}</span>
            )}
            {order.qty > 0 && (
              <span className="text-[11px] text-[#888]">Qty: {order.qty}</span>
            )}
            {order.sellingPrice > 0 && (
              <span className="text-[11px] font-bold text-black">
                ₹{order.sellingPrice.toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#f5f5f5] space-y-3">
          {/* Customer address */}
          {(order.customerAddress || order.customerCity || order.customerPincode) && (
            <div className="bg-[#fafafa] rounded-xl p-3">
              <div className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-1">Delivery Address</div>
              <div className="text-sm text-[#333] leading-relaxed">
                {[order.customerAddress, order.customerCity, order.customerPincode].filter(Boolean).join(", ")}
              </div>
            </div>
          )}

          {/* Product grid */}
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

          {/* Time + notes */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#aaa]">Scanned {fmtTime(order.scannedAt)}</span>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
          {order.notes && (
            <div className="text-[12px] text-[#777] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3 py-2">
              {order.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MeeshoOrders() {
  const { meeshoOrders, setMeeshoOrders } = useData();
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "all">("today");
  const [dateFilter, setDateFilter] = useState(today());

  const todayStr = today();

  const todayOrders = useMemo(
    () => meeshoOrders.filter((o) => o.date === todayStr),
    [meeshoOrders, todayStr]
  );

  const filteredOrders = useMemo(() => {
    if (activeTab === "today") return todayOrders;
    if (dateFilter) return meeshoOrders.filter((o) => o.date === dateFilter);
    return meeshoOrders;
  }, [meeshoOrders, todayOrders, activeTab, dateFilter]);

  const todayStats = useMemo(() => {
    const count = todayOrders.length;
    const qty = todayOrders.reduce((s, o) => s + o.qty, 0);
    const revenue = todayOrders.filter((o) => o.status !== "RTO").reduce((s, o) => s + o.sellingPrice, 0);
    return { count, qty, revenue };
  }, [todayOrders]);

  const handleScanResult = useCallback((text: string) => {
    setShowScanner(false);
    setScannedCode(text);
  }, []);

  const handleSaveOrder = (draft: Omit<MeeshoOrder, "id" | "scannedAt">) => {
    const order: MeeshoOrder = {
      ...draft,
      id: Date.now().toString(),
      scannedAt: new Date().toISOString(),
    };
    setMeeshoOrders((prev) => [order, ...prev]);
    setScannedCode(null);
  };

  const handleDelete = (id: string) => {
    setMeeshoOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // Group "All" orders by date
  const groupedByDate = useMemo(() => {
    if (activeTab === "today") return null;
    const groups: Record<string, MeeshoOrder[]> = {};
    filteredOrders.forEach((o) => {
      if (!groups[o.date]) groups[o.date] = [];
      groups[o.date].push(o);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredOrders, activeTab]);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Meesho Orders</h2>
          <p className="text-sm text-[#888] mt-1">Daily packing tracker</p>
        </div>
        {/* Scan button — always visible but especially useful on mobile */}
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1a1a1a] active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
        >
          <ScanLine size={16} />
          <span className="hidden sm:inline">Scan Bill</span>
          <span className="sm:hidden">Scan</span>
        </button>
      </div>

      {/* ── Today's Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#eff6ff] rounded-lg flex items-center justify-center">
              <ClipboardList size={13} className="text-blue-500" />
            </div>
            <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Today</span>
          </div>
          <div className="text-2xl font-black text-black">{todayStats.count}</div>
          <div className="text-[11px] text-[#aaa] mt-0.5">Orders packed</div>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#f0fdf4] rounded-lg flex items-center justify-center">
              <Package size={13} className="text-green-500" />
            </div>
            <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Qty</span>
          </div>
          <div className="text-2xl font-black text-black">{todayStats.qty}</div>
          <div className="text-[11px] text-[#aaa] mt-0.5">Items packed</div>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#fdf4ff] rounded-lg flex items-center justify-center">
              <IndianRupee size={13} className="text-purple-500" />
            </div>
            <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Revenue</span>
          </div>
          <div className="text-xl font-black text-black">
            ₹{todayStats.revenue.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-[#aaa] mt-0.5">Today&apos;s value</div>
        </div>
      </div>

      {/* ── Mobile scan hint ── */}
      {meeshoOrders.length === 0 && (
        <div className="bg-gradient-to-br from-[#f8f4ff] to-[#eff6ff] border border-[#e0d5ff] rounded-2xl p-6 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center">
            <ScanLine size={28} className="text-[#7c3aed]" />
          </div>
          <div>
            <div className="font-bold text-black">Start Scanning!</div>
            <div className="text-sm text-[#666] mt-1 leading-relaxed">
              Tap <strong>Scan</strong> and point your camera at the barcode on any Meesho shipping bill to log an order instantly.
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Switcher + Date Filter ── */}
      {meeshoOrders.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-[#f5f5f5] p-1 rounded-xl gap-1">
            {(["today", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === t
                    ? "bg-white text-black shadow-sm"
                    : "text-[#888] hover:text-black"
                }`}
              >
                {t === "today" ? `Today (${todayStats.count})` : `All (${meeshoOrders.length})`}
              </button>
            ))}
          </div>
          {activeTab === "all" && (
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-[#e8e8e8] rounded-xl px-3 py-1.5 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          )}
          {activeTab === "all" && dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-xs text-[#888] hover:text-black font-semibold transition-colors"
            >
              Clear date
            </button>
          )}
        </div>
      )}

      {/* ── Orders List ── */}
      {activeTab === "today" ? (
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-10 text-[#aaa] text-sm">
              No orders packed today yet. Tap <strong className="text-black">Scan</strong> to begin!
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} onDelete={() => handleDelete(order.id)} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate && groupedByDate.length === 0 && (
            <div className="text-center py-10 text-[#aaa] text-sm">No orders found.</div>
          )}
          {groupedByDate?.map(([date, orders]) => {
            const dayQty = orders.reduce((s, o) => s + o.qty, 0);
            return (
              <div key={date}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={13} className="text-[#aaa]" />
                    <span className="text-xs font-bold text-[#888] uppercase tracking-wider">
                      {formatDate(date)}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-[#f0f0f0]" />
                  <span className="text-xs font-bold text-black">{orders.length} orders · {dayQty} pcs</span>
                </div>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order} onDelete={() => handleDelete(order.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scanner Overlay ── */}
      {showScanner && (
        <BarcodeScanner
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Order Form Modal ── */}
      {scannedCode !== null && (
        <OrderForm
          initialOrderNo={scannedCode}
          onSave={handleSaveOrder}
          onClose={() => setScannedCode(null)}
        />
      )}

      {/* ── Add without scan (manual entry) ── */}
      {meeshoOrders.length > 0 && scannedCode === null && !showScanner && (
        <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40">
          <button
            onClick={() => setScannedCode("")}
            className="flex items-center gap-2 bg-white border border-[#e8e8e8] text-[#666] px-3.5 py-2 rounded-xl font-semibold text-xs shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:bg-[#f5f5f5] transition-colors"
          >
            <ClipboardList size={13} />
            Add manually
          </button>
        </div>
      )}
    </div>
  );
}
