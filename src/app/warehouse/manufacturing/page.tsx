'use client';

import React from 'react';
import { Factory, ShieldAlert, ArrowRight } from 'lucide-react';
import { DataTable } from '@/components/wms/ui/DataTable';

export default function ManufacturingPage() {
  const mockMfg = [
    { id: 'MFG-20260701-001', variant: 'CJ-DEER-03M', planned: 200, produced: 200, status: 'completed', date: '2026-07-01' },
    { id: 'MFG-20260701-002', variant: 'CCS-MINT-1218M', planned: 500, produced: 150, status: 'in_progress', date: '2026-07-01' },
  ];

  const columns = [
    { key: 'id', header: 'MFG Order ID', render: (row: any) => <span className="font-mono font-bold">{row.id}</span> },
    { key: 'variant', header: 'SKU Variant', render: (row: any) => <span className="font-mono">{row.variant}</span> },
    { key: 'planned', header: 'Planned Qty', align: 'center' as const },
    { key: 'produced', header: 'Produced Qty', align: 'center' as const },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
          row.status === 'completed'
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
            : 'bg-indigo-50 text-indigo-600 border-indigo-100'
        }`}>
          {row.status.toUpperCase()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <Factory className="w-6 h-6 text-indigo-500" /> Manufacturing Orders
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          Schedule production receipts and monitor line cutting/stitching orders.
        </p>
      </div>

      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 items-start shadow-sm">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            Roadmap Update: Manufacturing Module (Phase 2 Integration)
          </h4>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
            Standard production stock inward transactions are functional. Interactive manufacturing orders, operator logs, machine assignment cards, and fabric consumption estimations are scheduled for **Phase 2**.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <DataTable data={mockMfg} columns={columns} emptyMessage="No active manufacturing logs." />
      </div>
    </div>
  );
}
