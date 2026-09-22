-- Event visibility and atomic creation through Supabase PostgREST.

drop policy if exists participants_authenticated_access on patopay.event_participants;
create policy participants_authenticated_access on patopay.event_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from patopay.events e
      where e.id = event_id
        and (
          e.owner_id = auth.uid()
          or exists (
            select 1
            from patopay.event_participants visible_members
            where visible_members.event_id = e.id
              and visible_members.user_id = auth.uid()
          )
        )
    )
  );

create or replace function patopay.create_event_with_owner(p_name text)
returns patopay.events
language plpgsql
security invoker
set search_path = patopay, public
as $$
declare
  v_actor uuid := auth.uid();
  v_event patopay.events;
begin
  if v_actor is null then
    raise exception 'authenticated actor required' using errcode = '28000';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception 'event name is invalid' using errcode = '22023';
  end if;

  insert into patopay.events (owner_id, name)
  values (v_actor, trim(p_name))
  returning * into v_event;

  insert into patopay.event_participants (event_id, user_id, role)
  values (v_event.id, v_actor, 'owner');

  return v_event;
end;
$$;

grant execute on function patopay.create_event_with_owner(text) to authenticated;
