"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { VaultLock } from "@/components/vault/VaultLock";
import {
  bytesToB64,
  b64ToBytes,
  randomBytes,
  deriveKey,
  encryptJSON,
  decryptJSON,
} from "@/lib/vault/crypto";
import {
  Plus,
  Trash2,
  ExternalLink,
  Link2,
  X,
  Eye,
  EyeOff,
  Clock,
  Lock,
  CircleCheckBig,
  Loader2,
  Key,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface StashItem {
  id: string;
  type?: "link" | "credential";
  title: string;
  url: string;
  context: string; // notes
  username?: string;
  password?: string;
  accounts?: Array<{ username: string; password: string }>; // support multiple logins
  watched: boolean;
  createdAt: string;
}

interface VaultRecord {
  id: string;
  enc?: string;        // base64(iv|ciphertext) of encrypted payload
  watched?: boolean;
  createdAt?: string;
  salt?: string;       // meta only
  check?: string;      // meta only
}

const STORAGE_KEY = "biztrack_vault";
const SESSION_KEY = "biztrack_vault_unlocked";
const META_ID = "__vault_meta__";
const MAGIC = "biztrack-vault-v1";

/* ─── Helpers ───────────────────────────────────────────────── */
function normalizeUrl(input: string): string {
  const url = input.trim();
  if (!url) return "";
  return url.match(/^https?:\/\//i) ? url : "https://" + url;
}
function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function faviconOf(url: string): string {
  const h = hostnameOf(url);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=64` : "";
}
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/* ─── Stash Card ────────────────────────────────────────────── */
function StashCard({
  item,
  onDelete,
  onToggleWatched,
  onUpdateAccounts,
}: {
  item: StashItem;
  onDelete: (id: string) => void;
  onToggleWatched: (id: string) => void;
  onUpdateAccounts: (id: string, newAccounts: Array<{ username: string; password: string }>) => void;
}) {
  const fav = faviconOf(item.url);
  const open = () => item.url && window.open(item.url, "_blank", "noopener,noreferrer");

  // Normalize accounts list: support legacy root credentials as first entry
  const accountsList = item.accounts || (item.username || item.password ? [{ username: item.username || "", password: item.password || "" }] : []);

  // Multiple account toggle & copy states mapping
  const [showPassMap, setShowPassMap] = useState<Record<number, boolean>>({});
  const [copiedUserMap, setCopiedUserMap] = useState<Record<number, boolean>>({});
  const [copiedPassMap, setCopiedPassMap] = useState<Record<number, boolean>>({});

  // Inline account form states
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccUser, setNewAccUser] = useState("");
  const [newAccPass, setNewAccPass] = useState("");
  const [showNewAccPass, setShowNewAccPass] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`group relative bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-3xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_12px_24px_rgba(0,0,0,0.25)] transition-all duration-300 flex flex-col gap-4 ${
        item.watched ? "opacity-50" : ""
      }`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            {fav ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fav} alt="" width={20} height={20} className="object-contain" />
            ) : (
              <Key size={18} className="text-amber-500 dark:text-amber-400" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className={`font-bold text-sm text-zinc-900 dark:text-zinc-50 leading-snug truncate ${item.watched ? "line-through text-zinc-400 dark:text-zinc-500" : ""}`}>
              {item.title || "Unnamed Login"}
            </h3>
            {item.url && (
              <button 
                onClick={open} 
                className="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors truncate flex items-center gap-1 mt-0.5 w-fit max-w-full cursor-pointer"
              >
                <span className="truncate">{hostnameOf(item.url)}</span> 
                <ExternalLink size={9} className="shrink-0" />
              </button>
            )}
          </div>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/35 dark:border-amber-900/40 rounded-full shrink-0 uppercase tracking-wider">
          Login
        </span>
      </div>

      {/* Credentials Table Box */}
      <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3 space-y-3.5 text-xs text-zinc-700 dark:text-zinc-300">
        {accountsList.length === 0 ? (
          <div className="text-center py-2 text-zinc-400 text-[11px]">No accounts saved.</div>
        ) : (
          accountsList.map((acc, idx) => {
            const isShow = !!showPassMap[idx];
            const isCopiedUser = !!copiedUserMap[idx];
            const isCopiedPass = !!copiedPassMap[idx];

            const copyUser = async () => {
              if (!acc.username) return;
              try {
                await navigator.clipboard.writeText(acc.username);
                setCopiedUserMap((prev) => ({ ...prev, [idx]: true }));
                setTimeout(() => setCopiedUserMap((prev) => ({ ...prev, [idx]: false })), 2000);
              } catch (err) {
                console.error("Failed to copy", err);
              }
            };

            const copyPass = async () => {
              if (!acc.password) return;
              try {
                await navigator.clipboard.writeText(acc.password);
                setCopiedPassMap((prev) => ({ ...prev, [idx]: true }));
                setTimeout(() => setCopiedPassMap((prev) => ({ ...prev, [idx]: false })), 2000);
              } catch (err) {
                console.error("Failed to copy", err);
              }
            };

            return (
              <div key={idx} className={`space-y-2.5 ${idx > 0 ? "border-t border-zinc-250/30 dark:border-zinc-800/40 pt-3" : ""}`}>
                {/* Account Label */}
                {accountsList.length > 1 && (
                  <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    <span>Account #{idx + 1}</span>
                    <button
                      onClick={() => {
                        if (window.confirm("Remove this login account from this card?")) {
                          onUpdateAccounts(item.id, accountsList.filter((_, i) => i !== idx));
                        }
                      }}
                      className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete this account"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}

                {/* Username Row */}
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider shrink-0 w-16">Username</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="truncate font-mono font-medium text-zinc-900 dark:text-zinc-100 select-all text-right w-full" title={acc.username}>
                      {acc.username || "—"}
                    </span>
                    {acc.username && (
                      <button
                        onClick={copyUser}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-all shrink-0 cursor-pointer"
                        title="Copy Username"
                      >
                        {isCopiedUser ? <Check size={13} className="text-green-600 dark:text-green-400" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Password Row */}
                <div className="flex items-center justify-between gap-3 min-w-0 border-t border-zinc-200/10 dark:border-zinc-800/15 pt-2.5">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider shrink-0 w-16">Password</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="font-mono text-zinc-900 dark:text-zinc-100 select-all tracking-wide text-right w-full">
                      {isShow ? acc.password : "••••••••"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setShowPassMap((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-all cursor-pointer"
                        title={isShow ? "Hide Password" : "Show Password"}
                      >
                        {isShow ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      {acc.password && (
                        <button
                          onClick={copyPass}
                          className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-all cursor-pointer"
                          title="Copy Password"
                        >
                          {isCopiedPass ? <Check size={13} className="text-green-600 dark:text-green-400" /> : <Copy size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Notes / Context */}
      {item.context && (
        <div className="mt-0.5">
          <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Notes</span>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap bg-zinc-50/20 dark:bg-zinc-950/10 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/40">
            {item.context}
          </p>
        </div>
      )}

      {/* Inline Account Form Creator */}
      {addingAccount ? (
        <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-3 space-y-2 mt-1">
          <div className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Add Secondary Login</div>
          <div className="grid grid-cols-1 gap-2">
            <input
              value={newAccUser}
              onChange={(e) => setNewAccUser(e.target.value)}
              placeholder="Username / Email"
              className="bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-550 placeholder:text-zinc-400 focus:outline-none w-full animate-none"
            />
            <div className="flex items-center gap-2 bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-1.5 w-full">
              <input
                type={showNewAccPass ? "text" : "password"}
                value={newAccPass}
                onChange={(e) => setNewAccPass(e.target.value)}
                placeholder="Password"
                className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none border-none p-0 min-w-0"
              />
              <button
                type="button"
                onClick={() => setShowNewAccPass(!showNewAccPass)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 shrink-0 cursor-pointer"
              >
                {showNewAccPass ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
                  const len = 16;
                  let pass = "";
                  const array = new Uint32Array(len);
                  window.crypto.getRandomValues(array);
                  for (let i = 0; i < len; i++) {
                    pass += chars[array[i] % chars.length];
                  }
                  setNewAccPass(pass);
                  setShowNewAccPass(true);
                }}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 shrink-0 cursor-pointer"
                title="Generate Secure Password"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              onClick={() => {
                setAddingAccount(false);
                setNewAccUser("");
                setNewAccPass("");
              }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-zinc-500 hover:bg-zinc-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!newAccUser.trim() && !newAccPass.trim()) return;
                onUpdateAccounts(item.id, [...accountsList, { username: newAccUser.trim(), password: newAccPass }]);
                setAddingAccount(false);
                setNewAccUser("");
                setNewAccPass("");
              }}
              className="px-3 py-1 rounded-lg bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[10px] font-bold cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingAccount(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 w-full rounded-xl text-[10px] font-bold text-zinc-500 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-950/20 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all cursor-pointer mt-1"
        >
          <Plus size={11} /> Add Another Account
        </button>
      )}

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800/60 pt-3 mt-auto">
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          <Clock size={10} /> {timeAgo(item.createdAt)}
        </span>
        <div className="flex items-center gap-1.5">
          {item.url && (
            <button
              onClick={open}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              title="Open Website"
            >
              <ExternalLink size={10} /> Open
            </button>
          )}
          <button
            onClick={() => onToggleWatched(item.id)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
              item.watched
                ? "text-green-600 bg-green-500/10 hover:bg-green-500/20"
                : "text-zinc-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-500/5 dark:hover:bg-green-500/10"
            }`}
            title={item.watched ? "Mark as active" : "Mark as completed/archived"}
          >
            {item.watched ? <CircleCheckBig size={13} /> : <Eye size={13} />}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
            title="Delete card"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function VaultPage() {
  const [locked, setLocked] = useState(true);
  const [autoLocked, setAutoLocked] = useState(false);
  const [records, setRecords, isReady] = useSupabaseTable<VaultRecord>("vault_items", STORAGE_KEY, []);

  // Decrypted items (only in memory while unlocked).
  const [stash, setStash] = useState<StashItem[]>([]);
  const keyRef = useRef<CryptoKey | null>(null);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [showWatched, setShowWatched] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showComposerPass, setShowComposerPass] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasMeta = records.some((r) => r.id === META_ID);
  const mode: "setup" | "unlock" = hasMeta ? "unlock" : "setup";

  // Auto-initialize vault with PIN "2001" if it is completely uninitialized.
  useEffect(() => {
    if (!isReady) return;
    const hasMetaRecord = records.some((r) => r.id === META_ID);
    if (!hasMetaRecord) {
      const initVault = async () => {
        try {
          const salt = randomBytes(16);
          const key = await deriveKey("2001", salt);
          const check = await encryptJSON(key, MAGIC);
          const meta: VaultRecord = { id: META_ID, salt: bytesToB64(salt), check };
          const items = records.filter((r) => r.id !== META_ID);
          setRecords([meta, ...items]);
        } catch (e) {
          console.error("Auto-initialization of vault failed:", e);
        }
      };
      initVault();
    }
  }, [isReady, records, setRecords]);

  /* Clear all decrypted material from memory. */
  const wipe = () => {
    keyRef.current = null;
    setStash([]);
  };

  const resetVault = () => {
    if (window.confirm("Are you sure you want to reset the vault? This will permanently delete all encrypted items and credentials.")) {
      setRecords([]); // clear all records, including metadata
      wipe();
    }
  };

  /* Decrypt every item record with the given key. */
  const decryptAll = async (recs: VaultRecord[], key: CryptoKey): Promise<StashItem[]> => {
    const out: StashItem[] = [];
    for (const r of recs) {
      if (r.id === META_ID || !r.enc) continue;
      try {
        const payload = await decryptJSON<{
          type?: "link" | "credential";
          title: string;
          url: string;
          context: string;
          username?: string;
          password?: string;
          accounts?: Array<{ username: string; password: string }>;
        }>(key, r.enc);

        // Normalize accounts array for multi-login support
        let accounts = payload.accounts || [];
        if (accounts.length === 0 && (payload.username || payload.password)) {
          accounts = [{ username: payload.username || "", password: payload.password || "" }];
        }

        out.push({
          id: r.id,
          type: payload.type || "credential",
          title: payload.title || "",
          url: payload.url || "",
          context: payload.context || "",
          username: payload.username || "",
          password: payload.password || "",
          accounts: accounts,
          watched: !!r.watched,
          createdAt: r.createdAt || new Date(0).toISOString(),
        });
      } catch {
        /* skip records that don't decrypt */
      }
    }
    out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return out;
  };

  const verify = async (pin: string): Promise<boolean> => {
    try {
      const metaRec = records.find((r) => r.id === META_ID);

      if (!metaRec || !metaRec.salt || !metaRec.check) {
        // First-time setup: create salt + verifier under the chosen PIN.
        const salt = randomBytes(16);
        const key = await deriveKey(pin, salt);
        const check = await encryptJSON(key, MAGIC);
        const meta: VaultRecord = { id: META_ID, salt: bytesToB64(salt), check };
        keyRef.current = key;
        const items = records.filter((r) => r.id !== META_ID && r.enc);
        setRecords([meta, ...items]);
        setStash(await decryptAll(items, key));
        return true;
      }

      // Unlock: derive key and decrypt the verifier to confirm the PIN.
      const salt = b64ToBytes(metaRec.salt);
      const key = await deriveKey(pin, salt);
      const value = await decryptJSON<string>(key, metaRec.check); // throws on wrong PIN
      if (value !== MAGIC) return false;
      keyRef.current = key;
      const items = records.filter((r) => r.id !== META_ID && r.enc);
      setStash(await decryptAll(items, key));
      return true;
    } catch {
      return false;
    }
  };

  const unlock = () => {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
    setAutoLocked(false);
    setLocked(false);
  };

  const lock = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    wipe();
    setLocked(true);
  };

  // Auto-lock after 1 minute of inactivity (only while unlocked).
  useEffect(() => {
    if (locked) return;
    const TIMEOUT = 60_000;
    let timer: ReturnType<typeof setTimeout>;
    const doAutoLock = () => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      wipe();
      setAutoLocked(true);
      setLocked(true);
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(doAutoLock, TIMEOUT);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [locked]);

  useEffect(() => {
    if (!autoLocked) return;
    const t = setTimeout(() => setAutoLocked(false), 4500);
    return () => clearTimeout(t);
  }, [autoLocked]);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    const len = 16;
    let pass = "";
    const array = new Uint32Array(len);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < len; i++) {
      pass += chars[array[i] % chars.length];
    }
    setPassword(pass);
    setShowComposerPass(true);
  };

  /* Mutations */
  const add = async () => {
    const key = keyRef.current;
    if (!key) return;

    if (!title.trim() && !username.trim() && !password.trim()) return;
    const id = `st-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const cleanUrl = url.trim() ? normalizeUrl(url) : "";
    const cleanTitle = title.trim() || hostnameOf(cleanUrl) || "Unnamed Login";

    // Deduplication check: if a card with the same title/domain already exists, merge accounts!
    const existing = stash.find((i) => 
      slug(i.title) === slug(cleanTitle) || 
      (cleanUrl && hostnameOf(i.url) === hostnameOf(cleanUrl))
    );

    if (existing) {
      const existingAccounts = existing.accounts || (existing.username || existing.password ? [{ username: existing.username || "", password: existing.password || "" }] : []);
      const mergedAccounts = [...existingAccounts, { username: username.trim(), password: password }];
      await updateAccounts(existing.id, mergedAccounts);

      setUrl("");
      setTitle("");
      setUsername("");
      setPassword("");
      setContext("");
      setShowComposerPass(false);
      setIsModalOpen(false);
      return;
    }

    const payload = {
      type: "credential" as const,
      title: cleanTitle,
      url: cleanUrl,
      context: context.trim(),
      accounts: [
        { username: username.trim(), password: password }
      ]
    };

    const enc = await encryptJSON(key, payload);
    const rec: VaultRecord = { id, enc, watched: false, createdAt };
    setRecords((prev) => [rec, ...prev]);
    setStash((prev) => [{
      id,
      type: "credential",
      title: payload.title,
      url: cleanUrl,
      context: context.trim(),
      accounts: payload.accounts,
      watched: false,
      createdAt
    }, ...prev]);

    setUrl("");
    setTitle("");
    setUsername("");
    setPassword("");
    setContext("");
    setShowComposerPass(false);
    setIsModalOpen(false);
  };

  const remove = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setStash((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleWatched = (id: string) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, watched: !r.watched } : r)));
    setStash((prev) => prev.map((i) => (i.id === id ? { ...i, watched: !i.watched } : i)));
  };

  const updateAccounts = async (id: string, newAccounts: Array<{ username: string; password: string }>) => {
    const key = keyRef.current;
    if (!key) return;

    const record = records.find((r) => r.id === id);
    if (!record || !record.enc) return;

    try {
      const oldPayload = await decryptJSON<{
        type?: "link" | "credential";
        title: string;
        url: string;
        context: string;
      }>(key, record.enc);

      const newPayload = {
        ...oldPayload,
        accounts: newAccounts,
      };

      const enc = await encryptJSON(key, newPayload);

      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, enc } : r));
      setStash((prev) => prev.map((i) => {
        if (i.id === id) {
          return {
            ...i,
            accounts: newAccounts,
          };
        }
        return i;
      }));
    } catch (e) {
      console.error("Failed to update accounts list", e);
    }
  };

  const visible = stash.filter((i) => (showWatched ? true : !i.watched));

  return (
    <div>
      {/* Auto-lock notification */}
      <AnimatePresence>
        {autoLocked && (
          <motion.div
            initial={{ opacity: 0, y: -16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -16, x: "-50%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-20 left-1/2 z-[60] flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black dark:bg-zinc-800 text-white shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
            role="status"
          >
            <Lock size={15} className="text-amber-300" />
            <span className="text-sm font-semibold">Vault locked after 1 min of inactivity</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {locked ? (
          !isReady ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center min-h-[calc(100vh-200px)] text-[#999]"
            >
              <Loader2 className="animate-spin" size={24} />
            </motion.div>
          ) : (
            <VaultLock
              key="lock"
              mode={mode}
              verify={verify}
              onUnlock={unlock}
              notice={autoLocked ? "Locked due to inactivity" : undefined}
            />
          )
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Password Vault</h2>
                  <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-full tracking-wider">
                    Secure
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {stash.length} logins saved · fully client-side encrypted with your PIN
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-955 text-xs font-bold transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer"
                >
                  <Plus size={13} /> Add Password
                </button>
                <button
                  type="button"
                  onClick={lock}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 active:scale-95 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] cursor-pointer"
                >
                  <Lock size={13} /> Lock Vault
                </button>
              </div>
            </div>

            {/* Add Credentials Modal */}
            <AnimatePresence>
              {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsModalOpen(false)}
                    className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                  />

                  {/* Modal Container */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 16 }}
                    transition={{ type: "spring", duration: 0.4 }}
                    className="relative max-w-xl w-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.4)] p-6 z-10 flex flex-col gap-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <Key size={14} />
                        </div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Login Credentials</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider ml-1">App / Site Name</label>
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Google, Flipkart, Amazone, etc."
                          className="bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-650 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 transition-all w-full animate-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider ml-1">Website URL (optional)</label>
                        <div className="flex items-center gap-2 bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/5 transition-all w-full">
                          <Link2 size={14} className="text-zinc-400 dark:text-zinc-550 shrink-0" />
                          <input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-650 focus:outline-none border-none p-0 min-w-0 w-full"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider ml-1">Username / Email</label>
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username@gmail.com or user123"
                          className="bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-650 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 transition-all w-full animate-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider ml-1">Password</label>
                        <div className="flex items-center gap-2 bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-900 dark:focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/5 transition-all w-full">
                          <input
                            type={showComposerPass ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••••••"
                            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-650 focus:outline-none border-none p-0 min-w-0 font-mono tracking-wide w-full"
                          />
                          <button
                            type="button"
                            onClick={() => setShowComposerPass(!showComposerPass)}
                            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 shrink-0 transition-colors cursor-pointer"
                            title={showComposerPass ? "Hide password" : "Show password"}
                          >
                            {showComposerPass ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={generatePassword}
                            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 shrink-0 transition-colors cursor-pointer"
                            title="Generate Secure Password"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider ml-1">Notes (optional)</label>
                      <textarea
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder="Security questions, recovery codes, account numbers..."
                        rows={2}
                        className="bg-[#f8f8f8] dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-550 placeholder:text-zinc-400 dark:placeholder:text-zinc-650 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 transition-all resize-y w-full"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={add}
                        disabled={!title.trim() && !username.trim() && !password.trim()}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow active:scale-98 cursor-pointer"
                      >
                        <Plus size={14} /> Save Password
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Filter toggle */}
            {stash.some((i) => i.watched) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowWatched((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                    showWatched ? "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700" : "bg-black dark:bg-zinc-100 text-white dark:text-zinc-950 border-black dark:border-zinc-100"
                  }`}
                >
                  {showWatched ? "Hide Archived" : "Show All"}
                </button>
              </div>
            )}

            {/* List */}
            {visible.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {visible.map((item) => (
                    <StashCard 
                      key={item.id} 
                      item={item} 
                      onDelete={remove} 
                      onToggleWatched={toggleWatched} 
                      onUpdateAccounts={updateAccounts}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center bg-white dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/40 rounded-3xl p-6">
                <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-inner">
                  <Key size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">No passwords saved yet</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
                    Add your login credentials above to secure them. Everything stored here is locally encrypted in your browser.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
