"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon,
  Type, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Code2, Table as TableIcon, Minus, ChevronDown, Check,
} from "lucide-react";

/* ─── Notion colour palette ─────────────────────────────────── */
const TEXT_COLORS = [
  { name: "Default", value: "" },
  { name: "Gray", value: "rgb(120,119,116)" },
  { name: "Brown", value: "rgb(159,107,83)" },
  { name: "Orange", value: "rgb(217,115,13)" },
  { name: "Yellow", value: "rgb(203,145,47)" },
  { name: "Green", value: "rgb(68,131,97)" },
  { name: "Blue", value: "rgb(51,126,169)" },
  { name: "Purple", value: "rgb(144,101,176)" },
  { name: "Pink", value: "rgb(193,76,138)" },
  { name: "Red", value: "rgb(212,76,71)" },
];
const HIGHLIGHTS = [
  { name: "Gray", value: "rgb(241,241,239)" },
  { name: "Brown", value: "rgb(244,238,238)" },
  { name: "Orange", value: "rgb(251,236,221)" },
  { name: "Yellow", value: "rgb(251,243,219)" },
  { name: "Green", value: "rgb(237,243,236)" },
  { name: "Blue", value: "rgb(231,243,248)" },
  { name: "Purple", value: "rgb(244,240,247)" },
  { name: "Pink", value: "rgb(249,238,243)" },
  { name: "Red", value: "rgb(253,235,236)" },
];

/* ─── Slash command items ───────────────────────────────────── */
type SlashItem = {
  title: string;
  sub: string;
  icon: React.ReactNode;
  keywords: string;
  run: (editor: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { title: "Text", sub: "Just start writing with plain text.", keywords: "text paragraph plain", icon: <Type size={22} />, run: (e) => e.chain().focus().setParagraph().run() },
  { title: "Heading 1", sub: "Big section heading.", keywords: "h1 heading title big", icon: <Heading1 size={22} />, run: (e) => e.chain().focus().setNode("heading", { level: 1 }).run() },
  { title: "Heading 2", sub: "Medium section heading.", keywords: "h2 heading subtitle", icon: <Heading2 size={22} />, run: (e) => e.chain().focus().setNode("heading", { level: 2 }).run() },
  { title: "Heading 3", sub: "Small section heading.", keywords: "h3 heading", icon: <Heading3 size={22} />, run: (e) => e.chain().focus().setNode("heading", { level: 3 }).run() },
  { title: "To-do list", sub: "Track tasks with a checklist.", keywords: "todo task checkbox check", icon: <ListChecks size={22} />, run: (e) => e.chain().focus().toggleTaskList().run() },
  { title: "Bulleted list", sub: "Create a simple bulleted list.", keywords: "bullet unordered list ul point", icon: <List size={22} />, run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "Numbered list", sub: "Create a list with numbering.", keywords: "number ordered list ol", icon: <ListOrdered size={22} />, run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "Quote", sub: "Capture a quote.", keywords: "quote blockquote", icon: <Quote size={22} />, run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: "Code", sub: "Capture a code snippet.", keywords: "code snippet pre", icon: <Code2 size={22} />, run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: "Table", sub: "Add a simple table.", keywords: "table grid", icon: <TableIcon size={22} />, run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: "Divider", sub: "Visually divide blocks.", keywords: "divider separator hr line rule", icon: <Minus size={22} />, run: (e) => e.chain().focus().setHorizontalRule().run() },
];

/* ════════════════════════════════════════════════════════════
   Bubble menu (selection toolbar)
   ════════════════════════════════════════════════════════════ */
function BubbleBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`notion-bubble-btn ${active ? "is-active" : ""}`}>
      {children}
    </button>
  );
}

function ColorMenu({ editor, close }: { editor: Editor; close: () => void }) {
  return (
    <div className="notion-slash" style={{ width: 200, maxHeight: 300 }} onMouseDown={(e) => e.preventDefault()}>
      <div className="notion-slash-label">Text color</div>
      {TEXT_COLORS.map((c) => (
        <button key={c.name} type="button" className="notion-slash-item"
          onClick={() => { if (c.value) editor.chain().focus().setColor(c.value).run(); else editor.chain().focus().unsetColor().run(); close(); }}>
          <span className="notion-slash-ico" style={{ width: 24, height: 24, fontWeight: 700, color: c.value || "var(--notion-text)" }}>A</span>
          <span className="notion-slash-title">{c.name}</span>
        </button>
      ))}
      <div className="notion-slash-label">Background</div>
      {HIGHLIGHTS.map((c) => (
        <button key={c.name} type="button" className="notion-slash-item"
          onClick={() => { editor.chain().focus().toggleHighlight({ color: c.value }).run(); close(); }}>
          <span className="notion-slash-ico" style={{ width: 24, height: 24, fontWeight: 700, background: c.value }}>A</span>
          <span className="notion-slash-title">{c.name} background</span>
        </button>
      ))}
    </div>
  );
}

function LinkInput({ editor, close }: { editor: Editor; close: () => void }) {
  const [val, setVal] = useState<string>(() => (editor.getAttributes("link").href as string) || "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const apply = () => {
    const href = val.trim();
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: href.match(/^https?:\/\//) ? href : `https://${href}` }).run();
    close();
  };
  return (
    <div className="notion-bubble" style={{ padding: 6 }} onMouseDown={(e) => e.preventDefault()}>
      <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } if (e.key === "Escape") close(); }}
        placeholder="Paste link…"
        className="bg-transparent text-white text-[13px] px-2 py-1 outline-none border-none w-[180px] placeholder:text-white/40" />
      <button type="button" onClick={apply} className="notion-bubble-btn"><Check size={15} /></button>
    </div>
  );
}

function SelectionToolbar({ editor }: { editor: Editor }) {
  const [panel, setPanel] = useState<"none" | "color" | "link">("none");
  // Close any open panel whenever the selection changes.
  useEffect(() => {
    const reset = () => setPanel("none");
    editor.on("selectionUpdate", reset);
    return () => { editor.off("selectionUpdate", reset); };
  }, [editor]);

  if (panel === "color") return <ColorMenu editor={editor} close={() => setPanel("none")} />;
  if (panel === "link") return <LinkInput editor={editor} close={() => setPanel("none")} />;

  return (
    <div className="notion-bubble">
      <BubbleBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></BubbleBtn>
      <BubbleBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></BubbleBtn>
      <BubbleBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={15} /></BubbleBtn>
      <BubbleBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></BubbleBtn>
      <BubbleBtn title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={15} /></BubbleBtn>
      <BubbleBtn title="Link" active={editor.isActive("link")} onClick={() => setPanel("link")}><LinkIcon size={15} /></BubbleBtn>
      <span className="notion-bubble-sep" />
      <BubbleBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></BubbleBtn>
      <BubbleBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></BubbleBtn>
      <BubbleBtn title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></BubbleBtn>
      <BubbleBtn title="To-do" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={15} /></BubbleBtn>
      <BubbleBtn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></BubbleBtn>
      <span className="notion-bubble-sep" />
      <button type="button" title="Color" onMouseDown={(e) => e.preventDefault()} onClick={() => setPanel("color")}
        className="notion-bubble-btn">
        <span style={{ fontWeight: 700 }}>A</span><ChevronDown size={12} />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Slash command menu
   ════════════════════════════════════════════════════════════ */
function SlashMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const fromRef = useRef(0); // doc position of the "/" character

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_ITEMS;
    return SLASH_ITEMS.filter((i) => (i.title + " " + i.keywords).toLowerCase().includes(q));
  }, [query]);

  const close = useCallback(() => { setOpen(false); setQuery(""); setActive(0); }, []);

  const runItem = useCallback((item: SlashItem) => {
    const to = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: fromRef.current, to }).run();
    item.run(editor);
    close();
  }, [editor, close]);

  // Detect "/" trigger on every change.
  useEffect(() => {
    const detect = () => {
      const { state } = editor;
      const { selection } = state;
      const { $from, empty } = selection;
      if (!empty || $from.parent.type.name === "codeBlock") { setOpen(false); return; }
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
      const match = /(^|\s)\/([\w]*)$/.exec(textBefore);
      if (!match) { setOpen(false); return; }
      const slashLen = match[2].length + 1; // "/" + query
      fromRef.current = $from.pos - slashLen;
      setQuery(match[2]);
      setActive(0);
      try {
        const c = editor.view.coordsAtPos($from.pos);
        setCoords({ top: c.bottom + 6, left: c.left });
      } catch { /* ignore */ }
      setOpen(true);
    };
    editor.on("update", detect);
    editor.on("selectionUpdate", detect);
    return () => { editor.off("update", detect); editor.off("selectionUpdate", detect); };
  }, [editor]);

  // Keyboard navigation while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (items.length ? (i + 1) % items.length : 0)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0)); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[active]) runItem(items[active]); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, items, active, runItem, close]);

  if (!open) return null;

  return (
    <div className="notion-slash" style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 60 }}>
      {items.length === 0 ? (
        <div className="notion-slash-label" style={{ padding: "10px 8px" }}>No results</div>
      ) : (
        <>
          <div className="notion-slash-label">Basic blocks</div>
          {items.map((item, i) => (
            <button key={item.title} type="button"
              className={`notion-slash-item ${i === active ? "is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); runItem(item); }}>
              <span className="notion-slash-ico">{item.icon}</span>
              <span>
                <span className="notion-slash-title">{item.title}</span>
                <span className="notion-slash-sub">{item.sub}</span>
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Editor
   ════════════════════════════════════════════════════════════ */
export function NoteEditor({ initialContent, onChange }: { initialContent: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({
        showOnlyCurrent: true,
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return `Heading ${node.attrs.level}`;
          return "Write something, or press '/' for commands…";
        },
      }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: { class: "note-content" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return <div className="px-2 py-8 text-sm" style={{ color: "var(--notion-text-light)" }}>Loading editor…</div>;
  }

  return (
    <div className="notion-page">
      <BubbleMenu editor={editor} options={{ placement: "top" }}>
        <SelectionToolbar editor={editor} />
      </BubbleMenu>
      <SlashMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
