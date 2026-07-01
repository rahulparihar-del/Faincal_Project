'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Camera, 
  Keyboard, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  ArrowRight, 
  QrCode, 
  FolderPlus, 
  FolderMinus, 
  Search,
  CheckCircle,
  Package,
  Layers,
  DollarSign
} from 'lucide-react';
import { useWmsToast } from '@/components/wms/ui/WmsToast';
import { supabase } from '@/lib/supabase/client';
import { getVariantByBarcode, getVariantBySku } from '@/lib/wms/services/productService';
import Link from 'next/link';

type ScanMode = 'inward' | 'outward' | 'lookup';
type InputMode = 'camera' | 'manual';

interface LookupResult {
  variantId: string;
  sku: string;
  barcode: string;
  productName: string;
  sizeLabel: string;
  colorName: string;
  mrp: number;
  costPrice: number;
  sellingPrice: number;
  stock: {
    available: number;
    reserved: number;
    dispatched: number;
    qc_pending: number;
    total: number;
  };
}

export default function CameraScanPage() {
  const router = useRouter();
  const { success, error: toastError, warning } = useWmsToast();

  const [scanMode, setScanMode] = useState<ScanMode>('lookup');
  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [manualInput, setManualInput] = useState('');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [searching, setSearching] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  // Play audio beeps using browser AudioContext
  const playBeep = (frequency: number, duration: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
      
      setTimeout(() => {
        ctx.close();
      }, duration + 100);
    } catch (err) {
      console.warn('Audio feedback failed:', err);
    }
  };

  // Handle scanned or typed code
  const handleCodeResolved = async (code: string) => {
    setSearching(true);
    try {
      // Try to find variant by barcode or SKU
      let variant = await getVariantByBarcode(code);
      if (!variant) {
        variant = await getVariantBySku(code);
      }

      if (!variant) {
        playBeep(300, 250); // buzz
        warning(`No product matches code: "${code}"`);
        setSearching(false);
        return;
      }

      playBeep(880, 100); // success beep

      // Route based on scan mode
      if (scanMode === 'inward') {
        success(`Redirecting to inward with ${variant.sku}...`);
        router.push(`/warehouse/inward/new?prefill_sku=${encodeURIComponent(variant.sku)}`);
      } else if (scanMode === 'outward') {
        success(`Redirecting to outward with ${variant.sku}...`);
        router.push(`/warehouse/outward/new?prefill_sku=${encodeURIComponent(variant.sku)}`);
      } else {
        // Fetch detailed warehouse stock buckets for the lookup
        if (supabase) {
          const { data: snapData } = await supabase
            .from('wms_inventory_snapshot')
            .select('available, reserved, dispatched, qc_pending, total_stock')
            .eq('variant_id', variant.id);

          // Aggregate stock across all warehouses
          const stockAcc = {
            available: 0,
            reserved: 0,
            dispatched: 0,
            qc_pending: 0,
            total: 0
          };

          if (snapData) {
            snapData.forEach((s) => {
              stockAcc.available += s.available || 0;
              stockAcc.reserved += s.reserved || 0;
              stockAcc.dispatched += s.dispatched || 0;
              stockAcc.qc_pending += s.qc_pending || 0;
              stockAcc.total += s.total_stock || 0;
            });
          }

          setLookupResult({
            variantId: variant.id,
            sku: variant.sku,
            barcode: variant.barcode,
            productName: variant.product?.product_name || 'Unknown',
            sizeLabel: variant.size?.label || 'N/A',
            colorName: variant.color?.name || 'N/A',
            mrp: variant.mrp || 0,
            costPrice: variant.cost_price || 0,
            sellingPrice: variant.selling_price || 0,
            stock: stockAcc
          });
          success(`Resolved: ${variant.sku}`);
        }
      }
    } catch (err) {
      console.error('Scan resolve failed:', err);
      toastError('Failed to resolve scanned code.');
    } finally {
      setSearching(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleCodeResolved(manualInput.trim());
    setManualInput('');
  };

  // ZXing scanner lifecycle hook
  useEffect(() => {
    let active = true;

    const startScanning = async () => {
      if (inputMode !== 'camera' || !videoRef.current) return;
      try {
        setCameraLoading(true);
        setCameraError(null);

        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const codeReader = new BrowserMultiFormatReader();

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          throw new Error('No camera devices found on this device.');
        }

        setHasPermission(true);

        // Decode from video stream
        const controls = await codeReader.decodeFromVideoDevice(
          undefined, // Uses standard back camera automatically
          videoRef.current,
          (result, err) => {
            if (!active) return;
            if (result) {
              handleCodeResolved(result.getText());
            }
            if (err && !(err.name === 'NotFoundException')) {
              console.debug('ZXing scan error:', err);
            }
          }
        );

        if (active) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (err) {
        console.error('Scanner init error:', err);
        if (active) {
          setHasPermission(false);
          setCameraError(err instanceof Error ? err.message : 'Camera failed to start.');
        }
      } finally {
        if (active) setCameraLoading(false);
      }
    };

    startScanning();

    return () => {
      active = false;
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [inputMode, scanMode]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* Dynamic Header */}
      <header className="h-16 flex-shrink-0 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href="/warehouse" className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-sm font-black tracking-tight">KiddieKa CamScan</h1>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Device Scanner Terminal</p>
          </div>
        </div>

        {/* Input Mode Toggle */}
        <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setInputMode('camera')}
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              inputMode === 'camera' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
            title="Camera Stream"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            onClick={() => setInputMode('manual')}
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              inputMode === 'manual' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
            title="Manual Input"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mode Selectors */}
      <div className="flex-shrink-0 bg-slate-950/40 p-3 grid grid-cols-3 gap-2 border-b border-slate-800/60">
        <button
          onClick={() => { setScanMode('lookup'); setLookupResult(null); }}
          className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold tracking-tight transition-all cursor-pointer ${
            scanMode === 'lookup'
              ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-inner'
              : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700'
          }`}
        >
          <QrCode className="w-4 h-4" />
          Product Lookup
        </button>
        <button
          onClick={() => { setScanMode('inward'); setLookupResult(null); }}
          className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold tracking-tight transition-all cursor-pointer ${
            scanMode === 'inward'
              ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 shadow-inner'
              : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700'
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          Inward Redirect
        </button>
        <button
          onClick={() => { setScanMode('outward'); setLookupResult(null); }}
          className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-bold tracking-tight transition-all cursor-pointer ${
            scanMode === 'outward'
              ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-inner'
              : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700'
          }`}
        >
          <FolderMinus className="w-4 h-4" />
          Outward Redirect
        </button>
      </div>

      {/* Main Scanner Pane */}
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 items-center justify-center relative min-h-0 overflow-y-auto">
        
        {/* Scanner Feed / Manual Box */}
        <div className="w-full max-w-lg aspect-video md:aspect-[4/3] rounded-2xl bg-slate-950 border border-slate-800/80 shadow-2xl relative overflow-hidden flex items-center justify-center shrink-0">
          
          {inputMode === 'camera' ? (
            <>
              {cameraLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 gap-3">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-xs font-semibold text-slate-400">Requesting Video Stream...</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 text-rose-500 p-6 gap-3 text-center">
                  <AlertCircle className="w-10 h-10 stroke-1" />
                  <span className="text-xs font-bold leading-normal">{cameraError}</span>
                  <button
                    onClick={() => setInputMode('manual')}
                    className="mt-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-350 px-4 py-1.5 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  >
                    Use Keyboard Manual Entry
                  </button>
                </div>
              )}

              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Laser Reticle HUD */}
              {!cameraLoading && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-1/3 border-2 border-indigo-500/40 rounded-xl relative flex items-center justify-center bg-indigo-500/5">
                    {/* Corners */}
                    <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                    
                    {/* Pulsing red laser line */}
                    <div className="w-full h-0.5 bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleManualSubmit} className="p-6 w-full max-w-sm space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                  Keyboard Barcode Lookup
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Type SKU or scan code..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={searching}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search Code'}
              </button>
            </form>
          )}

          {/* HUD Overlay Mode label */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase border border-slate-800 flex items-center gap-1.5 shadow-md">
            <span className={`w-2 h-2 rounded-full animate-ping ${
              scanMode === 'inward' ? 'bg-emerald-500' : scanMode === 'outward' ? 'bg-amber-500' : 'bg-indigo-500'
            }`} />
            {scanMode} mode
          </div>
        </div>

        {/* Live Lookup Result Display Panel */}
        {scanMode === 'lookup' && (
          <div className="w-full max-w-lg flex flex-col justify-center">
            {lookupResult ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl animate-fade-in w-full">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider">
                      Match Resolved
                    </span>
                    <h3 className="text-base font-black text-white leading-tight">
                      {lookupResult.productName}
                    </h3>
                    <div className="flex gap-2 text-xs font-semibold text-slate-400">
                      <span>SZ: {lookupResult.sizeLabel}</span>
                      <span>•</span>
                      <span>CL: {lookupResult.colorName}</span>
                    </div>
                  </div>
                  <Package className="w-8 h-8 text-indigo-400 shrink-0 stroke-1" />
                </div>

                {/* SKU Code Bar */}
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans font-bold uppercase tracking-widest">SKU</span>
                    <span className="text-white font-bold">{lookupResult.sku}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block font-sans font-bold uppercase tracking-widest">Barcode</span>
                    <span className="text-slate-400 font-bold">{lookupResult.barcode}</span>
                  </div>
                </div>

                {/* Price metrics */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                    <span className="text-[9px] text-slate-500 block font-bold uppercase tracking-widest">Cost</span>
                    <span className="text-xs font-bold text-white">₹{lookupResult.costPrice}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                    <span className="text-[9px] text-slate-500 block font-bold uppercase tracking-widest">Selling</span>
                    <span className="text-xs font-bold text-indigo-400">₹{lookupResult.sellingPrice}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                    <span className="text-[9px] text-slate-500 block font-bold uppercase tracking-widest">MRP</span>
                    <span className="text-xs font-bold text-slate-350">₹{lookupResult.mrp}</span>
                  </div>
                </div>

                {/* Stock buckets */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                    Inventory Stock Levels
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-emerald-950/20 border border-emerald-900/50 p-2.5 rounded-xl flex flex-col justify-between">
                      <span className="text-[9px] text-emerald-400 font-bold uppercase">Available</span>
                      <span className="text-base font-extrabold text-white mt-1">{lookupResult.stock.available}</span>
                    </div>
                    <div className="bg-amber-950/20 border border-amber-900/50 p-2.5 rounded-xl flex flex-col justify-between">
                      <span className="text-[9px] text-amber-400 font-bold uppercase">Reserved</span>
                      <span className="text-base font-extrabold text-white mt-1">{lookupResult.stock.reserved}</span>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Dispatched</span>
                      <span className="text-base font-extrabold text-white mt-1">{lookupResult.stock.dispatched}</span>
                    </div>
                    <div className="bg-rose-950/20 border border-rose-900/50 p-2.5 rounded-xl flex flex-col justify-between">
                      <span className="text-[9px] text-rose-400 font-bold uppercase">QC Pending</span>
                      <span className="text-base font-extrabold text-white mt-1">{lookupResult.stock.qc_pending}</span>
                    </div>
                  </div>
                </div>

                {/* Quick actions redirect */}
                <div className="flex gap-2 pt-2">
                  <Link 
                    href={`/warehouse/inward/new?prefill_sku=${encodeURIComponent(lookupResult.sku)}`}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors text-center font-sans"
                  >
                    Inward Item <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link 
                    href={`/warehouse/outward/new?prefill_sku=${encodeURIComponent(lookupResult.sku)}`}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors text-center font-sans"
                  >
                    Outward Item <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/30 border border-slate-800 border-dashed rounded-2xl p-8 text-center text-slate-500 space-y-2">
                <QrCode className="w-12 h-12 stroke-1 text-slate-700 mx-auto" />
                <h4 className="text-xs font-bold text-slate-450 uppercase tracking-wider">Awaiting Scan Input</h4>
                <p className="text-[11px] leading-relaxed max-w-xs mx-auto">
                  Scan a product barcode or enter a SKU code manually to view live inventory buckets, specifications, and prices.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
