"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import {
  Store,
  Boxes,
  Plus,
  Trash2,
  ExternalLink,
  Link2,
  X,
  Check,
  Pencil,
  Globe,
  ChevronDown,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Platform {
  id: string;
  name: string;
  url: string;
  status: string; // "onboarded" | "in_process" | "rejected"
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  platformIds: string[]; // platforms this product is listed on
  createdAt: string;
}

const PLATFORM_KEY = "biztrack_platforms";
const PRODUCT_KEY = "biztrack_products";

/* Onboarding statuses for a seller account on a platform. */
const STATUSES = [
  { id: "onboarded", label: "Onboarded", dot: "bg-green-500", chip: "bg-green-500/12 text-green-600 border-green-500/25" },
  { id: "in_process", label: "In Process", dot: "bg-amber-500", chip: "bg-amber-500/12 text-amber-600 border-amber-500/25" },
  { id: "rejected", label: "On Hold", dot: "bg-red-500", chip: "bg-red-500/12 text-red-600 border-red-500/25" },
] as const;

const DEFAULT_STATUS = "in_process";
function statusOf(p: Platform): string {
  return p.status || DEFAULT_STATUS;
}
function statusMeta(id: string) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[1];
}

/* Common product types the user sells — quick-add suggestions. */
const PRODUCT_SUGGESTIONS = [
  "Co-ord Set",
  "Jabla",
  "Night Suit",
  "Wipes",
  "Hooded Towel",
  "Print",
];

/* ─── Helpers ───────────────────────────────────────────────── */
function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return "";
  if (!url.match(/^https?:\/\//i)) url = "https://" + url;
  return url;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconOf(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${hostnameOf(url)}&sz=64`;
}

/* ─── Products dropdown (inside each platform card) ─────────── */
function ProductsDropdown({
  products,
  platformId,
  onToggle,
  onCreate,
}: {
  products: Product[];
  platformId: string;
  onToggle: (productId: string, platformId: string) => void;
  onCreate: (name: string, platformId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const create = () => {
    const name = draft.trim();
    if (!name) return;
    onCreate(name, platformId);
    setDraft("");
  };

  const missingSuggestions = PRODUCT_SUGGESTIONS.filter(
    (s) => !products.some((p) => p.name.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-[#ccc] text-[12px] font-semibold text-[#666] hover:border-black hover:text-black transition-colors"
      >
        <Plus size={13} /> Add / manage products
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 left-0 w-72 bg-white border border-[#e8e8e8] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-2">
          {/* Create new */}
          <div className="flex items-center gap-1.5 bg-[#f5f5f5] border border-[#e8e8e8] rounded-lg px-2.5 py-2 focus-within:border-black transition-colors">
            <Boxes size={14} className="text-[#bbb] shrink-0" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              placeholder="New product name…"
              className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0"
            />
            <button
              onClick={create}
              disabled={!draft.trim()}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-black text-white disabled:bg-[#ddd] shrink-0"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Quick-add suggestions */}
          {missingSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 px-0.5">
              {missingSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onCreate(s, platformId)}
                  className="px-2 py-0.5 rounded-full border border-[#e8e8e8] text-[11px] font-medium text-[#666] hover:border-black hover:text-black transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}

          {/* Existing catalog */}
          <div className="mt-2 max-h-56 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#bbb] px-1.5 py-1">Your products</p>
            {products.length === 0 ? (
              <p className="text-[12px] text-[#bbb] px-1.5 py-1.5">No products yet — create one above.</p>
            ) : (
              products.map((p) => {
                const on = p.platformIds.includes(platformId);
                return (
                  <button
                    key={p.id}
                    onClick={() => onToggle(p.id, platformId)}
                    className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors text-left"
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        on ? "bg-black border-black text-white" : "border-[#ccc]"
                      }`}
                    >
                      {on && <Check size={11} />}
                    </span>
                    <span className="text-sm text-black truncate">{p.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Status badge with picker ──────────────────────────────── */
function StatusBadge({
  status,
  onChange,
}: {
  status: string;
  onChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = statusMeta(status);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${meta.chip}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
        <ChevronDown size={11} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute z-30 right-0 mt-1.5 w-40 bg-white border border-[#e8e8e8] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors text-left ${
                s.id === status ? "font-semibold" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-sm text-black flex-1">{s.label}</span>
              {s.id === status && <Check size={13} className="text-black" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Platform Card ─────────────────────────────────────────── */
function PlatformCard({
  platform,
  products,
  onDelete,
  onRename,
  onSetStatus,
  onToggleProduct,
  onCreateProduct,
}: {
  platform: Platform;
  products: Product[];
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSetStatus: (id: string, status: string) => void;
  onToggleProduct: (productId: string, platformId: string) => void;
  onCreateProduct: (name: string, platformId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(platform.name);

  const listed = products.filter((p) => p.platformIds.includes(platform.id));

  const commit = () => {
    onRename(platform.id, draft.trim() || hostnameOf(platform.url));
    setEditing(false);
  };

  return (
    <div className="group bg-white rounded-2xl border border-[#e8e8e8] hover:border-[#ccc] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8] flex items-center justify-center shrink-0 overflow-hidden">
          {platform.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconOf(platform.url)} alt={platform.name} width={22} height={22} className="object-contain" />
          ) : (
            <Store size={18} className="text-[#999]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                className="flex-1 text-sm font-semibold bg-[#f5f5f5] border border-[#e0e0e0] rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-black/20"
              />
              <button onClick={commit} className="w-6 h-6 flex items-center justify-center rounded-lg bg-black text-white shrink-0">
                <Check size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm text-black truncate">{platform.name}</h3>
              <button
                onClick={() => { setEditing(true); setDraft(platform.name); }}
                className="opacity-0 group-hover:opacity-100 text-[#bbb] hover:text-black transition-all shrink-0"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
          {platform.url ? (
            <a
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#aaa] hover:text-blue-500 truncate flex items-center gap-1 mt-0.5 w-fit"
            >
              {hostnameOf(platform.url)} <ExternalLink size={9} />
            </a>
          ) : (
            <span className="text-[11px] text-[#bbb]">No link</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={statusOf(platform)} onChange={(s) => onSetStatus(platform.id, s)} />
          <button
            onClick={() => onDelete(platform.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remove platform"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Listed products + manage dropdown */}
      <div className="border-t border-[#f3f3f3] pt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#bbb] mr-1">
          {listed.length} listed
        </span>
        {listed.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-black text-white text-[11px] font-semibold"
          >
            {p.name}
            <button
              onClick={() => onToggleProduct(p.id, platform.id)}
              className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20"
              title="Remove from this platform"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <ProductsDropdown
          products={products}
          platformId={platform.id}
          onToggle={onToggleProduct}
          onCreate={onCreateProduct}
        />
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function CatalogPage() {
  const [platforms, setPlatforms] = useSupabaseTable<Platform>("platforms", PLATFORM_KEY, []);
  const [products, setProducts] = useSupabaseTable<Product>("products", PRODUCT_KEY, []);

  const [pfName, setPfName] = useState("");
  const [pfUrl, setPfUrl] = useState("");
  const [filter, setFilter] = useState<string>("all");

  /* Platforms */
  const addPlatform = () => {
    const url = normalizeUrl(pfUrl);
    const name = pfName.trim() || (url ? hostnameOf(url) : "");
    if (!name) return;
    const platform: Platform = {
      id: `pf-${Date.now()}`,
      name,
      url: url || "",
      status: DEFAULT_STATUS,
      createdAt: new Date().toISOString(),
    };
    setPlatforms((prev) => [platform, ...prev]);
    setPfName("");
    setPfUrl("");
  };

  const deletePlatform = (id: string) => {
    setPlatforms((prev) => prev.filter((p) => p.id !== id));
    setProducts((prev) =>
      prev.map((p) =>
        p.platformIds.includes(id) ? { ...p, platformIds: p.platformIds.filter((x) => x !== id) } : p
      )
    );
  };

  const renamePlatform = (id: string, name: string) =>
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));

  const setPlatformStatus = (id: string, status: string) =>
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));

  /* Products */
  const createProduct = (name: string, platformId: string) => {
    const finalName = name.trim();
    if (!finalName) return;
    // If a product with this name already exists, just link it to the platform.
    const existing = products.find((p) => p.name.toLowerCase() === finalName.toLowerCase());
    if (existing) {
      if (!existing.platformIds.includes(platformId)) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === existing.id ? { ...p, platformIds: [...p.platformIds, platformId] } : p
          )
        );
      }
      return;
    }
    const product: Product = {
      id: `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      category: "",
      platformIds: [platformId],
      createdAt: new Date().toISOString(),
    };
    setProducts((prev) => [product, ...prev]);
  };

  const toggleProduct = (productId: string, platformId: string) =>
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              platformIds: p.platformIds.includes(platformId)
                ? p.platformIds.filter((x) => x !== platformId)
                : [...p.platformIds, platformId],
            }
          : p
      )
    );

  const onboardedCount = platforms.filter((p) => statusOf(p) === "onboarded").length;
  const inProcessCount = platforms.filter((p) => statusOf(p) === "in_process").length;
  const visiblePlatforms = filter === "all" ? platforms : platforms.filter((p) => statusOf(p) === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-black tracking-tight">Catalog</h2>
        <p className="text-sm text-[#888] mt-1">
          {onboardedCount} onboarded · {inProcessCount} in process · {products.length} product
          {products.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Section label */}
      <div className="flex items-center gap-2 text-[#555]">
        <Store size={16} />
        <h3 className="text-sm font-bold uppercase tracking-wider">Platforms · where you&apos;re registered</h3>
      </div>

      {/* Status filter tabs */}
      {platforms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: "all", label: "All", count: platforms.length },
            ...STATUSES.map((s) => ({
              id: s.id,
              label: s.label,
              count: platforms.filter((p) => statusOf(p) === s.id).length,
            })),
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                filter === tab.id
                  ? "bg-black text-white border-black"
                  : "bg-white text-[#666] border-[#e8e8e8] hover:border-[#bbb]"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] ${filter === tab.id ? "text-white/70" : "text-[#aaa]"}`}>{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Add platform */}
      <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm p-4 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 sm:w-52 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
          <Store size={15} className="text-[#bbb] shrink-0" />
          <input
            value={pfName}
            onChange={(e) => setPfName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addPlatform(); }}
            placeholder="Platform name (e.g. Meesho)"
            className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0"
          />
        </div>
        <div className="flex-1 flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
          <Link2 size={15} className="text-[#bbb] shrink-0" />
          <input
            value={pfUrl}
            onChange={(e) => setPfUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addPlatform(); }}
            placeholder="Link (e.g. supplier.meesho.com)"
            className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0"
          />
          {pfUrl && (
            <button onClick={() => setPfUrl("")} className="text-[#ccc] hover:text-black shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={addPlatform}
          disabled={!pfName.trim() && !pfUrl.trim()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-black hover:bg-[#222] disabled:bg-[#ddd] disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Platform grid */}
      {platforms.length > 0 ? (
        visiblePlatforms.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visiblePlatforms.map((pf) => (
              <PlatformCard
                key={pf.id}
                platform={pf}
                products={products}
                onDelete={deletePlatform}
                onRename={renamePlatform}
                onSetStatus={setPlatformStatus}
                onToggleProduct={toggleProduct}
                onCreateProduct={createProduct}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-[#888]">
            No platforms with this status.
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
            <Globe size={28} className="text-[#ccc]" />
          </div>
          <div>
            <h3 className="font-semibold text-black">No platforms yet</h3>
            <p className="text-sm text-[#888] mt-1 max-w-xs">
              Add where you sell — Meesho, Amazon, Flipkart, your own site — then tag the products
              listed on each.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
