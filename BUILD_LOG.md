# A4-CODEX-BASELINE-01
- Model / exact string: gpt-6-astra
- Archetype / condition: A4-CODEX-BASELINE-01
- Prompter: Marco Wang
- Start (UTC): 2:16 PM
- Harness version: codex-cli 0.155.1

## Implementation — 2026-09-28

- Built Commonplace using TypeScript, Next.js App Router, Supabase Auth/PostgreSQL/RLS/private Storage, Vercel cron configuration, and an OpenRouter generation/embedding adapter.
- Implemented rich-text notes, checklists, revision-checked autosave, recovered copies, tags, pinning, keyword/semantic search, source-linked assistant, consent/exclusion, private ZIP exports, trash/restore/deletion, and reauthenticated account deletion.
- Applied all three migrations to the isolated `commonplace-a4` local Supabase project; generated database types.
- Verified database ownership boundaries, stale revisions/jobs, excluded chunks, private Storage, daily limits, and idempotent saves with disposable accounts.
- Verified the production UI in Chromium at desktop and mobile sizes: sign-in, create/edit/reload, pin, AI settings, export/download, missing-provider error, conflict recovery, trash/restore/permanent deletion, CSRF rejection, and account purge.
- Production build and TypeScript checks pass. Unit checks cover document validation, chunking, Markdown structure, citation validation, and mocked OpenRouter request contracts. Production dependency audit reports zero known vulnerabilities at build time.
- Screenshots: artifacts/landing.png, artifacts/notebook-desktop.png, artifacts/notebook-mobile.png.
- Local app configured with the isolated Supabase project; no commercial model key supplied and no hosted deployment performed. Real OpenRouter quality/billing and hosted cron/email/backup behavior remain deployment verification tasks, described in README.md.
- Documented implementation bounds: 24,000-character single-note summaries, 35 MB export job limit, per-note tag arrays, no durable offline drafts, and no saved chat history.

## Vercel Hobby adaptation — 2026-09-29

- Removed the Vercel minute-level cron configuration; retained bounded 60-second HTTP functions.
- Added a Supabase Cron/pg_net dispatcher with Vault-backed worker URL and bearer secret. It remains dormant without deployment-specific configuration and skips idle HTTP invocations.
- Updated DESIGN.md and README.md with Hobby architecture, personal/noncommercial scope, Vault setup, dispatch monitoring, quota behavior, and migration instructions.
- Added a transactional SQL check for dormant/idle/due/backoff dispatch, authorization grants, and authenticated HTTP queue contents. Requests are rolled back before pg_net can send them.
- Verification: scheduler migration applied locally; transactional SQL assertions passed; production build and TypeScript check passed. Hosted Vault values and remote deployment remain user configuration steps.
