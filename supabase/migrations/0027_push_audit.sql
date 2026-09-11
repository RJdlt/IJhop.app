-- 0027: verstuurde meldingen bijhouden, per abonnee ontdubbelen, en een
-- blokkeerlijst. Draai dit in de Supabase SQL-editor, na 0026.
--
-- Aanleiding: op 11 september ging een omleiding van tram 25 als
-- "veerstoring" naar alle abonnees, ook naar iemand met alleen F4 en F9. De
-- oorzaak zat in het filter (zie api/_lib/ferryAlerts.mjs), maar er was geen
-- enkele manier om achteraf te zien wát er naar wie gestuurd was. Dat is het
-- echte probleem dat deze migratie oplost: zonder registratie is elke klacht
-- over een onterechte melding een gok.
--
-- Drie dingen:
--
-- 1) `push_sent_to`: per (alert, abonnee) één regel. Ontdubbelen gebeurde
--    eerder alleen globaal in `push_sent`, met de alert-id als primaire
--    sleutel. Dat betekende dat wie zich ná een melding abonneerde hem nooit
--    meer kreeg, en dat een tweede poging voor een geslaagde abonnee niet te
--    onderscheiden was van een eerste voor een nieuwe. Nu telt de combinatie.
--
-- 2) `push_alert_changes`: GVB hergebruikt dezelfde KV15-id bij een gewijzigde
--    tekst. Die wijziging leidt bewust niet tot een nieuwe melding (dan zou
--    één storing drie keer trillen), maar we leggen hem apart vast zodat
--    zichtbaar is dat de tekst veranderde.
--
-- 3) `push_alert_blocklist`: één knop in het dashboard om een alert-id nooit
--    meer te versturen. Voor het geval dat het filter er weer eens naast zit;
--    dan hoef je niet te wachten op een nieuwe deploy.

-- ---- Wat er naar wie ging ----------------------------------------------------

create table if not exists public.push_sent_to (
  alert_id text not null,
  endpoint text not null,
  sent_at timestamptz not null default now(),
  primary key (alert_id, endpoint)
);
create index if not exists push_sent_to_alert_idx on public.push_sent_to (alert_id);

-- `push_sent` bestond al met alleen alert_id en sent_at; de rest is voor het
-- dashboard, zodat een melding achteraf te herkennen is zonder de feed erbij.
alter table public.push_sent add column if not exists header text;
alter table public.push_sent add column if not exists lines text[];
alter table public.push_sent add column if not exists network_wide boolean not null default false;
alter table public.push_sent add column if not exists recipients int not null default 0;

create table if not exists public.push_alert_changes (
  id uuid primary key default gen_random_uuid(),
  alert_id text not null,
  old_header text,
  new_header text,
  seen_at timestamptz not null default now()
);
create index if not exists push_alert_changes_alert_idx on public.push_alert_changes (alert_id, seen_at desc);

create table if not exists public.push_alert_blocklist (
  alert_id text primary key,
  reason text,
  blocked_by uuid,
  created_at timestamptz not null default now()
);

alter table public.push_sent_to enable row level security;
alter table public.push_alert_changes enable row level security;
alter table public.push_alert_blocklist enable row level security;
-- Geen policies: alleen de service-role (serverless) en de admin-functies.

-- ---- Voor het dashboard ------------------------------------------------------

create or replace function public.admin_list_push_sent(p_days int default 30)
returns table(alert_id text, header text, lines text[], network_wide boolean,
              recipients int, sent_at timestamptz, blocked boolean,
              block_reason text, changes int)
language sql stable security definer set search_path = public as $$
  select s.alert_id, s.header, s.lines, s.network_wide,
         -- Tellen uit push_sent_to; de kolom in push_sent is een momentopname
         -- van de eerste ronde en die kan achterlopen.
         greatest(s.recipients,
                  (select count(*)::int from public.push_sent_to t where t.alert_id = s.alert_id)),
         s.sent_at,
         (b.alert_id is not null),
         b.reason,
         (select count(*)::int from public.push_alert_changes c where c.alert_id = s.alert_id)
  from public.push_sent s
  left join public.push_alert_blocklist b on b.alert_id = s.alert_id
  where public.is_admin()
    and s.sent_at >= now() - make_interval(days => greatest(1, least(365, coalesce(p_days, 30))))
  order by s.sent_at desc
  limit 200;
$$;

/* Zet een alert op de blokkeerlijst. Werkt met terugwerkende kracht in die zin
   dat hij nooit meer verstuurd wordt, ook niet als GVB de tekst aanpast. */
create or replace function public.admin_block_alert(p_alert_id text, p_reason text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_alert_id), '') = '' then raise exception 'geen alert opgegeven'; end if;
  insert into public.push_alert_blocklist (alert_id, reason, blocked_by)
  values (trim(p_alert_id), nullif(trim(p_reason), ''), auth.uid())
  on conflict (alert_id) do update
    set reason = excluded.reason, blocked_by = excluded.blocked_by, created_at = now();
  return json_build_object('ok', true, 'alert_id', trim(p_alert_id));
end; $$;

create or replace function public.admin_unblock_alert(p_alert_id text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  weg int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.push_alert_blocklist where alert_id = trim(p_alert_id);
  get diagnostics weg = row_count;
  return json_build_object('ok', true, 'removed', weg);
end; $$;

grant execute on function public.admin_list_push_sent(int) to authenticated;
grant execute on function public.admin_block_alert(text, text) to authenticated;
grant execute on function public.admin_unblock_alert(text) to authenticated;
