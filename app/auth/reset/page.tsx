"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";
export default function Reset() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  return (
    <main className="reset-page">
      <h1>Choose a new password</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await browserSupabase().auth.updateUser({
            password,
          });
          if (error) setMessage(error.message);
          else location.assign("/");
        }}
      >
        <label>
          New password
          <input
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="primary">Update password</button>
      </form>
      <p role="status">{message}</p>
      <a href="/">Back to notebook</a>
    </main>
  );
}
