import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Source } from "./types";
import { embed } from "./openrouter";
import { check } from "./api";
export async function retrieve(
  db: SupabaseClient,
  query: string,
  signal: AbortSignal,
) {
  const [vector] = await embed([query], signal);
  const { data, error } = await db.rpc("match_chunks", {
    p_embedding: JSON.stringify(vector),
    p_model: process.env.OPENROUTER_EMBEDDING_MODEL,
    p_query: query,
  });
  check(error);
  const { data: keywords, error: ke } = await db
    .from("notes")
    .select("id,title,revision,plain_text")
    .is("deleted_at", null)
    .eq("ai_excluded", false)
    .textSearch("search_vector", query, { type: "websearch", config: "simple" })
    .limit(8);
  check(ke);
  const sources: Source[] = (data || [])
    .filter((s: Source) => Number(s.score) > 0.2)
    .slice(0, 6);
  for (const n of keywords || []) {
    if (!sources.some((s) => s.note_id === n.id))
      sources.push({
        id: n.id,
        note_id: n.id,
        revision: n.revision,
        title: n.title,
        text: n.plain_text.slice(0, 1800),
      });
  }
  return sources.slice(0, 8);
}
export async function verifySources(
  db: SupabaseClient,
  sources: Source[],
  epoch: number,
) {
  const { data: p } = await db
    .from("profiles")
    .select("privacy_epoch,ai_enabled,state")
    .single();
  if (!p?.ai_enabled || p.state !== "active" || p.privacy_epoch !== epoch)
    throw new Error("STALE_SOURCES");
  if (!sources.length) return;
  const { data: notes, error } = await db
    .from("notes")
    .select("id,revision,ai_excluded,deleted_at")
    .in("id", [...new Set(sources.map((s) => s.note_id))]);
  check(error);
  if (
    sources.some(
      (s) =>
        !notes?.some(
          (n) =>
            n.id === s.note_id &&
            n.revision === s.revision &&
            !n.ai_excluded &&
            !n.deleted_at,
        ),
    )
  )
    throw new Error("STALE_SOURCES");
}
