"use client";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  ArrowUp,
  FileText,
  BookOpen,
  ArrowUpRight,
  Loader2,
  Square,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Answer, Note, Source } from "@/lib/types";
export function Assistant({
  note,
  enabled,
  onClose,
  onSettings,
  onSource,
  flush,
  initialScope = "note",
}: {
  note: Note | null;
  enabled: boolean;
  onClose: () => void;
  onSettings: () => void;
  onSource: (source: Source) => void;
  flush: () => Promise<boolean>;
  initialScope?: "note" | "all";
}) {
  const [scope, setScope] = useState<"note" | "all">(
    note ? initialScope : "all",
  );
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    { question: string; answer: Answer }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function ask(text = question) {
    if (!text.trim() || busy) return;
    if (!(await flush())) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const history = messages.slice(-3).flatMap((m) => [
        { role: "user", content: m.question },
        {
          role: "assistant",
          content: m.answer.segments
            .map((s) => s.text)
            .join("\n")
            .slice(0, 4000),
        },
      ]);
      const answer = await api<Answer>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          question: text,
          noteId: scope === "note" ? note?.id : undefined,
          history,
        }),
        signal: controller.signal,
      });
      setMessages((m) => [...m, { question: text, answer }]);
      setQuestion("");
    } catch (e) {
      setError(
        controller.signal.aborted ? "Request cancelled." : (e as Error).message,
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  return (
    <aside className="assistant-panel" aria-label="Notebook assistant">
      <header>
        <div>
          <span className="assistant-glyph">
            <Sparkles size={18} />
          </span>
          <strong>Your assistant</strong>
        </div>
        <button
          className="icon-button"
          aria-label="Close assistant"
          onClick={() => {
            abort.current?.abort();
            onClose();
          }}
        >
          <X size={18} />
        </button>
      </header>
      <div className="scope-picker">
        <button
          disabled={!note || busy}
          className={scope === "note" ? "selected" : ""}
          onClick={() => {
            setScope("note");
            setMessages([]);
          }}
        >
          <FileText size={13} /> This note
        </button>
        <button
          disabled={busy}
          className={scope === "all" ? "selected" : ""}
          onClick={() => {
            setScope("all");
            setMessages([]);
          }}
        >
          <BookOpen size={13} /> My notes
        </button>
      </div>
      <div className="assistant-scroll">
        {!enabled ? (
          <div className="assistant-welcome">
            <div className="assistant-flower">✳</div>
            <h2>
              A little help,
              <br />
              when you need it.
            </h2>
            <p>
              Find connections, make sense of your notes, and pick up where you
              left off.
            </p>
            <div className="privacy-card">
              <strong>Your words, your choice.</strong>
              <p>
                When enabled, relevant note text and your questions are sent
                through OpenRouter to an approved AI provider. You can exclude
                individual notes anytime.
              </p>
              <button className="primary" onClick={onSettings}>
                Choose in Settings <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="assistant-welcome">
            <div className="assistant-flower">✳</div>
            <div className="eyebrow">A SECOND PAIR OF EYES</div>
            <h2>
              What’s on
              <br />
              your mind?
            </h2>
            <p>Let’s turn your saved thoughts into a little more clarity.</p>
            <div className="suggestions">
              {(scope === "note"
                ? [
                    "Summarize this note",
                    "What are the key takeaways?",
                    "Are there any action items?",
                  ]
                : [
                    "What ideas have I been exploring?",
                    "Find connections across my notes",
                    "What should I follow up on?",
                  ]
              ).map((q) => (
                <button key={q} onClick={() => void ask(q)}>
                  {q}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div className="exchange" key={i}>
              <div className="question-bubble">{m.question}</div>
              <div className="answer-label">
                <Sparkles size={13} /> COMMONPLACE
              </div>
              {m.answer.segments.map((s, j) => (
                <div className="answer-segment" key={j}>
                  <p>{s.text}</p>
                  {s.sources.map((id) => {
                    const source = m.answer.sources.find((s) => s.id === id);
                    return source ? (
                      <button
                        className="source-link"
                        key={id}
                        onClick={() => onSource(source)}
                        title={source.text}
                      >
                        <FileText size={11} />
                        {source.title || "Untitled"}
                        <ArrowUpRight size={11} />
                      </button>
                    ) : null;
                  })}
                </div>
              ))}
              {m.answer.notice && (
                <p className="answer-notice">{m.answer.notice}</p>
              )}
            </div>
          ))
        )}
        {busy && (
          <div className="thinking" role="status">
            <Loader2 size={16} className="spin" /> Reading your notes…
          </div>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="assistant-compose">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <textarea
            aria-label="Ask your notes"
            placeholder="Ask a question about your notes…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
            disabled={!enabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
          />
          {busy ? (
            <button
              type="button"
              aria-label="Cancel request"
              onClick={() => abort.current?.abort()}
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              aria-label="Send question"
              disabled={!enabled || !question.trim()}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </form>
        <p>Grounded in your notes. Always check the sources.</p>
      </div>
    </aside>
  );
}
