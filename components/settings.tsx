"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Sparkles,
  Download,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Profile } from "@/lib/types";
type ExportItem = {
  id: string;
  state: string;
  created_at: string;
  epoch: number;
};
export function Settings({
  profile,
  email,
  onClose,
  onProfile,
}: {
  profile: Profile;
  email: string;
  onClose: () => void;
  onProfile: (p: Profile) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [usage, setUsage] = useState({ usage: 0, limit: 30 });
  const [indexing, setIndexing] = useState({ pending: 0, failed: 0 });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, []);
  async function refresh() {
    try {
      const [e, u] = await Promise.all([
        api<{ exports: ExportItem[] }>("/api/exports"),
        api<{
          usage: number;
          limit: number;
          indexing: { pending: number; failed: number };
        }>("/api/profile"),
      ]);
      setExports(e.exports);
      setUsage(u);
      setIndexing(u.indexing);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ enabled: !profile.ai_enabled }),
      });
      const { profile: p } = await api<{ profile: Profile }>("/api/profile");
      onProfile(p);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportNotes() {
    setBusy(true);
    try {
      await api("/api/exports", { method: "POST", body: "{}" });
      setMessage(
        "Your export is queued. The download will appear here when ready.",
      );
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ password, confirm: confirmation }),
      });
      location.assign("/");
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      aria-labelledby="settings-title"
    >
      <header>
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2 id="settings-title">Your preferences</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close settings"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="settings-content">
        <section>
          <div className="settings-heading">
            <Sparkles size={18} />
            <h3>Your AI assistant</h3>
            <button
              className={`switch ${profile.ai_enabled ? "on" : ""}`}
              role="switch"
              aria-checked={profile.ai_enabled}
              aria-label="Enable AI assistant"
              disabled={busy}
              onClick={toggle}
            >
              <span />
            </button>
          </div>
          <p>
            When enabled, relevant notes and questions are sent through
            OpenRouter to an approved commercial AI provider for processing.
            Embeddings are stored privately with your notebook.
          </p>
          <p>
            Exclude any note from AI in its editor. Switching off removes
            embeddings and stops new AI requests. Requests already sent cannot
            be recalled.
          </p>
          {profile.ai_enabled &&
            (indexing.pending > 0 || indexing.failed > 0) && (
              <p role="status">
                {indexing.pending > 0
                  ? `${indexing.pending} notes are being indexed. Recent edits may not appear in meaning-based search yet. `
                  : ""}
                {indexing.failed > 0
                  ? `${indexing.failed} notes could not be indexed. Turn AI off and on to retry after checking service availability.`
                  : ""}
              </p>
            )}
          <div className="usage-row">
            <span>
              {usage.usage} of {usage.limit} daily requests used
            </span>
            <span>Resets at midnight UTC</span>
          </div>
        </section>
        <section>
          <div className="settings-heading">
            <Download size={18} />
            <h3>Take your thoughts with you</h3>
          </div>
          <p>
            Download your notes as Markdown and a complete JSON archive,
            including tags, formatting, and trash. Exports expire after 24 hours
            or when notes change.
          </p>
          <button className="secondary" disabled={busy} onClick={exportNotes}>
            Export notebook <Download size={14} />
          </button>
          <div className="export-list">
            {exports.map((e) => (
              <div key={e.id}>
                <span>{new Date(e.created_at).toLocaleString()}</span>
                {e.state === "ready" && e.epoch === profile.privacy_epoch ? (
                  <a href={`/api/exports?id=${e.id}`} className="source-link">
                    Download <ExternalLink size={12} />
                  </a>
                ) : (
                  <span>
                    {e.epoch !== profile.privacy_epoch
                      ? "Out of date"
                      : e.state === "failed"
                        ? "Export failed — request a new one"
                        : e.state}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="settings-heading">
            <ShieldCheck size={18} />
            <h3>A private notebook</h3>
          </div>
          <p>
            Signed in as <strong>{email}</strong>. Notes are private to your
            account and encrypted in transit and at rest by the hosting
            services. This is not end-to-end encryption; the server processes
            your notes.
          </p>
          <p>
            The assistant reads your notes; it cannot edit or delete them. No
            conversations are saved after you leave.
          </p>
        </section>
        <section>
          <div className="settings-heading">
            <Trash2 size={18} />
            <h3>Delete account</h3>
          </div>
          <p>
            Permanently delete your notebook and account. Access stops
            immediately; cleanup is processed in the background. This cannot be
            undone.
          </p>
          {!deleteOpen ? (
            <button className="text-danger" onClick={() => setDeleteOpen(true)}>
              Delete my account
            </button>
          ) : (
            <form
              className="delete-form"
              onSubmit={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              <label>
                Your password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label>
                Type DELETE to confirm
                <input
                  required
                  pattern="DELETE"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              <button className="danger" disabled={busy}>
                Permanently delete account
              </button>
            </form>
          )}
        </section>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
        {busy && (
          <span className="thinking">
            <Loader2 size={14} className="spin" /> Working…
          </span>
        )}
      </div>
    </dialog>
  );
}
