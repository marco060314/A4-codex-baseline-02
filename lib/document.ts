import { z } from "zod";
import type { Doc } from "./types";
const types = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "hardBreak",
  "horizontalRule",
  "codeBlock",
]);
export function validateDoc(value: unknown, depth = 0): Doc {
  if (depth > 20 || !value || typeof value !== "object")
    throw new Error("VALIDATION");
  const n = value as Doc;
  if (n.type === "heading" && ![1, 2, 3].includes(Number(n.attrs?.level)))
    throw new Error("VALIDATION");
  if (
    n.type === "orderedList" &&
    n.attrs?.start !== undefined &&
    (!Number.isInteger(n.attrs.start) ||
      Number(n.attrs.start) < 1 ||
      Number(n.attrs.start) > 99999)
  )
    throw new Error("VALIDATION");
  if (
    !types.has(n.type) ||
    (n.text !== undefined && typeof n.text !== "string")
  )
    throw new Error("VALIDATION");
  if (n.content && (!Array.isArray(n.content) || n.content.length > 10000))
    throw new Error("VALIDATION");
  if (
    n.marks &&
    (!Array.isArray(n.marks) ||
      n.marks.some(
        (m) =>
          !["bold", "italic", "strike", "code", "link", "underline"].includes(
            m.type,
          ),
      ))
  )
    throw new Error("VALIDATION");
  if (
    n.marks?.some(
      (m) =>
        m.type === "link" && !/^(https?:|mailto:)/i.test(String(m.attrs?.href)),
    )
  )
    throw new Error("VALIDATION");
  return { ...n, content: n.content?.map((c) => validateDoc(c, depth + 1)) };
}
export function plainText(n: Doc): string {
  if (n.type === "text") return n.text || "";
  if (n.type === "hardBreak") return "\n";
  const text = (n.content || []).map(plainText).join("");
  return (
    text +
    ([
      "paragraph",
      "heading",
      "listItem",
      "taskItem",
      "blockquote",
      "codeBlock",
    ].includes(n.type)
      ? "\n"
      : "")
  );
}
export function markdown(n: Doc): string {
  if (n.type === "text") {
    let s = (n.text || "").replace(/([\\`*_\[\]])/g, "\\$1");
    for (const m of n.marks || []) {
      if (m.type === "bold") s = `**${s}**`;
      if (m.type === "italic") s = `*${s}*`;
      if (m.type === "strike") s = `~~${s}~~`;
      if (m.type === "code")
        s = "`" + (n.text || "").replace(/`/g, "\\`") + "`";
      if (m.type === "link")
        s = `[${s}](${String(m.attrs?.href).replace(/[()]/g, encodeURIComponent)})`;
    }
    return s;
  }
  const children = (n.content || []).map(markdown);
  if (n.type === "heading")
    return `${"#".repeat(Number(n.attrs?.level) || 2)} ${children.join("")}\n\n`;
  if (n.type === "orderedList")
    return (
      children
        .map((text, i) =>
          text.replace(/^- /, `${(Number(n.attrs?.start) || 1) + i}. `),
        )
        .join("") + "\n"
    );
  if (n.type === "blockquote")
    return (
      children
        .join("")
        .trim()
        .split("\n")
        .map((line) => "> " + line)
        .join("\n") + "\n\n"
    );
  if (n.type === "taskItem")
    return `- [${n.attrs?.checked ? "x" : " "}] ${children.join("").trim()}\n`;
  if (n.type === "listItem") return `- ${children.join("").trim()}\n`;
  if (n.type === "hardBreak") return "\n";
  if (n.type === "horizontalRule") return "\n---\n";
  if (n.type === "codeBlock") return `\n\`\`\`\n${plainText(n)}\`\`\`\n`;
  return children.join("") + (n.type === "paragraph" ? "\n\n" : "");
}
export function chunkText(text: string, size = 1800): string[] {
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const split = text.lastIndexOf(" ", end);
      if (split > start + size / 2) end = split;
    }
    out.push(text.slice(start, end));
    if (end === text.length) break;
    start = Math.max(start + 1, end - 120);
  }
  return out;
}
export const noteInput = z.object({
  id: z.uuid(),
  revision: z.number().int().min(0),
  title: z.string().max(240),
  content: z.unknown(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  pinned: z.boolean(),
  ai_excluded: z.boolean(),
});
export function validateAnswer(value: unknown, sources: { id: string }[]) {
  const result = z
    .object({
      segments: z
        .array(
          z.object({
            text: z.string().min(1).max(12000),
            sources: z.array(z.string()).max(20),
          }),
        )
        .min(1)
        .max(30),
    })
    .parse(value);
  const ids = new Set(sources.map((s) => s.id));
  if (result.segments.some((s) => s.sources.some((id) => !ids.has(id))))
    throw new Error("INVALID_CITATION");
  return result;
}
