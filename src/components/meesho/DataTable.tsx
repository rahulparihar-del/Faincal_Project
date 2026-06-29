"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchKeys?: (keyof T | string)[];
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchable = true,
  searchKeys = ["orderNo", "productName", "sku", "city"],
  pageSize = 10,
  emptyMessage = "No records found",
  onRowClick,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Search logic
  const searchedData = useMemo(() => {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => {
        const val = row[k as string];
        return val ? String(val).toLowerCase().includes(lower) : false;
      })
    );
  }, [data, search, searchKeys]);

  // Sort logic
  const sortedData = useMemo(() => {
    if (!sortKey) return searchedData;

    return [...searchedData].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Handle nulls
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      // Handle string vs numbers
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [searchedData, sortKey, sortOrder]);

  // Paginate logic
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  // Reset page when search or data changes
  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e8e8e8",
        borderRadius: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with Search */}
      {searchable && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#f5f5f5",
              border: "1px solid #e8e8e8",
              borderRadius: 8,
              padding: "6px 10px",
              width: "min(300px, 100%)",
            }}
          >
            <Search size={14} style={{ color: "#aaa" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records…"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 12,
                color: "#333",
                width: "100%",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      )}

      {/* Table content */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
              {columns.map((col, idx) => {
                const align = col.align || "left";
                return (
                  <th
                    key={idx}
                    onClick={() => col.sortable !== false && handleSort(col.key as string)}
                    style={{
                      padding: "12px 16px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      cursor: col.sortable !== false ? "pointer" : "default",
                      textAlign: align,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
                      }}
                    >
                      {col.label}
                      {col.sortable !== false && <ArrowUpDown size={10} style={{ color: "#bbb" }} />}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: "32px", textAlign: "center", color: "#aaa", fontSize: 12 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom: rowIdx === paginatedData.length - 1 ? "none" : "1px solid #f0f0f0",
                    cursor: onRowClick ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                  className="table-row-hover"
                >
                  {columns.map((col, colIdx) => {
                    const align = col.align || "left";
                    return (
                      <td
                        key={colIdx}
                        style={{
                          padding: "12px 16px",
                          fontSize: 12,
                          color: "#333",
                          textAlign: align,
                        }}
                      >
                        {col.render ? col.render(row) : row[col.key as string]}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>
            Showing {Math.min(searchedData.length, (page - 1) * pageSize + 1)}-
            {Math.min(searchedData.length, page * pageSize)} of {searchedData.length} records
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: 6,
                border: "1px solid #e8e8e8",
                background: "#fff",
                color: page === 1 ? "#ccc" : "#555",
                cursor: page === 1 ? "not-allowed" : "pointer",
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: 6,
                border: "1px solid #e8e8e8",
                background: "#fff",
                color: page === totalPages ? "#ccc" : "#555",
                cursor: page === totalPages ? "not-allowed" : "pointer",
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .table-row-hover:hover {
          background: #fdfcff;
        }
      `}</style>
    </div>
  );
}
