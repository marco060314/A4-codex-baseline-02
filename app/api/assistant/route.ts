import { body, check, failure, json, session } from "@/lib/api";
import { answer } from "@/lib/openrouter";
import { retrieve, verifySources } from "@/lib/retrieval";
import type { Source } from "@/lib/types";
import { z } from "zod";
export const maxDuration = 60;
export async function POST(req: Request) {
  let finish: (() => Promise<void>) | undefined;
  try {
    const { db, profile } = await session();
    const input = z
      .object({
        id: z.uuid(),
        question: z.string().trim().min(1).max(2000),
        noteId: z.uuid().optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(4000),
            }),
          )
          .max(6)
          .default([]),
      })
      .parse(await body(req));
    if (!profile.ai_enabled) throw new Error("AI_DISABLED");
    const { error } = await db.rpc("reserve_ai", {
      p_id: input.id,
      p_daily: Number(process.env.AI_DAILY_LIMIT || 30),
      p_global: Number(process.env.AI_GLOBAL_DAILY_LIMIT || 1000),
    });
    check(error);
    let tokens = 0,
      model = "";
    finish = async () => {
      await db.rpc("finish_ai", {
        p_id: input.id,
        p_tokens: tokens,
        p_model: model,
      });
    };
    let sources: Source[];
    if (input.noteId) {
      const { data: n, error } = await db
        .from("notes")
        .select("*")
        .eq("id", input.noteId)
        .is("deleted_at", null)
        .eq("ai_excluded", false)
        .single();
      check(error);
      if (n.plain_text.length > 24000) throw new Error("TOO_LONG");
      sources = [
        {
          id: n.id,
          note_id: n.id,
          title: n.title,
          revision: n.revision,
          text: n.plain_text,
        },
      ];
    } else sources = await retrieve(db, input.question, req.signal);
    if (!sources.length || sources.every((s) => !s.text.trim()))
      return json({
        segments: [
          {
            text: "I couldn’t find enough information in your eligible notes to answer that. Try a more specific question, or wait for new notes to finish indexing.",
            sources: [],
          },
        ],
        sources: [],
      });
    const result = await answer(
      input.question,
      sources,
      input.history,
      req.signal,
    );
    tokens = result.tokens;
    model = result.model;
    await verifySources(db, sources, profile.privacy_epoch);
    return json({
      segments: result.segments,
      sources,
      notice: input.noteId
        ? undefined
        : "Based on relevant passages, not an exhaustive review of your notebook.",
    });
  } catch (e) {
    return failure(e);
  } finally {
    await finish?.();
  }
}
