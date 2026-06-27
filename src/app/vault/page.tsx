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
  Bookmark,
  Plus,
  Trash2,
  ExternalLink,
  Link2,
  X,
  Eye,
  EyeOff,
  Clock,
  Lock,
  Play,
  CircleCheckBig,
  Loader2,
  Key,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
// Decrypted, in-memory shape used for display.
interface StashItem {
  id: string;
  type?: "link" | "credential";
  title: string;
  url: string;
  context: string;
  username?: string;
  password?: string;
  watched: boolean;
  createdAt: string;
}

// Persisted shape (Supabase). Sensitive fields live encrypted inside `enc`.
// The meta record (id === META_ID) holds the salt + verifier instead.
interface VaultRecord {
  id: string;
  enc?: string;        // base64(iv|ciphertext) of { title, url, context }
  watched?: boolean;
  createdAt?: string;
  salt?: string;       // meta only
  check?: string;      // meta only — encrypted verifier
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

/* ─── Stash Card ────────────────────────────────────────────── */
function StashCard({
  item,
  onDelete,
  onToggleWatched,
}: {
  item: StashItem;
  onDelete: (id: string) => void;
  onToggleWatched: (id: string) => void;
}) {
  const fav = faviconOf(item.url);
  const open = () => item.url && window.open(item.url, "_blank", "noopener,noreferrer");

  const [showPass, setShowPass] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  const copyUsername = async () => {
    if (!item.username) return;
    try {
      await navigator.clipboard.writeText(item.username);
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    } catch (err) {
      console.error("Failed to copy username", err);
    }
  };

  const copyPassword = async () => {
    if (!item.password) return;
    try {
      await navigator.clipboard.writeText(item.password);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } catch (err) {
      console.error("Failed to copy password", err);
    }
  };

  const isCredential = item.type === "credential";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`group bg-white rounded-2xl border border-[#e8e8e8] hover:border-[#ccc] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all p-4 flex flex-col gap-2.5 ${
        item.watched ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8] flex items-center justify-center shrink-0 overflow-hidden">
          {fav ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fav} alt="" width={18} height={18} className="object-contain" />
          ) : isCredential ? (
            <Key size={15} className="text-amber-600" />
          ) : (
            <Bookmark size={15} className="text-[#999]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm text-black leading-snug ${item.watched ? "line-through" : ""}`}>
            {item.title || (isCredential ? "Unnamed Login" : hostnameOf(item.url) || "Saved note")}
          </h3>
          {item.url && (
            <button onClick={open} className="text-[11px] text-[#aaa] hover:text-blue-500 truncate flex items-center gap-1 mt-0.5 w-fit max-w-full">
              <span className="truncate">{hostnameOf(item.url)}</span> <ExternalLink size={9} className="shrink-0" />
            </button>
          )}
        </div>
        {isCredential && (
          <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50 rounded-full shrink-0 uppercase tracking-wider">
            Login
          </span>
        )}
      </div>

      {isCredential ? (
        <div className="bg-[#fafafa] border border-[#f0f0f0] rounded-xl p-2.5 space-y-2 mt-0.5 text-xs text-[#444]">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[#888] shrink-0 font-medium w-16">Username</span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              <span className="truncate font-mono text-black select-all text-right w-full" title={item.username}>
                {item.username || "—"}
              </span>
              {item.username && (
                <button
                  onClick={copyUsername}
                  className="p-1 hover:bg-[#e8e8e8] text-[#888] hover:text-black rounded transition-colors shrink-0"
                  title="Copy Username"
                >
                  {copiedUser ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 min-w-0 border-t border-[#f0f0f0]/60 pt-2">
            <span className="text-[#888] shrink-0 font-medium w-16">Password</span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              <span className="font-mono text-black select-all tracking-wide text-right w-full">
                {showPass ? item.password : "••••••••"}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="p-1 hover:bg-[#e8e8e8] text-[#888] hover:text-black rounded transition-colors"
                  title={showPass ? "Hide Password" : "Show Password"}
                >
                  {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                {item.password && (
                  <button
                    onClick={copyPassword}
                    className="p-1 hover:bg-[#e8e8e8] text-[#888] hover:text-black rounded transition-colors"
                    title="Copy Password"
                  >
                    {copiedPass ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!isCredential && item.context && (
        <p className="text-[13px] text-[#666] leading-relaxed whitespace-pre-wrap">{item.context}</p>
      )}

      {isCredential && item.context && (
        <div className="mt-0.5">
          <span className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wider block mb-0.5">Notes</span>
          <p className="text-[12px] text-[#555] leading-relaxed whitespace-pre-wrap">{item.context}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[#f3f3f3] pt-2.5 mt-auto">
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[#bbb]">
          <Clock size={10} /> {timeAgo(item.createdAt)}
        </span>
        <div className="flex items-center gap-1">
          {item.url && !isCredential && (
            <button
              onClick={open}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-[#555] hover:bg-[#f5f5f5] transition-colors"
              title="Open link"
            >
              <Play size={12} /> Resume
            </button>
          )}
          {isCredential && item.url && (
            <button
              onClick={open}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-[#555] hover:bg-[#f5f5f5] transition-colors"
              title="Open Website"
            >
              <ExternalLink size={11} /> Open
            </button>
          )}
          <button
            onClick={() => onToggleWatched(item.id)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
              item.watched
                ? "text-green-600 bg-green-50 hover:bg-green-100"
                : "text-[#ccc] hover:text-green-600 hover:bg-green-50"
            }`}
            title={item.watched ? "Mark as not done" : "Mark as done"}
          >
            {item.watched ? <CircleCheckBig size={14} /> : <Eye size={14} />}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
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

  const [composerTab, setComposerTab] = useState<"link" | "credential">("link");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showComposerPass, setShowComposerPass] = useState(false);

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
        }>(key, r.enc);
        out.push({
          id: r.id,
          type: payload.type || (payload.username || payload.password ? "credential" : "link"),
          title: payload.title || "",
          url: payload.url || "",
          context: payload.context || "",
          username: payload.username || "",
          password: payload.password || "",
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

  /* Verify PIN (and set up the vault on first run). Returns success. */
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

  // Re-lock on a hard reload — the session flag only survives in-app navigation,
  // and we still require the PIN again to re-derive the key (data stays encrypted).
  // (We intentionally do NOT auto-unlock from the session flag, since the key
  //  cannot be restored without the PIN.)

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

    const id = `st-${Date.now()}`;
    const createdAt = new Date().toISOString();

    if (composerTab === "link") {
      const cleanUrl = normalizeUrl(url);
      if (!cleanUrl && !title.trim() && !context.trim()) return;

      const payload = {
        type: "link" as const,
        title: title.trim(),
        url: cleanUrl,
        context: context.trim(),
      };

      const enc = await encryptJSON(key, payload);
      const rec: VaultRecord = { id, enc, watched: false, createdAt };
      setRecords((prev) => [rec, ...prev]);
      setStash((prev) => [{ id, type: "link", title: title.trim(), url: cleanUrl, context: context.trim(), watched: false, createdAt }, ...prev]);
      
      setUrl("");
      setTitle("");
      setContext("");
    } else {
      if (!title.trim() && !username.trim() && !password.trim()) return;
      const cleanUrl = url.trim() ? normalizeUrl(url) : "";

      const payload = {
        type: "credential" as const,
        title: title.trim() || hostnameOf(cleanUrl) || "Unnamed Login",
        url: cleanUrl,
        username: username.trim(),
        password: password,
        context: context.trim(),
      };

      const enc = await encryptJSON(key, payload);
      const rec: VaultRecord = { id, enc, watched: false, createdAt };
      setRecords((prev) => [rec, ...prev]);
      setStash((prev) => [{
        id,
        type: "credential",
        title: payload.title,
        url: cleanUrl,
        username: username.trim(),
        password: password,
        context: context.trim(),
        watched: false,
        createdAt
      }, ...prev]);

      setUrl("");
      setTitle("");
      setUsername("");
      setPassword("");
      setContext("");
      setShowComposerPass(false);
    }
  };

  const remove = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setStash((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleWatched = (id: string) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, watched: !r.watched } : r)));
    setStash((prev) => prev.map((i) => (i.id === id ? { ...i, watched: !i.watched } : i)));
  };

  const visible = stash.filter((i) => (showWatched ? true : !i.watched));
  const pendingCount = stash.filter((i) => !i.watched).length;

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
            className="fixed top-20 left-1/2 z-[60] flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black text-white shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
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
              onReset={resetVault}
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
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-black tracking-tight">Vault</h2>
                <p className="text-sm text-[#888] mt-1">
                  {pendingCount} to revisit · {stash.length} saved · encrypted
                </p>
              </div>
              <button
                onClick={lock}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e8e8e8] text-sm font-semibold text-[#555] hover:bg-[#f5f5f5] transition-colors"
              >
                <Lock size={14} /> Lock
              </button>
            </div>

            {/* Composer */}
            <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm p-4 flex flex-col gap-3">
              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 bg-[#f5f5f5] rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setComposerTab("link");
                    setUrl("");
                    setTitle("");
                    setContext("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    composerTab === "link"
                      ? "bg-white text-black shadow-sm"
                      : "text-[#666] hover:text-black"
                  }`}
                >
                  <Link2 size={13} />
                  <span>Link / Note</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposerTab("credential");
                    setUrl("");
                    setTitle("");
                    setContext("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    composerTab === "credential"
                      ? "bg-white text-black shadow-sm"
                      : "text-[#666] hover:text-black"
                  }`}
                >
                  <Key size={13} />
                  <span>Password / Login</span>
                </button>
              </div>

              {composerTab === "link" ? (
                <>
                  <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
                    <Link2 size={15} className="text-[#bbb] shrink-0" />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") add(); }}
                      placeholder="Paste a link (YouTube, article, anything)…"
                      className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0"
                    />
                    {url && (
                      <button onClick={() => setUrl("")} className="text-[#ccc] hover:text-black shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") add(); }}
                    placeholder="Title (optional)"
                    className="bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all"
                  />
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="What were you doing? Where to resume, why you saved it…"
                    rows={2}
                    className="bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all resize-y"
                  />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider ml-1">App / Site Name</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Google, Netflix, Router, etc."
                        className="bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider ml-1">Website URL (optional)</label>
                      <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
                        <Link2 size={14} className="text-[#bbb] shrink-0" />
                        <input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider ml-1">Username / Email</label>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="username@gmail.com or user123"
                        className="bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider ml-1">Password</label>
                      <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
                        <input
                          type={showComposerPass ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowComposerPass(!showComposerPass)}
                          className="text-[#ccc] hover:text-black shrink-0 transition-colors"
                          title={showComposerPass ? "Hide password" : "Show password"}
                        >
                          {showComposerPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-[#ccc] hover:text-black shrink-0 transition-colors"
                          title="Generate Secure Password"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#888] uppercase tracking-wider ml-1">Notes (optional)</label>
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Security questions, recovery codes, account numbers..."
                      rows={2}
                      className="bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2.5 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-all resize-y"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={add}
                  disabled={
                    composerTab === "link"
                      ? !url.trim() && !title.trim() && !context.trim()
                      : !title.trim() && !username.trim() && !password.trim()
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-[#222] disabled:bg-[#ddd] disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus size={15} /> Save to Vault
                </button>
              </div>
            </div>

            {/* Filter toggle */}
            {stash.some((i) => i.watched) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowWatched((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                    showWatched ? "bg-white text-[#666] border-[#e8e8e8] hover:border-[#bbb]" : "bg-black text-white border-black"
                  }`}
                >
                  {showWatched ? "Hide done" : "Show all"}
                </button>
              </div>
            )}

            {/* List */}
            {visible.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence mode="popLayout">
                  {visible.map((item) => (
                    <StashCard key={item.id} item={item} onDelete={remove} onToggleWatched={toggleWatched} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
                  <Bookmark size={28} className="text-[#ccc]" />
                </div>
                <div>
                  <h3 className="font-semibold text-black">Nothing saved yet</h3>
                  <p className="text-sm text-[#888] mt-1 max-w-xs">
                    Paste a link and jot down where you left off — everything here is encrypted with your PIN.
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
