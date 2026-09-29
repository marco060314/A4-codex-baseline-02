-- Supabase owns scheduling; Vercel Hobby only executes ordinary bounded HTTP requests.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create function public.dispatch_jobs() returns bigint
language plpgsql security definer set search_path='' as $$
declare endpoint text; token text; request_id bigint;
begin
  -- Secrets are configured independently per deployment, never stored in migration source.
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='commonplace_worker_url';
  select decrypted_secret into token from vault.decrypted_secrets where name='commonplace_cron_secret';
  if endpoint is null or token is null or length(token)<32 then return null; end if;
  if endpoint !~ '^https://[^/?#]+/api/jobs$' then raise exception 'INVALID_WORKER_URL'; end if;
  perform public.reconcile_jobs();
  -- No Vercel invocation when there is no due work. Failed jobs require operator retry.
  if not exists(select 1 from public.jobs where attempts<5 and
    ((state='pending' and available_at<=now()) or (state='running' and lease_until<now())))
    and not exists(select 1 from public.exports where expires_at<now() or state='expired')
    and not exists(select 1 from public.notes where deleted_at<now()-interval '30 days')
  then return null; end if;
  select net.http_get(
    url:=endpoint,
    headers:=jsonb_build_object('Authorization','Bearer '||token),
    timeout_milliseconds:=60000
  ) into request_id;
  return request_id;
end $$;
revoke all on function public.dispatch_jobs() from public,anon,authenticated;
grant execute on function public.dispatch_jobs() to service_role;

-- Installed but dormant until the deployment's two Vault secrets are configured.
select cron.schedule('commonplace-dispatch','* * * * *','select public.dispatch_jobs();');
select cron.schedule('commonplace-cron-history','17 3 * * *',
  $$delete from cron.job_run_details where jobid in
    (select jobid from cron.job where jobname in ('commonplace-dispatch','commonplace-cron-history'))
    and end_time < now()-interval '7 days';$$);
