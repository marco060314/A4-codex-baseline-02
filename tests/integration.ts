import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const accounts: string[] = [];
async function user() {
  const email = `integration-${crypto.randomUUID()}@example.com`,
    password = crypto.randomUUID() + "A1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  accounts.push(data.user!.id);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const login = await db.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  return { db, id: data.user!.id };
}
async function main() {
  try {
    const a = await user(),
      b = await user();
    const noteId = crypto.randomUUID();
    const payload = {
      p_id: noteId,
      p_revision: 0,
      p_title: "Private project",
      p_content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Blue telescope" }],
          },
        ],
      },
      p_text: "Blue telescope",
      p_tags: ["ideas"],
      p_pinned: false,
      p_excluded: false,
    };
    const save = await a.db.rpc("save_note", payload);
    assert.ifError(save.error);
    assert.equal(save.data.revision, 1);
    const replay = await a.db.rpc("save_note", payload);
    assert.ifError(replay.error);
    assert.equal(replay.data.revision, 1);
    assert.ok((await a.db.rpc("begin_delete")).error);
    assert.ok((await a.db.rpc("begin_account_delete", { p_user: b.id })).error);
    assert.equal(
      (await b.db.from("notes").select("*").eq("id", noteId)).data?.length,
      0,
    );
    assert.ok(
      (await b.db.rpc("save_note", { ...payload, p_revision: 1 })).error,
    );
    assert.ok(
      (await b.db.rpc("note_action", { p_id: noteId, p_action: "trash" }))
        .error,
    );
    assert.ok(
      (await a.db.from("notes").update({ user_id: b.id }).eq("id", noteId))
        .error,
    );
    assert.ok(
      (
        await a.db
          .from("profiles")
          .update({ ai_enabled: true })
          .eq("user_id", a.id)
      ).error,
    );
    assert.ok(
      (
        await a.db.rpc("save_note", { ...payload, p_revision: 7 })
      ).error?.message.includes("CONFLICT"),
    );
    assert.ifError((await a.db.rpc("set_ai", { p_enabled: true })).error);
    const claim = await admin.rpc("claim_jobs");
    assert.ifError(claim.error);
    const job = claim.data.find(
      (j: { note_id: string }) => j.note_id === noteId,
    );
    assert.ok(job);
    const vector = JSON.stringify(
      Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0)),
    );
    const published = await admin.rpc("publish_chunks", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_model: "test-model",
      p_chunks: [{ ordinal: 0, text: "Blue telescope", embedding: vector }],
    });
    assert.ifError(published.error);
    assert.equal(published.data, true);
    const ownMatch = await a.db.rpc("match_chunks", {
      p_embedding: vector,
      p_model: "test-model",
      p_query: "telescope",
    });
    assert.ifError(ownMatch.error);
    assert.equal(ownMatch.data.length, 1);
    assert.equal(
      (
        await b.db.rpc("match_chunks", {
          p_embedding: vector,
          p_model: "test-model",
          p_query: "telescope",
        })
      ).data?.length,
      0,
    );
    assert.ifError(
      (
        await a.db.rpc("save_note", {
          ...payload,
          p_revision: 1,
          p_excluded: true,
        })
      ).error,
    );
    assert.equal((await a.db.from("note_chunks").select("*")).data?.length, 0);
    assert.equal(
      (
        await admin.rpc("publish_chunks", {
          p_job: job.id,
          p_lease: job.lease_token,
          p_model: "test-model",
          p_chunks: [{ ordinal: 0, text: "old text", embedding: vector }],
        })
      ).data,
      false,
    );
    const quota = await a.db.rpc("reserve_ai", {
      p_id: crypto.randomUUID(),
      p_daily: 1,
      p_global: 1000,
    });
    assert.ifError(quota.error);
    assert.match(
      (
        await a.db.rpc("reserve_ai", {
          p_id: crypto.randomUUID(),
          p_daily: 1,
          p_global: 1000,
        })
      ).error?.message || "",
      /RATE_LIMIT/,
    );
    assert.ifError(
      (await a.db.rpc("note_action", { p_id: noteId, p_action: "trash" }))
        .error,
    );
    assert.ok(
      (await a.db.from("notes").select("*").eq("id", noteId).single()).data
        .deleted_at,
    );
    assert.ifError(
      (await a.db.rpc("note_action", { p_id: noteId, p_action: "restore" }))
        .error,
    );
    assert.equal(
      (await a.db.from("notes").select("*").eq("id", noteId).single()).data
        .deleted_at,
      null,
    );
    const object = `${a.id}/probe.txt`;
    assert.ifError(
      (await admin.storage.from("exports").upload(object, "private")).error,
    );
    assert.ok((await b.db.storage.from("exports").download(object)).error);
    assert.ok((await a.db.storage.from("exports").download(object)).error);
    await admin.storage.from("exports").remove([object]);
    assert.ok((await a.db.rpc("claim_jobs")).error);
    assert.ok((await a.db.from("jobs").select("*")).error);
    console.log(
      "Passed: save revisions, ownership, RLS, private storage, quotas, indexing, stale jobs, exclusion, trash and restore.",
    );
  } finally {
    for (const id of accounts) {
      await admin.from("jobs").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
