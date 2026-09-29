import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, embed } from "../lib/openrouter";
const original = globalThis.fetch;
const settings = {
  OPENROUTER_API_KEY: "test-only",
  OPENROUTER_MODEL: "test/model",
  OPENROUTER_PROVIDERS: "reviewed-provider",
  OPENROUTER_EMBEDDING_MODEL: "test/embed",
  OPENROUTER_EMBEDDING_PROVIDERS: "reviewed-embedder",
};
test("OpenRouter adapter keeps privacy constraints and source IDs through generation", async () => {
  Object.assign(process.env, settings);
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.provider.only, ["reviewed-provider"]);
      assert.equal(body.provider.allow_fallbacks, false);
      assert.equal(body.provider.zdr, true);
      assert.equal(body.provider.data_collection, "deny");
      assert.equal(body.response_format.type, "json_schema");
      assert.match(body.messages[0].content, /untrusted/);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                segments: [
                  { text: "Your notes say Saturday.", sources: ["source-1"] },
                ],
              }),
            },
          },
        ],
        usage: { total_tokens: 90 },
        model: "test/model",
      });
    };
    const result = await answer(
      "When?",
      [
        {
          id: "source-1",
          note_id: "note-1",
          revision: 1,
          title: "Plan",
          text: "Saturday",
        },
      ],
      [],
      new AbortController().signal,
    );
    assert.equal(result.tokens, 90);
    assert.deepEqual(result.segments[0].sources, ["source-1"]);
  } finally {
    globalThis.fetch = original;
  }
});
test("embedding adapter validates dimensions and fails closed on routing or upstream errors", async () => {
  Object.assign(process.env, settings);
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.dimensions, 1536);
      assert.deepEqual(body.provider.only, ["reviewed-embedder"]);
      return Response.json({ data: [{ index: 0, embedding: [1, 0] }] });
    };
    await assert.rejects(() => embed(["note"]), /AI_UNAVAILABLE/);
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await assert.rejects(() => embed(["note"]), /AI_UNAVAILABLE/);
    delete process.env.OPENROUTER_EMBEDDING_PROVIDERS;
    let sent = false;
    globalThis.fetch = async () => {
      sent = true;
      return Response.json({});
    };
    await assert.rejects(() => embed(["note"]), /AI_UNAVAILABLE/);
    assert.equal(sent, false);
  } finally {
    globalThis.fetch = original;
  }
});
