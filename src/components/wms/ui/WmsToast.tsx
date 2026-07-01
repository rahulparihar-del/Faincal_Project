'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface WmsToastContextType {
  addToast: (message: string, type: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const WmsToastContext = createContext<WmsToastContextType | undefined>(undefined);

export function WmsToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: Toast['type'], duration = 3000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, message, type, duration };
      
      setToasts((prev) => {
        // Keep at most 5 toasts visible
        const current = [...prev, newToast];
        if (current.length > 5) {
          return current.slice(current.length - 5);
        }
        return current;
      });

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((msg: string, dur?: number) => addToast(msg, 'success', dur), [addToast]);
  const error = useCallback((msg: string, dur?: number) => addToast(msg, 'error', dur), [addToast]);
  const warning = useCallback((msg: string, dur?: number) => addToast(msg, 'warning', dur), [addToast]);
  const info = useCallback((msg: string, dur?: number) => addToast(msg, 'info', dur), [addToast]);

  return (
    <WmsToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}
      <WmsToastContainer toasts={toasts} onDismiss={removeToast} />
    </WmsToastContext.Provider>
  );
}

export function useWmsToast() {
  const ctx = useContext(WmsToastContext);
  if (!ctx) {
    throw new Error('useWmsToast must be used within a WmsToastProvider');
  }
  return ctx;
}

interface WmsToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function WmsToastContainer({ toasts, onDismiss }: WmsToastContainerProps) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <XCircleIcon className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const bgClasses = {
    success: 'border-emerald-100 bg-emerald-50/90 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-300',
    error: 'border-rose-100 bg-rose-50/90 dark:bg-rose-950/20 dark:border-rose-900/30 text-rose-900 dark:text-rose-300',
    warning: 'border-amber-100 bg-amber-50/90 dark:bg-amber-950/20 dark:border-amber-900/30 text-amber-900 dark:text-amber-300',
    info: 'border-blue-100 bg-blue-50/90 dark:bg-blue-950/20 dark:border-blue-900/30 text-blue-900 dark:text-blue-300',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm ${bgClasses[toast.type]}`}
          >
            {icons[toast.type]}
            <p className="text-xs font-bold leading-relaxed flex-1 mr-2">{toast.message}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-current opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// XCircle fallback
function XCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return <AlertCircle {...props} />;
}
