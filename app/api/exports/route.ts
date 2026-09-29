import { body, check, failure, json, session } from "@/lib/api";
import { admin } from "@/lib/supabase/server";
export async function GET(req: Request) {
  try {
    const { db, profile } = await session();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      const { data, error } = await db
        .from("exports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      check(error);
      return json({ exports: data });
    }
    const { data: item, error } = await db
      .from("exports")
      .select("*")
      .eq("id", id)
      .single();
    check(error);
    if (
      item.state !== "ready" ||
      item.epoch !== profile.privacy_epoch ||
      Date.parse(item.expires_at) < Date.now()
    )
      throw new Error("NOT_FOUND");
    const { data, error: e } = await admin()
      .storage.from("exports")
      .download(item.path);
    check(e);
    const { data: latest } = await db
      .from("profiles")
      .select("state,privacy_epoch")
      .single();
    if (latest?.state !== "active" || latest.privacy_epoch !== item.epoch)
      throw new Error("NOT_FOUND");
    return new Response(data, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="commonplace-notes.zip"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await body(req);
    const { db } = await session();
    const { data, error } = await db.rpc("request_export");
    check(error);
    return json({ id: data });
  } catch (e) {
    return failure(e);
  }
}
