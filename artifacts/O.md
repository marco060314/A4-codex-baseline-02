
• The priorities are preventing lost notes, protecting private data, and detecting background work that silently stops. The app has safeguards, but automated
  operational alerts have not yet been configured.

   Area                    What to monitor                                                        Suggested response
  ━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Note saving             Failed saves, slow responses, revision conflicts                       Alert on repeated failures or a save-error rate above 1% over 5
                                                                                                  minutes. Preserve drafts; never show “Saved” before confirmation.
  ──────────────────────  ─────────────────────────────────────────────────────────────────────  ──────────────────────────────────────────────────────────────────────
   Background jobs         Oldest due job, failed jobs, expired leases                            Investigate due work waiting over 5 minutes. Check Supabase Cron,
                                                                                                  HTTP delivery, and the jobs table—not just cron success.
  ──────────────────────  ─────────────────────────────────────────────────────────────────────  ──────────────────────────────────────────────────────────────────────
   Account isolation       Unauthorized access attempts and permission changes                    Run two-account isolation tests after every database migration.
                                                                                                  Treat any cross-account disclosure as an immediate incident.
  ──────────────────────  ─────────────────────────────────────────────────────────────────────  ──────────────────────────────────────────────────────────────────────
   AI spending             OpenRouter spend, remaining credits, request volume, indexing          Set a provider-side spending cap and alerts. The app’s request
                           volume                                                                 quotas are not a dollar budget.
  ──────────────────────  ─────────────────────────────────────────────────────────────────────  ──────────────────────────────────────────────────────────────────────
   AI reliability          Timeouts, unavailable routes, invalid citations, unsupported           Keep note-taking available during AI outages. Evaluate answers
                           answers                                                                against synthetic notes after changing models or prompts.
  ──────────────────────  ─────────────────────────────────────────────────────────────────────  ──────────────────────────────────────────────────────────────────────
   Authentication          Failed sign-ins, signup spikes, email delivery failures                Watch for account farming and password attacks. Add signup abuse
                                                                                                  protection before broad public exposure.
  ──────────────────────  ─────────────────────────────────────────────────────────────────────  ──────────────────────────────────────────────────────────────────────
   Deletion and exports    Failed purges, expired files remaining, export failures                Alert on overdue deletion tasks and repeated export failures. Verify
                                                                                                  that excluded/deleted notes never enter new AI requests.
  ──────────────────────  ─────────────────────────────────────────────────────────────────────  ──────────────────────────────────────────────────────────────────────
   Hosting capacity        Vercel compute/bandwidth and Supabase database/storage usage           Set warning thresholds before exhaustion. If using Supabase Free,
                                                                                                  monitor project pausing too. Supabase pausing

  A few specifics matter for this implementation:

  - Worker HTTP 200 does not mean every job succeeded. The worker catches individual failures and schedules retries. Monitor jobs.state, error_code, attempts, and
    queue age.

  - Protect secrets and logs. Never record note bodies, questions, answers, authorization headers, or provider keys in routine monitoring. Use request IDs, timings,
    counts, and sanitized error codes.

  - Maintain recoverable backups. Test restoring accounts and notes into an isolated project. Supabase database backups do not include Storage object contents; Free
    projects need an explicit backup process. Backup documentation

  - Test large exports before launch. The app permits export jobs containing up to 35 MB of serialized notes, while Vercel documents a 4.5 MB function request/response
    payload limit. The current download path needs hosted size testing and potentially a different delivery approach. Vercel function limits

  - Watch the scheduler’s shared secret. Changing CRON_SECRET in Vercel without updating Supabase Vault stops background processing. Domain changes also require
    updating the Vault worker URL.

  For an initial deployment, I’d establish five alerts first: repeated save failures, due jobs older than five minutes, failed account deletion, OpenRouter budget
  nearing its cap, and hosting usage nearing its limit. Then run a periodic test account through sign-in → save → reload → export to verify the actual user experience.
