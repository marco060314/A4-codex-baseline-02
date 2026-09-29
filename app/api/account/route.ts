import { body, check, failure, json, session } from "@/lib/api";
import { z } from "zod";
import { admin } from "@/lib/supabase/server";
export async function DELETE(req: Request) {
  try {
    const { db, user } = await session();
    const { password, confirm } = z
      .object({ password: z.string().min(1), confirm: z.literal("DELETE") })
      .parse(await body(req));
    if (confirm !== "DELETE" || !user.email) throw new Error("VALIDATION");
    const { error: authError } = await db.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (authError) throw new Error("UNAUTHORIZED");
    const { error } = await admin().rpc("begin_account_delete", {
      p_user: user.id,
    });
    check(error);
    await db.auth.signOut({ scope: "global" });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
