"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { useTheme } from "@/context/ThemeContext";
import {
  Package, Search, Zap, Sparkles, History,
  FileDown, Share2, Plus, X, Check, RefreshCw,
  LayoutDashboard, Boxes,
} from "lucide-react";
import Image from "next/image";

/* ─── Types ──────────────────────────────────────────────────── */
interface InventoryCategory {
  id: string;
  name: string;
  prints: string[];
  sizes: string[];
  qty: Record<string, Record<string, number>>;
  order: number;
}
interface LogEntry { id: string; text: string; at: string; }

const STORAGE_KEY = "biztrack_inventory";

/* ─── Product images ─────────────────────────────────────────── */
const PRODUCT_IMAGES: Record<string, string> = {
  "cat-jabla":     "/inv-jabla.jpg",
  "cat-frock":     "/inv-frock.jpg",
  "cat-coord":     "/inv-coord.jpg",
  "cat-nightsuit": "/inv-nightsuit.jpg",
  "cat-new-nightsuit": "/inv-nightsuit.jpg",
  "cat-hooded":    "/inv-hooded.jpg",
};

/* ─── Seed data ──────────────────────────────────────────────── */
function buildCat(id: string, name: string, prints: string[], sizes: string[], rows: number[][], order: number): InventoryCategory {
  const qty: Record<string, Record<string, number>> = {};
  sizes.forEach((s, i) => { qty[s] = {}; prints.forEach((p, j) => { qty[s][p] = rows[i]?.[j] ?? 0; }); });
  return { id, name, prints, sizes, qty, order };
}

const DEFAULT_CATEGORIES: InventoryCategory[] = [
  buildCat("cat-jabla", "Jabla",
    ["Bear","Owl","Dino","Mashroom","Multi-Orange","Elephant","Car","Unicorn","Avacoda","Flower","Strawberry","Icecream"],
    ["0-3","3-6","6-9","9-12"],
    [[18,20,7,22,20,4,9,21,0,0,0,0],[1,2,0,1,25,1,0,41,25,25,25,25],[0,0,0,0,42,0,0,45,40,41,41,41],[1,1,0,2,38,0,0,40,41,36,38,37]], 0),
  buildCat("cat-frock", "Frock",
    ["Strawberry","Dino","Icecream","Multi-Orange","Bear","Unicorn","Mashroom","Car","Elephant","Owl","Toucan","Flower"],
    ["0-3","3-6","6-12"],
    [[6,7,7,5,5,17,17,12,3,6,0,0],[8,4,0,5,0,6,16,0,3,3,7,4],[0,0,0,0,0,0,0,1,1,2,2,0]], 1),
  buildCat("cat-coord", "Co-ord Set",
    ["Mashroom","Car","Flower","Toucan","Icecream","Bear","Strawberry","Dino","Unicorn","Avocado","Elephant"],
    ["0-3","3-6","6-9","9-12","12-18","18-24"],
    [[4,3,2,0,0,0,0,0,0,1,0],[0,0,0,0,0,0,0,0,0,0,0],[0,0,0,6,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0],[8,0,6,4,0,0,3,0,1,0,7],[10,0,3,0,0,0,0,0,0,0,6]], 2),
  buildCat("cat-nightsuit", "Night Suit",
    ["Dino","Car","Bear","Owl","Unicorn","Mashroom","Multi-Orange","Elephant"],
    ["0-3","3-6","6-9","9-12","12-18","18-24"],
    [[0,3,3,6,0,7,7,4],[4,0,0,3,3,5,3,0],[0,0,1,3,0,1,1,0],[0,0,0,1,0,0,0,0],[0,1,0,0,0,1,0,0],[0,1,0,0,0,0,0,1]], 3),
  buildCat("cat-new-nightsuit", "New Night Suit",
    ["Dino", "Triangle", "Unicorn", "Vegetable", "Owl", "Flower", "Honey Beans", "Uni Horse", "Uni Baby"],
    ["0-3", "3-6", "6-9", "6-12", "9-12", "12-18", "18-24"],
    [
      [3, 4, 5, 3, 4, 0, 0, 0, 0], // 0-3
      [4, 4, 5, 4, 4, 0, 0, 0, 0], // 3-6
      [5, 5, 0, 4, 4, 0, 0, 0, 0], // 6-9
      [21, 12, 6, 7, 12, 0, 0, 0, 0], // 6-12
      [0, 0, 0, 0, 0, 0, 0, 0, 0], // 9-12
      [6, 9, 0, 8, 10, 0, 0, 0, 0], // 12-18
      [9, 8, 0, 4, 4, 8, 7, 8, 6], // 18-24
    ], 4),
  buildCat("cat-hooded", "Hooded Towel", ["Plain"], ["Standard"], [[18]], 5),
];

/* ─── Helpers ────────────────────────────────────────────────── */
function catTotal(c: InventoryCategory) {
  let t = 0;
  for (const s of c.sizes) for (const p of c.prints) t += c.qty[s]?.[p] ?? 0;
  return t;
}
function rowTotal(c: InventoryCategory, size: string) {
  return c.prints.reduce((sum, p) => sum + (c.qty[size]?.[p] ?? 0), 0);
}
function colTotal(c: InventoryCategory, print: string) {
  return c.sizes.reduce((sum, s) => sum + (c.qty[s]?.[print] ?? 0), 0);
}
function outOfStockCount(cats: InventoryCategory[]) {
  let n = 0;
  for (const c of cats) for (const s of c.sizes) for (const p of c.prints) if ((c.qty[s]?.[p] ?? 0) === 0) n++;
  return n;
}
function lowStockCount(cats: InventoryCategory[]) {
  let n = 0;
  for (const c of cats) for (const s of c.sizes) for (const p of c.prints) { const v = c.qty[s]?.[p] ?? 0; if (v > 0 && v <= 5) n++; }
  return n;
}
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ""); }

/* ══════════════════════════════════════════════════════════════
   OVERVIEW TAB - CLEAN FLAT DESIGN
══════════════════════════════════════════════════════════════ */
function OverviewTab({ ordered }: { ordered: InventoryCategory[] }) {
  const grandTotal = ordered.reduce((s, c) => s + catTotal(c), 0);
  const oos = outOfStockCount(ordered);
  const low = lowStockCount(ordered);

  // Category distribution
  const maxCat = Math.max(...ordered.map(catTotal), 1);

  // Print distribution
  const printMap: Record<string, number> = {};
  for (const c of ordered) {
    for (const p of c.prints) {
      printMap[p] = (printMap[p] || 0) + colTotal(c, p);
    }
  }
  const topPrints = Object.entries(printMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxPrint = topPrints[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Inventory", value: grandTotal, sub: "Pieces in stock" },
          { label: "Categories", value: ordered.length, sub: "Product categories" },
          { label: "Out of Stock", value: oos, sub: "Combo items at 0" },
          { label: "Low Stock", value: low, sub: "Combo items ≤ 5" },
        ].map(item => (
          <div key={item.label} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{item.label}</div>
            <div className="text-3xl font-black text-zinc-900 dark:text-white mt-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>
              {item.value.toLocaleString("en-IN")}
            </div>
            <div className="text-xs text-zinc-500 mt-1">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Main lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories list */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Category Stock</h3>
          <div className="space-y-4">
            {ordered.map(c => {
              const total = catTotal(c);
              const pct = (total / maxCat) * 100;
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <span>{c.name}</span>
                    <span>{total.toLocaleString("en-IN")} pcs</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-900 dark:bg-white rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prints distribution */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Top Prints</h3>
          <div className="space-y-4">
            {topPrints.map(([print, total]) => {
              const pct = (total / maxPrint) * 100;
              return (
                <div key={print} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <span>{print}</span>
                    <span>{total} pcs</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-400 dark:bg-zinc-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STOCK TAB - FLAT LIST TABLE LAYOUT
══════════════════════════════════════════════════════════════ */
function StockTab({
  ordered, cats, setCats,
  quickSale, setQuickSale,
  log, setLog,
  shareWhatsApp, exportPdf,
  setDimModalOpen, setParseOpen, setShowLog,
}: {
  ordered: InventoryCategory[];
  cats: InventoryCategory[];
  setCats: (v: InventoryCategory[] | ((p: InventoryCategory[]) => InventoryCategory[])) => void;
  quickSale: boolean; setQuickSale: (v: boolean) => void;
  log: LogEntry[]; setLog: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  shareWhatsApp: () => void; exportPdf: () => void;
  setDimModalOpen: (v: boolean) => void; setParseOpen: (v: boolean) => void;
  setShowLog: (v: boolean) => void;
}) {
  const [activeCatId, setActiveCatId] = useState(ordered[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [editingCell, setEditingCell] = useState<{ print: string; size: string } | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = ordered.find(c => c.id === activeCatId) ?? ordered[0] ?? null;
  const img = active ? PRODUCT_IMAGES[active.id] : null;

  useEffect(() => {
    if (!activeCatId && ordered.length > 0) setActiveCatId(ordered[0].id);
  }, [ordered, activeCatId]);

  const touchSaved = useCallback(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState("saved");
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), 2200);
    }, 500);
  }, []);

  const pushLog = useCallback((text: string) =>
    setLog(prev => [{ id: `lg-${Date.now()}`, text, at: new Date().toISOString() }, ...prev].slice(0, 50)), [setLog]);

  const updateCat = useCallback((id: string, fn: (c: InventoryCategory) => InventoryCategory) => {
    setCats(prev => prev.map(c => c.id === id ? fn(c) : c));
    touchSaved();
  }, [setCats, touchSaved]);

  const setQty = (size: string, print: string, value: number) => {
    if (!active) return;
    const v = Math.max(0, Math.floor(value || 0));
    updateCat(active.id, c => ({ ...c, qty: { ...c.qty, [size]: { ...(c.qty[size] || {}), [print]: v } } }));
  };

  const handleCellClick = (size: string, print: string, currentVal: number) => {
    if (quickSale) {
      if (currentVal > 0) {
        setQty(size, print, currentVal - 1);
        pushLog(`Sold 1 ${active.name} · ${size} · ${print}`);
      }
    } else {
      setEditingCell({ print, size });
    }
  };

  const q = search.trim().toLowerCase();
  const visiblePrints = active
    ? (q ? active.prints.filter(p => p.toLowerCase().includes(q)) : active.prints)
    : [];

  return (
    <div className="space-y-4">
      {/* Auto-save toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-20 left-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg bg-zinc-900 dark:bg-white border border-zinc-800 dark:border-white/20 text-white dark:text-black text-xs font-bold"
          >
            <Check size={14} />
            <span>Changes synced to database</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Horizontal Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
        {ordered.map(c => {
          if (c.id === "cat-new-nightsuit") return null; // Hide the separate new nightsuit tab
          const on = activeCatId === c.id || (c.id === "cat-nightsuit" && activeCatId === "cat-new-nightsuit");
          const totalPcs = c.id === "cat-nightsuit" 
            ? catTotal(c) + (ordered.find(x => x.id === "cat-new-nightsuit") ? catTotal(ordered.find(x => x.id === "cat-new-nightsuit")!) : 0)
            : catTotal(c);
          return (
            <button
              key={c.id}
              onClick={() => { 
                if (c.id === "cat-nightsuit") {
                  setActiveCatId("cat-nightsuit"); 
                } else {
                  setActiveCatId(c.id); 
                }
                setSearch(""); 
                setEditingCell(null); 
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                on 
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white" 
                  : "bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850"
              }`}
            >
              {c.name} · <span className="opacity-60">{totalPcs} pcs</span>
            </button>
          );
        })}
      </div>

      {/* Main content grid - Locked Height */}
      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-stretch h-[calc(100vh-170px)] overflow-hidden">
          
          {/* Left Side: Product Image Display Card - Scrollable internally if needed */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Product Image</div>
              <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-zinc-50 border border-zinc-100 dark:border-zinc-850 shrink-0">
                {img ? (
                  <Image src={img} alt={active.name} fill sizes="260px" className="object-cover" priority />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                    <Package size={48} />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-md font-black text-zinc-900 dark:text-white leading-tight">{active.name}</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">{catTotal(active)} Total Pieces</p>
              </div>
              
              {/* Quick stats list */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-850 text-xs">
                <div className="py-1.5 flex justify-between">
                  <span className="text-zinc-500">Prints count</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{active.prints.length}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-zinc-500">Sizes count</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{active.sizes.length}</span>
                </div>
              </div>
            </div>

            {/* Quick controls panel */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-850 mt-2 shrink-0">
              <button
                onClick={() => setQuickSale(!quickSale)}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  quickSale 
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white" 
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-white border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                }`}
              >
                {quickSale ? "Quick Sale ON" : "Quick Sale Mode"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDimModalOpen(true)} className="py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-white rounded-lg text-[10px] font-bold hover:bg-zinc-100 transition-all cursor-pointer">
                  Add Size/Print
                </button>
                <button onClick={() => setParseOpen(true)} className="py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-white rounded-lg text-[10px] font-bold hover:bg-zinc-100 transition-all cursor-pointer">
                  AI Parse
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-zinc-500 text-[10px] pt-1">
                <button onClick={exportPdf} className="hover:text-zinc-900 dark:hover:text-white cursor-pointer font-bold">PDF</button>
                <button onClick={shareWhatsApp} className="hover:text-zinc-900 dark:hover:text-white cursor-pointer font-bold">WhatsApp</button>
                <button onClick={() => setShowLog(true)} className="hover:text-zinc-900 dark:hover:text-white cursor-pointer font-bold">Log</button>
              </div>
            </div>
          </div>

          {/* Right Side: Clean Flat Spreadsheet Table - Locked Height with inner scroll */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            {/* Table controls */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0 bg-white dark:bg-zinc-900">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2 max-w-xs flex-1">
                  <Search size={14} className="text-zinc-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filter prints..."
                    className="w-full bg-transparent text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none border-none"
                  />
                </div>
                
                {/* Night Suit Sub-tab Toggles (Original / New Collection) */}
                {(active.id === "cat-nightsuit" || active.id === "cat-new-nightsuit") && (
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0">
                    <button
                      onClick={() => { setActiveCatId("cat-nightsuit"); setEditingCell(null); }}
                      className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        active.id === "cat-nightsuit"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-250/30 dark:border-zinc-700"
                          : "text-zinc-450 dark:text-zinc-500 hover:text-zinc-750 dark:hover:text-zinc-350"
                      }`}
                    >
                      Old Print
                    </button>
                    <button
                      onClick={() => { setActiveCatId("cat-new-nightsuit"); setEditingCell(null); }}
                      className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        active.id === "cat-new-nightsuit"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-250/30 dark:border-zinc-700"
                          : "text-zinc-450 dark:text-zinc-500 hover:text-zinc-750 dark:hover:text-zinc-350"
                      }`}
                    >
                      New Print
                    </button>
                  </div>
                )}
              </div>

              {quickSale && (
                <div className="text-[9px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  ⚡ Tap any cell to subtract 1
                </div>
              )}
            </div>

            {/* Scrollable table container */}
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950">Print Pattern</th>
                    {active.sizes.map(size => (
                      <th key={size} className="px-3 py-3 text-center bg-zinc-50 dark:bg-zinc-950">{size}</th>
                    ))}
                    <th className="px-4 py-3 text-right bg-zinc-50 dark:bg-zinc-950">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-250/60 dark:divide-zinc-800 text-xs">
                  {visiblePrints.map(print => {
                    const colTot = colTotal(active, print);
                    return (
                      <tr key={print} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{print}</td>
                        {active.sizes.map(size => {
                          const val = active.qty[size]?.[print] ?? 0;
                          const isEditing = editingCell?.print === print && editingCell?.size === size;
                          return (
                            <td key={size} className="px-1.5 py-1 text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={val}
                                  min={0}
                                  autoFocus
                                  onFocus={e => e.target.select()}
                                  onChange={e => setQty(size, print, parseInt(e.target.value, 10))}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={e => { if (e.key === "Enter") setEditingCell(null); }}
                                  className="w-12 h-7 text-center font-bold bg-zinc-100 dark:bg-zinc-950 border border-zinc-350 dark:border-zinc-750 text-zinc-900 dark:text-white rounded"
                                />
                              ) : (
                                <div
                                  onClick={() => handleCellClick(size, print, val)}
                                  className={`w-10 h-7 mx-auto flex items-center justify-center font-bold rounded cursor-pointer border ${
                                    val === 0 
                                      ? "text-zinc-300 dark:text-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/10 border-zinc-200 dark:border-zinc-850 border-dashed" 
                                      : "text-zinc-800 dark:text-zinc-200 bg-zinc-100/70 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750"
                                  }`}
                                >
                                  {val}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-right font-black text-zinc-900 dark:text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {colTot}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT PAGE
══════════════════════════════════════════════════════════════ */
export default function InventoryPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [cats, setCats, isReady] = useSupabaseTable<InventoryCategory>("inventory_categories", STORAGE_KEY, []);
  const [tab, setTab] = useState<"overview" | "stock">("overview");
  const [quickSale, setQuickSale] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [dimModalOpen, setDimModalOpen] = useState(false);
  const [dimType, setDimType] = useState<"print" | "size">("print");
  const [newPrint, setNewPrint] = useState("");
  const [newSize, setNewSize] = useState("");
  const [parseOpen, setParseOpen] = useState(false);
  const seededRef = useRef(false);

  // Seed
  useEffect(() => {
    if (!isReady || seededRef.current) return;
    if (cats.length === 0) { seededRef.current = true; setCats(DEFAULT_CATEGORIES); }
  }, [isReady, cats, setCats]);

  const ordered = useMemo(() => [...cats].sort((a, b) => a.order - b.order), [cats]);
  const grandTotal = ordered.reduce((s, c) => s + catTotal(c), 0);

  /* Active category for dim modal */
  const [activeCatForDim, setActiveCatForDim] = useState<string>("");
  const activeDim = ordered.find(c => c.id === activeCatForDim) ?? ordered[0] ?? null;

  const updateCat = (id: string, fn: (c: InventoryCategory) => InventoryCategory) => {
    setCats(prev => prev.map(c => c.id === id ? fn(c) : c));
  };
  const addPrint = (catId: string) => {
    const cat = ordered.find(c => c.id === catId);
    if (!cat) return;
    const name = newPrint.trim();
    if (!name || cat.prints.some(p => slug(p) === slug(name))) { setNewPrint(""); return; }
    updateCat(catId, c => {
      const qty = { ...c.qty };
      c.sizes.forEach(s => { qty[s] = { ...(qty[s] || {}), [name]: 0 }; });
      return { ...c, prints: [...c.prints, name], qty };
    });
    setNewPrint("");
  };
  const addSize = (catId: string) => {
    const cat = ordered.find(c => c.id === catId);
    if (!cat) return;
    const name = newSize.trim();
    if (!name || cat.sizes.some(s => slug(s) === slug(name))) { setNewSize(""); return; }
    updateCat(catId, c => {
      const row: Record<string, number> = {};
      c.prints.forEach(p => { row[p] = 0; });
      return { ...c, sizes: [...c.sizes, name], qty: { ...c.qty, [name]: row } };
    });
    setNewSize("");
  };

  const buildSummaryText = () => {
    const lines = [`KiddieKa Stock — ${grandTotal} pcs total`, ""];
    for (const c of ordered) {
      lines.push(`${c.name} — ${catTotal(c)}`);
      for (const p of c.prints) { const t = colTotal(c, p); if (t > 0) lines.push(`  - ${p}: ${t}`); }
      lines.push("");
    }
    return lines.join("\n");
  };
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildSummaryText())}`, "_blank", "noopener,noreferrer");

  const exportPdf = () => {
    const active = ordered[0]; if (!active) return;
    const win = window.open("", "_blank", "width=900,height=700"); if (!win) return;
    const head = `<tr><th style="text-align:left">Print</th>${active.sizes.map(s => `<th>${s}</th>`).join("")}<th>Total</th></tr>`;
    const rows = active.prints.map(p => `<tr><td>${p}</td>${active.sizes.map(s => `<td style="text-align:center">${active.qty[s]?.[p] ?? 0}</td>`).join("")}<td style="text-align:right;font-weight:700">${colTotal(active, p)}</td></tr>`).join("");
    win.document.write(`<html><head><title>${active.name} Inventory</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:6px 10px}thead{background:#f3f3f3}</style></head><body><h1>${active.name} — ${catTotal(active)} pcs</h1><table><thead>${head}</thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close(); setTimeout(() => win.print(), 300);
  };

  const applyParse = (raw: string) => {
    const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
    let applied = 0;
    setCats(prev => {
      const next = prev.map(c => ({ ...c, qty: { ...c.qty } }));
      for (const line of lines) {
        const m = line.match(/(?:sold\s+)?(\d+)\s+([a-z][a-z\- ]*?)\s+([\d]+-[\d]+|standard)\s+([a-z][a-z\-]*)/i);
        if (!m) continue;
        const [, qtyStr, catName, sizeName, printName] = m;
        const dec = parseInt(qtyStr, 10);
        const c = next.find(x => slug(x.name) === slug(catName) || x.name.toLowerCase().startsWith(catName.toLowerCase().trim()));
        if (!c) continue;
        const size = c.sizes.find(s => slug(s) === slug(sizeName));
        const print = c.prints.find(p => slug(p) === slug(printName));
        if (!size || !print) continue;
        c.qty[size] = { ...(c.qty[size] || {}), [print]: Math.max(0, (c.qty[size]?.[print] ?? 0) - dec) };
        applied++;
      }
      return next;
    });
    return applied;
  };

  if (!isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-white dark:bg-[#050508]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={28} className="text-zinc-400 dark:text-white/30" />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 30px", background: isDark ? "#09090b" : "#fcfcfc", minHeight: "100vh", transition: "background 0.2s" }}>
      
      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-sm">
            <Boxes size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">Stock Inventory</h1>
            <p className="text-[10px] text-zinc-400 dark:text-white/30 mt-1 uppercase tracking-widest font-bold">KiddieKa · Prints & Sizes</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "stock",    label: "Stock",    icon: Boxes },
          ].map(t => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
                  on 
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                    : "text-zinc-500 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60"
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB PANELS ── */}
      <AnimatePresence mode="wait">
        {tab === "overview" ? (
          <motion.div key="overview"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}>
            <OverviewTab ordered={ordered} />
          </motion.div>
        ) : (
          <motion.div key="stock"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}>
            <StockTab
              ordered={ordered} cats={cats} setCats={setCats}
              quickSale={quickSale} setQuickSale={setQuickSale}
              log={log} setLog={setLog}
              shareWhatsApp={shareWhatsApp} exportPdf={exportPdf}
              setDimModalOpen={v => { setActiveCatForDim(ordered[0]?.id ?? ""); setDimModalOpen(v); }}
              setParseOpen={setParseOpen}
              setShowLog={setShowLog}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ADD DIMENSION MODAL ══ */}
      <AnimatePresence>
        {dimModalOpen && activeDim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={() => setDimModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
            <div className="relative w-full max-w-sm rounded-xl p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5"><Plus size={15} /> Add Dimension</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">to {activeDim.name}</p>
                </div>
                <button onClick={() => setDimModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"><X size={16} /></button>
              </div>
              <div className="flex gap-1 p-1 rounded bg-zinc-100 dark:bg-zinc-950">
                {(["print","size"] as const).map(t => (
                  <button key={t} onClick={() => setDimType(t)}
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer capitalize ${
                      dimType === t 
                        ? "bg-white dark:bg-zinc-850 text-zinc-900 dark:text-white shadow-sm" 
                        : "text-zinc-400"
                    }`}
                  >
                    {t === "print" ? "Print" : "Size"}
                  </button>
                ))}
              </div>
              <input
                value={dimType === "print" ? newPrint : newSize}
                onChange={e => dimType === "print" ? setNewPrint(e.target.value) : setNewSize(e.target.value)}
                placeholder={dimType === "print" ? "Pattern name, e.g. Bear" : "Size label, e.g. 12-18"}
                onKeyDown={e => { if (e.key === "Enter") { dimType === "print" ? addPrint(activeDim.id) : addSize(activeDim.id); if (!(dimType === "print" ? newPrint : newSize).trim()) setDimModalOpen(false); } }}
                className="rounded-lg px-3 py-2 text-xs text-zinc-950 dark:text-white outline-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                autoFocus
              />
              <div className="flex gap-2 justify-end text-xs">
                <button onClick={() => setDimModalOpen(false)} className="px-3 py-2 font-bold text-zinc-450 hover:text-zinc-700 cursor-pointer">Cancel</button>
                <button
                  onClick={() => { dimType === "print" ? addPrint(activeDim.id) : addSize(activeDim.id); setDimModalOpen(false); }}
                  className="px-4 py-2 font-black text-white dark:text-black bg-zinc-900 dark:bg-white rounded-lg cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ ACTIVITY LOG ══ */}
      <AnimatePresence>
        {showLog && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowLog(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
            <div className="relative w-full max-w-md rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col" style={{ maxHeight: "60vh" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-850">
                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5"><History size={14} /> Activity Log</h3>
                <button onClick={() => setShowLog(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto p-2 space-y-0.5">
                {log.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-10">No activity logged.</p>
                ) : log.map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                    <span className="text-xs text-zinc-700 dark:text-white/70">{l.text}</span>
                    <span className="text-[9px] text-zinc-400 whitespace-nowrap">
                      {new Date(l.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ PARSE MODAL ══ */}
      <AnimatePresence>
        {parseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setParseOpen(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
            <ParseModal onClose={() => setParseOpen(false)} onApply={applyParse} />
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

/* ─── Parse Modal ──────────────────────────────────────────── */
function ParseModal({ onClose, onApply }: { onClose: () => void; onApply: (raw: string) => number }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const run = () => {
    const n = onApply(text);
    setResult(n > 0 ? `✓ Applied ${n} update${n !== 1 ? "s" : ""}.` : "No matching lines. Format: sold 2 jabla 3-6 bear");
    if (n > 0) setText("");
  };

  return (
    <div onClick={e => e.stopPropagation()} className="relative w-full max-w-lg rounded-xl p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5"><Sparkles size={15} /> Parse Sales</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"><X size={16} /></button>
      </div>
      <p className="text-[10px] text-zinc-400">
        One entry per line: <code className="text-zinc-700 dark:text-white/70 font-mono bg-zinc-100 dark:bg-white/5 px-1 py-0.5 rounded">sold 2 jabla 3-6 bear</code>
      </p>
      <textarea
        ref={ref} value={text}
        onChange={e => { setText(e.target.value); setResult(null); }}
        rows={6}
        placeholder={"sold 2 jabla 3-6 bear\nsold 1 frock 0-3 unicorn\n3 night suit 0-3 owl"}
        className="w-full rounded-lg p-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-450 outline-none resize-y font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
      />
      {result && (
        <p className="text-xs font-bold text-zinc-500">{result}</p>
      )}
      <div className="flex justify-end gap-2 text-xs">
        <button onClick={onClose} className="px-3 py-2 font-bold text-zinc-450 hover:text-zinc-700 cursor-pointer">Close</button>
        <button onClick={run} disabled={!text.trim()}
          className="px-4 py-2 font-black text-white dark:text-black bg-zinc-900 dark:bg-white rounded-lg cursor-pointer flex items-center gap-1 shadow"
        >
          <Check size={12} /> Apply Updates
        </button>
      </div>
    </div>
  );
}
