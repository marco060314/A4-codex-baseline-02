import { body, check, failure, json, session } from "@/lib/api";
import { z } from "zod";
export async function GET() {
  try {
    const { db, user, profile } = await session();
    const { count } = await db
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date().toISOString().slice(0, 10));
    const { data: health } = await db.rpc("index_health");
    return json({
      indexing: health?.[0] || { pending: 0, failed: 0 },
      profile,
      email: user.email,
      usage: count || 0,
      limit: Number(process.env.AI_DAILY_LIMIT || 30),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request) {
  try {
    const { db } = await session();
    const { enabled } = z
      .object({ enabled: z.boolean() })
      .parse(await body(req));
    const { error } = await db.rpc("set_ai", { p_enabled: enabled });
    check(error);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
