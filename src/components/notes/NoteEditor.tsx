"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Code, Table as TableIcon,
  Palette, Highlighter, Type, Pilcrow, Undo2, Redo2, ChevronDown,
} from "lucide-react";

const TEXT_COLORS = ["#111111", "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#9333ea", "#0891b2"];
const HL_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa", "#cffafe", "#e5e7eb"];
const FONTS = [
  { label: "Sans", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];
const SIZES = [
  { label: "Small", value: "13px" },
  { label: "Normal", value: "" },
  { label: "Large", value: "20px" },
];

function ToolBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 px-1.5 flex items-center justify-center rounded-lg text-sm transition-colors ${
        active ? "bg-black text-white" : "text-[#555] hover:bg-[#f0f0f0]"
      }`}
    >
      {children}
    </button>
  );
}

function Popover({ icon, title, children }: { icon: React.ReactNode; title: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-1.5 flex items-center gap-0.5 rounded-lg text-sm text-[#555] hover:bg-[#f0f0f0]"
      >
        {icon}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 bg-white border border-[#e8e8e8] rounded-xl shadow-lg p-2">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const Sep = () => <div className="w-px h-5 bg-[#e8e8e8] mx-0.5" />;
  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-[#e8e8e8] bg-[#fafafa] sticky top-0 z-20 rounded-t-2xl">
      <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></ToolBtn>
      <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolBtn>
      <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolBtn>
      <ToolBtn title="Paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}><Pilcrow size={15} /></ToolBtn>
      <Sep />
      <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolBtn>
      <ToolBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={15} /></ToolBtn>
      <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolBtn>
      <Sep />

      <Popover icon={<Palette size={15} />} title="Text color">
        {(close) => (
          <div className="flex flex-col gap-2 w-[148px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] px-0.5">Text color</span>
            <div className="grid grid-cols-4 gap-1.5">
              {TEXT_COLORS.map((col) => (
                <button key={col} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().setColor(col).run(); close(); }}
                  className="w-7 h-7 rounded-lg border border-black/10" style={{ background: col }} title={col} />
              ))}
            </div>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().unsetColor().run(); close(); }}
              className="text-xs font-semibold text-[#666] hover:text-black mt-0.5">Clear color</button>
          </div>
        )}
      </Popover>

      <Popover icon={<Highlighter size={15} />} title="Highlight">
        {(close) => (
          <div className="flex flex-col gap-2 w-[148px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] px-0.5">Highlight</span>
            <div className="grid grid-cols-4 gap-1.5">
              {HL_COLORS.map((col) => (
                <button key={col} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().toggleHighlight({ color: col }).run(); close(); }}
                  className="w-7 h-7 rounded-lg border border-black/10" style={{ background: col }} title={col} />
              ))}
            </div>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().unsetHighlight().run(); close(); }}
              className="text-xs font-semibold text-[#666] hover:text-black mt-0.5">Clear highlight</button>
          </div>
        )}
      </Popover>

      <Popover icon={<Type size={15} />} title="Font & size">
        {(close) => (
          <div className="flex flex-col gap-2.5 w-[150px]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Font</span>
              <div className="mt-1 flex flex-col gap-0.5">
                {FONTS.map((f) => (
                  <button key={f.label} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (f.value) { editor.chain().focus().setFontFamily(f.value).run(); } else { editor.chain().focus().unsetFontFamily().run(); } close(); }}
                    className="text-left text-sm px-2 py-1 rounded-lg hover:bg-[#f0f0f0]" style={{ fontFamily: f.value || "inherit" }}>{f.label}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">Size</span>
              <div className="mt-1 flex flex-col gap-0.5">
                {SIZES.map((s) => (
                  <button key={s.label} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (s.value) { editor.chain().focus().setFontSize(s.value).run(); } else { editor.chain().focus().unsetFontSize().run(); } close(); }}
                    className="text-left text-sm px-2 py-1 rounded-lg hover:bg-[#f0f0f0]">{s.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Popover>
      <Sep />

      <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolBtn>
      <ToolBtn title="To-do list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={15} /></ToolBtn>
      <Sep />
      <ToolBtn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolBtn>
      <ToolBtn title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={15} /></ToolBtn>
      <ToolBtn title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={15} /></ToolBtn>
      <Sep />
      <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolBtn>
      <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolBtn>
    </div>
  );
}

export function NoteEditor({ initialContent, onChange }: { initialContent: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder: "Start writing — type / for a heading, list, table…" }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: { class: "note-content focus:outline-none px-5 sm:px-7 py-5 min-h-[60vh]" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return <div className="px-5 py-8 text-sm text-[#888]">Loading editor…</div>;
  }

  return (
    <div className="flex flex-col">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
