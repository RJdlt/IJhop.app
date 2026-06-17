-- Naam toevoegen aan prijs-inzendingen. Idempotent: veilig meermaals te draaien.
-- Draai dit ná 0010 in de Supabase SQL-editor.

alter table public.highscore_entries add column if not exists name text;

-- Insert-RPC mét naam (vervangt de oude 4-argument-versie).
drop function if exists public.submit_highscore_entry(text, int, text, boolean);
create or replace function public.submit_highscore_entry(p_game_id text, p_score int, p_name text, p_email text, p_consent boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_consent is not true then raise exception 'toestemming vereist'; end if;
  if coalesce(trim(p_email), '') = '' or position('@' in p_email) = 0 then
    raise exception 'geldig e-mailadres vereist';
  end if;
  insert into public.highscore_entries(game_id, score, name, email, consent, user_id)
  values (coalesce(nullif(trim(p_game_id), ''), 'ponthop'),
          greatest(0, coalesce(p_score, 0)),
          nullif(trim(p_name), ''),
          lower(trim(p_email)), true, auth.uid());
  return json_build_object('ok', true);
end; $$;

-- Admin-lijst mét naam (return-type wijzigt, dus eerst droppen).
drop function if exists public.admin_list_highscore_entries();
create or replace function public.admin_list_highscore_entries()
returns table(id uuid, game_id text, score int, name text, email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, game_id, score, name, email, created_at
  from public.highscore_entries
  where public.is_admin()
  order by created_at desc
  limit 2000;
$$;

grant execute on function public.submit_highscore_entry(text, int, text, text, boolean) to anon, authenticated;
grant execute on function public.admin_list_highscore_entries() to authenticated;
