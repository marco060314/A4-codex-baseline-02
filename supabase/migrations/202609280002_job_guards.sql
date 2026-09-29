-- Keep user-adjustable RPC parameters below hard application ceilings.
create or replace function public.reserve_ai(p_id uuid,p_daily integer,p_global integer) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(837241);
 if not public.active_account() or not exists(select 1 from public.profiles where user_id=auth.uid() and ai_enabled) then raise exception 'AI_DISABLED'; end if;
 if exists(select 1 from public.ai_requests where id=p_id) then raise exception 'DUPLICATE_REQUEST'; end if;
 if (select count(*) from public.ai_requests where user_id=auth.uid() and created_at>=date_trunc('day',now()))>=least(coalesce(p_daily,30),30) or
 (select count(*) from public.ai_requests where created_at>=date_trunc('day',now()))>=least(coalesce(p_global,1000),1000) or
 (select count(*) from public.ai_requests where user_id=auth.uid() and finished_at is null and created_at>now()-interval '2 minutes')>=2 then raise exception 'RATE_LIMIT'; end if;
 insert into public.ai_requests(id,user_id) values(p_id,auth.uid());
end $$;
-- The application reauthenticates the password before invoking this service-only operation.
revoke execute on function public.begin_delete() from authenticated;
create function public.begin_account_delete(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.profiles set state='deleting',ai_enabled=false,privacy_epoch=privacy_epoch+1 where user_id=p_user and state='active';
 if not found then raise exception 'UNAUTHORIZED'; end if;
 insert into public.jobs(user_id,kind) values(p_user,'delete_account');
 update public.exports set state='expired' where user_id=p_user;
end $$;
revoke all on function public.begin_account_delete(uuid) from public,anon,authenticated;
grant execute on function public.begin_account_delete(uuid) to service_role;

create table public.index_usage (user_id uuid not null references public.profiles on delete cascade,day date not null default current_date,requests integer not null default 0,primary key(user_id,day));
alter table public.index_usage enable row level security;
revoke all on public.index_usage from anon,authenticated;
grant all on public.index_usage to service_role;
create function public.reserve_index(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(837242);
 if not exists(select 1 from public.profiles where user_id=p_user and state='active' and ai_enabled) then return false; end if;
 if coalesce((select requests from public.index_usage where user_id=p_user and day=current_date),0)>=200 or coalesce((select sum(requests) from public.index_usage where day=current_date),0)>=2000 then return false; end if;
 insert into public.index_usage(user_id,requests) values(p_user,1) on conflict(user_id,day) do update set requests=public.index_usage.requests+1;
 return true;
end $$;
revoke all on function public.reserve_index(uuid) from public,anon,authenticated;
grant execute on function public.reserve_index(uuid) to service_role;

create function public.reconcile_jobs() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.jobs set state='done' where kind='index' and state in ('pending','failed') and not exists(select 1 from public.notes n join public.profiles p on p.user_id=n.user_id where n.id=note_id and n.revision=jobs.revision and n.deleted_at is null and not n.ai_excluded and p.ai_enabled and p.state='active');
 update public.jobs set state='failed',error_code='LEASE_EXHAUSTED' where state='running' and lease_until<now() and attempts>=5;
 insert into public.jobs(user_id,note_id,kind,revision)
 select n.user_id,n.id,'index',n.revision from public.notes n join public.profiles p on p.user_id=n.user_id
 where p.state='active' and p.ai_enabled and not n.ai_excluded and n.deleted_at is null
 and not exists(select 1 from public.note_chunks c where c.note_id=n.id and c.revision=n.revision)
 and not exists(select 1 from public.jobs j where j.note_id=n.id and j.revision=n.revision and j.kind='index')
 order by n.updated_at limit 100 on conflict do nothing;
 delete from public.jobs where state='done' and kind<>'export' and created_at<now()-interval '30 days';
 delete from public.index_usage where day<current_date-30;
end $$;
revoke all on function public.reconcile_jobs() from public,anon,authenticated;
grant execute on function public.reconcile_jobs() to service_role;

create function public.index_health() returns table(pending bigint,failed bigint) language sql stable security definer set search_path='' as $$
 select count(*) filter(where j.state in ('pending','running')),count(*) filter(where j.state='failed')
 from public.jobs j join public.notes n on n.id=j.note_id and n.revision=j.revision
 where j.user_id=auth.uid() and public.active_account() and j.kind='index' and not n.ai_excluded and n.deleted_at is null;
$$;
revoke all on function public.index_health() from public,anon;
grant execute on function public.index_health() to authenticated,service_role;
