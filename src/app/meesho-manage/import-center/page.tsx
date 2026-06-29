"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Clock,
  History,
  Info,
  ChevronRight,
  Database
} from "lucide-react";
import { useMMData } from "@/components/meesho/useMeeshoData";

type ImportType = 'orders' | 'returns' | 'payments' | 'ads' | 'claims' | 'inventory' | 'meesho_xlsx';

const IMPORT_OPTIONS: { value: ImportType; label: string; description: string }[] = [
  { value: 'meesho_xlsx', label: 'Meesho Settlement (XLSX)', description: 'Upload the 5-sheet orders, ads, and payments Excel workbook' },
  { value: 'orders', label: 'Orders CSV', description: 'Upload sub-orders, selling price, fee, and shipping details' },
  { value: 'returns', label: 'Returns & RTO CSV', description: 'Upload returned customer packages and RTO delivery failures' },
  { value: 'payments', label: 'Payments Settlement CSV', description: 'Upload bank settlement UTR logs and platform commission deductions' },
  { value: 'ads', label: 'Advertisement CSV', description: 'Upload ad campaign click, impression, spend, and attribution data' },
  { value: 'claims', label: 'Claims Recovery CSV', description: 'Upload outstanding claim submissions and approved amounts' },
  { value: 'inventory', label: 'Inventory Master CSV', description: 'Upload SKU current stock levels, safety reserve, and daily sales' }
];

export default function ImportCenterPage() {
  const { imports, syncStatus, importCSVData, importExcelData, isLoaded } = useMMData();
  const [selectedType, setSelectedType] = useState<ImportType>('orders');
  const [dragActive, setDragActive] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to format date freshness relative time
  const formatFreshness = (timestamp: number | undefined): string => {
    if (!timestamp) return "Never Synced";
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just updated";
    if (diffMins < 60) return `Updated ${diffMins} minutes ago`;
    if (diffHours < 24) {
      const date = new Date(timestamp);
      const hoursStr = String(date.getHours()).padStart(2, '0');
      const minsStr = String(date.getMinutes()).padStart(2, '0');
      return `Updated Today ${hoursStr}:${minsStr}`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Updated Yesterday";
    return `Updated ${diffDays} days ago`;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    const isXlsx = file.name.endsWith('.xlsx');
    const isCsv = file.name.endsWith('.csv');

    if (!isCsv && !isXlsx) {
      setFeedback({ status: 'error', msg: 'Invalid file type. Please upload a CSV or XLSX file.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (isXlsx) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const buffer = event.target?.result as ArrayBuffer;
          if (buffer) {
            try {
              const res = await importExcelData(file.name, buffer);
              setFeedback({
                status: 'success',
                msg: `Processed Excel: Store ID: ${res.sellerId} | Type: ${res.statementType} | Period: ${res.startDate} to ${res.endDate}. Captured disclaimer verbatim. Imported ${res.orders.length} orders, ${res.ads.length} ads entries, ${res.claims.length} safety compensations, and ${res.payments.length} referral payouts.`
              });
            } catch (err: any) {
              setFeedback({ status: 'error', msg: `Error parsing Excel workbook sheets: ${err.message || err}` });
            }
          } else {
            setFeedback({ status: 'error', msg: 'Empty Excel file buffer.' });
          }
          setIsLoading(false);
        };
        reader.onerror = () => {
          setFeedback({ status: 'error', msg: 'Error reading Excel file.' });
          setIsLoading(false);
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const text = event.target?.result as string;
          if (text) {
            if (selectedType === "meesho_xlsx") {
              setFeedback({ status: 'error', msg: 'Cannot upload a CSV file under the Meesho Settlement (XLSX) option. Please select a CSV option or upload an XLSX workbook.' });
              setIsLoading(false);
              return;
            }
            const log = await importCSVData(selectedType as any, file.name, text);
            setFeedback({
              status: 'success',
              msg: `Successfully imported ${log.importedRows} rows. Skipped ${log.duplicateRows} duplicates. Failed ${log.failedRows} rows.`
            });
          } else {
            setFeedback({ status: 'error', msg: 'Empty file contents.' });
          }
          setIsLoading(false);
        };
        reader.onerror = () => {
          setFeedback({ status: 'error', msg: 'Error reading file.' });
          setIsLoading(false);
        };
        reader.readAsText(file);
      }
    } catch (e) {
      setFeedback({ status: 'error', msg: 'Error processing file upload.' });
      setIsLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>Syncing database catalog…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Universal Import Center</h1>
        <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Upload data spreadsheets to synchronize orders, payments, logistics, and ads without manual entry</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginBottom: 24, alignItems: "start" }}>
        {/* Left Column: Import Selector and Drag-and-Drop */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>1. Select Import Dataset</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
              {IMPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSelectedType(opt.value);
                    setFeedback(null);
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: selectedType === opt.value ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                    background: selectedType === opt.value ? "#7c3aed0a" : "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <FileSpreadsheet size={14} style={{ color: selectedType === opt.value ? "#7c3aed" : "#64748b" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{opt.label}</span>
                  </div>
                  <p style={{ fontSize: 9, color: "#64748b", lineHeight: "1.3em" }}>{opt.description}</p>
                </button>
              ))}
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>2. Upload File</h3>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              style={{
                border: dragActive ? "2px dashed #7c3aed" : "2px dashed #cbd5e1",
                borderRadius: 12,
                padding: "32px 16px",
                textAlign: "center",
                background: dragActive ? "#7c3aed05" : "#f8fafc",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s"
              }}
            >
              <input
                type="file"
                id="csv-file-input"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <label htmlFor="csv-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <UploadCloud size={32} style={{ color: dragActive ? "#7c3aed" : "#94a3b8" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                  {isLoading ? "Parsing File..." : `Drag & Drop your ${IMPORT_OPTIONS.find(o => o.value === selectedType)?.label} here`}
                </span>
                <span style={{ fontSize: 10, color: "#64748b" }}>or click to browse from files</span>
              </label>
            </div>

            {feedback && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: feedback.status === 'success' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${feedback.status === 'success' ? '#bbf7d0' : '#fecaca'}`,
                  color: feedback.status === 'success' ? '#15803d' : '#b91c1c'
                }}
              >
                {feedback.status === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span>{feedback.msg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Freshness Monitor */}
        <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Database size={16} style={{ color: "#7c3aed" }} />
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textTransform: "uppercase" }}>Freshness Sync</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {IMPORT_OPTIONS.map((opt) => {
              const lastSync = syncStatus[opt.value];
              return (
                <div key={opt.value} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>{opt.label.split(' ')[0]}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Clock size={8} />
                      {formatFreshness(lastSync)}
                    </div>
                  </div>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: lastSync ? (Date.now() - lastSync < 3600000 ? "#10b981" : "#f59e0b") : "#ef4444"
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: "#f8fafc", fontSize: 10, color: "#64748b", display: "flex", gap: 6 }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Green dot indicates sync is fresh (within 1 hr). Orange means synced but older. Red indicates never synced.</span>
          </div>
        </div>
      </div>

      {/* Import Logs Table */}
      <div style={{ background: "#ffffff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <History size={16} style={{ color: "#64748b" }} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Import Logs & History</h3>
        </div>

        {imports.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No files uploaded yet. Select a dataset above to begin syncing.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                  <th style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>Upload Date</th>
                  <th style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>File Name</th>
                  <th style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>Dataset</th>
                  <th style={{ padding: 10, color: "#64748b", fontWeight: 700, textAlign: "center" }}>Rows Imported</th>
                  <th style={{ padding: 10, color: "#64748b", fontWeight: 700, textAlign: "center" }}>Duplicates</th>
                  <th style={{ padding: 10, color: "#64748b", fontWeight: 700, textAlign: "center" }}>Failed</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 10, color: "#334155" }}>{new Date(item.importDate).toLocaleString("en-IN")}</td>
                    <td style={{ padding: 10, fontWeight: 700, color: "#1e293b" }}>{item.fileName}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: "#f1f5f9", fontSize: 9, textTransform: "capitalize", fontWeight: 700, color: "#64748b" }}>
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: 10, color: "#16a34a", fontWeight: 700, textAlign: "center" }}>+{item.importedRows}</td>
                    <td style={{ padding: 10, color: "#d97706", textAlign: "center" }}>{item.duplicateRows}</td>
                    <td style={{ padding: 10, color: item.failedRows > 0 ? "#dc2626" : "#64748b", textAlign: "center" }}>{item.failedRows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
