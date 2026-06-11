"use client";

import React, { useState, useMemo } from "react";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import {
  Stamp,
  Plus,
  Trash2,
  Phone,
  MessageCircle,
  Pencil,
  Check,
  X,
  Search,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface BrandingEnquiry {
  id: string;
  itemType: string;   // Printed Box | Hang Tag | Label | Other
  vendor: string;     // who you spoke to / company
  phone: string;
  rate: string;       // free text, e.g. "₹3/pc · MOQ 1000"
  description: string;
  status: string;     // enquired | quoted | sample | finalized | rejected
  date: string;       // when you talked
  createdAt: string;
}

const STORAGE_KEY = "biztrack_branding";
const ITEM_TYPES = ["Printed Box", "Hang Tag", "Label", "Sticker", "Other"];
const STATUSES = [
  { id: "enquired", label: "Enquired", dot: "bg-[#999]", chip: "bg-[#f0f0f0] text-[#666] border-[#e0e0e0]" },
  { id: "quoted", label: "Quoted", dot: "bg-blue-500", chip: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "sample", label: "Sample", dot: "bg-amber-500", chip: "bg-amber-500/12 text-amber-600 border-amber-500/25" },
  { id: "finalized", label: "Finalized", dot: "bg-green-500", chip: "bg-green-500/12 text-green-600 border-green-500/25" },
  { id: "rejected", label: "Rejected", dot: "bg-red-500", chip: "bg-red-500/10 text-red-500 border-red-500/20" },
] as const;

function statusMeta(id: string) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}
function waLink(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}`;
}

/* ─── Status picker ─────────────────────────────────────────── */
function StatusPicker({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(status);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${meta.chip}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </button>
      {open && (
        <div className="absolute z-30 right-0 mt-1.5 w-36 bg-white border border-[#e8e8e8] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onMouseDown={(e) => { e.preventDefault(); onChange(s.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f5f5f5] transition-colors text-left ${s.id === status ? "font-semibold" : ""}`}
            >
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-sm text-black flex-1">{s.label}</span>
              {s.id === status && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Enquiry card ──────────────────────────────────────────── */
function EnquiryCard({
  e,
  onDelete,
  onStatus,
  onEdit,
}: {
  e: BrandingEnquiry;
  onDelete: (id: string) => void;
  onStatus: (id: string, s: string) => void;
  onEdit: (e: BrandingEnquiry) => void;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-[#e8e8e8] hover:border-[#ccc] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-black truncate">{e.vendor || "Unknown vendor"}</h3>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#999] mt-1">
            <Stamp size={10} /> {e.itemType}{e.date ? ` · ${e.date}` : ""}
          </span>
        </div>
        <StatusPicker status={e.status} onChange={(s) => onStatus(e.id, s)} />
      </div>

      {e.rate && (
        <div className="text-[13px] text-black"><span className="text-[#999]">Rate:</span> <span className="font-semibold">{e.rate}</span></div>
      )}
      {e.description && (
        <p className="text-[13px] text-[#666] leading-relaxed whitespace-pre-wrap">{e.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[#f3f3f3] pt-2.5 mt-0.5">
        {e.phone ? (
          <div className="flex items-center gap-1.5">
            <a href={`tel:${e.phone}`} className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-[#555] hover:bg-[#f5f5f5] transition-colors" title="Call">
              <Phone size={12} /> {e.phone}
            </a>
            <a href={waLink(e.phone)} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg text-[#555] hover:bg-[#f5f5f5] transition-colors" title="WhatsApp">
              <MessageCircle size={13} />
            </a>
          </div>
        ) : <span className="text-[11px] text-[#bbb]">No number</span>}
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(e)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-black hover:bg-[#f5f5f5] transition-colors" title="Edit"><Pencil size={13} /></button>
          <button onClick={() => onDelete(e.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
const EMPTY = { itemType: "Printed Box", vendor: "", phone: "", rate: "", description: "", status: "enquired", date: "" };

export default function BrandingPage() {
  const [items, setItems] = useSupabaseTable<BrandingEnquiry>("branding_enquiries", STORAGE_KEY, []);
  const [draft, setDraft] = useState<typeof EMPTY>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");

  const reset = () => { setDraft({ ...EMPTY }); setEditingId(null); };

  const save = () => {
    if (!draft.vendor.trim() && !draft.phone.trim()) return;
    if (editingId) {
      setItems((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...draft } : x)));
    } else {
      const item: BrandingEnquiry = {
        id: `br-${Date.now()}`,
        ...draft,
        vendor: draft.vendor.trim(),
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [item, ...prev]);
    }
    reset();
  };

  const startEdit = (e: BrandingEnquiry) => {
    setEditingId(e.id);
    setDraft({ itemType: e.itemType, vendor: e.vendor, phone: e.phone, rate: e.rate, description: e.description, status: e.status, date: e.date });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = (id: string) => { setItems((prev) => prev.filter((x) => x.id !== id)); if (editingId === id) reset(); };
  const setStatus = (id: string, s: string) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: s } : x)));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((e) => (typeFilter === "All" ? true : e.itemType === typeFilter))
      .filter((e) => !q || e.vendor.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.rate.toLowerCase().includes(q) || e.phone.includes(q))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [items, typeFilter, search]);

  const inputCls = "w-full bg-[#f8f8f8] border border-[#e8e8e8] rounded-lg px-3 py-2.5 text-sm text-black placeholder:text-[#bbb] focus:outline-none focus:border-black transition-all";
  const labelCls = "block text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-1";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-black tracking-tight">Branding & Packaging</h2>
        <p className="text-sm text-[#888] mt-1">{items.length} enquir{items.length !== 1 ? "ies" : "y"} · printed boxes, tags & labels for KiddieKa</p>
      </div>

      {/* Add / edit form */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-[#888]" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-[#555]">{editingId ? "Edit enquiry" : "New enquiry"}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Item</label>
            <select className={inputCls} value={draft.itemType} onChange={(e) => setDraft({ ...draft, itemType: e.target.value })}>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vendor / contact *</label>
            <input className={inputCls} placeholder="Who you spoke to" value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} placeholder="Mobile number" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Rate / quote</label>
            <input className={inputCls} placeholder="e.g. ₹3/pc · MOQ 1000" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Date talked</label>
            <input type="date" className={inputCls} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Description / notes</label>
            <textarea className={`${inputCls} resize-y`} rows={2} placeholder="Box size, print quality, sample status, what was discussed…" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          {editingId && (
            <button onClick={reset} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#555] hover:bg-[#f5f5f5] flex items-center gap-1.5"><X size={15} /> Cancel</button>
          )}
          <button onClick={save} disabled={!draft.vendor.trim() && !draft.phone.trim()} className="flex items-center gap-1.5 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-[#222] disabled:bg-[#ddd] disabled:cursor-not-allowed transition-colors">
            {editingId ? <><Check size={15} /> Update</> : <><Plus size={15} /> Add enquiry</>}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-lg px-3 h-9 focus-within:border-black transition-all">
          <Search size={15} className="text-[#bbb] shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor, rate, notes…" className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0 min-w-0" />
        </div>
        {["All", ...ITEM_TYPES].map((t) => {
          const count = t === "All" ? items.length : items.filter((e) => e.itemType === t).length;
          const on = typeFilter === t;
          return (
            <button key={t} onClick={() => setTypeFilter(t)} className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-[13px] font-semibold border transition-colors ${on ? "bg-black text-white border-black" : "bg-white text-[#666] border-[#e8e8e8] hover:border-[#bbb]"}`}>
              {t}<span className={`text-[11px] ${on ? "text-white/70" : "text-[#aaa]"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((e) => (
            <EnquiryCard key={e.id} e={e} onDelete={remove} onStatus={setStatus} onEdit={startEdit} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
            <Stamp size={28} className="text-[#ccc]" />
          </div>
          <div>
            <h3 className="font-semibold text-black">No enquiries yet</h3>
            <p className="text-sm text-[#888] mt-1 max-w-xs">Add who you talked to for boxes, tags or labels — their number, rate and what was discussed.</p>
          </div>
        </div>
      )}
    </div>
  );
}
