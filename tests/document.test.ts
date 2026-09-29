import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunkText,
  markdown,
  plainText,
  validateAnswer,
  validateDoc,
} from "../lib/document";
test("document validation rejects executable links and unsupported nodes", () => {
  assert.throws(() => validateDoc({ type: "script" }));
  assert.throws(() =>
    validateDoc({
      type: "doc",
      content: [
        {
          type: "text",
          text: "unsafe",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    }),
  );
});
test("text and Markdown export preserve headings and checked tasks", () => {
  const doc = validateDoc({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Plan" }],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Pack notebook" }],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.match(plainText(doc), /Plan\nPack notebook/);
  assert.match(markdown(doc), /## Plan/);
  assert.match(markdown(doc), /- \[x\] Pack notebook/);
});
test("chunking terminates and covers long documents including unbroken strings", () => {
  const text = "a".repeat(10000);
  const chunks = chunkText(text);
  assert.ok(chunks.length > 5 && chunks.length < 10);
  assert.ok(chunks.every((s) => s.length <= 1800));
  assert.equal(chunks.join("").replace(/a/g, ""), "");
  assert.deepEqual(chunkText(""), []);
});
test("answers reject fabricated source references and invalid structure", () => {
  assert.throws(() =>
    validateAnswer(
      { segments: [{ text: "Invented", sources: ["other-user"] }] },
      [{ id: "valid" }],
    ),
  );
  assert.throws(() => validateAnswer({ segments: [] }, []));
  assert.equal(
    validateAnswer(
      { segments: [{ text: "Your notes say yes.", sources: ["valid"] }] },
      [{ id: "valid" }],
    ).segments.length,
    1,
  );
});

test("ordered lists and blockquotes keep their Markdown structure", () => {
  const paragraph = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  const list = {
    type: "orderedList",
    attrs: { start: 3 },
    content: [
      { type: "listItem", content: [paragraph("First")] },
      { type: "listItem", content: [paragraph("Second")] },
    ],
  };
  assert.match(markdown(list), /3\. First\n4\. Second/);
  assert.match(
    markdown({ type: "blockquote", content: [paragraph("Remember this")] }),
    /> Remember this/,
  );
  assert.throws(() =>
    validateDoc({ type: "heading", attrs: { level: 10000000 } }),
  );
});
