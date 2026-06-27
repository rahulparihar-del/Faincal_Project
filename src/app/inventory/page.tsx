"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState(false);
  const seededRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit in place cell state
  const [editingCell, setEditingCell] = useState<{ size: string; print: string } | null>(null);
  const [dimModalOpen, setDimModalOpen] = useState(false);
  const [dimType, setDimType] = useState<"print" | "size">("print");

  // Seed default data once if the table is empty.
  useEffect(() => {
    if (!isReady || seededRef.current) return;
    if (cats.length === 0) {
      seededRef.current = true;
      setCats(DEFAULT_CATEGORIES);
    }
  }, [isReady, cats, setCats]);

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

  const touchSaved = () => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState("saved");
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), 2200);
    }, 500);
  };

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

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
  const handleCellClick = (size: string, print: string, val: number) => {
    if (quickSale) {
      if (val > 0) cellSale(size, print);
    } else {
      setEditingCell({ size, print });
    }
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
    if (window.confirm(`Are you sure you want to delete print "${print}"?`)) {
      updateCat(active.id, (c) => {
        const qty: Record<string, Record<string, number>> = {};
        for (const s of c.sizes) { const { [print]: _d, ...rest } = c.qty[s] || {}; void _d; qty[s] = rest; }
        return { ...c, prints: c.prints.filter((p) => p !== print), qty };
      });
      pushLog(`Removed print "${print}" from ${active.name}`);
    }
  };
  const removeSize = (size: string) => {
    if (!active) return;
    if (window.confirm(`Are you sure you want to delete size "${size}"?`)) {
      updateCat(active.id, (c) => {
        const { [size]: _d, ...rest } = c.qty; void _d;
        return { ...c, sizes: c.sizes.filter((s) => s !== size), qty: rest };
      });
      pushLog(`Removed size "${size}" from ${active.name}`);
    }
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

  /* ── Parse lines ── */
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
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
        on 
          ? "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm" 
          : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:text-zinc-900 dark:hover:text-zinc-250"
      }`}
    >
      {icon}<span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Auto-save toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -16, x: "-50%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-20 left-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
            role="status"
          >
            <Check size={15} className="text-green-400" />
            <span className="text-sm font-semibold">Changes synced to database</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-955 flex items-center justify-center shadow-sm">
            <Package size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">Stock Inventory</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
              {grandTotal.toLocaleString("en-IN")} pcs total · across {ordered.length} active categories
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {saveState === "saving" ? (
            <span className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 font-medium">
              <RefreshCw size={12} className="animate-spin" /> Saving changes…
            </span>
          ) : savedAt ? (
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
              <Check size={12} className="text-green-500" /> Synced · {savedAt}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Auto-sync active
          </span>
        </div>
      </div>

      {/* Category selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Grand Total Card */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 dark:from-zinc-950 dark:to-black text-white rounded-2xl p-3.5 flex flex-col justify-between shadow-sm min-h-[82px] border border-zinc-800">
          <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold">Grand Total</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black tracking-tight">{grandTotal.toLocaleString("en-IN")}</span>
            <span className="text-[10px] font-medium text-zinc-400 uppercase">pcs</span>
          </div>
        </div>
        
        {ordered.map((c) => {
          const on = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`rounded-2xl p-3.5 flex flex-col justify-between text-left border transition-all duration-300 min-h-[82px] cursor-pointer hover:shadow-sm ${
                on 
                  ? "bg-white dark:bg-zinc-800 border-zinc-950 dark:border-zinc-100 ring-2 ring-zinc-950/10 dark:ring-white/10" 
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-350 dark:hover:border-zinc-700"
              }`}
            >
              <span className={`text-[9px] uppercase tracking-wider font-bold ${on ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-550"} truncate`}>
                {c.name}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-2xl font-extrabold tracking-tight ${on ? "text-zinc-900 dark:text-white" : "text-zinc-800 dark:text-zinc-200"}`}>
                  {catTotal(c).toLocaleString("en-IN")}
                </span>
                <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase">pcs</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 h-9 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/5 transition-all">
          <Search size={14} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search size or print…"
            className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-405 dark:placeholder:text-zinc-600 focus:outline-none border-none p-0 min-w-0" />
          {oos > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full whitespace-nowrap">
              <AlertTriangle size={10} className="text-amber-500" /> {oos} empty
            </span>
          )}
        </div>
        <button
          onClick={() => setDimModalOpen(true)}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-955 text-xs font-bold transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer shrink-0"
        >
          <Plus size={13} /> Add Dimension
        </button>
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
        <Tool icon={<Zap size={13} />} label="Quick Sale" onClick={() => setQuickSale((v) => !v)} active={quickSale} />
        <Tool icon={<Sparkles size={13} />} label="AI Parse" onClick={() => setParseOpen(true)} />
        <Tool icon={<ClipboardPaste size={13} />} label="Bulk Paste" onClick={() => setParseOpen(true)} />
        <Tool icon={<History size={13} />} label="Log" onClick={() => setShowLog(true)} />
        <Tool icon={<FileDown size={13} />} label="PDF" onClick={exportPdf} />
        <Tool icon={<Share2 size={13} />} label="WhatsApp" onClick={shareWhatsApp} />
      </div>

      {quickSale && (
        <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Zap size={14} className="text-amber-500 animate-pulse" />
          <span><strong>Quick Sale Mode Active</strong> — Tap any stock cell in the table below to deduct 1 item.</span>
        </div>
      )}

      {active && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] dark:shadow-none overflow-hidden">
          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] table-fixed border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/20 text-xs text-zinc-400 dark:text-zinc-550">
                  <th className="sticky left-0 bg-white dark:bg-zinc-900 z-20 w-[68px] text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 border-r border-zinc-150/40 dark:border-zinc-800/60 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-none">
                    Size
                  </th>
                  {visiblePrints.map((p) => (
                    <th key={p} className="text-[10px] font-bold uppercase tracking-wider px-2 py-3 text-center leading-tight align-bottom group relative">
                      <span className="inline-flex items-center gap-1 justify-center w-full">
                        <span className="truncate" title={p}>{p}</span>
                        <button 
                          onClick={() => removePrint(p)} 
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all shrink-0 cursor-pointer"
                          title={`Delete print ${p}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    </th>
                  ))}
                  <th className="sticky right-0 bg-white dark:bg-zinc-900 z-20 w-[78px] text-right text-[10px] font-bold uppercase tracking-wider px-4 py-3 border-l border-zinc-150/40 dark:border-zinc-800/60 shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-none">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleSizes.map((s) => (
                  <tr key={s} className="border-b border-zinc-150/40 dark:border-zinc-800/40 group hover:bg-zinc-50/40 dark:hover:bg-zinc-950/20 transition-all">
                    <td className="sticky left-0 bg-white dark:bg-zinc-900 z-10 px-4 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-50 border-r border-zinc-150/40 dark:border-zinc-800/60 whitespace-nowrap shadow-[3px_0_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-none">
                      <div className="flex items-center gap-1.5">
                        {s}
                        <button 
                          onClick={() => removeSize(s)} 
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all cursor-pointer"
                          title={`Delete size ${s}`}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </td>
                    {visiblePrints.map((p) => {
                      const val = active.qty[s]?.[p] ?? 0;
                      const isEditing = editingCell?.size === s && editingCell?.print === p;
                      return (
                        <td key={p} className="px-0.5 py-1.5 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              inputMode="numeric"
                              value={val}
                              min={0}
                              onChange={(e) => setQty(s, p, parseInt(e.target.value, 10))}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => { if (e.key === "Enter") setEditingCell(null); }}
                              className="w-12 h-8 text-center text-xs font-bold rounded-lg border border-zinc-950 dark:border-zinc-100 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                              autoFocus
                              onFocus={(e) => e.target.select()}
                            />
                          ) : (
                            <div
                              onClick={() => handleCellClick(s, p, val)}
                              className={`w-12 h-8 mx-auto flex items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                                val === 0
                                  ? "text-red-500 bg-red-500/5 dark:bg-red-500/10 border-red-500/10"
                                  : val <= 5
                                  ? "text-amber-600 bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/10"
                                  : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-transparent"
                              }`}
                            >
                              {val}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bg-white dark:bg-zinc-900 z-10 px-4 py-2 text-right text-xs font-black text-zinc-900 dark:text-zinc-50 border-l border-zinc-150/40 dark:border-zinc-800/60 shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-none">
                      {rowTotal(active, s).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
                <tr className="bg-zinc-50/50 dark:bg-zinc-950/20">
                  <td className="sticky left-0 bg-zinc-50/80 dark:bg-zinc-950/80 z-10 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-50 border-r border-zinc-150/40 dark:border-zinc-800/60 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-none">
                    Total
                  </td>
                  {visiblePrints.map((p) => (
                    <td key={p} className="px-0.5 py-3 text-center text-xs font-black text-zinc-900 dark:text-zinc-50">
                      {colTotal(active, p).toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="sticky right-0 bg-zinc-50/80 dark:bg-zinc-950/80 z-10 px-4 py-3 text-right text-xs font-black text-zinc-900 dark:text-zinc-50 border-l border-zinc-150/40 dark:border-zinc-800/60 shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.02)] dark:shadow-none">
                    {catTotal(active).toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isReady && <div className="py-20 text-center text-[#999]"><RefreshCw size={22} className="animate-spin inline" /></div>}

      {/* Add Dimension Modal */}
      <AnimatePresence>
        {dimModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDimModalOpen(false)}
              className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative max-w-sm w-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 z-10 flex flex-col gap-4 shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Plus size={16} /> Add Dimension
                </h3>
                <button onClick={() => setDimModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl">
                <button
                  onClick={() => setDimType("print")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${dimType === "print" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
                >
                  Print Pattern
                </button>
                <button
                  onClick={() => setDimType("size")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${dimType === "size" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
                >
                  Size Option
                </button>
              </div>

              {dimType === "print" ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider ml-1">Print Pattern Name</label>
                  <input
                    value={newPrint}
                    onChange={(e) => setNewPrint(e.target.value)}
                    placeholder="e.g. Bear, Dinosaur, Stripes"
                    onKeyDown={(e) => { if (e.key === "Enter") { addPrint(); setDimModalOpen(false); } }}
                    className="bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 focus:ring-2 focus:ring-black/5 w-full"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider ml-1">Size Option Label</label>
                  <input
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    placeholder="e.g. 12-18, Standard, XL"
                    onKeyDown={(e) => { if (e.key === "Enter") { addSize(); setDimModalOpen(false); } }}
                    className="bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 focus:ring-2 focus:ring-black/5 w-full"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setDimModalOpen(false)} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 cursor-pointer">Cancel</button>
                <button
                  onClick={() => {
                    if (dimType === "print") addPrint();
                    else addSize();
                    setDimModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold hover:shadow transition-all cursor-pointer"
                >
                  Add to {active?.name}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log */}
      <AnimatePresence>
        {showLog && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={() => setShowLog(false)}>
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md max-h-[60vh] flex flex-col z-10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><History size={16} /> Activity Log</h3>
                <button onClick={() => setShowLog(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"><X size={18} /></button>
              </div>
              <div className="overflow-y-auto p-3 space-y-1">
                {log.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-10">No activity yet this session.</p>
                ) : (
                  log.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-950/40 transition-colors">
                      <span className="text-xs text-zinc-800 dark:text-zinc-200">{l.text}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">{new Date(l.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg p-5 z-10 flex flex-col gap-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles size={16} className="text-zinc-500" /> Parse Sales & Bulk Paste
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Paste one entry per line to deduct from stock. Format: <code className="font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-950 px-1.5 py-0.5 rounded">sold 2 jabla 3-6 bear</code>
          </p>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null); }}
            rows={6}
            placeholder={"sold 2 jabla 3-6 bear\nsold 1 frock 0-3 unicorn\n3 night suit 0-3 owl"}
            className="w-full bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 focus:ring-2 focus:ring-black/5 resize-y font-mono"
          />
          {result && (
            <p className={`text-xs font-semibold ${result.startsWith("Applied") ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
              {result}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 cursor-pointer">Close</button>
            <button
              onClick={run}
              disabled={!text.trim()}
              className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-955 text-xs font-bold disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-650 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Check size={14} /> Apply Updates
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
