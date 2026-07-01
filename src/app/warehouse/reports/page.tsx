'use client';

import React from 'react';
import { BarChart3, ShieldAlert } from 'lucide-react';
import { DataTable } from '@/components/wms/ui/DataTable';

export default function ReportsPage() {
  const mockReports = [
    { name: 'Stock Ageing Analysis', type: 'Inventory', lastRun: 'Today' },
    { name: 'Order Fulfillment Rates', type: 'Sales Outward', lastRun: 'Yesterday' },
    { name: 'Category Cost Valuations', type: 'Financial', lastRun: 'Today' },
  ];

  const columns = [
    { key: 'name', header: 'Report Name', render: (row: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{row.name}</span> },
    { key: 'type', header: 'Report Type' },
    { key: 'lastRun', header: 'Last Calculated' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-500" /> Advanced Analytics & Reports
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          Generate financial stock reports, warehouse velocity summaries, and order fill ratios.
        </p>
      </div>

      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 items-start shadow-sm">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            Roadmap Update: Advanced Reports Module (Phase 4 Integration)
          </h4>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
            Basic ledger views and inventory status alerts are active. Excel/PDF reports compilation, auto-scheduled email exports, stock velocity tracking, and stock-ageing dashboards are scheduled for **Phase 4**.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <DataTable data={mockReports} columns={columns} emptyMessage="No reports found." />
      </div>
    </div>
  );
}
