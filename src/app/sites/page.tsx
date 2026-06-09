"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import {
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Link2,
  X,
  Edit3,
  Check,
  RefreshCw,
  Star,
  StarOff,
  AlertCircle,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface SiteBookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  favicon: string;
  ogImage: string | null;
  hostname: string;
  pinned: boolean;
  addedAt: string;
  category: string;
}

const STORAGE_KEY = "biztrack_site_bookmarks";
const CATEGORIES = ["All", "Ecommerce", "Tools", "Finance", "Social", "Other"];

/* ─── Helpers ─────────────────────────────────────────────────── */
function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.match(/^https?:\/\//i)) url = "https://" + url;
  return url;
}

/* ─── Favicon Image with fallback ─────────────────────────────── */
function FaviconImg({ src, hostname, size = 28 }: { src: string; hostname: string; size?: number }) {
  const [err, setErr] = useState(false);
  const fallbackSrc = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  return err || !src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fallbackSrc} alt={hostname} width={size} height={size} className="rounded-md object-contain" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={hostname}
      width={size}
      height={size}
      className="rounded-md object-contain"
      onError={() => setErr(true)}
    />
  );
}

/* ─── Single Site Card ─────────────────────────────────────────── */
function SiteCard({
  site,
  onDelete,
  onTogglePin,
  onRefresh,
  onEditTitle,
  refreshingId,
}: {
  site: SiteBookmark;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRefresh: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  refreshingId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(site.title);
  const [ogImgError, setOgImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => window.open(site.url, "_blank", "noopener,noreferrer");

  const commitEdit = () => {
    onEditTitle(site.id, draft.trim() || site.hostname);
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  return (
    <div className="group relative bg-white rounded-2xl border border-[#e8e8e8] hover:border-[#ccc] shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-all duration-200 overflow-hidden flex flex-col cursor-pointer">
      {/* Pinned indicator */}
      {site.pinned && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 z-10" />
      )}

      {/* OG / Hero image — falls back to favicon tile if URL errors */}
      {site.ogImage && !ogImgError ? (
        <div className="relative h-32 overflow-hidden bg-[#f5f5f5] shrink-0" onClick={handleOpen}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={site.ogImage}
            alt={site.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setOgImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      ) : (
        <div
          className="h-32 flex items-center justify-center bg-gradient-to-br from-[#f8f8f8] to-[#f0f0f0] shrink-0 cursor-pointer"
          onClick={handleOpen}
        >
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-[#e8e8e8]">
            <FaviconImg src={site.favicon} hostname={site.hostname} size={32} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start gap-2">
          {site.ogImage && !ogImgError && (
            <div className="w-6 h-6 rounded-md overflow-hidden shrink-0 bg-[#f5f5f5] border border-[#e8e8e8] flex items-center justify-center">
              <FaviconImg src={site.favicon} hostname={site.hostname} size={14} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
                  className="flex-1 text-sm font-semibold text-black bg-[#f5f5f5] border border-[#e0e0e0] rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-black/20"
                />
                <button onClick={commitEdit} className="w-6 h-6 flex items-center justify-center rounded-lg bg-black text-white hover:bg-[#222] transition-colors shrink-0">
                  <Check size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group/title">
                <h3
                  className="font-semibold text-sm text-black leading-snug line-clamp-1 flex-1 cursor-pointer"
                  onClick={handleOpen}
                >
                  {site.title}
                </h3>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(site.title); }}
                  className="shrink-0 opacity-0 group-hover/title:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[#aaa] hover:text-black transition-all"
                >
                  <Edit3 size={11} />
                </button>
              </div>
            )}
            <p className="text-[11px] text-[#aaa] mt-0.5 truncate">{site.hostname}</p>
          </div>
        </div>

        {site.description && (
          <p className="text-[12px] text-[#888] leading-relaxed line-clamp-2">{site.description}</p>
        )}
      </div>

      {/* Footer bar */}
      <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-[#f5f5f5] pt-2.5">
        {/* Category pill */}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#bbb] bg-[#f5f5f5] px-2 py-0.5 rounded-full">
          {site.category}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTogglePin(site.id)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
              site.pinned
                ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
                : "text-[#ccc] hover:text-amber-500 hover:bg-amber-50"
            }`}
            title={site.pinned ? "Unpin" : "Pin to top"}
          >
            {site.pinned ? <Star size={13} fill="currentColor" /> : <StarOff size={13} />}
          </button>
          <button
            onClick={() => onRefresh(site.id)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-blue-500 hover:bg-blue-50 transition-colors ${refreshingId === site.id ? "animate-spin text-blue-500" : ""}`}
            title="Refresh metadata"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={handleOpen}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-green-500 hover:bg-green-50 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={() => onDelete(site.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remove"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add URL Bar ─────────────────────────────────────────────── */
function AddUrlBar({ onAdd, loading }: { onAdd: (url: string, category: string) => Promise<void>; loading: boolean }) {
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("Other");
  const [showCat, setShowCat] = useState(false);

  const submit = async () => {
    const url = normalizeUrl(input);
    if (!url) return;
    await onAdd(url, category);
    setInput("");
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[#aaa] mb-1">
        <Link2 size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">Add a website</span>
      </div>

      <div className="flex items-center gap-2">
        {/* URL input */}
        <div className="flex-1 flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
          <Globe size={15} className="text-[#bbb] shrink-0" />
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Paste or type a URL… e.g. kiddieka.com"
            className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0"
          />
          {input && (
            <button onClick={() => setInput("")} className="text-[#ccc] hover:text-black transition-colors shrink-0">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowCat((v) => !v)}
            className="px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8] text-[#555] text-xs font-semibold hover:bg-[#eee] transition-colors whitespace-nowrap flex items-center gap-1"
          >
            {category}
          </button>
          {showCat && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#e8e8e8] shadow-lg py-1 z-50 min-w-[130px]">
              {CATEGORIES.filter((c) => c !== "All").map((c) => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setShowCat(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#f5f5f5] transition-colors ${category === c ? "text-black font-semibold" : "text-[#555]"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          onClick={submit}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-[#222] disabled:bg-[#ddd] disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          {loading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          Add
        </button>
      </div>

      <p className="text-[11px] text-[#bbb]">
        Paste any URL — title, description and icon are fetched automatically
      </p>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function MySitesPage() {
  // Persisted to Supabase (with localStorage fallback) — keeps the same legacy
  // localStorage key so any previously-saved bookmarks migrate over automatically.
  const [bookmarks, setBookmarks] = useSupabaseTable<SiteBookmark>(
    "site_bookmarks",
    STORAGE_KEY,
    []
  );
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Fetch metadata */
  const fetchMeta = useCallback(async (url: string): Promise<Omit<SiteBookmark, "id" | "pinned" | "addedAt" | "category">> => {
    const res = await fetch(`/api/fetch-site-meta?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return {
      url,
      title: data.title || new URL(url).hostname,
      description: data.description || "",
      favicon: data.favicon || "",
      ogImage: data.ogImage || null,
      hostname: data.hostname || new URL(url).hostname,
    };
  }, []);

  /* Add bookmark */
  const handleAdd = async (url: string, category: string) => {
    // Check duplicate
    if (bookmarks.some((b) => b.url === url || b.url === url.replace(/\/$/, ""))) {
      setError("This site is already bookmarked.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const meta = await fetchMeta(url);
      const newBookmark: SiteBookmark = {
        ...meta,
        id: `bm-${Date.now()}`,
        pinned: false,
        addedAt: new Date().toISOString(),
        category,
      };
      setBookmarks((prev) => [newBookmark, ...prev]);
    } catch {
      setError("Couldn't fetch site info. Check the URL and try again.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setAdding(false);
    }
  };

  /* Delete */
  const handleDelete = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  /* Toggle pin */
  const handleTogglePin = (id: string) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, pinned: !b.pinned } : b))
    );
  };

  /* Refresh metadata */
  const handleRefresh = async (id: string) => {
    const bm = bookmarks.find((b) => b.id === id);
    if (!bm) return;
    setRefreshingId(id);
    try {
      const meta = await fetchMeta(bm.url);
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...meta } : b))
      );
    } catch { /* ignore */ } finally {
      setRefreshingId(null);
    }
  };

  /* Edit title */
  const handleEditTitle = (id: string, title: string) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, title } : b))
    );
  };

  /* Sort: pinned first, then newest */
  const filtered = [...bookmarks].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  });

  const pinnedCount = bookmarks.filter((b) => b.pinned).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">My Sites</h2>
          <p className="text-sm text-[#888] mt-1">
            {bookmarks.length} bookmark{bookmarks.length !== 1 ? "s" : ""}
            {pinnedCount > 0 && ` · ${pinnedCount} pinned`}
          </p>
        </div>
      </div>

      {/* Add URL bar */}
      <AddUrlBar onAdd={handleAdd} loading={adding} />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}



      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onRefresh={handleRefresh}
              onEditTitle={handleEditTitle}
              refreshingId={refreshingId}
            />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-3xl bg-[#f5f5f5] flex items-center justify-center">
            <Globe size={36} className="text-[#ccc]" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-black text-lg">No sites yet</h3>
            <p className="text-[#888] text-sm mt-1 max-w-xs">
              Paste a URL above to bookmark your websites — metadata is fetched automatically.
            </p>
          </div>
          <div className="mt-2 flex flex-col items-center gap-2 text-[12px] text-[#aaa]">
            <p className="font-medium">Try adding:</p>
            {["kiddieka.com", "invoicesync.in", "stocksync.app"].map((eg) => (
              <button
                key={eg}
                onClick={() => handleAdd(`https://${eg}`, "Tools")}
                disabled={adding}
                className="px-4 py-1.5 rounded-full border border-[#e8e8e8] hover:border-[#ccc] hover:text-black transition-colors"
              >
                {eg}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
