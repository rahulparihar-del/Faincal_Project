"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { VaultLock } from "@/components/vault/VaultLock";
import {
  bytesToB64, b64ToBytes, randomBytes, deriveKey, encryptJSON, decryptJSON,
} from "@/lib/vault/crypto";
import {
  Plus, Trash2, ExternalLink, Link2, X, Eye, EyeOff, Clock,
  Lock, CircleCheckBig, Loader2, Key, Copy, Check, RefreshCw,
  Search, Globe, ShieldCheck, ChevronDown, Mail, AtSign,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Account { username: string; password: string; url?: string; linkedUrl?: string; }
interface StashItem {
  id: string;
  title: string;
  url: string;
  context: string;
  accounts: Account[];
  watched: boolean;
  createdAt: string;
  category?: string;
  linkedUrl?: string;
}
interface VaultRecord {
  id: string;
  enc?: string;
  watched?: boolean;
  createdAt?: string;
  salt?: string;
  check?: string;
}

const STORAGE_KEY  = "biztrack_vault";
const SESSION_KEY  = "biztrack_vault_unlocked";
const META_ID      = "__vault_meta__";
const MAGIC        = "biztrack-vault-v1";

const CATEGORIES = ["Social", "Shopping", "Finance", "Work", "Email", "Other"];

/* ─── Helpers ───────────────────────────────────────────────── */
function normalizeUrl(u: string) {
  const t = u.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : "https://" + t;
}
function hostnameOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function faviconOf(url: string) {
  const h = hostnameOf(url);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=64` : "";
}
function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const m = Math.floor(d / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ""); }

/* ─── Category pill color ───────────────────────────────────── */
const catColor: Record<string, string> = {
  Social:   "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border-pink-200/40 dark:border-pink-900/40",
  Shopping: "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200/40 dark:border-orange-900/40",
  Finance:  "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/40 dark:border-emerald-900/40",
  Work:     "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200/40 dark:border-blue-900/40",
  Email:    "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border-violet-200/40 dark:border-violet-900/40",
  Other:    "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200/40 dark:border-zinc-700/40",
};

/* ─── Credential Card ────────────────────────────────────────── */
function CredCard({
  item, onDelete, onToggleWatched, onOpenDetails,
}: {
  item: StashItem;
  onDelete: (id: string) => void;
  onToggleWatched: (id: string) => void;
  onOpenDetails: (item: StashItem) => void;
}) {
  const fav   = faviconOf(item.url);
  const host  = hostnameOf(item.url);
  const [imgErr, setImgErr]             = useState(false);

  const accs = item.accounts?.length ? item.accounts : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={() => onOpenDetails(item)}
      className={`group relative bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-zinc-200/40 dark:hover:shadow-black/50 hover:border-zinc-350 dark:hover:border-zinc-700 cursor-pointer flex flex-col justify-between min-h-[160px] ${item.watched ? "opacity-60" : ""}`}
    >
      {/* Header Area */}
      <div className="p-5 pb-3 flex items-start gap-4">
        {/* Favicon Icon */}
        <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 flex items-center justify-center shadow-inner shrink-0 overflow-hidden">
          {fav && !imgErr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fav} alt="" width={24} height={24} className="object-contain" onError={() => setImgErr(true)} />
          ) : (
            <Globe size={20} className="text-zinc-400 dark:text-zinc-600" />
          )}
        </div>

        {/* Text details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-black text-[15px] leading-tight text-zinc-900 dark:text-zinc-50 tracking-tight truncate ${item.watched ? "line-through text-zinc-400" : ""}`}>
              {item.title || "Unnamed"}
            </h3>
          </div>
          {host && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              <span className="truncate max-w-[150px] font-medium">{host}</span>
            </p>
          )}
          {item.linkedUrl && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              <span className="font-semibold text-zinc-400/80 dark:text-zinc-500/80 uppercase tracking-wider text-[9px]">Linked:</span>
              <span className="truncate max-w-[120px] underline">
                {hostnameOf(item.linkedUrl) || item.linkedUrl}
              </span>
            </div>
          )}
        </div>

        {/* Actions inside group hover */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {item.category && (
            <span className={`text-[9px] font-extrabold px-2.5 py-1 border rounded-full uppercase tracking-wider shrink-0 ${catColor[item.category] ?? catColor.Other}`}>
              {item.category}
            </span>
          )}
          <button
            onClick={() => onToggleWatched(item.id)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${item.watched ? "text-green-500 bg-green-500/10" : "text-zinc-400 dark:text-zinc-500 hover:text-green-500 hover:bg-green-500/10"}`}
            title={item.watched ? "Unarchive" : "Archive"}
          >
            <CircleCheckBig size={14} />
          </button>
          <button
            onClick={() => { if (window.confirm("Delete this entry?")) onDelete(item.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Account Count Badge */}
      <div className="px-5 pb-4 pt-1 flex items-center justify-between mt-auto">
        <span className="text-[10px] font-extrabold px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg">
          {accs.length} {accs.length === 1 ? "Credential" : "Credentials"}
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold group-hover:text-amber-500 transition-colors">
          View details &rarr;
        </span>
      </div>

      {/* Card Footer info */}
      <div className="px-5 py-3.5 bg-zinc-50/40 dark:bg-zinc-950/10 border-t border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
        <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(item.createdAt)}</span>
      </div>
    </motion.div>
  );
}

/* ─── Mock Browser Preview Component ────────────────────────── */
function BrowserPreview({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const host = hostnameOf(url);

  useEffect(() => {
    setLoading(true);
  }, [url]);

  if (!url) {
    return (
      <div className="w-full h-56 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-center justify-center text-zinc-400 p-4">
        <Globe size={32} className="text-zinc-300 dark:text-zinc-700 mb-2" />
        <span className="text-xs font-semibold">No website connected</span>
      </div>
    );
  }

  return (
    <div className="w-full border border-zinc-250 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900 flex flex-col h-80">
      {/* Browser Chrome Header */}
      <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2.5 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
        {/* Window Controls */}
        <div className="flex gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        {/* Address Bar */}
        <div className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Lock size={10} className="text-green-500 shrink-0" />
            <span className="truncate select-all">{url}</span>
          </div>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            className="hover:text-amber-500 p-0.5 rounded transition-colors shrink-0"
            title="Open in new tab"
          >
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
      {/* Browser Viewport */}
      <div className="relative w-full flex-1 bg-white dark:bg-zinc-900">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-[1px] z-10">
            <Loader2 className="animate-spin text-zinc-400" size={20} />
          </div>
        )}
        <iframe
          src={url}
          onLoad={() => setLoading(false)}
          className="w-full h-full border-none bg-white"
          title={`Preview of ${host}`}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        {/* Fallback info layer at the bottom in case embedding is blocked */}
        <div className="absolute bottom-0 inset-x-0 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-[2px] border-t border-zinc-200/50 dark:border-zinc-800/50 px-3 py-2 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Security policies may prevent some sites from embedding.</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-amber-500 font-bold hover:underline flex items-center gap-0.5">
            Open Directly <ExternalLink size={9} />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Details Modal ─────────────────────────────────────────── */
function DetailsModal({
  item, onClose, onUpdateAccounts, onDelete,
}: {
  item: StashItem;
  onClose: () => void;
  onUpdateAccounts: (id: string, accs: Account[]) => void;
  onDelete: (id: string) => void;
}) {
  const [activeAccIdx, setActiveAccIdx] = useState(0);
  const [showPassMap, setShowPassMap] = useState<Record<number, boolean>>({});
  const [copiedUser, setCopiedUser] = useState<number | null>(null);
  const [copiedPass, setCopiedPass] = useState<number | null>(null);

  // Inline "Add Account" form state
  const [addingAcc, setAddingAcc] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLinkedUrl, setNewLinkedUrl] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);

  const accs = item.accounts?.length ? item.accounts : [];
  const activeAcc = accs[activeAccIdx] || accs[0];

  const copy = async (text: string, type: "user" | "pass", idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "user") {
        setCopiedUser(idx);
        setTimeout(() => setCopiedUser(null), 1500);
      } else {
        setCopiedPass(idx);
        setTimeout(() => setCopiedPass(null), 1500);
      }
    } catch { /* ignore */ }
  };

  const genPass = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
    const arr = new Uint32Array(16);
    window.crypto.getRandomValues(arr);
    setNewPass(Array.from(arr).map(n => chars[n % chars.length]).join(""));
    setShowNewPass(true);
  };

  const fav = faviconOf(item.url);
  const host = hostnameOf(item.url);
  const [imgErr, setImgErr] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editUser, setEditUser] = useState("");
  const [editPass, setEditPass] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editLinkedUrl, setEditLinkedUrl] = useState("");
  const [showEditPass, setShowEditPass] = useState(false);

  useEffect(() => {
    if (activeAcc) {
      setEditUser(activeAcc.username || "");
      setEditPass(activeAcc.password || "");
      setEditUrl(activeAcc.url || item.url || "");
      setEditLinkedUrl(activeAcc.linkedUrl || item.linkedUrl || "");
    }
    setIsEditing(false);
  }, [activeAccIdx, item.id]);

  // The website to preview for the active account
  const previewUrl = activeAcc
    ? (activeAcc.linkedUrl || activeAcc.url || item.linkedUrl || item.url)
    : (item.linkedUrl || item.url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
      />
      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-6xl h-[90vh] bg-white dark:bg-zinc-900 sm:rounded-3xl rounded-t-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl z-10 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 flex items-center justify-center overflow-hidden shrink-0">
              {fav && !imgErr ? (
                <img src={fav} alt="" width={22} height={22} className="object-contain" onError={() => setImgErr(true)} />
              ) : (
                <Globe size={18} className="text-zinc-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50">
                  {item.title || "Unnamed Service"}
                </h3>
                {item.category && (
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 border rounded-full uppercase tracking-wider ${catColor[item.category] ?? catColor.Other}`}>
                    {item.category}
                  </span>
                )}
              </div>
              {host && <p className="text-[11px] text-zinc-400">{host}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm("Delete this entire password entry?")) {
                  onDelete(item.id);
                  onClose();
                }
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
              title="Delete site"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Two-Column Content Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Column: Accounts list & adding form */}
          <div className="w-full md:w-[320px] border-r border-zinc-100 dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-950/20 overflow-y-auto">
            <div className="p-4 space-y-3">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block px-1">
                Saved Accounts ({accs.length})
              </span>
              
              <div className="space-y-2">
                {accs.map((acc, idx) => {
                  const isActive = idx === activeAccIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveAccIdx(idx)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group/acc ${
                        isActive
                          ? "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 shadow-sm"
                          : "bg-transparent border-transparent hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isActive ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>
                          {acc.username || "Unnamed Account"}
                        </p>
                        {(acc.linkedUrl || item.linkedUrl) && (
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {hostnameOf(acc.linkedUrl || item.linkedUrl || "")}
                          </p>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (accs.length === 1) {
                            if (window.confirm("This is the last account. Deleting it will remove this entire service. Proceed?")) {
                              onDelete(item.id);
                              onClose();
                            }
                          } else {
                            if (window.confirm("Remove this account?")) {
                              const updated = accs.filter((_, i) => i !== idx);
                              onUpdateAccounts(item.id, updated);
                              if (activeAccIdx >= updated.length) {
                                setActiveAccIdx(Math.max(0, updated.length - 1));
                              }
                            }
                          }
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer ml-2 shrink-0"
                        title="Remove Account"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Inline Add Account Form inside Modal */}
              {addingAcc ? (
                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest">New Login</span>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Username / Email</label>
                    <input
                      value={newUser} onChange={e => setNewUser(e.target.value)}
                      placeholder="Username / Email"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Password</label>
                    <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 w-full">
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPass} onChange={e => setNewPass(e.target.value)}
                        placeholder="Password"
                        className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
                      />
                      <button type="button" onClick={() => setShowNewPass(v => !v)} className="text-zinc-400 hover:text-zinc-650 cursor-pointer"><Eye size={12} /></button>
                      <button type="button" onClick={genPass} className="text-zinc-400 hover:text-zinc-650 cursor-pointer" title="Generate"><RefreshCw size={12} /></button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Website URL (optional)</label>
                    <input
                      value={newUrl} onChange={e => setNewUrl(e.target.value)}
                      placeholder="e.g. https://supabase.com"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 uppercase">Linked Website URL (optional)</label>
                    <input
                      value={newLinkedUrl} onChange={e => setNewLinkedUrl(e.target.value)}
                      placeholder="e.g. https://my-app.vercel.app"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => { setAddingAcc(false); setNewUser(""); setNewPass(""); setNewUrl(""); setNewLinkedUrl(""); }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-550 hover:bg-zinc-100 dark:hover:bg-zinc-805 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!newUser.trim() && !newPass.trim()) return;
                        const merged = [
                          ...accs,
                          {
                            username: newUser.trim(),
                            password: newPass,
                            url: newUrl.trim() ? normalizeUrl(newUrl) : undefined,
                            linkedUrl: newLinkedUrl.trim() ? normalizeUrl(newLinkedUrl) : undefined
                          }
                        ];
                        onUpdateAccounts(item.id, merged);
                        setActiveAccIdx(merged.length - 1);
                        setAddingAcc(false); setNewUser(""); setNewPass(""); setNewUrl(""); setNewLinkedUrl("");
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[10px] font-bold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingAcc(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 w-full rounded-2xl text-[10px] font-bold text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
                >
                  <Plus size={11} /> Add Another Account
                </button>
              )}
            </div>
            
            {/* Notes Section inside Left Pane */}
            {item.context && (
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto bg-zinc-50/20 dark:bg-zinc-950/10">
                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
                  Notes
                </span>
                <p className="text-[11px] text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium whitespace-pre-wrap">
                  {item.context}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Credentials View & Browser Preview */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5 min-w-0">
            {activeAcc ? (
              <>
                {/* Credentials details panel */}
                <div className="bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4.5 space-y-4 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-zinc-400 tracking-widest uppercase">
                      {isEditing ? "Editing Credentials" : "Active Credentials"}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              const updatedAccs = accs.map((acc, idx) => {
                                if (idx === activeAccIdx) {
                                  return {
                                    username: editUser.trim(),
                                    password: editPass,
                                    url: editUrl.trim() ? normalizeUrl(editUrl) : undefined,
                                    linkedUrl: editLinkedUrl.trim() ? normalizeUrl(editLinkedUrl) : undefined
                                  };
                                }
                                return acc;
                              });
                              onUpdateAccounts(item.id, updatedAccs);
                              setIsEditing(false);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-400 hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <Check size={11} /> Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              if (activeAcc) {
                                setEditUser(activeAcc.username || "");
                                setEditPass(activeAcc.password || "");
                                setEditUrl(activeAcc.url || item.url || "");
                                setEditLinkedUrl(activeAcc.linkedUrl || item.linkedUrl || "");
                              }
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <X size={11} /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                          >
                            <RefreshCw size={11} /> Edit Details
                          </button>
                          <button
                            onClick={() => {
                              if (accs.length === 1) {
                                if (window.confirm("This is the last account. Deleting it will remove this entire service. Proceed?")) {
                                  onDelete(item.id);
                                  onClose();
                                }
                              } else {
                                if (window.confirm("Delete this active account?")) {
                                  const updated = accs.filter((_, i) => i !== activeAccIdx);
                                  onUpdateAccounts(item.id, updated);
                                  setActiveAccIdx(Math.max(0, updated.length - 1));
                                }
                              }
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                            title="Delete this account option"
                          >
                            <Trash2 size={11} /> Delete Account
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Username Display */}
                    <div className="space-y-1 bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/40 rounded-xl p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                          <Mail size={10} /> Username / Email
                        </span>
                        {!isEditing && activeAcc.username && (
                          <button
                            onClick={() => copy(activeAcc.username, "user", activeAccIdx)}
                            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 transition-all cursor-pointer"
                          >
                            {copiedUser === activeAccIdx ? (
                              <span className="text-[9px] font-bold text-green-500 flex items-center gap-0.5"><Check size={10} /> Copied</span>
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <input
                          value={editUser}
                          onChange={e => setEditUser(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none mt-1"
                        />
                      ) : (
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 select-all truncate mt-1">
                          {activeAcc.username || "—"}
                        </p>
                      )}
                    </div>

                    {/* Password Display */}
                    <div className="space-y-1 bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/40 rounded-xl p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                          <Key size={10} /> Password
                        </span>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => setShowEditPass(v => !v)}
                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 transition-all cursor-pointer"
                              >
                                {showEditPass ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                              <button
                                onClick={() => {
                                  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
                                  const arr = new Uint32Array(16);
                                  window.crypto.getRandomValues(arr);
                                  setEditPass(Array.from(arr).map(n => chars[n % chars.length]).join(""));
                                  setShowEditPass(true);
                                }}
                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 transition-all cursor-pointer"
                                title="Generate Password"
                              >
                                <RefreshCw size={11} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setShowPassMap(p => ({ ...p, [activeAccIdx]: !p[activeAccIdx] }))}
                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 transition-all cursor-pointer"
                              >
                                {showPassMap[activeAccIdx] ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                              {activeAcc.password && (
                                <button
                                  onClick={() => copy(activeAcc.password, "pass", activeAccIdx)}
                                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 transition-all cursor-pointer"
                                >
                                  {copiedPass === activeAccIdx ? (
                                    <span className="text-[9px] font-bold text-green-500 flex items-center gap-0.5"><Check size={10} /> Copied</span>
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <input
                          type={showEditPass ? "text" : "password"}
                          value={editPass}
                          onChange={e => setEditPass(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none mt-1 font-mono"
                        />
                      ) : (
                        <p className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 tracking-wider select-all mt-1">
                          {showPassMap[activeAccIdx] ? activeAcc.password : "••••••••••••••••"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Connected URLs */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200/30 dark:border-zinc-800/30">
                    {/* Primary Url */}
                    {isEditing ? (
                      <div className="flex flex-col gap-1 text-[11px] bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-200/30 dark:border-zinc-800/30">
                        <span className="font-semibold text-zinc-400/80 uppercase tracking-wider text-[9px] flex items-center gap-1">
                          <Link2 size={10} /> Website Portal URL:
                        </span>
                        <input
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          placeholder="e.g. https://supabase.com"
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none"
                        />
                      </div>
                    ) : (
                      (activeAcc.url || item.url) && (
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-200/30 dark:border-zinc-800/30">
                          <span className="font-semibold text-zinc-400/80 uppercase tracking-wider text-[9px] flex items-center gap-1">
                            <Link2 size={10} /> Website Portal:
                          </span>
                          <a
                            href={activeAcc.url || item.url} target="_blank" rel="noopener noreferrer"
                            className="hover:text-amber-500 transition-colors inline-flex items-center gap-1 underline font-medium select-all"
                          >
                            {activeAcc.url || item.url}
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )
                    )}
                    {/* Linked Url */}
                    {isEditing ? (
                      <div className="flex flex-col gap-1 text-[11px] bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-200/30 dark:border-zinc-800/30">
                        <span className="font-semibold text-zinc-400/80 uppercase tracking-wider text-[9px] flex items-center gap-1">
                          <Globe size={10} /> Connected Website URL:
                        </span>
                        <input
                          value={editLinkedUrl}
                          onChange={e => setEditLinkedUrl(e.target.value)}
                          placeholder="e.g. https://my-app.vercel.app"
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none"
                        />
                      </div>
                    ) : (
                      (activeAcc.linkedUrl || item.linkedUrl) && (
                        <div className="flex items-center justify-between text-[11px] text-zinc-550 bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-200/30 dark:border-zinc-800/30">
                          <span className="font-semibold text-zinc-400/80 uppercase tracking-wider text-[9px] flex items-center gap-1">
                            <Globe size={10} /> Connected Website:
                          </span>
                          <a
                            href={activeAcc.linkedUrl || item.linkedUrl} target="_blank" rel="noopener noreferrer"
                            className="hover:text-amber-500 transition-colors inline-flex items-center gap-1 underline font-medium select-all"
                          >
                            {activeAcc.linkedUrl || item.linkedUrl}
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Browser preview */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Globe size={11} /> Connected Site Live Preview
                    </span>
                  </div>
                  <BrowserPreview url={previewUrl} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-400 py-10">
                <Key size={32} className="text-zinc-300 dark:text-zinc-700 mb-2" />
                <p className="text-xs font-semibold">Select an account to view credentials & live preview</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Add Modal ─────────────────────────────────────────────── */
function AddModal({
  onClose, onAdd,
}: {
  onClose: () => void;
  onAdd: (data: { title: string; url: string; username: string; password: string; context: string; category: string; linkedUrl: string }) => void;
}) {
  const [title, setTitle]           = useState("");
  const [url, setUrl]               = useState("");
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [context, setContext]       = useState("");
  const [category, setCategory]     = useState("Other");
  const [linkedUrl, setLinkedUrl]   = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [imgErr, setImgErr]         = useState(false);
  const [urlPreviewed, setUrlPrev]  = useState("");

  // Auto-fill title from URL
  useEffect(() => {
    const normalized = url.trim() ? normalizeUrl(url) : "";
    if (normalized && normalized !== urlPreviewed) {
      setUrlPrev(normalized);
      setImgErr(false);
      const host = hostnameOf(normalized);
      if (host && !title) {
        const name = host.split(".")[0];
        setTitle(name.charAt(0).toUpperCase() + name.slice(1));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const genPass = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
    const arr = new Uint32Array(16);
    window.crypto.getRandomValues(arr);
    setPassword(Array.from(arr).map(n => chars[n % chars.length]).join(""));
    setShowPass(true);
  };

  const fav = urlPreviewed ? faviconOf(urlPreviewed) : "";
  const host = urlPreviewed ? hostnameOf(urlPreviewed) : "";

  const valid = !!(title.trim() || username.trim() || password.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
      />
      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", duration: 0.45, bounce: 0.18 }}
        className="relative w-full sm:max-w-lg bg-white dark:bg-zinc-900 sm:rounded-3xl rounded-t-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            {/* Live website preview */}
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center overflow-hidden">
              {fav && !imgErr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fav} alt="" width={20} height={20} className="object-contain" onError={() => setImgErr(true)} />
              ) : (
                <ShieldCheck size={16} className="text-amber-500" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {title || (host ? host : "New Credential")}
              </h3>
              {host && <p className="text-[10px] text-zinc-400">{host}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Form body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Website URL — first so we can preview */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Website URL</label>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 transition-all">
              <Link2 size={13} className="text-zinc-400 shrink-0" />
              <input
                value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none min-w-0"
              />
            </div>
          </div>

          {/* Linked Project/App URL */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Linked Website / App URL <span className="normal-case font-normal">(optional)</span></label>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 transition-all">
              <Globe size={13} className="text-zinc-400 shrink-0" />
              <input
                value={linkedUrl} onChange={e => setLinkedUrl(e.target.value)}
                placeholder="e.g. localhost:3000 or my-app.vercel.app"
                className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none min-w-0"
              />
            </div>
          </div>

          {/* Site name + category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Site / App Name</label>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Google, Meesho…"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Category</label>
              <select
                value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-all cursor-pointer"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Email / Username</label>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 transition-all">
              <AtSign size={13} className="text-zinc-400 shrink-0" />
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none min-w-0"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Password</label>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 transition-all">
              <Key size={13} className="text-zinc-400 shrink-0" />
              <input
                type={showPass ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none font-mono min-w-0"
                autoComplete="new-password"
              />
              <button onClick={() => setShowPass(v => !v)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={genPass} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer" title="Generate secure password">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Notes <span className="normal-case font-normal">(optional)</span></label>
            <textarea
              value={context} onChange={e => setContext(e.target.value)}
              placeholder="Recovery codes, security questions, account numbers…"
              rows={2}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-all resize-y"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => onAdd({ title, url, username, password, context, category, linkedUrl })}
            disabled={!valid}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all cursor-pointer shadow-sm"
          >
            <Lock size={13} /> Save Securely
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function VaultPage() {
  const [locked, setLocked]         = useState(true);
  const [autoLocked, setAutoLocked] = useState(false);
  const [records, setRecords, isReady, isSynced] = useSupabaseTable<VaultRecord>(
    "vault_items", STORAGE_KEY, [],
    { noLocalStorage: true }
  );

  const [stash, setStash]           = useState<StashItem[]>([]);
  const keyRef                      = useRef<CryptoKey | null>(null);
  const recordsRef                  = useRef<VaultRecord[]>(records);
  useEffect(() => { recordsRef.current = records; }, [records]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQ, setSearchQ]         = useState("");
  const [filterCat, setFilterCat]     = useState<string>("All");
  const [showArchived, setShowArchived] = useState(false);

  const currentItem = stash.find(i => i.id === selectedItemId);

  const hasMeta = records.some(r => r.id === META_ID);
  const mode: "setup" | "unlock" = hasMeta ? "unlock" : "setup";

  /* Auto-initialize vault with PIN "2001" only after Supabase has synced */
  useEffect(() => {
    if (!isReady || !isSynced) return;
    if (records.some(r => r.id === META_ID)) return;
    (async () => {
      try {
        const salt  = randomBytes(16);
        const key   = await deriveKey("2001", salt);
        const check = await encryptJSON(key, MAGIC);
        const meta: VaultRecord = { id: META_ID, salt: bytesToB64(salt), check };
        setRecords([meta, ...records.filter(r => r.id !== META_ID)]);
      } catch (e) { console.error("Vault init failed:", e); }
    })();
  }, [isReady, isSynced, records, setRecords]);

  const wipe = () => { keyRef.current = null; setStash([]); };

  const decryptAll = async (recs: VaultRecord[], key: CryptoKey): Promise<StashItem[]> => {
    const out: StashItem[] = [];
    for (const r of recs) {
      if (r.id === META_ID || !r.enc) continue;
      try {
        const p = await decryptJSON<{
          title: string; url: string; context: string; category?: string;
          username?: string; password?: string; accounts?: Account[];
          linkedUrl?: string;
        }>(key, r.enc);
        let accounts = p.accounts || [];
        if (!accounts.length && (p.username || p.password))
          accounts = [{ username: p.username || "", password: p.password || "" }];
        out.push({
          id: r.id, title: p.title || "", url: p.url || "",
          context: p.context || "", accounts, category: p.category,
          watched: !!r.watched,
          createdAt: r.createdAt || new Date(0).toISOString(),
          linkedUrl: p.linkedUrl || "",
        });
      } catch { /* skip undecryptable */ }
    }
    return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const verify = async (pin: string): Promise<boolean> => {
    try {
      const cur = recordsRef.current;
      const metaRec = cur.find(r => r.id === META_ID);
      if (!metaRec?.salt || !metaRec?.check) {
        const salt  = randomBytes(16);
        const key   = await deriveKey(pin, salt);
        const check = await encryptJSON(key, MAGIC);
        const meta: VaultRecord = { id: META_ID, salt: bytesToB64(salt), check };
        keyRef.current = key;
        const items = cur.filter(r => r.id !== META_ID && r.enc);
        setRecords([meta, ...items]);
        setStash(await decryptAll(items, key));
        return true;
      }
      const salt  = b64ToBytes(metaRec.salt);
      const key   = await deriveKey(pin, salt);
      const value = await decryptJSON<string>(key, metaRec.check);
      if (value !== MAGIC) return false;
      keyRef.current = key;
      const items = cur.filter(r => r.id !== META_ID && r.enc);
      setStash(await decryptAll(items, key));
      return true;
    } catch { return false; }
  };

  const unlock = () => {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
    setAutoLocked(false); setLocked(false);
  };
  const lock = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    wipe(); setLocked(true);
  };

  /* Auto-lock after 1 min inactivity */
  useEffect(() => {
    if (locked) return;
    let timer: ReturnType<typeof setTimeout>;
    const doLock = () => { wipe(); setAutoLocked(true); setLocked(true); };
    const reset  = () => { clearTimeout(timer); timer = setTimeout(doLock, 60_000); };
    const evts: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    evts.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); evts.forEach(e => window.removeEventListener(e, reset)); };
  }, [locked]);

  useEffect(() => {
    if (!autoLocked) return;
    const t = setTimeout(() => setAutoLocked(false), 4500);
    return () => clearTimeout(t);
  }, [autoLocked]);

  /* Mutations */
  const handleAdd = useCallback(async (data: {
    title: string; url: string; username: string; password: string; context: string; category: string;
    linkedUrl?: string;
  }) => {
    const key = keyRef.current;
    if (!key) return;
    if (!data.title.trim() && !data.username.trim() && !data.password.trim()) return;

    const id        = `st-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const cleanUrl  = data.url.trim() ? normalizeUrl(data.url) : "";
    const cleanTitle = data.title.trim() || hostnameOf(cleanUrl) || "Unnamed";
    const cleanLinkedUrl = data.linkedUrl?.trim() ? normalizeUrl(data.linkedUrl) : "";

    // Dedup: merge into existing card if same title/domain
    const existing = stash.find(i =>
      slug(i.title) === slug(cleanTitle) || (cleanUrl && hostnameOf(i.url) === hostnameOf(cleanUrl))
    );
    if (existing) {
      const merged = [
        ...(existing.accounts || []),
        {
          username: data.username.trim(),
          password: data.password,
          url: cleanUrl || undefined,
          linkedUrl: cleanLinkedUrl || undefined
        }
      ];
      await updateAccounts(existing.id, merged);
      setIsModalOpen(false);
      return;
    }

    const payload = {
      title: cleanTitle, url: cleanUrl, context: data.context.trim(),
      category: data.category,
      accounts: [
        {
          username: data.username.trim(),
          password: data.password,
          url: cleanUrl || undefined,
          linkedUrl: cleanLinkedUrl || undefined
        }
      ],
      linkedUrl: cleanLinkedUrl,
    };
    const enc = await encryptJSON(key, payload);
    const rec: VaultRecord = { id, enc, watched: false, createdAt };
    setRecords(prev => [rec, ...prev]);
    setStash(prev => [{
      id, title: cleanTitle, url: cleanUrl, context: data.context.trim(),
      category: data.category, accounts: payload.accounts, watched: false, createdAt,
      linkedUrl: cleanLinkedUrl,
    }, ...prev]);
    setIsModalOpen(false);
  }, [stash, setRecords]);

  const remove = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    setStash(prev => prev.filter(i => i.id !== id));
  };

  const toggleWatched = (id: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, watched: !r.watched } : r));
    setStash(prev => prev.map(i => i.id === id ? { ...i, watched: !i.watched } : i));
  };

  const updateAccounts = async (id: string, newAccounts: Account[]) => {
    const key = keyRef.current;
    if (!key) return;
    const record = recordsRef.current.find(r => r.id === id);
    if (!record?.enc) return;
    try {
      const old = await decryptJSON<{ title: string; url: string; context: string; category?: string }>(key, record.enc);
      const enc = await encryptJSON(key, { ...old, accounts: newAccounts });
      setRecords(prev => prev.map(r => r.id === id ? { ...r, enc } : r));
      setStash(prev => prev.map(i => i.id === id ? { ...i, accounts: newAccounts } : i));
    } catch (e) { console.error("updateAccounts failed", e); }
  };

  /* Filter */
  const visible = stash.filter(i => {
    if (!showArchived && i.watched) return false;
    if (filterCat !== "All" && i.category !== filterCat) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (
        i.title.toLowerCase().includes(q) ||
        hostnameOf(i.url).includes(q) ||
        (i.linkedUrl && hostnameOf(i.linkedUrl).includes(q)) ||
        i.accounts.some(a => a.username.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const hasArchived = stash.some(i => i.watched);

  return (
    <div>
      {/* Auto-lock toast */}
      <AnimatePresence>
        {autoLocked && (
          <motion.div
            initial={{ opacity: 0, y: -16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -16, x: "-50%" }}
            className="fixed top-20 left-1/2 z-[60] flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-950 dark:bg-zinc-800 text-white shadow-xl"
          >
            <Lock size={14} className="text-amber-300" />
            <span className="text-sm font-semibold">Vault locked after 1 min of inactivity</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {locked ? (
          !isReady || !isSynced ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 min-h-[calc(100vh-200px)] text-zinc-400"
            >
              <Loader2 className="animate-spin" size={24} />
              {isReady && !isSynced && <span className="text-xs">Syncing vault…</span>}
            </motion.div>
          ) : (
            <VaultLock key="lock" mode={mode} verify={verify} onUnlock={unlock} notice={autoLocked ? "Locked due to inactivity" : undefined} />
          )
        ) : (
          <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Password Vault</h2>
                  <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-full tracking-wider">
                    <ShieldCheck size={9} /> Secure
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {stash.length} {stash.length === 1 ? "login" : "logins"} · AES-256 encrypted · PIN 2001
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 hover:opacity-90 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Plus size={13} /> Add Password
                </button>
                <button
                  onClick={lock}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-all cursor-pointer"
                >
                  <Lock size={13} /> Lock
                </button>
              </div>
            </div>

            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all">
                <Search size={14} className="text-zinc-400 shrink-0" />
                <input
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search site, email…"
                  className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none"
                />
                {searchQ && (
                  <button onClick={() => setSearchQ("")} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                    <X size={13} />
                  </button>
                )}
              </div>
              {/* Category filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {["All", ...CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      filterCat === cat
                        ? "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-950 dark:border-zinc-100"
                        : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {hasArchived && (
                  <button
                    onClick={() => setShowArchived(v => !v)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ml-1 ${
                      showArchived
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400"
                    }`}
                  >
                    Archived
                  </button>
                )}
              </div>
            </div>

            {/* Grid */}
            {visible.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {visible.map(item => (
                    <CredCard
                      key={item.id} item={item}
                      onDelete={remove}
                      onToggleWatched={toggleWatched}
                      onOpenDetails={(item) => setSelectedItemId(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl"
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center shadow-inner">
                  {searchQ ? <Search size={24} className="text-zinc-400" /> : <Key size={24} className="text-zinc-400" />}
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {searchQ ? "No results found" : "No passwords saved yet"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
                    {searchQ ? `Nothing matches "${searchQ}"` : "Click \"Add Password\" to store your first login securely."}
                  </p>
                </div>
                {!searchQ && (
                  <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold cursor-pointer">
                    <Plus size={12} /> Add First Password
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <AddModal onClose={() => setIsModalOpen(false)} onAdd={handleAdd} />
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {currentItem && (
          <DetailsModal
            item={currentItem}
            onClose={() => setSelectedItemId(null)}
            onUpdateAccounts={updateAccounts}
            onDelete={remove}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
