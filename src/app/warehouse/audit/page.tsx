'use client';

import React from 'react';
import { ClipboardCheck, ShieldAlert } from 'lucide-react';
import { DataTable } from '@/components/wms/ui/DataTable';

export default function StockAuditPage() {
  const mockAudit = [
    { id: 'AUD-20260701-01', warehouse: 'Main Warehouse', startedBy: 'Admin Operator', status: 'in_progress' },
  ];

  const columns = [
    { key: 'id', header: 'Audit Code', render: (row: any) => <span className="font-mono font-bold">{row.id}</span> },
    { key: 'warehouse', header: 'Warehouse' },
    { key: 'startedBy', header: 'Auditor' },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-amber-50 text-amber-600 border-amber-100">
          {row.status.toUpperCase()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-indigo-500" /> Stock Audit (Cycle Count)
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          Perform stocktakes, barcode scan checks, and adjust variances.
        </p>
      </div>

      <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 items-start shadow-sm">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            Roadmap Update: Stock Audit Module (Phase 4 Integration)
          </h4>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed font-medium">
            Adjustment ledger entries and snapshots updates are functional. Interactive cycle counts, barcode scan audits, blind audits, and automated variance ledger insertions are scheduled for **Phase 4**.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <DataTable data={mockAudit} columns={columns} emptyMessage="No active audits." />
      </div>
    </div>
  );
}
