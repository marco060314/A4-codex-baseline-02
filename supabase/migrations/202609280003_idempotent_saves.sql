-- A retry after a lost response returns the existing identical committed revision.
create or replace function public.save_note(p_id uuid,p_revision integer,p_title text,p_content jsonb,p_text text,p_tags text[],p_pinned boolean,p_excluded boolean) returns public.notes language plpgsql security definer set search_path='' as $$
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
   if n.deleted_at is null and n.revision=p_revision+1 and n.title=p_title and n.content=p_content and n.plain_text=p_text and n.tags=p_tags and n.pinned=p_pinned and n.ai_excluded=p_excluded then return n; end if;
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
