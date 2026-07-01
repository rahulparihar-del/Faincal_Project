'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Keyboard, AlertCircle, RefreshCw } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  isActive?: boolean;
  className?: string;
  placeholder?: string;
}

export function BarcodeScanner({
  onScan,
  onError,
  isActive = true,
  className = '',
  placeholder = 'Type SKU or scan barcode...',
}: BarcodeScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('manual');
  const [manualInput, setManualInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  interface ScannerControls {
    stop: () => void;
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);

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

  const triggerSuccess = (code: string) => {
    playBeep(880, 100); // 880Hz success beep
    setHistory((prev) => [code, ...prev.slice(0, 2)]);
    onScan(code);
  };

  const triggerError = (errMessage: string) => {
    playBeep(300, 250); // 300Hz error buzz
    if (onError) onError(errMessage);
  };

  // Keyboard manual submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const code = manualInput.trim();
    setManualInput('');
    triggerSuccess(code);
  };

  // Setup ZXing Browser Scanner
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      if (mode !== 'camera' || !isActive || !videoRef.current) return;
      try {
        setCameraLoading(true);
        setCameraError(null);

        // Dynamically import ZXing Browser components
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const codeReader = new BrowserMultiFormatReader();

        // Check permissions
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          throw new Error('No camera devices found.');
        }

        setHasPermission(true);

        // Start scanning
        const controls = await codeReader.decodeFromVideoDevice(
          undefined, // picks default back camera or first dev
          videoRef.current,
          (result, err) => {
            if (!active) return;
            if (result) {
              triggerSuccess(result.getText());
            }
            if (err && !(err.name === 'NotFoundException')) {
              // ignore standard NotFoundException (normal when no code in view)
              console.debug('Scan error:', err);
            }
          }
        );

        if (active) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (err) {
        console.error('Camera startup failed:', err);
        if (active) {
          setHasPermission(false);
          const msg = err instanceof Error ? err.message : 'Failed to initialize camera.';
          setCameraError(msg);
          triggerError(msg);
        }
      } finally {
        if (active) setCameraLoading(false);
      }
    };

    startCamera();

    return () => {
      active = false;
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [mode, isActive]);

  return (
    <div className={`w-full max-w-sm flex flex-col bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm ${className}`}>
      {/* Switcher Tab */}
      <div className="flex border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            mode === 'manual'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/20'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          Keyboard Mode
        </button>
        <button
          type="button"
          onClick={() => setMode('camera')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            mode === 'camera'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/20'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Camera className="w-4 h-4" />
          Camera Scan
        </button>
      </div>

      {/* Screen Area */}
      <div className="p-4 flex-1 min-h-[160px] flex flex-col justify-center">
        {mode === 'manual' ? (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Manual Input
              </label>
              <input
                type="text"
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Submit Barcode
            </button>
          </form>
        ) : (
          <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-slate-800 flex items-center justify-center">
            {cameraLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-2">
                <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                <span className="text-[10px] font-semibold text-slate-400">Initializing camera...</span>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 text-rose-500 p-4 gap-2 text-center">
                <AlertCircle className="w-8 h-8 stroke-1" />
                <span className="text-xs font-semibold leading-relaxed">{cameraError}</span>
                <button
                  onClick={() => setMode('manual')}
                  className="mt-2 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  Switch to Manual
                </button>
              </div>
            )}

            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Target Reticle Overlay */}
            {!cameraLoading && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-20 border-2 border-indigo-500/50 rounded-lg flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Log */}
      {history.length > 0 && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
            Recently Scanned
          </span>
          <div className="flex flex-wrap gap-1">
            {history.map((code, index) => (
              <span
                key={`${code}-${index}`}
                className="inline-flex items-center text-[10px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded shadow-sm animate-fade-in"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
