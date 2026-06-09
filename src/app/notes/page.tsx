"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable";
import { NoteEditor } from "@/components/notes/NoteEditor";
import {
  NotebookPen,
  Plus,
  Trash2,
  Search,
  FileText,
  ChevronLeft,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Note {
  id: string;
  title: string;
  content: string; // HTML from TipTap
  updatedAt: string;
}

const STORAGE_KEY = "biztrack_notes";

/* Strip HTML tags to build a short preview line for the list. */
function previewOf(html: string): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function NotesPage() {
  const [notes, setNotes, isReady] = useSupabaseTable<Note>("notes", STORAGE_KEY, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Mobile: which pane is showing ("list" or "editor").
  const [mobilePane, setMobilePane] = useState<"list" | "editor">("list");

  // Debounced-save plumbing. We hold the pending HTML in a ref and flush it
  // after a quiet period so we don't hit Supabase on every keystroke.
  const pendingContent = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const html = pendingContent.current;
    pendingContent.current = null;
    if (html === null || !activeId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId ? { ...n, content: html, updatedAt: new Date().toISOString() } : n
      )
    );
  }, [activeId, setNotes]);

  // Flush on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Pick a sensible note once data loads.
  useEffect(() => {
    if (!isReady) return;
    if (activeId && notes.some((n) => n.id === activeId)) return;
    if (notes.length > 0) {
      const sorted = [...notes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setActiveId(sorted[0].id);
    } else {
      setActiveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, notes.length]);

  const sorted = useMemo(
    () =>
      [...notes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [notes]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || previewOf(n.content).toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const activeNote = notes.find((n) => n.id === activeId) || null;

  const handleNew = () => {
    flushPending();
    const note: Note = {
      id: `note-${Date.now()}`,
      title: "Untitled",
      content: "",
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    setMobilePane("editor");
  };

  const handleSelect = (id: string) => {
    if (id === activeId) {
      setMobilePane("editor");
      return;
    }
    flushPending();
    setActiveId(id);
    setMobilePane("editor");
  };

  const handleDelete = (id: string) => {
    if (id === activeId) {
      pendingContent.current = null;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleTitleChange = (title: string) => {
    if (!activeId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId ? { ...n, title, updatedAt: new Date().toISOString() } : n
      )
    );
  };

  const handleContentChange = (html: string) => {
    pendingContent.current = html;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushPending, 700);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-black tracking-tight">Notes</h2>
          <p className="text-sm text-[#888] mt-1">
            {notes.length} note{notes.length !== 1 ? "s" : ""} · saved automatically
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-[#222] text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <Plus size={15} /> New Note
        </button>
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 lg:gap-5">
        {/* ── List pane ── */}
        <div
          className={`${mobilePane === "editor" ? "hidden" : "flex"} lg:flex flex-col bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden lg:max-h-[calc(100vh-220px)]`}
        >
          {/* Search */}
          <div className="p-3 border-b border-[#e8e8e8]">
            <div className="flex items-center gap-2 bg-[#f8f8f8] border border-[#e8e8e8] rounded-xl px-3 py-2 focus-within:border-black focus-within:ring-2 focus-within:ring-black/10 transition-all">
              <Search size={14} className="text-[#bbb] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes…"
                className="flex-1 bg-transparent text-sm text-black placeholder:text-[#bbb] focus:outline-none border-none p-0"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-[#f5f5f5] flex items-center justify-center">
                  <FileText size={24} className="text-[#ccc]" />
                </div>
                <p className="text-sm text-[#888]">
                  {query ? "No notes match your search." : "No notes yet. Create your first one."}
                </p>
              </div>
            ) : (
              filtered.map((note) => {
                const isActive = note.id === activeId;
                const preview = previewOf(note.content);
                return (
                  <button
                    key={note.id}
                    onClick={() => handleSelect(note.id)}
                    className={`group w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                      isActive ? "bg-black text-white" : "hover:bg-[#f5f5f5] text-black"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {note.title || "Untitled"}
                        </p>
                        <p
                          className={`text-[12px] truncate mt-0.5 ${
                            isActive ? "text-white/60" : "text-[#aaa]"
                          }`}
                        >
                          {preview || "Empty note"}
                        </p>
                        <p
                          className={`text-[10px] mt-1 font-medium uppercase tracking-wider ${
                            isActive ? "text-white/50" : "text-[#bbb]"
                          }`}
                        >
                          {timeAgo(note.updatedAt)}
                        </p>
                      </div>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(note.id);
                        }}
                        className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                          isActive
                            ? "text-white/70 hover:text-white hover:bg-white/15"
                            : "text-[#ccc] hover:text-red-500 hover:bg-red-50"
                        }`}
                        title="Delete note"
                        role="button"
                        aria-label="Delete note"
                      >
                        <Trash2 size={13} />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Editor pane ── */}
        <div
          className={`${mobilePane === "list" ? "hidden" : "block"} lg:block bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden`}
        >
          {activeNote ? (
            <div className="flex flex-col">
              {/* Title row */}
              <div className="flex items-center gap-2 px-4 sm:px-7 pt-4">
                <button
                  onClick={() => setMobilePane("list")}
                  className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[#888] hover:bg-[#f5f5f5] shrink-0"
                  aria-label="Back to notes list"
                >
                  <ChevronLeft size={18} />
                </button>
                <input
                  value={activeNote.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Untitled"
                  className="flex-1 text-2xl sm:text-[1.75rem] font-bold text-black bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder:text-[#ccc]"
                />
              </div>

              {/* Rich editor — keyed by note id so it re-initialises per note. */}
              <NoteEditor
                key={activeNote.id}
                initialContent={activeNote.content}
                onChange={handleContentChange}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-20 h-20 rounded-3xl bg-[#f5f5f5] flex items-center justify-center">
                <NotebookPen size={36} className="text-[#ccc]" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-black text-lg">No note selected</h3>
                <p className="text-[#888] text-sm mt-1 max-w-xs">
                  Create a note to start writing — format with headings, colors, highlights,
                  lists, tables and more.
                </p>
              </div>
              <button
                onClick={handleNew}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-black hover:bg-[#222] text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus size={15} /> New Note
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
