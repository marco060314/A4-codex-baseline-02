"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Sparkles,
  Search,
  ArrowRight,
  Check,
  Leaf,
} from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <BookOpen size={21} strokeWidth={1.6} />
      </span>
      <span>
        commonplace<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function AuthScreen({
  configured,
  message,
}: {
  configured: boolean;
  message?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(message || "");
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setShowSetup(true);
      return;
    }
    setBusy(true);
    setStatus("");
    const db = browserSupabase();
    try {
      if (mode === "reset") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) throw error;
        setStatus("Check your email for a password reset link.");
      } else if (mode === "signup") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) location.assign("/");
        else setStatus("Check your email to confirm your account.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.assign("/");
      }
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <span className="header-note">
          A home for your thoughts <ArrowUpRight size={15} />
        </span>
      </header>
      <main className="landing-main">
        <section className="intro">
          <div className="eyebrow">
            <span className="tiny-dot" /> YOUR MIND, A LITTLE MORE ORGANIZED
          </div>
          <h1>
            A little space
            <br />
            for <em>everything.</em>
          </h1>
          <p className="intro-copy">
            The passing thought. The big idea. The thing you don’t want to
            forget. Keep it all together, and find a little clarity along the
            way.
          </p>
          <div className="intro-benefits">
            <div>
              <BookOpen size={18} />
              <span>Make room for your notes</span>
            </div>
            <div>
              <Search size={18} />
              <span>Find the thought you’re looking for</span>
            </div>
            <div>
              <Sparkles size={18} />
              <span>Connect the dots with your assistant</span>
            </div>
          </div>
          <div className="paper-preview" aria-hidden="true">
            <div className="paper-label">
              <span>FROM THE NOTEBOOK</span>
              <span>01 / ∞</span>
            </div>
            <h3>Good things start with a note.</h3>
            <p>
              Collect a little inspiration.
              <br />
              Follow an interesting thought.
              <br />
              See where it takes you.
            </p>
            <div className="paper-tags">
              <span>everyday ideas</span>
              <Leaf size={27} strokeWidth={1} />
            </div>
          </div>
        </section>
        <section className="auth-card">
          <div className="auth-icon">
            <Leaf size={26} strokeWidth={1.5} />
          </div>
          <h2>
            {mode === "signup"
              ? "Make yourself at home."
              : mode === "reset"
                ? "A fresh start."
                : "Welcome to your space."}
          </h2>
          <p>
            {mode === "signup"
              ? "A notebook for whatever’s on your mind."
              : mode === "reset"
                ? "We’ll send you a link to reset your password."
                : "A quiet place to think, collect, and connect."}
          </p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            {mode !== "reset" && (
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "signup"
                      ? "At least 8 characters"
                      : "Your password"
                  }
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 8 : 1}
                  required
                />
              </label>
            )}
            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? "One moment…"
                : mode === "signin"
                  ? "Open your notebook"
                  : mode === "signup"
                    ? "Create your notebook"
                    : "Send reset link"}
              <ArrowRight size={17} />
            </button>
          </form>
          {status && (
            <p role="status" className="form-message">
              {status}
            </p>
          )}
          <div className="auth-links">
            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setStatus("");
              }}
            >
              {mode === "signup"
                ? "Already have a notebook? Sign in"
                : "New here? Create an account"}
            </button>
            {mode === "signin" && (
              <button onClick={() => setMode("reset")}>Forgot password?</button>
            )}
            {mode === "reset" && (
              <button onClick={() => setMode("signin")}>Back to sign in</button>
            )}
          </div>
          <div className="auth-foot">
            <Check size={14} /> Your notes stay private. Always your space.
          </div>
          {!configured && (
            <div className="setup-note">
              <button onClick={() => setShowSetup(!showSetup)}>
                This installation needs connection setup{" "}
                <ArrowUpRight size={13} />
              </button>
              {showSetup && (
                <p>
                  Add the Supabase URL and publishable key to{" "}
                  <code>.env.local</code>, apply the database migration, then
                  restart. The README has the complete setup guide. No data has
                  been sent or saved.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
      <footer className="landing-footer">
        <span>A notebook. A companion. A little more clarity.</span>
        <span>MADE FOR YOUR EVERYDAY</span>
      </footer>
    </div>
  );
}
