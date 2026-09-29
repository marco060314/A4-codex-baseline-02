"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ListChecks,
  Heading2,
  Link2,
  Undo2,
  Redo2,
  Check,
  Loader2,
  Pin,
  Trash2,
  Sparkles,
  ArrowLeft,
  ShieldOff,
  Plus,
  X,
  Copy,
} from "lucide-react";
import { api, ApiError } from "@/lib/client";
import type { Doc, Note } from "@/lib/types";
export type EditorHandle = { flush: () => Promise<boolean> };
export const NoteEditor = forwardRef<
  EditorHandle,
  {
    note: Note;
    highlight?: string;
    onSave: (note: Note) => void;
    onTrash: () => void;
    onAsk: () => void;
    onBack: () => void;
    onRecovered: (note: Note) => void;
  }
>(function NoteEditor(
  { note, highlight, onSave, onTrash, onAsk, onBack, onRecovered },
  ref,
) {
  const [draft, setDraft] = useState(note);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [draft.title]);
  const draftRef = useRef(note);
  const savedRef = useRef(note);
  const dirty = useRef(false);
  const running = useRef<Promise<boolean> | null>(null);
  const [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [tag, setTag] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const change = useCallback((patch: Partial<Note>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
    dirty.current = true;
    setStatus("Unsaved");
    setError("");
  }, []);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, protocols: ["https", "http", "mailto"] },
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({
        placeholder: "Let a thought find its way here…",
      }),
    ],
    content: note.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Note content",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) =>
      change({
        content: editor.getJSON() as Doc,
        plain_text: editor.getText(),
      }),
  });
  useEffect(() => {
    if (!editor || !highlight) return;
    const needles = highlight
      .split(/\n/)
      .map((s) => s.trim().slice(0, 70))
      .filter((s) => s.length > 5);
    let selection: { from: number; to: number } | undefined;
    editor.state.doc.descendants((node, pos) => {
      if (selection || !node.isText) return;
      for (const needle of needles) {
        const at = (node.text || "").indexOf(needle);
        if (at >= 0) {
          selection = { from: pos + at, to: pos + at + needle.length };
          break;
        }
      }
    });
    if (selection)
      editor.chain().setTextSelection(selection).scrollIntoView().focus().run();
  }, [editor, highlight]);
  const flush = useCallback(async (): Promise<boolean> => {
    if (running.current) return running.current;
    if (conflict) return false;
    const work = async () => {
      while (dirty.current) {
        const sent = draftRef.current;
        dirty.current = false;
        setStatus("Saving…");
        try {
          const { note: saved } = await api<{ note: Note }>("/api/notes", {
            method: "POST",
            body: JSON.stringify({
              ...sent,
              revision: savedRef.current.revision,
            }),
          });
          savedRef.current = saved;
          onSave(saved);
          if (!dirty.current) {
            draftRef.current = saved;
            setDraft(saved);
          }
          setStatus(dirty.current ? "Unsaved" : "Saved");
        } catch (e) {
          dirty.current = true;
          setStatus("Not saved");
          setError(e instanceof Error ? e.message : "Could not save.");
          if (e instanceof ApiError && e.code === "CONFLICT") setConflict(true);
          return false;
        }
      }
      return true;
    };
    const promise = work();
    running.current = promise;
    try {
      return await promise;
    } finally {
      running.current = null;
    }
  }, [conflict, onSave]);
  useImperativeHandle(ref, () => ({ flush }), [flush]);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => void flush(), 750);
    return () => clearTimeout(timer);
  }, [draft, flush]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const online = () => {
      if (dirty.current) void flush();
    };
    window.addEventListener("beforeunload", before);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("online", online);
    };
  }, [flush]);
  async function recover() {
    try {
      const { note: n } = await api<{ note: Note }>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          ...draftRef.current,
          id: crypto.randomUUID(),
          revision: 0,
          title: `${draftRef.current.title || "Untitled"} (recovered)`,
        }),
      });
      dirty.current = false;
      onRecovered(n);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addTag() {
    const value = tag.trim();
    if (value && !draft.tags.includes(value) && draft.tags.length < 20) {
      change({ tags: [...draft.tags, value] });
      setTag("");
    }
  }
  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: editor?.isActive("bold"),
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: editor?.isActive("italic"),
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Heading",
      icon: Heading2,
      active: editor?.isActive("heading"),
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: editor?.isActive("bulletList"),
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: editor?.isActive("orderedList"),
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Checklist",
      icon: ListChecks,
      active: editor?.isActive("taskList"),
      run: () => editor?.chain().focus().toggleTaskList().run(),
    },
  ];
  return (
    <section className="editor-panel">
      <header className="editor-header">
        <button
          className="icon-button mobile-back"
          aria-label="Back to notes"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
        </button>
        <span className="breadcrumb">
          My notebook <span>/</span> <span>{draft.title || "Untitled"}</span>
        </span>
        <div className="editor-actions">
          <span className="save-state" role="status">
            {status === "Saving…" ? (
              <Loader2 size={13} className="spin" />
            ) : status === "Saved" ? (
              <Check size={13} />
            ) : (
              <span className="tiny-dot" />
            )}
            {status}
          </span>
          <button
            className={`icon-button ${draft.pinned ? "active" : ""}`}
            aria-label={draft.pinned ? "Unpin note" : "Pin note"}
            title="Pin note"
            onClick={() => change({ pinned: !draft.pinned })}
          >
            <Pin size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Move to trash"
            onClick={onTrash}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>
      <div className="editor-scroll">
        <div className="note-page">
          <div className="note-date">
            {new Date(draft.created_at).toLocaleDateString("en", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <textarea
            ref={titleRef}
            rows={1}
            className="note-title"
            aria-label="Note title"
            placeholder="Untitled"
            maxLength={240}
            value={draft.title}
            onChange={(e) =>
              change({ title: e.target.value.replace(/\n/g, " ") })
            }
          />
          <div className="note-tags">
            {draft.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
                <button
                  aria-label={`Remove tag ${t}`}
                  onClick={() =>
                    change({ tags: draft.tags.filter((x) => x !== t) })
                  }
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTag();
              }}
            >
              <Plus size={12} />
              <input
                aria-label="Add tag"
                placeholder="Add a tag"
                maxLength={40}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onBlur={addTag}
              />
            </form>
          </div>
          <div
            className="editor-toolbar"
            role="toolbar"
            aria-label="Text formatting"
          >
            {tools.map(({ label, icon: Icon, active, run }) => (
              <button
                key={label}
                className={`icon-button ${active ? "active" : ""}`}
                title={label}
                aria-label={label}
                aria-pressed={!!active}
                onClick={run}
              >
                <Icon size={16} />
              </button>
            ))}
            <span className="toolbar-divider" />
            <button
              className="icon-button"
              aria-label="Add link"
              onClick={() => {
                setLink(String(editor?.getAttributes("link").href || ""));
                setLinkOpen(!linkOpen);
              }}
            >
              <Link2 size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Undo"
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 size={16} />
            </button>
          </div>
          {linkOpen && (
            <form
              className="link-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^https?:\/\//i.test(link)) {
                  editor
                    ?.chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: link })
                    .run();
                  setLinkOpen(false);
                }
              }}
            >
              <input
                aria-label="Link URL"
                type="url"
                placeholder="https://…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                required
              />
              <button className="small-button">Apply link</button>
              <button
                type="button"
                className="small-button"
                onClick={() => {
                  editor?.chain().focus().unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                Remove
              </button>
            </form>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <p>{error}</p>
              {conflict ? (
                <button className="small-button" onClick={recover}>
                  <Copy size={13} /> Save as recovered copy
                </button>
              ) : (
                <button className="small-button" onClick={() => void flush()}>
                  Retry save
                </button>
              )}
            </div>
          )}
          <EditorContent editor={editor} />
          <div className="note-bottom">
            <span>
              {draft.plain_text.trim().split(/\s+/).filter(Boolean).length}{" "}
              words
            </span>
            <label className="exclude-toggle">
              <input
                type="checkbox"
                checked={draft.ai_excluded}
                onChange={(e) => change({ ai_excluded: e.target.checked })}
              />
              <ShieldOff size={13} /> Exclude from AI
            </label>
          </div>
          <button
            className="summary-card"
            onClick={onAsk}
            disabled={draft.ai_excluded}
          >
            <span className="sparkle-box">
              <Sparkles size={19} />
            </span>
            <span>
              <strong>A fresh perspective on your thoughts</strong>
              <small>Summarize this note or ask a question about it.</small>
            </span>
            <span>↗</span>
          </button>
        </div>
      </div>
    </section>
  );
});
