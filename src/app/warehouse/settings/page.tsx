'use client';

import React from 'react';
import { Settings, ShieldAlert } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-500" /> WMS Settings
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          Configure default printer templates, safety thresholds, and warehouse rules.
        </p>
      </div>

      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 items-start shadow-sm">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            Roadmap Update: Settings & Printers Configuration (Phase 4 Integration)
          </h4>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
            Basic barcode templates and warehouse defaults are operational. USB/LAN barcode printer driver integrations, label layouts customizers, and roles/permissions control panel are scheduled for **Phase 4**.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
          Phase 1 Basic Configurations
        </h3>
        <div className="grid grid-cols-2 gap-6 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold">Low Stock Threshold Limit</span>
            <span className="text-slate-700 dark:text-slate-350 font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl inline-block">
              10 units (Default)
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold">Default Printer Type</span>
            <span className="text-slate-700 dark:text-slate-350 font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl inline-block">
              Standard Alphanumeric Code128
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
