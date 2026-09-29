create extension if not exists vector with schema extensions;
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  ai_enabled boolean not null default false,
  privacy_epoch bigint not null default 0,
  state text not null default 'active' check(state in ('active','deleting')),
  created_at timestamptz not null default now()
);
create function public.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(user_id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
create function public.active_account() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles where user_id=auth.uid() and state='active'); $$;
create table public.notes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 title text not null default '' check(length(title)<=240), content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
 plain_text text not null default '' check(length(plain_text)<=100000), tags text[] not null default '{}',
 revision integer not null default 1, pinned boolean not null default false, ai_excluded boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 search_vector tsvector generated always as (setweight(to_tsvector('simple',title),'A') || setweight(to_tsvector('simple',plain_text),'B')) stored,
 unique(id,user_id), check(cardinality(tags)<=20)
);
create index notes_owner on public.notes(user_id,updated_at desc,id);
create index notes_search on public.notes using gin(search_vector);
create table public.note_chunks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, note_id uuid not null,
 revision integer not null, ordinal integer not null, text text not null, embedding extensions.vector(1536), model text not null,
 foreign key(note_id,user_id) references public.notes(id,user_id) on delete cascade,
 unique(note_id,revision,ordinal)
);
create index chunks_owner on public.note_chunks(user_id,note_id,revision);
create table public.jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, note_id uuid,
 kind text not null check(kind in ('index','export','delete_account')), revision integer,
 state text not null default 'pending' check(state in ('pending','running','done','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(), lease_until timestamptz,
 lease_token uuid, error_code text, created_at timestamptz not null default now()
);
create index jobs_pending on public.jobs(state,available_at);
create unique index jobs_index_unique on public.jobs(note_id,revision) where kind='index';
create table public.exports (
 id uuid primary key references public.jobs(id) on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 path text, state text not null default 'pending', expires_at timestamptz not null default now()+interval '24 hours',
 epoch bigint not null, created_at timestamptz not null default now()
);
create table public.ai_requests (
 id uuid primary key, user_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(), finished_at timestamptz, tokens integer not null default 0, model text
);
create index ai_requests_day on public.ai_requests(created_at,user_id);
alter table public.profiles enable row level security;
alter table public.notes enable row level security;
alter table public.note_chunks enable row level security;
alter table public.jobs enable row level security;
alter table public.exports enable row level security;
alter table public.ai_requests enable row level security;
create policy profile_read on public.profiles for select to authenticated using(user_id=auth.uid());
create policy notes_read on public.notes for select to authenticated using(user_id=auth.uid() and public.active_account());
create policy chunks_read on public.note_chunks for select to authenticated using(user_id=auth.uid() and public.active_account() and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.ai_enabled) and exists(select 1 from public.notes n where n.id=note_id and n.revision=note_chunks.revision and not n.ai_excluded and n.deleted_at is null));
create policy exports_read on public.exports for select to authenticated using(user_id=auth.uid() and public.active_account());
create policy usage_read on public.ai_requests for select to authenticated using(user_id=auth.uid() and public.active_account());
revoke all on public.profiles,public.notes,public.note_chunks,public.jobs,public.exports,public.ai_requests from anon,authenticated;
grant select on public.profiles,public.notes,public.note_chunks,public.exports,public.ai_requests to authenticated;

create function public.save_note(p_id uuid,p_revision integer,p_title text,p_content jsonb,p_text text,p_tags text[],p_pinned boolean,p_excluded boolean) returns public.notes language plpgsql security definer set search_path='' as $$
declare n public.notes; p public.profiles;
begin
 select * into p from public.profiles where user_id=auth.uid() for update;
 if p.user_id is null or p.state<>'active' then raise exception 'UNAUTHORIZED'; end if;
 if length(p_title)>240 or length(p_text)>100000 or pg_column_size(p_content)>1000000 or cardinality(p_tags)>20 then raise exception 'VALIDATION'; end if;
 if exists(select 1 from unnest(p_tags) t where length(t)>40) then raise exception 'VALIDATION'; end if;
 select * into n from public.notes where id=p_id and user_id=auth.uid() for update;
 if n.id is null then
   if p_revision<>0 then raise exception 'NOT_FOUND'; end if;
   if (select count(*) from public.notes where user_id=auth.uid() and deleted_at is null)>=5000 then raise exception 'NOTE_LIMIT'; end if;
   insert into public.notes(id,user_id,title,content,plain_text,tags,pinned,ai_excluded) values(p_id,auth.uid(),p_title,p_content,p_text,p_tags,p_pinned,p_excluded) returning * into n;
 else
   if n.revision<>p_revision then raise exception 'CONFLICT'; end if;
   if n.deleted_at is not null then raise exception 'TRASHED'; end if;
   update public.notes set title=p_title,content=p_content,plain_text=p_text,tags=p_tags,pinned=p_pinned,ai_excluded=p_excluded,revision=revision+1,updated_at=now() where id=p_id returning * into n;
 end if;
 update public.profiles set privacy_epoch=privacy_epoch+1 where user_id=auth.uid();
 if p_excluded then delete from public.note_chunks where note_id=p_id; end if;
 if p.ai_enabled and not n.ai_excluded then
 insert into public.jobs(user_id,note_id,kind,revision) values(auth.uid(),n.id,'index',n.revision) on conflict do nothing;
 end if;
 return n;
end $$;

create function public.note_action(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 select * into p from public.profiles where user_id=auth.uid() for update;
 if p.state is distinct from 'active' then raise exception 'UNAUTHORIZED'; end if;
 if not exists(select 1 from public.notes where id=p_id and user_id=auth.uid()) then raise exception 'NOT_FOUND'; end if;
 if p_action='trash' then update public.notes set deleted_at=now(),revision=revision+1 where id=p_id and deleted_at is null;
 elsif p_action='restore' then
 update public.notes set deleted_at=null,revision=revision+1,updated_at=now() where id=p_id and deleted_at is not null;
 insert into public.jobs(user_id,note_id,kind,revision) select user_id,id,'index',revision from public.notes where id=p_id and not ai_excluded and p.ai_enabled on conflict do nothing;
 elsif p_action='delete' then
   if exists(select 1 from public.notes where id=p_id and deleted_at is null) then raise exception 'TRASH_FIRST'; end if;
   delete from public.notes where id=p_id;
   update public.exports set state='expired' where user_id=auth.uid();
 else raise exception 'VALIDATION'; end if;
 delete from public.note_chunks where note_id=p_id;
 update public.profiles set privacy_epoch=privacy_epoch+1 where user_id=auth.uid();
end $$;

create function public.set_ai(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.active_account() then raise exception 'UNAUTHORIZED'; end if;
 update public.profiles set ai_enabled=p_enabled,privacy_epoch=privacy_epoch+1 where user_id=auth.uid();
 if not p_enabled then delete from public.note_chunks where user_id=auth.uid();
 else
 insert into public.jobs(user_id,note_id,kind,revision) select user_id,id,'index',revision from public.notes where user_id=auth.uid() and deleted_at is null and not ai_excluded
 on conflict(note_id,revision) where kind='index' do update set state='pending',attempts=0,available_at=now();
 end if;
end $$;

create function public.match_chunks(p_embedding extensions.vector(1536),p_model text,p_query text) returns table(id uuid,note_id uuid,revision integer,title text,text text,score double precision) language sql stable security invoker set search_path='' as $$
 select c.id,c.note_id,c.revision,n.title,c.text,
 (1-(c.embedding OPERATOR(extensions.<=>) p_embedding)) + least(ts_rank_cd(n.search_vector,websearch_to_tsquery('simple',p_query)),0.3)::double precision as score
 from public.note_chunks c join public.notes n on n.id=c.note_id and n.revision=c.revision
 where c.model=p_model and c.user_id=auth.uid() and not n.ai_excluded and n.deleted_at is null
 order by score desc limit 20;
$$;

create function public.reserve_ai(p_id uuid,p_daily integer,p_global integer) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(837241);
 if not public.active_account() or not exists(select 1 from public.profiles where user_id=auth.uid() and ai_enabled) then raise exception 'AI_DISABLED'; end if;
 if exists(select 1 from public.ai_requests where id=p_id) then raise exception 'DUPLICATE_REQUEST'; end if;
 if (select count(*) from public.ai_requests where user_id=auth.uid() and created_at>=date_trunc('day',now()))>=least(p_daily,100) or
 (select count(*) from public.ai_requests where created_at>=date_trunc('day',now()))>=least(p_global,10000) or
 (select count(*) from public.ai_requests where user_id=auth.uid() and finished_at is null and created_at>now()-interval '2 minutes')>=2 then raise exception 'RATE_LIMIT'; end if;
 insert into public.ai_requests(id,user_id) values(p_id,auth.uid());
end $$;
create function public.finish_ai(p_id uuid,p_tokens integer,p_model text) returns void language plpgsql security definer set search_path='' as $$
begin update public.ai_requests set finished_at=now(),tokens=greatest(p_tokens,0),model=p_model where id=p_id and user_id=auth.uid(); end $$;
create function public.request_export() returns uuid language plpgsql security definer set search_path='' as $$
declare j uuid; p public.profiles;
begin
 select * into p from public.profiles where user_id=auth.uid() for update;
 if p.state is distinct from 'active' then raise exception 'UNAUTHORIZED'; end if;
 if (select count(*) from public.exports where user_id=auth.uid() and created_at>now()-interval '1 hour')>=3 then raise exception 'RATE_LIMIT'; end if;
 insert into public.jobs(user_id,kind) values(auth.uid(),'export') returning id into j;
 insert into public.exports(id,user_id,epoch) values(j,auth.uid(),p.privacy_epoch); return j;
end $$;
create function public.begin_delete() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.active_account() then raise exception 'UNAUTHORIZED'; end if;
 update public.profiles set state='deleting',ai_enabled=false,privacy_epoch=privacy_epoch+1 where user_id=auth.uid();
 insert into public.jobs(user_id,kind) values(auth.uid(),'delete_account');
 update public.exports set state='expired' where user_id=auth.uid();
end $$;

create function public.claim_jobs() returns setof public.jobs language plpgsql security definer set search_path='' as $$
begin return query
 update public.jobs set state='running',lease_until=now()+interval '90 seconds',lease_token=gen_random_uuid(),attempts=attempts+1
 where id in(select id from public.jobs where ((state='pending' and available_at<=now()) or (state='running' and lease_until<now())) and attempts<5 order by created_at for update skip locked limit 3) returning *;
end $$;
create function public.publish_chunks(p_job uuid,p_lease uuid,p_chunks jsonb,p_model text) returns boolean language plpgsql security definer set search_path='' as $$
declare j public.jobs; n public.notes; p public.profiles; c jsonb;
begin
 select * into j from public.jobs where id=p_job and lease_token=p_lease and state='running' for update;
 if j.id is null then return false; end if;
 select * into p from public.profiles where user_id=j.user_id for update;
 select * into n from public.notes where id=j.note_id for update;
 if p.state is distinct from 'active' or not p.ai_enabled or n.id is null or n.revision<>j.revision or n.ai_excluded or n.deleted_at is not null then
 update public.jobs set state='done' where id=j.id; return false; end if;
 delete from public.note_chunks where note_id=n.id;
 for c in select * from jsonb_array_elements(p_chunks) loop
 insert into public.note_chunks(user_id,note_id,revision,ordinal,text,embedding,model) values(n.user_id,n.id,n.revision,(c->>'ordinal')::integer,c->>'text',(c->>'embedding')::extensions.vector,p_model);
 end loop;
 update public.jobs set state='done' where id=j.id; return true;
end $$;

-- No function is callable merely because it lives in the public schema.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.active_account() to authenticated;
grant execute on function public.save_note(uuid,integer,text,jsonb,text,text[],boolean,boolean),public.note_action(uuid,text),public.set_ai(boolean),public.match_chunks(extensions.vector,text,text),public.reserve_ai(uuid,integer,integer),public.finish_ai(uuid,integer,text),public.request_export(),public.begin_delete() to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('exports','exports',false,52428800) on conflict do nothing;
-- Only service-side worker and authenticated app download endpoint access export objects.
-- No browser Storage policies are granted; owning an object path alone grants no access.
