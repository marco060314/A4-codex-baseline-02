# Commonplace

A private notebook with a source-grounded AI assistant. Built with TypeScript, Next.js App Router, Supabase PostgreSQL/Auth/Storage, Vercel Hobby, and OpenRouter.

## Run locally

Requires Node.js 22+, npm, and Docker for local Supabase.

```sh
npm install
npx supabase start
npx supabase status -o env > /tmp/commonplace-local-env
node scripts/local-env.mjs
npm run dev
```

Open http://localhost:3000 and create an account. The isolated local Supabase project uses ports 64321–64324 (API, database, Studio, and local mail inbox). Local email confirmation is disabled by the development Supabase config; configure confirmation and production SMTP for deployment. Password recovery emails appear in http://localhost:64324.

Without Supabase environment variables the app renders the sign-in page with a setup explanation. It does not simulate authentication or store anonymous notes. `.env.local` is ignored by Git. `scripts/local-env.mjs` writes local-only credentials; do not use it against a production project.

## Hosted setup

1. Create a Supabase project. Apply all files in `supabase/migrations` in order using the Supabase CLI or SQL editor. The schema installs pgvector, RLS policies, transactional RPCs, job records, and a private `exports` bucket.
2. Set the Supabase Auth site URL and allowed redirects to your application origin and `/auth/callback`. Configure email confirmation, password recovery, and production email delivery.
3. Import this repository into a Vercel Hobby project. Set the variables in `.env.example`, using separate Supabase projects and credentials for preview and production.
4. Set `APP_URL` to the exact public origin. Set a strong `CRON_SECRET`. There is no Vercel Cron schedule; the 60-second function limits are compatible with Hobby. After deploying, configure Supabase dispatch as described below.
5. Configure OpenRouter as below. Deploy, verify authentication, run two-account isolation checks in a nonproduction project, and test the scheduled worker.

No hosted resources have been provisioned or deployed by this repository.

## OpenRouter

Set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and an explicit comma-separated `OPENROUTER_PROVIDERS` allowlist. Select a commercial model supporting JSON-schema structured responses.

Set `OPENROUTER_EMBEDDING_MODEL` and `OPENROUTER_EMBEDDING_PROVIDERS` separately. The embedding model must support **1536 dimensions**. Embeddings and queries must use the same model. Changing models requires reindexing (toggle AI off and on); changing dimensions requires a schema migration.

All AI calls use OpenRouter. Routing requires the configured providers, `data_collection: deny`, `zdr: true`, and parameter support; no silent provider fallback is permitted. Verify that the selected generation and embedding routes support these requirements. An unavailable route produces an explicit assistant error while note saving continues normally. Review gateway and provider retention terms before making privacy commitments.

AI is off until the user activates it in Settings. Per-note exclusion applies to summaries, embedding, and retrieval. The assistant can only read, never edit. Conversations remain in browser memory. No model key is sent to the browser.

A daily request limit and two concurrent requests per account are enforced by PostgreSQL. Configure the app's `AI_DAILY_LIMIT` and `AI_GLOBAL_DAILY_LIMIT` to lower limits as needed. Database maximums of 30 per account and 1,000 globally are enforced independently of client input. Background indexing is separately capped at 200 embedding batches per account and 2,000 globally per day; deferred work resumes later. Set a separate hard spending limit on the OpenRouter key before deployment, because request counts are not a dollar budget. Usage accounting currently records generation tokens; embedding usage is bounded operationally rather than billed by tokens in the UI.

## Vercel Hobby scheduling setup

Hobby is for personal, noncommercial use. This configuration supports a personal prototype; using a free host does not remove OpenRouter charges or Supabase usage limits. See [Hobby terms and limits](https://vercel.com/docs/plans/hobby).

Apply the new migration to your hosted Supabase project:

```sh
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

The migration creates `commonplace-dispatch` in Supabase Cron and a daily history-cleanup task. Dispatch stays dormant until configured. In the **Supabase Vault dashboard**, create these two secrets:

| Vault secret name | Value |
| --- | --- |
| `commonplace_worker_url` | `https://YOUR-PRODUCTION-DOMAIN/api/jobs` (exact endpoint, no trailing slash) |
| `commonplace_cron_secret` | The same strong secret as Vercel's `CRON_SECRET`, at least 32 characters |

Generate a secret with `openssl rand -hex 32`. Store it in Vercel Production environment settings and Vault, then redeploy Vercel if its environment changed. Never place secret values in migrations or Git. Use the stable production domain, not a temporary preview URL. The endpoint must be accessible to Supabase; deployment protection must not turn worker requests into login pages. The endpoint itself still requires its bearer secret.

Check **Supabase → Cron → commonplace-dispatch → History**, then Vercel function logs and the Supabase `jobs` table. A successful cron tick only proves the SQL dispatcher ran. For actual HTTP delivery, inspect statuses without displaying headers or secrets:

```sql
select id, status_code, timed_out, error_msg, created
from net._http_response
order by created desc limit 10;
```

Create an export in the app and confirm it becomes downloadable after dispatch. To trigger a tick manually as the database administrator, run `select public.dispatch_jobs();`. To pause scheduling, deactivate `commonplace-dispatch` in Supabase Cron. Update the Vault URL when changing domains, and rotate the shared secret in both Vault and Vercel together.

The scheduler sends no Vercel request when idle. Job processing still consumes Hobby compute and Supabase resources. Cold starts, exhausted allowances, a paused Supabase project, or a large queue can delay work. No paid Vercel plan or extra scheduling service is required. Native Vercel Hobby cron is limited to daily runs, so **do not restore the old minute-level `crons` entry**. [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Background jobs

`GET /api/jobs` requires `Authorization: Bearer <CRON_SECRET>`. Supabase Cron dispatches it once per minute only when due work exists. Vercel Hobby runs the authenticated HTTP worker; it does not schedule it. For local indexing and exports, call it manually with your local secret or run a local scheduler. Secrets should be read from the environment and not checked into scripts or logs.

Jobs are leased in small batches with `SKIP LOCKED`, retries, and revision checks. A stale worker cannot publish an older index. Errors are stored as codes without note text. Inspect job failures in Supabase; provider configuration errors must be resolved before retrying exhausted jobs. Account deletion disables access immediately, then removes Storage objects before the Auth identity. Temporary exports expire after 24 hours; all downloads require an active session and matching privacy epoch.

## Checks

With local Supabase running and `.env.local` configured:

```sh
npm test
npm run typecheck
npm run test:integration
npm run build
npm run start
# In a second terminal:
npx playwright install chromium
npm run test:browser
```

Unit checks cover document safety, export formatting, chunking, and invalid citations. Database integration checks use disposable accounts and cover RLS, cross-account reads/writes, stale revisions and workers, quotas, exclusion, trash, and private Storage. Browser checks cover actual authentication, editing/autosave, reload, pinning, AI consent/unavailable service, export, conflict recovery, trash/restore/delete, and mobile overflow. Screenshots are written to `artifacts/`.

Generated database types live in `lib/supabase/database.types.ts`. Regenerate after migrations with `npx supabase gen types typescript --local`.

## Implementation notes and launch gates

- Notes store validated Tiptap JSON plus derived text. Tags are a constrained text array per note rather than separate tag entities; there is no tag-renaming UI.
- Saves use revision checks. Conflicting drafts can be saved as a recovered copy. Offline drafts survive only while the tab remains open.
- Keyword search uses PostgreSQL full-text search; semantic retrieval combines embedding ranking with current keyword matches. The assistant returns validated source identifiers and rechecks note revisions and privacy state before delivering results.
- Single-note summaries currently accept up to 24,000 characters. Larger requests show an explicit size message; hierarchical long-note summaries are a later enhancement.
- Export is bounded to 35 MB of serialized note data per job. Oversized exports fail visibly instead of silently omitting notes; resumable large-account export is a future extension.
- Authenticated exports stream from private Storage through the API. There are no client Storage grants; direct object requests are denied even to the account owner.
- Production backup retention, Storage backup coverage, restore procedures, performance targets, and the 50-question live-model quality evaluation must be validated against the chosen service plans before public launch. Do not treat design targets as measured guarantees.
- No commercial AI credentials are included. Live generation quality, actual OpenRouter billing, email delivery, and hosted cron execution require real service configuration and deployment verification.

See [DESIGN.md](DESIGN.md) for the complete product specification and architecture.
