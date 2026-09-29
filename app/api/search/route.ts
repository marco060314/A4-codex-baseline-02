import { body, check, failure, json, session } from "@/lib/api";
import { retrieve, verifySources } from "@/lib/retrieval";
import { z } from "zod";
export async function POST(req: Request) {
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const { db, profile } = await session();
    const { query } = z
      .object({ query: z.string().trim().min(1).max(2000) })
      .parse(await body(req));
    if (!profile.ai_enabled) throw new Error("AI_DISABLED");
    const id = crypto.randomUUID();
    const { error } = await db.rpc("reserve_ai", {
      p_id: id,
      p_daily: Number(process.env.AI_DAILY_LIMIT || 30),
      p_global: Number(process.env.AI_GLOBAL_DAILY_LIMIT || 1000),
    });
    check(error);
    cleanup = async () => {
      await db.rpc("finish_ai", {
        p_id: id,
        p_tokens: 0,
        p_model: process.env.OPENROUTER_EMBEDDING_MODEL || "",
      });
    };
    const sources = await retrieve(db, query, req.signal);
    await verifySources(db, sources, profile.privacy_epoch);
    const ids = [...new Set(sources.map((s) => s.note_id))];
    if (!ids.length) return json({ notes: [] });
    const { data, error: e } = await db.from("notes").select("*").in("id", ids);
    check(e);
    return json({
      notes: ids.map((id) => data?.find((n) => n.id === id)).filter(Boolean),
    });
  } catch (e) {
    return failure(e);
  } finally {
    await cleanup?.();
  }
}
