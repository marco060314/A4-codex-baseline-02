These steps deploy the updated app to Vercel Hobby, with Supabase handling scheduled jobs. Hobby permits personal, noncommercial use; a commercial launch
  requires a different hosting arrangement. Vercel’s Hobby policy

  1. Push the project to GitHub

     Include the source, package-lock.json, vercel.json, and all files in supabase/migrations.

     Do not upload .env.local; its credentials belong to the local development environment.

  2. Create a hosted Supabase project and apply migrations

     From the project directory:

     npm ci
     npx supabase login
     npx supabase link --project-ref YOUR_PROJECT_REF
     npx supabase db push --dry-run
     npx supabase db push

     Find YOUR_PROJECT_REF in your Supabase dashboard URL. This creates the database, access rules, private export bucket, and scheduler. The scheduler
     remains dormant until configured in step 6. Supabase migration workflow

  3. Import the repository into Vercel

     Create a project on your Hobby account with:

      Setting             Value
     ━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Framework           Next.js
     ──────────────────  ────────────────────────────────
      Root directory      Folder containing package.json
     ──────────────────  ────────────────────────────────
      Node.js             22.x
     ──────────────────  ────────────────────────────────
      Install command     npm ci
     ──────────────────  ────────────────────────────────
      Build command       npm run build
     ──────────────────  ────────────────────────────────
      Output directory    Framework default

     Choose your stable production domain, such as https://your-notebook.vercel.app.

  4. Set Vercel’s production environment variables

     Add these under Project Settings → Environment Variables, selecting Production:

      Variable                                Value
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      NEXT_PUBLIC_SUPABASE_URL                Hosted Supabase project URL
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY    Supabase publishable key
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      SUPABASE_SERVICE_ROLE_KEY               Supabase server secret or legacy service-role key
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      APP_URL                                 Exact production origin, e.g. https://your-notebook.vercel.app
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      OPENROUTER_API_KEY                      Your OpenRouter API key
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      OPENROUTER_MODEL                        Exact generation model ID
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      OPENROUTER_PROVIDERS                    Approved provider slugs, comma-separated
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      OPENROUTER_EMBEDDING_MODEL              Exact embedding model ID
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      OPENROUTER_EMBEDDING_PROVIDERS          Approved embedding provider slugs
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      CRON_SECRET                             Random secret generated below
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      AI_DAILY_LIMIT                          30
     ──────────────────────────────────────  ────────────────────────────────────────────────────────────────
      AI_GLOBAL_DAILY_LIMIT                   1000

     Generate the secret locally:

     openssl rand -hex 32

     The generation model must support JSON-schema structured output. The embedding model must support 1536 dimensions. Both provider routes must support
     the app’s zero-data-retention settings. Fund the OpenRouter account and set an API-key spending limit.

     Deploy, or redeploy if you added variables after the first deployment. Keep production credentials out of Preview environments.

  5. Configure Supabase sign-in and email

     In Authentication → URL Configuration, replace the example domain below:

     Site URL:
     https://your-notebook.vercel.app

     Redirect URLs:
     https://your-notebook.vercel.app/auth/callback
     https://your-notebook.vercel.app/auth/callback?next=/auth/reset
     https://your-notebook.vercel.app/auth/reset

     Enable email confirmation and configure custom SMTP for signup and password-reset messages. Supabase’s default email service is restricted and is not
     intended for public production signups. SMTP instructions

  6. Activate background processing in Supabase Vault

     In the hosted project’s Vault dashboard, create:

      Secret name                Value
     ━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      commonplace_worker_url     https://your-notebook.vercel.app/api/jobs
     ─────────────────────────  ────────────────────────────────────────────────
      commonplace_cron_secret    Exactly the same value as Vercel’s CRON_SECRET

     Use the complete worker URL with no trailing slash.

     The migration already created the commonplace-dispatch schedule. It checks every minute and calls Vercel only when work is due. Do not add a Vercel
     Cron schedule.

     Ensure Vercel deployment protection does not redirect this endpoint to a Vercel login page. The endpoint itself requires the shared bearer secret.

  7. Verify the deployed app
      - Create an account, confirm email, and test password recovery.
      - Save a note, reload, and confirm it remains.
      - Enable AI in Settings and summarize the note.
      - Allow indexing to run, then test meaning-based search.
      - Request an export and confirm the download appears.

     Check Supabase → Cron → commonplace-dispatch → History and Vercel’s function logs. A successful cron tick does not by itself prove the HTTP request
     succeeded. Inspect delivery results in Supabase’s SQL editor:

     select id, status_code, timed_out, error_msg, created
     from net._http_response
     order by created desc
     limit 10;

     Expect HTTP 200 when the worker runs. No HTTP request while the queue is idle is normal. Supabase documents scheduler history in its Cron guide.

  Deployment instructions are also saved in README.md (README.md#hosted-setup). Hosted AI, email, and scheduler behavior still need the verification above;
  they have not yet been tested against your production accounts.