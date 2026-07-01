'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Search, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonTable } from './SkeletonTable';
import gsap from 'gsap';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}


interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  actions?: (row: T) => React.ReactNode;
  rowKey?: (row: T) => string;
  stickyHeader?: boolean;
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  searchable = false,
  searchPlaceholder = 'Search records...',
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  actions,
  rowKey,
  stickyHeader = false,
  pagination,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (!loading && data.length > 0 && tableBodyRef.current) {
      const rows = tableBodyRef.current.querySelectorAll('.wms-table-row');
      if (rows.length > 0) {
        gsap.killTweensOf(rows);
        gsap.fromTo(
          rows,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: 'power1.out' }
        );
      }
    }
  }, [data, loading]);

  const getRowId = (row: T, index: number): string => {
    if (rowKey) return rowKey(row);
    if (row && typeof row === 'object' && 'id' in row) return String((row as Record<string, unknown>).id);
    return String(index);
  };

  // Handle Sort Toggle
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Search Filter
  const filteredData = useMemo(() => {
    if (!searchable || !searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) => {
      return Object.values(row as object).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchable, searchTerm]);

  // Sort Data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      const allIds = sortedData.map((row, idx) => getRowId(row, idx));
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    }
  };

  const isAllSelected = useMemo(() => {
    if (sortedData.length === 0) return false;
    return sortedData.every((row, idx) => selectedIds.includes(getRowId(row, idx)));
  }, [sortedData, selectedIds]);

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className="w-full flex flex-col h-full bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
      {/* Search Header */}
      {searchable && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white focus:border-slate-900 dark:focus:border-white focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>
        </div>
      )}

      {/* Table Wrapper */}
      <div className="flex-1 overflow-x-auto min-h-0">
        <table className="w-full text-xs text-slate-700 dark:text-slate-300">
          <thead
            className={`bg-slate-50/70 dark:bg-[#0f172a]/60 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 font-bold uppercase tracking-wider ${
              stickyHeader ? 'sticky top-0 z-10' : ''
            }`}
          >
            <tr>
              {selectable && (
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-slate-900 dark:focus:ring-white cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-4 py-3.5 font-bold ${alignClasses[col.align ?? 'left']} ${
                    col.sortable ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                    <span>{col.header}</span>
                    {col.sortable && sortKey === col.key && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
              {actions && <th className="px-4 py-3.5 text-right w-16">Actions</th>}
            </tr>
          </thead>
          <tbody ref={tableBodyRef} className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {loading ? (
              // Renders loading placeholders
              <SkeletonTable columns={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} rows={5} />
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
                    <Inbox className="w-8 h-8 stroke-1" />
                    <span className="font-semibold text-xs">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => {
                const id = getRowId(row, idx);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`wms-table-row transition-colors border-b border-slate-100 dark:border-slate-800/60 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${
                      isSelected
                        ? 'bg-slate-100/70 dark:bg-slate-800/60 font-bold'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'
                    }`}
                  >
                    {selectable && (
                      <td
                        className="px-4 py-2.5 text-center"
                        onClick={(e) => e.stopPropagation()} // stop row triggers
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-350 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-slate-950 dark:focus:ring-white cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400 font-medium ${alignClasses[col.align ?? 'left']}`}
                      >
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                    {actions && (
                      <td
                        className="px-4 py-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && !loading && (
        <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Showing {Math.min(pagination.total, (pagination.page - 1) * pagination.perPage + 1)} to{' '}
            {Math.min(pagination.total, pagination.page * pagination.perPage)} of {pagination.total} records
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
              Page {pagination.page}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.perPage >= pagination.total}
              className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
