export type Doc = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Doc[];
};
export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: Doc;
  plain_text: string;
  tags: string[];
  revision: number;
  pinned: boolean;
  ai_excluded: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export type Profile = {
  user_id: string;
  ai_enabled: boolean;
  privacy_epoch: number;
  state: string;
};
export type Source = {
  id: string;
  note_id: string;
  revision: number;
  title: string;
  text: string;
  score?: number;
};
export type Answer = {
  segments: { text: string; sources: string[] }[];
  sources: Source[];
  notice?: string;
};
export const EMPTY_DOC: Doc = { type: "doc", content: [{ type: "paragraph" }] };
