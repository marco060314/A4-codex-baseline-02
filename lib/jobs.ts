import "server-only";
import { admin } from "./supabase/server";
import { check } from "./api";
import { chunkText, markdown } from "./document";
import { embed } from "./openrouter";
import { zipSync, strToU8 } from "fflate";
import type { Note } from "./types";
type Job = {
  id: string;
  user_id: string;
  note_id: string;
  revision: number;
  kind: string;
  lease_token: string;
  attempts: number;
};
export async function runJobs() {
  const db = admin();
  const deadline = Date.now() + 47000;
  check((await db.rpc("reconcile_jobs")).error);
  // Expire artifacts independently of database retention. A private object never becomes public.
  const { data: expired } = await db
    .from("exports")
    .select("*")
    .or(`expires_at.lt.${new Date().toISOString()},state.eq.expired`)
    .limit(30);
  for (const item of expired || []) {
    if (item.path) {
      const { error } = await db.storage.from("exports").remove([item.path]);
      check(error);
    }
    await db.from("exports").delete().eq("id", item.id);
  }
  const { data: old } = await db
    .from("notes")
    .select("id,user_id")
    .lt("deleted_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .limit(50);
  for (const n of old || []) {
    await db
      .from("exports")
      .update({ state: "expired" })
      .eq("user_id", n.user_id);
    await db.from("notes").delete().eq("id", n.id);
  }
  const { data: jobs, error } = await db.rpc("claim_jobs");
  check(error);
  let completed = 0;
  for (const job of (jobs || []) as Job[]) {
    if (Date.now() > deadline - 8000) {
      await db
        .from("jobs")
        .update({ state: "pending", available_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("lease_token", job.lease_token);
      continue;
    }
    try {
      const { data: p } = await db
        .from("profiles")
        .select("*")
        .eq("user_id", job.user_id)
        .maybeSingle();
      if (job.kind === "delete_account") {
        const { data: objects, error: oe } = await db.storage
          .from("exports")
          .list(job.user_id, { limit: 100 });
        check(oe);
        if (objects?.length) {
          const { error } = await db.storage
            .from("exports")
            .remove(objects.map((o) => `${job.user_id}/${o.name}`));
          check(error);
        }
        const { error } = await db.auth.admin.deleteUser(job.user_id);
        if (error && !error.message.includes("not found")) check(error);
        await db
          .from("jobs")
          .delete()
          .eq("user_id", job.user_id)
          .neq("id", job.id);
      } else if (
        p?.state === "active" &&
        job.kind === "index" &&
        p.ai_enabled
      ) {
        const { data: n } = await db
          .from("notes")
          .select("*")
          .eq("id", job.note_id)
          .maybeSingle();
        if (
          n &&
          !n.ai_excluded &&
          !n.deleted_at &&
          n.revision === job.revision
        ) {
          const budget = await db.rpc("reserve_index", { p_user: job.user_id });
          check(budget.error);
          if (!budget.data) {
            await db
              .from("jobs")
              .update({
                state: "pending",
                attempts: Math.max(0, job.attempts - 1),
                available_at: new Date(Date.now() + 86400000).toISOString(),
              })
              .eq("id", job.id)
              .eq("lease_token", job.lease_token);
            continue;
          }
          const texts = chunkText(n.title + "\n" + n.plain_text);
          const vectors = await embed(
            texts,
            AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
          );
          const { error } = await db.rpc("publish_chunks", {
            p_job: job.id,
            p_lease: job.lease_token,
            p_model: process.env.OPENROUTER_EMBEDDING_MODEL,
            p_chunks: texts.map((text, i) => ({
              ordinal: i,
              text,
              embedding: JSON.stringify(vectors[i]),
            })),
          });
          check(error);
        }
      } else if (p?.state === "active" && job.kind === "export") {
        const { data: entry } = await db
          .from("exports")
          .select("*")
          .eq("id", job.id)
          .single();
        if (!entry || entry.epoch !== p.privacy_epoch)
          throw new Error("STALE_SOURCES");
        const notes: Note[] = [];
        let size = 0;
        for (let offset = 0; offset < 6000; offset += 100) {
          const { data, error } = await db
            .from("notes")
            .select("*")
            .eq("user_id", job.user_id)
            .order("id")
            .range(offset, offset + 99);
          check(error);
          for (const n of data || []) {
            size += JSON.stringify(n).length;
            if (size > 35_000_000) throw new Error("EXPORT_LIMIT");
            notes.push(n);
          }
          if (!data?.length || data.length < 100) break;
          if (Date.now() > deadline - 3000) throw new Error("EXPORT_TIMEOUT");
        }
        const files: Record<string, Uint8Array> = {};
        for (const n of notes)
          files[`${n.deleted_at ? "trash" : "notes"}/${n.id}.md`] = strToU8(
            `# ${n.title || "Untitled"}\n\n${markdown(n.content)}`,
          );
        files["manifest.json"] = strToU8(
          JSON.stringify(
            { version: 1, exported_at: new Date().toISOString(), notes },
            null,
            2,
          ),
        );
        const path = `${job.user_id}/${job.id}.zip`;
        const { error } = await db.storage
          .from("exports")
          .upload(path, zipSync(files), {
            contentType: "application/zip",
            upsert: true,
          });
        check(error);
        const { data: current } = await db
          .from("profiles")
          .select("*")
          .eq("user_id", job.user_id)
          .single();
        if (
          current?.state !== "active" ||
          current.privacy_epoch !== entry.epoch
        ) {
          await db.storage.from("exports").remove([path]);
          throw new Error("STALE_SOURCES");
        }
        await db
          .from("exports")
          .update({ path, state: "ready" })
          .eq("id", job.id);
      }
      await db
        .from("jobs")
        .update({ state: "done", error_code: null })
        .eq("id", job.id)
        .eq("lease_token", job.lease_token);
      completed++;
    } catch (e) {
      const code =
        e instanceof Error && /^[A-Z_]+$/.test(e.message)
          ? e.message
          : "JOB_FAILED";
      await db
        .from("jobs")
        .update({
          state: job.attempts >= 5 ? "failed" : "pending",
          error_code: code,
          available_at: new Date(
            Date.now() + Math.min(3600000, 2 ** job.attempts * 10000),
          ).toISOString(),
        })
        .eq("id", job.id)
        .eq("lease_token", job.lease_token);
      if (job.kind === "export")
        await db
          .from("exports")
          .update({ state: job.attempts >= 5 ? "failed" : "pending" })
          .eq("id", job.id);
    }
  }
  return { completed, claimed: jobs?.length || 0 };
}
