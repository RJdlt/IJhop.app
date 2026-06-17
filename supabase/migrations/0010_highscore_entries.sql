-- Prijzenactie-inzendingen (consent-first). Draai dit in de Supabase SQL-editor.
-- Alleen admins kunnen lezen; insert kan uitsluitend via de RPC mét toestemming.

create table if not exists public.highscore_entries (
  id uuid primary key default gen_random_uuid(),
  game_id text not null default 'ponthop',
  score integer not null,
  email text not null,
  consent boolean not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists highscore_entries_created_idx on public.highscore_entries (created_at desc);

alter table public.highscore_entries enable row level security;
-- Bewust geen policies: geen directe client-toegang (lezen noch schrijven).

-- Insert met expliciete toestemming. Zonder consent of geldig e-mailadres: niets.
create or replace function public.submit_highscore_entry(p_game_id text, p_score int, p_email text, p_consent boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_consent is not true then raise exception 'toestemming vereist'; end if;
  if coalesce(trim(p_email), '') = '' or position('@' in p_email) = 0 then
    raise exception 'geldig e-mailadres vereist';
  end if;
  insert into public.highscore_entries(game_id, score, email, consent, user_id)
  values (coalesce(nullif(trim(p_game_id), ''), 'ponthop'),
          greatest(0, coalesce(p_score, 0)),
          lower(trim(p_email)), true, auth.uid());
  return json_build_object('ok', true);
end; $$;

-- Admin-only lijst voor het dashboard / export.
create or replace function public.admin_list_highscore_entries()
returns table(id uuid, game_id text, score int, email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, game_id, score, email, created_at
  from public.highscore_entries
  where public.is_admin()
  order by created_at desc
  limit 2000;
$$;

grant execute on function public.submit_highscore_entry(text, int, text, boolean) to anon, authenticated;
grant execute on function public.admin_list_highscore_entries() to authenticated;
