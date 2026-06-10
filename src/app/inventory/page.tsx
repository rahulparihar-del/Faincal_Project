"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import {
  Package,
  Search,
  Zap,
  Sparkles,
  ClipboardPaste,
  History,
  FileDown,
  Share2,
  Plus,
  X,
  AlertTriangle,
  Check,
  RefreshCw,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface InventoryCategory {
  id: string;
  name: string;
  prints: string[];
  sizes: string[];
  qty: Record<string, Record<string, number>>; // qty[size][print]
  order: number;
}

interface LogEntry {
  id: string;
  text: string;
  at: string;
}

const STORAGE_KEY = "biztrack_inventory";
const SEED_FLAG = "biztrack_inventory_seeded";

/* ─── Seed data (quantities from the supplied stock sheets) ─── */
function buildCat(id: string, name: string, prints: string[], sizes: string[], rows: number[][], order: number): InventoryCategory {
  const qty: Record<string, Record<string, number>> = {};
  sizes.forEach((s, i) => {
    qty[s] = {};
    prints.forEach((p, j) => { qty[s][p] = rows[i]?.[j] ?? 0; });
  });
  return { id, name, prints, sizes, qty, order };
}

const DEFAULT_CATEGORIES: InventoryCategory[] = [
  buildCat("cat-jabla", "Jabla",
    ["Bear", "Owl", "Dino", "Mashroom", "Multi-Orange", "Elephant", "Car", "Unicorn", "Avacoda", "Flower", "Strawberry", "Icecream"],
    ["0-3", "3-6", "6-9", "9-12"],
    [
      [18, 20, 7, 22, 20, 4, 9, 21, 0, 0, 0, 0],
      [1, 2, 0, 1, 25, 1, 0, 41, 25, 25, 25, 25],
      [0, 0, 0, 0, 42, 0, 0, 45, 40, 41, 41, 41],
      [1, 1, 0, 2, 38, 0, 0, 40, 41, 36, 38, 37],
    ], 0),
  buildCat("cat-frock", "Frock",
    ["Strawberry", "Dino", "Icecream", "Multi-Orange", "Bear", "Unicorn", "Mashroom", "Car", "Elephant", "Owl", "Toucan", "Flower"],
    ["0-3", "3-6", "6-12"],
    [
      [6, 7, 7, 5, 5, 17, 17, 12, 3, 6, 0, 0],
      [8, 4, 0, 5, 0, 6, 16, 0, 3, 3, 7, 4],
      [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 0],
    ], 1),
  buildCat("cat-coord", "Co-ord Set",
    ["Mashroom", "Car", "Flower", "Toucan", "Icecream", "Bear", "Strawberry", "Dino", "Unicorn", "Avocado", "Elephant"],
    ["0-3", "3-6", "6-9", "9-12", "12-18", "18-24"],
    [
      [4, 3, 2, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [8, 0, 6, 4, 0, 0, 3, 0, 1, 0, 7],
      [10, 0, 3, 0, 0, 0, 0, 0, 0, 0, 6],
    ], 2),
  buildCat("cat-nightsuit", "Night Suit",
    ["Dino", "Car", "Bear", "Owl", "Unicorn", "Mashroom", "Multi-Orange", "Elephant"],
    ["0-3", "3-6", "6-9", "9-12", "12-18", "18-24"],
    [
      [0, 3, 3, 6, 0, 7, 7, 4],
      [4, 0, 0, 3, 3, 5, 3, 0],
      [0, 0, 1, 3, 0, 1, 1, 0],
      [0, 0, 0, 1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 1],
    ], 3),
  buildCat("cat-hooded", "Hooded Towel", ["Plain"], ["Standard"], [[18]], 4),
];

/* ─── Helpers ───────────────────────────────────────────────── */
function catTotal(c: InventoryCategory): number {
  let t = 0;
  for (const s of c.sizes) for (const p of c.prints) t += c.qty[s]?.[p] ?? 0;
  return t;
}
function rowTotal(c: InventoryCategory, size: string): number {
  return c.prints.reduce((sum, p) => sum + (c.qty[size]?.[p] ?? 0), 0);
}
function colTotal(c: InventoryCategory, print: string): number {
  return c.sizes.reduce((sum, s) => sum + (c.qty[s]?.[print] ?? 0), 0);
}
function outOfStockCount(cats: InventoryCategory[]): number {
  let n = 0;
  for (const c of cats) for (const s of c.sizes) for (const p of c.prints) if ((c.qty[s]?.[p] ?? 0) === 0) n++;
  return n;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const NUM_INPUT = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export default function InventoryPage() {
  const [cats, setCats, isReady] = useSupabaseTable<InventoryCategory>("inventory_categories", STORAGE_KEY, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quickSale, setQuickSale] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [newPrint, setNewPrint] = useState("");
  const [newSize, setNewSize] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [parseOpen, setParseOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let seeded = false;
    try { seeded = localStorage.getItem(SEED_FLAG) === "1"; } catch { /* ignore */ }
    if (cats.length === 0 && !seeded) {
      setCats(DEFAULT_CATEGORIES);
      try { localStorage.setItem(SEED_FLAG, "1"); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  const ordered = useMemo(() => [...cats].sort((a, b) => a.order - b.order), [cats]);

  useEffect(() => {
    if (!activeId && ordered.length > 0) setActiveId(ordered[0].id);
    if (activeId && !ordered.some((c) => c.id === activeId) && ordered.length > 0) setActiveId(ordered[0].id);
  }, [ordered, activeId]);

  const active = ordered.find((c) => c.id === activeId) || null;
  const grandTotal = ordered.reduce((s, c) => s + catTotal(c), 0);
  const oos = outOfStockCount(ordered);

  const pushLog = (text: string) =>
    setLog((prev) => [{ id: `lg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text, at: new Date().toISOString() }, ...prev].slice(0, 50));
  const touchSaved = () => setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));

  /* ── Mutations ── */
  const updateCat = (id: string, fn: (c: InventoryCategory) => InventoryCategory) => {
    setCats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
    touchSaved();
  };
  const setQty = (size: string, print: string, value: number) => {
    if (!active) return;
    const v = Math.max(0, Math.floor(value || 0));
    updateCat(active.id, (c) => ({ ...c, qty: { ...c.qty, [size]: { ...(c.qty[size] || {}), [print]: v } } }));
  };
  const cellSale = (size: string, print: string) => {
    if (!active) return;
    const cur = active.qty[size]?.[print] ?? 0;
    if (cur <= 0) return;
    setQty(size, print, cur - 1);
    pushLog(`Sold 1 ${active.name} · ${size} · ${print}`);
  };
  const addPrint = () => {
    if (!active) return;
    const name = newPrint.trim();
    if (!name || active.prints.some((p) => slug(p) === slug(name))) { setNewPrint(""); return; }
    updateCat(active.id, (c) => {
      const qty = { ...c.qty };
      c.sizes.forEach((s) => { qty[s] = { ...(qty[s] || {}), [name]: 0 }; });
      return { ...c, prints: [...c.prints, name], qty };
    });
    pushLog(`Added print "${name}" to ${active.name}`);
    setNewPrint("");
  };
  const addSize = () => {
    if (!active) return;
    const name = newSize.trim();
    if (!name || active.sizes.some((s) => slug(s) === slug(name))) { setNewSize(""); return; }
    updateCat(active.id, (c) => {
      const row: Record<string, number> = {};
      c.prints.forEach((p) => { row[p] = 0; });
      return { ...c, sizes: [...c.sizes, name], qty: { ...c.qty, [name]: row } };
    });
    pushLog(`Added size "${name}" to ${active.name}`);
    setNewSize("");
  };
  const removePrint = (print: string) => {
    if (!active) return;
    updateCat(active.id, (c) => {
      const qty: Record<string, Record<string, number>> = {};
      for (const s of c.sizes) { const { [print]: _d, ...rest } = c.qty[s] || {}; void _d; qty[s] = rest; }
      return { ...c, prints: c.prints.filter((p) => p !== print), qty };
    });
  };
  const removeSize = (size: string) => {
    if (!active) return;
    updateCat(active.id, (c) => {
      const { [size]: _d, ...rest } = c.qty; void _d;
      return { ...c, sizes: c.sizes.filter((s) => s !== size), qty: rest };
    });
  };

  /* ── Search filter ── */
  const q = search.trim().toLowerCase();
  const matchPrints = active ? active.prints.filter((p) => p.toLowerCase().includes(q)) : [];
  const matchSizes = active ? active.sizes.filter((s) => s.toLowerCase().includes(q)) : [];
  const visiblePrints = active ? (q ? (matchPrints.length ? matchPrints : active.prints) : active.prints) : [];
  const visibleSizes = active ? (q && matchSizes.length && !matchPrints.length ? matchSizes : active.sizes) : [];

  /* ── Exports ── */
  const buildSummaryText = () => {
    const lines = [`Prints Inventory — ${grandTotal} pcs total`, ""];
    for (const c of ordered) {
      lines.push(`${c.name} — ${catTotal(c)}`);
      for (const p of c.prints) { const t = colTotal(c, p); if (t > 0) lines.push(`  - ${p}: ${t}`); }
      lines.push("");
    }
    return lines.join("\n");
  };
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildSummaryText())}`, "_blank", "noopener,noreferrer");
  const exportPdf = () => {
    if (!active) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const head = `<tr><th style="text-align:left">Size</th>${active.prints.map((p) => `<th>${p}</th>`).join("")}<th style="text-align:right">Total</th></tr>`;
    const rows = active.sizes.map((s) => `<tr><td>${s}</td>${active.prints.map((p) => `<td style="text-align:center">${active.qty[s]?.[p] ?? 0}</td>`).join("")}<td style="text-align:right;font-weight:700">${rowTotal(active, s)}</td></tr>`).join("");
    const foot = `<tr style="font-weight:700"><td>TOTAL</td>${active.prints.map((p) => `<td style="text-align:center">${colTotal(active, p)}</td>`).join("")}<td style="text-align:right">${catTotal(active)}</td></tr>`;
    win.document.write(`<html><head><title>${active.name} Inventory</title><style>body{font-family:-apple-system,Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px;font-size:13px}th,td{border:1px solid #ddd;padding:6px 8px}thead{background:#f3f3f3}</style></head><body><h1>${active.name} — ${catTotal(active)} pcs</h1><table><thead>${head}</thead><tbody>${rows}${foot}</tbody></table></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  /* ── Parse "sold 2 jabla 3-6 bear" lines ── */
  const applyParse = (raw: string) => {
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let applied = 0;
    setCats((prev) => {
      const next = prev.map((c) => ({ ...c, qty: { ...c.qty } }));
      for (const line of lines) {
        const m = line.match(/(?:sold\s+)?(\d+)\s+([a-z][a-z\- ]*?)\s+([\d]+-[\d]+|standard)\s+([a-z][a-z\-]*)/i);
        if (!m) continue;
        const [, qtyStr, catName, sizeName, printName] = m;
        const dec = parseInt(qtyStr, 10);
        const c = next.find((x) => slug(x.name) === slug(catName) || x.name.toLowerCase().startsWith(catName.toLowerCase().trim()));
        if (!c) continue;
        const size = c.sizes.find((s) => slug(s) === slug(sizeName));
        const print = c.prints.find((p) => slug(p) === slug(printName));
        if (!size || !print) continue;
        c.qty[size] = { ...(c.qty[size] || {}), [print]: Math.max(0, (c.qty[size]?.[print] ?? 0) - dec) };
        applied++;
        pushLog(`Sold ${dec} ${c.name} · ${size} · ${print}`);
      }
      return next;
    });
    touchSaved();
    return applied;
  };

  const Tool = ({ icon, label, onClick, active: on }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
        on ? "bg-black text-white" : "bg-white border border-[#e8e8e8] text-[#555] hover:bg-[#f5f5f5]"
      }`}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center"><Package size={17} /></div>
          <div>
            <h2 className="text-xl font-bold text-black tracking-tight leading-none">Stock Inventory</h2>
            <p className="text-[11px] text-[#999] mt-1">{grandTotal.toLocaleString("en-IN")} pcs across {ordered.length} categories</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#999]">
          {savedAt && <span className="flex items-center gap-1"><Check size={12} /> Saved · {savedAt}</span>}
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-black" /> Synced</span>
        </div>
      </div>

      {/* Category selector (doubles as totals) */}
      <div className="flex items-stretch gap-2 flex-wrap">
        <div className="bg-black text-white rounded-xl px-4 py-2.5 flex flex-col justify-center min-w-[120px]">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/55">Grand Total</span>
          <span className="text-xl font-bold leading-tight">{grandTotal.toLocaleString("en-IN")}<span className="text-[11px] font-medium text-white/55 ml-1">pcs</span></span>
        </div>
        {ordered.map((c) => {
          const on = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`rounded-xl px-4 py-2.5 flex flex-col justify-center min-w-[104px] text-left border transition-all ${
                on ? "bg-white border-black ring-1 ring-black" : "bg-white border-[#e8e8e8] hover:border-[#ccc]"
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#999] truncate">{c.name}</span>
              <span className="text-xl font-bold text-black leading-tight">{catTotal(c)}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-lg px-3 h-9 focus-within:border-black transition-all">
          <Search size={15} className="text-[#bbb] shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search size or print…"
            className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0" />
          {oos > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#666] bg-[#ececec] px-2 py-0.5 rounded-full whitespace-nowrap">
              <AlertTriangle size={11} /> {oos} empty
            </span>
          )}
        </div>
        <Tool icon={<Zap size={14} />} label="Quick Sale" onClick={() => setQuickSale((v) => !v)} active={quickSale} />
        <Tool icon={<Sparkles size={14} />} label="AI Parse" onClick={() => setParseOpen(true)} />
        <Tool icon={<ClipboardPaste size={14} />} label="Bulk Paste" onClick={() => setParseOpen(true)} />
        <Tool icon={<History size={14} />} label="Log" onClick={() => setShowLog(true)} />
        <Tool icon={<FileDown size={14} />} label="PDF" onClick={exportPdf} />
        <Tool icon={<Share2 size={14} />} label="WhatsApp" onClick={shareWhatsApp} />
      </div>

      {quickSale && (
        <div className="text-[12px] text-[#555] bg-[#f5f5f5] border border-[#e8e8e8] rounded-lg px-3 py-2">
          <strong>Quick Sale on</strong> — tap any cell to deduct 1 from stock.
        </div>
      )}

      {active && (
        <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden">
          {/* Add print / size */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 p-3 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-1.5 flex-1">
              <input value={newPrint} onChange={(e) => setNewPrint(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPrint(); }}
                placeholder={`New print for ${active.name}`}
                className="flex-1 bg-[#f8f8f8] border border-[#e8e8e8] rounded-lg px-3 h-9 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black transition-all min-w-0" />
              <button onClick={addPrint} className="flex items-center gap-1 px-3 h-9 rounded-lg bg-black text-white text-[13px] font-semibold hover:bg-[#222] shrink-0"><Plus size={14} /> Print</button>
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <input value={newSize} onChange={(e) => setNewSize(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSize(); }}
                placeholder="New size (e.g. 24-30)"
                className="flex-1 bg-[#f8f8f8] border border-[#e8e8e8] rounded-lg px-3 h-9 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black transition-all min-w-0" />
              <button onClick={addSize} className="flex items-center gap-1 px-3 h-9 rounded-lg bg-white border border-black text-black text-[13px] font-semibold hover:bg-[#f5f5f5] shrink-0"><Plus size={14} /> Size</button>
            </div>
          </div>

          {/* Matrix — table-fixed so it always fits the width (no horizontal scroll) */}
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-[#e8e8e8]">
                <th className="w-[56px] text-left text-[11px] font-semibold uppercase tracking-wider text-[#999] px-3 py-2.5">Size</th>
                {visiblePrints.map((p) => (
                  <th key={p} className="text-[10.5px] font-semibold text-[#777] px-1 py-2.5 text-center leading-tight align-bottom group">
                    <span className="inline-flex items-center gap-0.5 break-words">
                      {p}
                      <button onClick={() => removePrint(p)} className="opacity-0 group-hover:opacity-100 text-[#ccc] hover:text-black transition-all shrink-0"><X size={10} /></button>
                    </span>
                  </th>
                ))}
                <th className="w-[52px] text-right text-[11px] font-semibold uppercase tracking-wider text-[#999] px-3 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleSizes.map((s) => (
                <tr key={s} className="border-b border-[#f3f3f3] group hover:bg-[#fafafa]">
                  <td className="px-3 py-1.5 text-[13px] font-medium text-black whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {s}
                      <button onClick={() => removeSize(s)} className="opacity-0 group-hover:opacity-100 text-[#ccc] hover:text-black transition-all"><X size={10} /></button>
                    </span>
                  </td>
                  {visiblePrints.map((p) => {
                    const val = active.qty[s]?.[p] ?? 0;
                    return (
                      <td key={p} className="px-0.5 py-1.5 text-center">
                        {quickSale ? (
                          <button onClick={() => cellSale(s, p)} disabled={val <= 0}
                            className={`w-11 h-7 mx-auto rounded-md border text-[13px] font-medium transition-colors ${val <= 0 ? "text-[#ccc] border-[#f0f0f0] cursor-not-allowed" : "text-black border-[#e8e8e8] hover:bg-[#f0f0f0]"}`}>
                            {val}
                          </button>
                        ) : (
                          <input type="number" inputMode="numeric" value={val} min={0}
                            onChange={(e) => setQty(s, p, parseInt(e.target.value, 10))}
                            onFocus={(e) => e.target.select()}
                            className={`w-11 h-7 mx-auto text-center rounded-md border text-[13px] focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition-all ${NUM_INPUT} ${val === 0 ? "text-[#ccc] border-[#f0f0f0]" : "text-black border-[#e8e8e8]"}`} />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right text-[13px] font-bold text-black">{rowTotal(active, s)}</td>
                </tr>
              ))}
              <tr className="bg-[#fafafa]">
                <td className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-black">Total</td>
                {visiblePrints.map((p) => (
                  <td key={p} className="px-0.5 py-2.5 text-center text-[13px] font-bold text-black">{colTotal(active, p)}</td>
                ))}
                <td className="px-3 py-2.5 text-right text-[13px] font-bold text-black">{catTotal(active)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!isReady && <div className="py-20 text-center text-[#999]"><RefreshCw size={22} className="animate-spin inline" /></div>}

      {/* Log */}
      {showLog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={() => setShowLog(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl border border-[#e8e8e8] shadow-2xl w-full max-w-md max-h-[60vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e8e8]">
              <h3 className="font-bold text-black flex items-center gap-2"><History size={16} /> Activity Log</h3>
              <button onClick={() => setShowLog(false)} className="text-[#999] hover:text-black"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {log.length === 0 ? (
                <p className="text-sm text-[#999] text-center py-8">No activity yet this session.</p>
              ) : (
                log.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-[#f5f5f5]">
                    <span className="text-sm text-black">{l.text}</span>
                    <span className="text-[11px] text-[#aaa] whitespace-nowrap">{new Date(l.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {parseOpen && <ParseModal onClose={() => setParseOpen(false)} onApply={applyParse} />}
    </div>
  );
}

/* ─── Parse / Bulk paste modal ──────────────────────────────── */
function ParseModal({ onClose, onApply }: { onClose: () => void; onApply: (raw: string) => number }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const run = () => {
    const n = onApply(text);
    setResult(n > 0 ? `Applied ${n} update${n !== 1 ? "s" : ""}.` : "No matching lines. Format: sold 2 jabla 3-6 bear");
    if (n > 0) setText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl border border-[#e8e8e8] shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e8e8]">
          <h3 className="font-bold text-black flex items-center gap-2"><Sparkles size={16} /> Parse sales / bulk paste</h3>
          <button onClick={onClose} className="text-[#999] hover:text-black"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[13px] text-[#666]">One per line — each line deducts stock:</p>
          <textarea ref={ref} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={6}
            placeholder={"sold 2 jabla 3-6 bear\nsold 1 frock 0-3 unicorn\n3 night suit 0-3 owl"}
            className="w-full bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 transition-all resize-y font-mono" />
          {result && <p className={`text-sm font-medium ${result.startsWith("Applied") ? "text-black" : "text-[#888]"}`}>{result}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 h-9 rounded-lg text-sm font-semibold text-[#555] hover:bg-[#f5f5f5]">Close</button>
            <button onClick={run} disabled={!text.trim()} className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-black text-white text-sm font-semibold disabled:bg-[#ddd]"><Check size={14} /> Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
