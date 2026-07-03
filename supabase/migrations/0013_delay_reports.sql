-- 0013: Community-vertragingsmeldingen ("Vertraagd?"), anoniem en met rem.
-- Draai dit ná 0012 in de Supabase SQL-editor. Idempotent.
--
-- Ontwerp:
-- * Eén melding per gebruiker per lijn per 20 minuten, server-side afgedwongen.
-- * Alleen geaggregeerde tellingen zijn uitleesbaar (nooit wie er meldde).
-- * Meldingen verlopen vanzelf (rolling window van 20 minuten); oude rijen
--   worden opportunistisch opgeruimd bij elke nieuwe melding (geen cron nodig).

create table if not exists public.delay_reports (
  id uuid primary key default gen_random_uuid(),
  line_id text not null check (line_id ~ '^[A-Z0-9]{1,6}$'),
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists delay_reports_line_time_idx on public.delay_reports (line_id, created_at desc);
create index if not exists delay_reports_user_idx on public.delay_reports (user_id, line_id, created_at desc);

alter table public.delay_reports enable row level security;
-- Bewust géén policies: alle toegang loopt via de RPC's hieronder.

-- Meld een vertraging. Retourneert het actuele aantal meldingen voor de lijn.
create or replace function public.report_delay(p_line text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  active int;
begin
  if uid is null then
    raise exception 'not authorized';
  end if;
  if p_line is null or p_line !~ '^[A-Z0-9]{1,6}$' then
    raise exception 'invalid line';
  end if;

  -- Rem: één melding per gebruiker per lijn per 20 minuten.
  if exists (
    select 1 from delay_reports
    where user_id = uid and line_id = p_line
      and created_at > now() - interval '20 minutes'
  ) then
    select count(*) into active from delay_reports
      where line_id = p_line and created_at > now() - interval '20 minutes';
    return json_build_object('ok', false, 'already', true, 'reports', active);
  end if;

  insert into delay_reports (line_id, user_id) values (p_line, uid);
  -- Opportunistische opschoning: houd de tabel klein zonder cron.
  delete from delay_reports where created_at < now() - interval '2 hours';

  select count(*) into active from delay_reports
    where line_id = p_line and created_at > now() - interval '20 minutes';
  return json_build_object('ok', true, 'reports', active);
end; $$;

-- Anonieme tellingen per lijn over de laatste 20 minuten.
create or replace function public.delay_counts()
returns table(line_id text, reports bigint, latest timestamptz)
language sql stable security definer set search_path = public as $$
  select line_id, count(*)::bigint, max(created_at)
  from delay_reports
  where created_at > now() - interval '20 minutes'
  group by line_id;
$$;

grant execute on function public.report_delay(text) to authenticated;
grant execute on function public.delay_counts() to authenticated;
