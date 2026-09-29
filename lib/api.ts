import "server-only";
import { supabase } from "./supabase/server";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function session() {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (error || profile?.state !== "active") throw new Error("UNAUTHORIZED");
  return { db, user, profile };
}
export async function body(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_URL || new URL(req.url).origin;
  if (origin && origin !== new URL(expected).origin)
    throw new Error("FORBIDDEN");
  const text = await req.text();
  if (text.length > 1100000) throw new Error("VALIDATION");
  return JSON.parse(text);
}
export function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export function failure(error: unknown) {
  const msg =
    error instanceof Error && error.name === "ZodError"
      ? "VALIDATION"
      : error instanceof Error
        ? error.message
        : "";
  const known: Record<string, [number, string]> = {
    UNAUTHORIZED: [401, "Please sign in again."],
    FORBIDDEN: [403, "This request is not allowed."],
    VALIDATION: [400, "Please check your input or shorten this note."],
    CONFLICT: [
      409,
      "This note changed in another tab. Your draft has been kept.",
    ],
    NOT_FOUND: [404, "This note is no longer available."],
    TRASHED: [409, "Restore this note before editing."],
    RATE_LIMIT: [
      429,
      "Your AI or export limit has been reached. Please try again later.",
    ],
    AI_DISABLED: [403, "Enable the assistant in Settings first."],
    SETUP_REQUIRED: [
      503,
      "Connected services are not configured yet. See the setup guide.",
    ],
    AI_UNAVAILABLE: [
      503,
      "The assistant is unavailable. Your notes are safe; please try again later.",
    ],
    STALE_SOURCES: [
      409,
      "Your notes changed while answering. Please ask again.",
    ],
    NOTE_LIMIT: [400, "Your notebook has reached its note limit."],
    TOO_LONG: [
      400,
      "This note is too long for one summary. Select a shorter note.",
    ],
    INVALID_CITATION: [
      502,
      "The answer could not be verified. Please try again.",
    ],
    DUPLICATE_REQUEST: [409, "This request has already been submitted."],
  };
  const key = Object.keys(known).find((k) => msg.includes(k));
  const [status, message] = key
    ? known[key]
    : [500, "Something went wrong. Please try again."];
  return json({ error: message, code: key || "INTERNAL" }, status);
}
