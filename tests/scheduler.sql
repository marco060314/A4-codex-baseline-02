-- Run only against the isolated local Supabase database. Everything is rolled back,
-- including pg_net requests, so this test never contacts the example endpoint.
begin;

do $$
begin
  assert not has_function_privilege('anon','public.dispatch_jobs()','execute');
  assert not has_function_privilege('authenticated','public.dispatch_jobs()','execute');
  assert has_function_privilege('service_role','public.dispatch_jobs()','execute');
  assert exists(select 1 from cron.job where jobname='commonplace-dispatch' and schedule='* * * * *' and active);
end $$;

-- Transaction-local isolation from any existing local development notebook.
delete from vault.secrets where name in ('commonplace_worker_url','commonplace_cron_secret');
do $$ begin assert public.dispatch_jobs() is null, 'Unconfigured dispatch must be dormant'; end $$;
select vault.create_secret('https://scheduler-test.example/api/jobs','commonplace_worker_url');
select vault.create_secret(repeat('a',64),'commonplace_cron_secret');
update public.jobs set state='done';
update public.profiles set ai_enabled=false;
update public.notes set deleted_at=null;
update public.exports set state='ready',expires_at=now()+interval '1 day';
do $$ begin assert public.dispatch_jobs() is null, 'Idle dispatch must not consume a Vercel invocation'; end $$;
insert into public.jobs(user_id,kind) values(gen_random_uuid(),'delete_account');
do $$
declare request_id bigint;
begin
  request_id:=public.dispatch_jobs();
  assert request_id is not null, 'Due work must enqueue HTTP dispatch';
  assert exists(select 1 from net.http_request_queue where id=request_id
    and url='https://scheduler-test.example/api/jobs'
    and headers->>'Authorization'='Bearer '||repeat('a',64)
    and timeout_milliseconds=60000), 'Dispatch must carry the shared secret and bounded timeout';
end $$;
update public.jobs set state='pending',available_at=now()+interval '1 hour';
do $$ begin assert public.dispatch_jobs() is null, 'Backoff must not trigger early dispatch'; end $$;
rollback;
