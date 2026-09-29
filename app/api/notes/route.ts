import { body, check, failure, json, session } from "@/lib/api";
import { noteInput, plainText, validateDoc } from "@/lib/document";
import { z } from "zod";
export async function GET(req: Request) {
  try {
    const { db } = await session();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const { data, error } = await db
        .from("notes")
        .select("*")
        .eq("id", id)
        .single();
      check(error);
      return json({ note: data });
    }
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    let q = db
      .from("notes")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .order("id")
      .range(offset, offset + 99);
    q =
      url.searchParams.get("trash") === "true"
        ? q.not("deleted_at", "is", null)
        : q.is("deleted_at", null);
    const search = url.searchParams.get("q");
    if (search)
      q = q.textSearch("search_vector", search, {
        type: "websearch",
        config: "simple",
      });
    const tag = url.searchParams.get("tag");
    if (tag) q = q.contains("tags", [tag]);
    const { data, error } = await q;
    check(error);
    return json({ notes: data, more: data?.length === 100 });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const { db } = await session();
    const input = noteInput.parse(await body(req));
    const content = validateDoc(input.content);
    if (content.type !== "doc") throw new Error("VALIDATION");
    const { data, error } = await db.rpc("save_note", {
      p_id: input.id,
      p_revision: input.revision,
      p_title: input.title,
      p_content: content,
      p_text: plainText(content),
      p_tags: [...new Set(input.tags)],
      p_pinned: input.pinned,
      p_excluded: input.ai_excluded,
    });
    check(error);
    return json({ note: data });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request) {
  try {
    const { db } = await session();
    const input = z
      .object({ id: z.uuid(), action: z.enum(["trash", "restore", "delete"]) })
      .parse(await body(req));
    const { error } = await db.rpc("note_action", {
      p_id: input.id,
      p_action: input.action,
    });
    check(error);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
