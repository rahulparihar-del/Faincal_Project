"use client";

import React, { useState } from "react";
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
  Tag,
  Globe,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Platform {
  id: string;
  name: string;
  url: string;
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

/* Common product types the user mentioned — used for quick-add suggestions. */
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

/* ─── Platform Card ─────────────────────────────────────────── */
function PlatformCard({
  platform,
  productCount,
  onDelete,
  onRename,
}: {
  platform: Platform;
  productCount: number;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(platform.name);

  const commit = () => {
    onRename(platform.id, draft.trim() || hostnameOf(platform.url));
    setEditing(false);
  };

  return (
    <div className="group bg-white rounded-2xl border border-[#e8e8e8] hover:border-[#ccc] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8] flex items-center justify-center shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={faviconOf(platform.url)} alt={platform.name} width={22} height={22} className="object-contain" />
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
        <a
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#aaa] hover:text-blue-500 truncate flex items-center gap-1 mt-0.5 w-fit"
        >
          {hostnameOf(platform.url)} <ExternalLink size={9} />
        </a>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-semibold text-[#888] bg-[#f5f5f5] px-2 py-1 rounded-full whitespace-nowrap">
          {productCount} listed
        </span>
        <button
          onClick={() => onDelete(platform.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove platform"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ─── Product Card ──────────────────────────────────────────── */
function ProductCard({
  product,
  platforms,
  onDelete,
  onToggle,
  onRename,
}: {
  product: Product;
  platforms: Platform[];
  onDelete: (id: string) => void;
  onToggle: (productId: string, platformId: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(product.name);

  const commit = () => {
    onRename(product.id, draft.trim() || "Untitled");
    setEditing(false);
  };

  return (
    <div className="group bg-white rounded-2xl border border-[#e8e8e8] hover:border-[#ccc] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all p-4 flex flex-col gap-3">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-black/[0.04] flex items-center justify-center shrink-0">
            <Boxes size={16} className="text-[#888]" />
          </div>
          <div className="min-w-0">
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
                  className="text-sm font-semibold bg-[#f5f5f5] border border-[#e0e0e0] rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-black/20"
                />
                <button onClick={commit} className="w-6 h-6 flex items-center justify-center rounded-lg bg-black text-white shrink-0">
                  <Check size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm text-black truncate">{product.name}</h3>
                <button
                  onClick={() => { setEditing(true); setDraft(product.name); }}
                  className="opacity-0 group-hover:opacity-100 text-[#bbb] hover:text-black transition-all shrink-0"
                >
                  <Pencil size={11} />
                </button>
              </div>
            )}
            {product.category && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#999] mt-1">
                <Tag size={9} /> {product.category}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(product.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
          title="Remove product"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Platform toggles */}
      <div className="border-t border-[#f3f3f3] pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#bbb] mb-2">Listed on</p>
        {platforms.length === 0 ? (
          <p className="text-[11px] text-[#bbb]">Add a platform first to mark where this is listed.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((pf) => {
              const on = product.platformIds.includes(pf.id);
              return (
                <button
                  key={pf.id}
                  onClick={() => onToggle(product.id, pf.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    on
                      ? "bg-black text-white border-black"
                      : "bg-white text-[#888] border-[#e0e0e0] hover:border-[#bbb]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faviconOf(pf.url)} alt="" width={13} height={13} className="rounded-sm object-contain" />
                  {pf.name}
                  {on && <Check size={11} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function CatalogPage() {
  const [platforms, setPlatforms] = useSupabaseTable<Platform>("platforms", PLATFORM_KEY, []);
  const [products, setProducts] = useSupabaseTable<Product>("products", PRODUCT_KEY, []);

  // Platform add form
  const [pfName, setPfName] = useState("");
  const [pfUrl, setPfUrl] = useState("");

  // Product add form
  const [prName, setPrName] = useState("");
  const [prCategory, setPrCategory] = useState("");

  /* Platforms */
  const addPlatform = () => {
    const url = normalizeUrl(pfUrl);
    const name = pfName.trim() || (url ? hostnameOf(url) : "");
    if (!name) return;
    const platform: Platform = {
      id: `pf-${Date.now()}`,
      name,
      url: url || "",
      createdAt: new Date().toISOString(),
    };
    setPlatforms((prev) => [platform, ...prev]);
    setPfName("");
    setPfUrl("");
  };

  const deletePlatform = (id: string) => {
    setPlatforms((prev) => prev.filter((p) => p.id !== id));
    // also unlink from products
    setProducts((prev) =>
      prev.map((p) =>
        p.platformIds.includes(id) ? { ...p, platformIds: p.platformIds.filter((x) => x !== id) } : p
      )
    );
  };

  const renamePlatform = (id: string, name: string) =>
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));

  /* Products */
  const addProduct = (name?: string, category?: string) => {
    const finalName = (name ?? prName).trim();
    if (!finalName) return;
    const product: Product = {
      id: `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      category: (category ?? prCategory).trim(),
      platformIds: [],
      createdAt: new Date().toISOString(),
    };
    setProducts((prev) => [product, ...prev]);
    if (name === undefined) {
      setPrName("");
      setPrCategory("");
    }
  };

  const deleteProduct = (id: string) =>
    setProducts((prev) => prev.filter((p) => p.id !== id));

  const renameProduct = (id: string, name: string) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));

  const togglePlatformForProduct = (productId: string, platformId: string) =>
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

  const existingNames = new Set(products.map((p) => p.name.toLowerCase()));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-black tracking-tight">Catalog</h2>
        <p className="text-sm text-[#888] mt-1">
          {platforms.length} platform{platforms.length !== 1 ? "s" : ""} · {products.length} product
          {products.length !== 1 ? "s" : ""} listed
        </p>
      </div>

      {/* ── Platforms section ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-[#555]">
          <Store size={16} />
          <h3 className="text-sm font-bold uppercase tracking-wider">Platforms · where you&apos;re registered</h3>
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {platforms.map((pf) => (
              <PlatformCard
                key={pf.id}
                platform={pf}
                productCount={products.filter((p) => p.platformIds.includes(pf.id)).length}
                onDelete={deletePlatform}
                onRename={renamePlatform}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
              <Globe size={24} className="text-[#ccc]" />
            </div>
            <p className="text-sm text-[#888]">No platforms yet. Add where you sell — Meesho, Amazon, Flipkart, your own site…</p>
          </div>
        )}
      </section>

      {/* ── Products section ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-[#555]">
          <Boxes size={16} />
          <h3 className="text-sm font-bold uppercase tracking-wider">Products · what you sell</h3>
        </div>

        {/* Add product */}
        <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm p-4 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
            <Boxes size={15} className="text-[#bbb] shrink-0" />
            <input
              value={prName}
              onChange={(e) => setPrName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addProduct(); }}
              placeholder="Product name (e.g. Co-ord Set)"
              className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0"
            />
          </div>
          <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 sm:w-48 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
            <Tag size={15} className="text-[#bbb] shrink-0" />
            <input
              value={prCategory}
              onChange={(e) => setPrCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addProduct(); }}
              placeholder="Category (optional)"
              className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0"
            />
          </div>
          <button
            onClick={() => addProduct()}
            disabled={!prName.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-black hover:bg-[#222] disabled:bg-[#ddd] disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
          >
            <Plus size={15} /> Add
          </button>
        </div>

        {/* Quick-add suggestions */}
        {PRODUCT_SUGGESTIONS.some((s) => !existingNames.has(s.toLowerCase())) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-[#aaa]">Quick add:</span>
            {PRODUCT_SUGGESTIONS.filter((s) => !existingNames.has(s.toLowerCase())).map((s) => (
              <button
                key={s}
                onClick={() => addProduct(s, "")}
                className="px-3 py-1 rounded-full border border-[#e8e8e8] text-xs font-medium text-[#666] hover:border-[#bbb] hover:text-black transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        )}

        {/* Product grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {products.map((pr) => (
              <ProductCard
                key={pr.id}
                product={pr}
                platforms={platforms}
                onDelete={deleteProduct}
                onToggle={togglePlatformForProduct}
                onRename={renameProduct}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
              <Boxes size={24} className="text-[#ccc]" />
            </div>
            <p className="text-sm text-[#888]">No products yet. Add your listings above or use the quick-add chips.</p>
          </div>
        )}
      </section>
    </div>
  );
}
