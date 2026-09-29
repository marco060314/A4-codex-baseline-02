"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Sparkles,
  Pin,
  Trash2,
  Settings as SettingsIcon,
  LogOut,
  ChevronDown,
  ArrowUpRight,
  Leaf,
  FileText,
  Hash,
  Menu,
  ArrowLeft,
  RotateCcw,
  X,
  Loader2,
} from "lucide-react";
import { Brand } from "./auth-screen";
import { NoteEditor, type EditorHandle } from "./editor";
import { Assistant } from "./assistant";
import { Settings } from "./settings";
import { api } from "@/lib/client";
import { browserSupabase } from "@/lib/supabase/browser";
import { EMPTY_DOC, type Note, type Profile, type Source } from "@/lib/types";
export function Notebook({
  email,
  initialProfile,
}: {
  email: string;
  initialProfile: Profile;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [highlight, setHighlight] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [view, setView] = useState<"all" | "pinned" | "trash">("all");
  const [assistant, setAssistant] = useState(false);
  const [scope, setScope] = useState<"note" | "all">("note");
  const [settings, setSettings] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [semantic, setSemantic] = useState(false);
  const [mobileEditor, setMobileEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [offline, setOffline] = useState(false);
  const editor = useRef<EditorHandle>(null);
  const generation = useRef(0);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const flush = useCallback(
    async () => (await editor.current?.flush()) ?? true,
    [],
  );
  const load = useCallback(
    async (append = false) => {
      const request = ++generation.current;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          trash: String(view === "trash"),
          q: query,
          tag,
          offset: String(append ? notes.length : 0),
        });
        const data = await api<{ notes: Note[]; more: boolean }>(
          `/api/notes?${params}`,
        );
        if (request !== generation.current) return;
        setNotes((n) => (append ? [...n, ...data.notes] : data.notes));
        setMore(data.more);
        setSemantic(false);
      } catch (e) {
        if (request === generation.current) setError((e as Error).message);
      } finally {
        if (request === generation.current) setLoading(false);
      }
    },
    [view, query, tag, notes.length],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 250 : 0);
    return () =>
      clearTimeout(timer); /* load depends on count only for pagination */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, query, tag]);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    const focus = async () => {
      setAssistant(false);
      try {
        const { profile: p } = await api<{ profile: Profile }>("/api/profile");
        setProfile(p);
      } catch {}
    };
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    if (deleteTarget) deleteDialog.current?.showModal();
  }, [deleteTarget]);
  const onSave = useCallback((n: Note) => {
    setNotes((list) => list.map((old) => (old.id === n.id ? n : old)));
    setSelected((old) => (old?.id === n.id ? n : old));
  }, []);
  async function choose(n: Note) {
    if (!(await flush())) return;
    setSelected(n);
    setMobileEditor(true);
    setAssistant(false);
    setSidebar(false);
  }
  async function navigate(v: typeof view) {
    if (!(await flush())) return;
    setView(v);
    setSelected(null);
    setQuery("");
    setTag("");
    setSidebar(false);
    setMobileEditor(false);
    setAssistant(false);
  }
  async function create() {
    if (!(await flush())) return;
    setError("");
    try {
      const { note } = await api<{ note: Note }>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          revision: 0,
          title: "",
          content: EMPTY_DOC,
          tags: [],
          pinned: false,
          ai_excluded: false,
        }),
      });
      setView("all");
      setQuery("");
      setTag("");
      setNotes((ns) => [note, ...ns]);
      setSelected(note);
      setMobileEditor(true);
      setSidebar(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function action(n: Note, action: "trash" | "restore" | "delete") {
    if (!(await flush())) return;
    try {
      await api("/api/notes", {
        method: "PATCH",
        body: JSON.stringify({ id: n.id, action }),
      });
      if (selected?.id === n.id) setSelected(null);
      setMobileEditor(false);
      setAssistant(false);
      setDeleteTarget(null);
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function source(source: Source) {
    if (!(await flush())) return;
    try {
      const { note } = await api<{ note: Note }>(
        `/api/notes?id=${source.note_id}`,
      );
      if (note.revision !== source.revision)
        throw new Error(
          "This source has changed. Ask again for an up-to-date answer.",
        );
      setSelected(note);
      setHighlight(source.text);
      setMobileEditor(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function meaning() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<{ notes: Note[] }>("/api/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      setNotes(data.notes);
      setSemantic(true);
      setMore(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const visible = notes.filter((n) => view !== "pinned" || n.pinned);
  const tags = [...new Set(notes.flatMap((n) => n.tags))].sort();
  return (
    <div
      className={`workspace ${mobileEditor ? "show-editor" : ""} ${assistant ? "with-assistant" : ""}`}
    >
      <a className="skip-link" href="#note-list">
        Skip to notes
      </a>
      {sidebar && (
        <button
          className="sidebar-shade"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <Brand />
        <button className="new-note primary" onClick={create}>
          <Plus size={17} /> New note <span aria-hidden="true">＋</span>
        </button>
        <div className="nav-section-label">YOUR SPACE</div>
        <nav>
          <button
            className={view === "all" ? "selected" : ""}
            onClick={() => void navigate("all")}
          >
            <BookOpen size={17} /> All notes
          </button>
          <button
            className={view === "pinned" ? "selected" : ""}
            onClick={() => void navigate("pinned")}
          >
            <Pin size={17} /> Pinned notes
          </button>
          <button
            onClick={async () => {
              if (await flush()) {
                setScope("all");
                setAssistant(true);
                setSidebar(false);
              }
            }}
          >
            <Sparkles size={17} /> Ask your notes{" "}
            <span className="nav-new">AI</span>
          </button>
        </nav>
        <div className="nav-section-label tag-heading">
          TAGS <Hash size={12} />
        </div>
        <div className="sidebar-tags">
          {tags.length ? (
            tags.map((t) => (
              <button
                className={tag === t ? "selected" : ""}
                key={t}
                onClick={() => {
                  setTag(tag === t ? "" : t);
                  setSidebar(false);
                }}
              >
                <span className="tag-dot" />
                {t}
              </button>
            ))
          ) : (
            <p>
              Add tags to your notes
              <br />
              to make a little order.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-message">
            <Leaf size={22} strokeWidth={1.2} />
            <p>
              A thought worth keeping
              <br />
              starts right here.
            </p>
          </div>
          <button
            className={view === "trash" ? "selected" : ""}
            onClick={() => void navigate("trash")}
          >
            <Trash2 size={16} /> Trash
          </button>
          <button
            onClick={async () => {
              if (await flush()) setSettings(true);
            }}
          >
            <SettingsIcon size={16} /> Settings
          </button>
          <div className="account">
            <span className="avatar">{email.charAt(0).toUpperCase()}</span>
            <div>
              <strong>My notebook</strong>
              <small title={email}>{email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                if (await flush()) {
                  await browserSupabase().auth.signOut();
                  location.assign("/");
                }
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="notebook-main">
        <header className="notebook-top">
          <div>
            <button
              className="icon-button menu-button"
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span className="top-label">A LITTLE SPACE FOR YOUR THOUGHTS</span>
          </div>
          <button
            className={`assistant-toggle ${assistant ? "active" : ""}`}
            onClick={async () => {
              if (await flush()) {
                setScope(selected ? "note" : "all");
                setAssistant(!assistant);
              }
            }}
          >
            <Sparkles size={15} /> Ask your notes <span>↗</span>
          </button>
        </header>
        {offline && (
          <div className="offline-banner" role="status">
            You’re offline. Keep this tab open to preserve unsaved changes.
          </div>
        )}
        {error && (
          <div className="global-error" role="alert">
            {error}
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="notebook-body">
          <section className="notes-column" id="note-list">
            <header className="notes-heading">
              <div>
                <span className="eyebrow">YOUR PERSONAL COLLECTION</span>
                <h1>
                  {view === "trash"
                    ? "Trash"
                    : view === "pinned"
                      ? "Pinned notes"
                      : tag
                        ? tag
                        : "All notes"}
                  <span>
                    {visible.length}
                    {more ? "+" : ""}
                  </span>
                </h1>
              </div>
              <button
                className="icon-button add-note"
                aria-label="Create note"
                onClick={create}
              >
                <Plus size={21} />
              </button>
            </header>
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="Search notes"
                placeholder="Find a thought…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={13} />
                </button>
              )}
            </div>
            {query && view !== "trash" && (
              <button
                className="meaning-search"
                disabled={loading}
                onClick={meaning}
              >
                <Sparkles size={12} />
                {semantic
                  ? "Showing meaning-based matches"
                  : "Search by meaning"}
                <ArrowUpRight size={12} />
              </button>
            )}
            <div className="list-label">
              <span>
                {view === "trash"
                  ? "DELETED NOTES"
                  : query
                    ? "SEARCH RESULTS"
                    : "RECENT NOTES"}
              </span>
              <span>
                Last edited <ChevronDown size={12} />
              </span>
            </div>
            <div className="notes-list">
              {loading && !visible.length ? (
                <div className="list-empty">
                  <Loader2 className="spin" size={20} />
                  <p>Opening your notebook…</p>
                </div>
              ) : !visible.length ? (
                <div className="list-empty">
                  <BookOpen size={28} strokeWidth={1} />
                  <h3>
                    {query
                      ? "No matching notes"
                      : view === "trash"
                        ? "Nothing in the trash"
                        : "A fresh page awaits"}
                  </h3>
                  <p>
                    {query
                      ? "Try another word, or search by meaning."
                      : view === "trash"
                        ? "Deleted notes will stay here for 30 days."
                        : "Start with a thought, a plan, or just a few words."}
                  </p>
                  {view === "all" && !query && (
                    <button className="text-button" onClick={create}>
                      Write your first note <Plus size={13} />
                    </button>
                  )}
                </div>
              ) : (
                visible.map((n) => (
                  <button
                    className={`note-card ${selected?.id === n.id ? "selected" : ""}`}
                    key={n.id}
                    onClick={() => void choose(n)}
                  >
                    <div className="note-card-top">
                      <span>
                        <FileText size={12} />
                        {new Date(n.updated_at).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {n.pinned && <Pin size={12} />}
                    </div>
                    <h3>{n.title || "Untitled"}</h3>
                    <p>
                      {n.plain_text.trim() ||
                        "An open space for your next thought."}
                    </p>
                    {n.tags.length > 0 && (
                      <div className="card-tags">
                        {n.tags.slice(0, 2).map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                        {n.tags.length > 2 && <span>+{n.tags.length - 2}</span>}
                      </div>
                    )}
                  </button>
                ))
              )}
              {more && (
                <button
                  className="load-more"
                  disabled={loading}
                  onClick={() => void load(true)}
                >
                  {loading ? "Loading…" : "Load more notes"}
                </button>
              )}
            </div>
            <footer className="notes-footer">
              <span className="tiny-dot" /> YOUR NOTES, ALL TOGETHER
            </footer>
          </section>
          {selected ? (
            selected.deleted_at ? (
              <section className="trash-preview">
                <button
                  className="text-button"
                  onClick={() => setMobileEditor(false)}
                >
                  <ArrowLeft size={16} /> Back to notes
                </button>
                <Trash2 size={32} strokeWidth={1} />
                <h2>{selected.title || "Untitled"}</h2>
                <p className="trash-text">{selected.plain_text}</p>
                <p>
                  This note is in the trash and isn’t available to your
                  assistant.
                </p>
                <div>
                  <button
                    className="primary"
                    onClick={() => void action(selected, "restore")}
                  >
                    <RotateCcw size={15} /> Restore note
                  </button>
                  <button
                    className="text-danger"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    Delete forever
                  </button>
                </div>
              </section>
            ) : (
              <NoteEditor
                key={selected.id}
                ref={editor}
                note={selected}
                highlight={highlight}
                onSave={onSave}
                onTrash={() => void action(selected, "trash")}
                onAsk={async () => {
                  if (await flush()) {
                    setScope("note");
                    setAssistant(true);
                  }
                }}
                onBack={async () => {
                  if (await flush()) setMobileEditor(false);
                }}
                onRecovered={(n) => {
                  setNotes((ns) => [n, ...ns]);
                  setSelected(n);
                }}
              />
            )
          ) : (
            <section className="blank-editor">
              <div className="blank-art">
                <div className="mini-paper">
                  <span />
                  <span />
                  <span />
                  <Leaf size={35} strokeWidth={1} />
                </div>
                <span className="art-star">✳</span>
              </div>
              <span className="eyebrow">
                A NOTEBOOK, AND A LITTLE POSSIBILITY
              </span>
              <h2>
                Make room for
                <br />
                <em>what’s on your mind.</em>
              </h2>
              <p>
                Your ideas don’t have to be polished.
                <br />
                They just need a place to begin.
              </p>
              <button className="primary" onClick={create}>
                <Plus size={16} /> Write a note
              </button>
              <div className="blank-bottom">
                <span>CAPTURE A THOUGHT</span>
                <span>FOLLOW AN IDEA</span>
                <span>FIND A CONNECTION</span>
              </div>
            </section>
          )}
          {assistant && (
            <Assistant
              key={`${scope}-${scope === "note" ? selected?.id || "none" : "all"}-${profile.privacy_epoch}`}
              note={selected}
              enabled={profile.ai_enabled}
              initialScope={scope}
              flush={flush}
              onClose={() => setAssistant(false)}
              onSettings={() => setSettings(true)}
              onSource={(id) => void source(id)}
            />
          )}
        </div>
      </main>
      {settings && (
        <Settings
          profile={profile}
          email={email}
          onClose={() => setSettings(false)}
          onProfile={(p) => {
            setProfile(p);
            setAssistant(false);
          }}
        />
      )}
      {deleteTarget && (
        <dialog
          ref={deleteDialog}
          className="confirm-dialog"
          onCancel={() => setDeleteTarget(null)}
        >
          <h2>Delete this note forever?</h2>
          <p>
            “{deleteTarget.title || "Untitled"}” will be permanently removed.
            This cannot be undone.
          </p>
          <div>
            <button className="secondary" onClick={() => setDeleteTarget(null)}>
              Keep in trash
            </button>
            <button
              className="danger"
              onClick={() => void action(deleteTarget, "delete")}
            >
              Delete forever
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
