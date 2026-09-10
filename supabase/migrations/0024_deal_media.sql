-- 0024: logo's en foto's bij Pontdeals, plus de meting per kaartvorm.
-- Draai dit in de Supabase SQL-editor, na 0019 tot en met 0023. Volledige
-- vervanging van analytics_dashboard, zoals eerder: alles uit de vorige
-- migraties zit hierin.
--
-- Drie dingen:
--
-- 1) Een opslagbak `partner-media`. Publiek leesbaar, want de plaatjes staan
--    op het klokscherm van iedereen. Schrijven mag alleen een admin, en de
--    controle daarop staat in de policy zelf en niet in de app.
--
-- 2) `deals.photo_url`: een eigen foto per deal. Staat die er niet, dan valt
--    de kaart terug op de foto van de partner. Zo hoeft een zaak maar één
--    keer iets aan te leveren, maar kan een losse deal wel een eigen beeld
--    krijgen.
--
-- 3) `card_mode` en `has_photo` in de meting. De kaart ziet er 's ochtends
--    anders uit dan 's avonds; zonder deze twee weet je straks niet of een
--    hoger claim-percentage aan de foto lag of aan het tijdstip.

-- ---- Opslag -----------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('partner-media', 'partner-media', true)
on conflict (id) do update set public = true;

drop policy if exists "partner-media openbaar leesbaar" on storage.objects;
create policy "partner-media openbaar leesbaar" on storage.objects
  for select using (bucket_id = 'partner-media');

drop policy if exists "partner-media alleen admins schrijven" on storage.objects;
create policy "partner-media alleen admins schrijven" on storage.objects
  for insert with check (bucket_id = 'partner-media' and public.is_admin());

drop policy if exists "partner-media alleen admins bijwerken" on storage.objects;
create policy "partner-media alleen admins bijwerken" on storage.objects
  for update using (bucket_id = 'partner-media' and public.is_admin());

drop policy if exists "partner-media alleen admins verwijderen" on storage.objects;
create policy "partner-media alleen admins verwijderen" on storage.objects
  for delete using (bucket_id = 'partner-media' and public.is_admin());

-- ---- Foto's ------------------------------------------------------------------

alter table public.partners add column if not exists photo_url text;
alter table public.deals add column if not exists photo_url text;

-- Partner opslaan, nu met foto erbij.
create or replace function public.admin_save_partner(
  p_id uuid, p_slug text, p_name text, p_logo_url text default null,
  p_address text default null, p_lat double precision default null,
  p_lng double precision default null, p_photo_url text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  nieuw_id uuid;
  v_slug text := lower(regexp_replace(coalesce(trim(p_slug), ''), '[^a-zA-Z0-9-]', '-', 'g'));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if v_slug = '' or coalesce(trim(p_name), '') = '' then raise exception 'naam en slug zijn verplicht'; end if;

  if p_id is null then
    insert into public.partners(slug, name, logo_url, address, lat, lng, photo_url)
    values (v_slug, trim(p_name), nullif(trim(p_logo_url), ''), nullif(trim(p_address), ''),
            p_lat, p_lng, nullif(trim(p_photo_url), ''))
    returning id into nieuw_id;
  else
    -- Een leeg meegegeven plaatje betekent "niet aanraken", niet "wissen".
    -- Anders veegt een formulier dat alleen het adres bijwerkt het logo weg.
    update public.partners
       set slug = v_slug,
           name = trim(p_name),
           logo_url = coalesce(nullif(trim(p_logo_url), ''), logo_url),
           address = nullif(trim(p_address), ''),
           lat = p_lat, lng = p_lng,
           photo_url = coalesce(nullif(trim(p_photo_url), ''), photo_url)
     where id = p_id
    returning id into nieuw_id;
    if nieuw_id is null then raise exception 'partner niet gevonden'; end if;
  end if;
  return json_build_object('id', nieuw_id);
end; $$;

-- Losse zetter voor de plaatjes, zodat het uploadformulier niet de hele
-- partner hoeft mee te sturen. `null` wist hier wél: dat is een expliciete
-- keuze van de beheerder ("haal die foto weg").
create or replace function public.admin_set_partner_media(
  p_id uuid, p_logo_url text, p_photo_url text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  geraakt int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_id is null then raise exception 'geen partner gekozen'; end if;
  update public.partners
     set logo_url = nullif(trim(coalesce(p_logo_url, '')), ''),
         photo_url = nullif(trim(coalesce(p_photo_url, '')), '')
   where id = p_id;
  get diagnostics geraakt = row_count;
  if geraakt = 0 then raise exception 'partner niet gevonden'; end if;
  return json_build_object('ok', true);
end; $$;

-- Deal opslaan, met eigen foto en een verplichte looptijd.
create or replace function public.admin_save_deal(
  p_id uuid, p_partner uuid, p_offer text, p_stop text, p_lines text[],
  p_walk_min int, p_valid_from timestamptz, p_valid_to timestamptz, p_status text,
  p_photo_url text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  nieuw_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_offer), '') = '' then raise exception 'aanbod is verplicht'; end if;
  if p_valid_to <= p_valid_from then raise exception 'einde ligt voor het begin'; end if;
  -- Verplicht: zonder looptijd staat er "bij de steiger" en dat zegt niets.
  if p_walk_min is null or p_walk_min < 1 then
    raise exception 'looptijd vanaf de steiger is verplicht';
  end if;

  if p_id is null then
    insert into public.deals(partner_id, offer, stop_id, lines, walk_min, valid_from, valid_to, status, photo_url)
    values (p_partner, trim(p_offer), p_stop, coalesce(p_lines, '{}'), p_walk_min,
            p_valid_from, p_valid_to, coalesce(p_status, 'concept'), nullif(trim(p_photo_url), ''))
    returning id into nieuw_id;
  else
    update public.deals
       set partner_id = p_partner, offer = trim(p_offer), stop_id = p_stop,
           lines = coalesce(p_lines, '{}'), walk_min = p_walk_min,
           valid_from = p_valid_from, valid_to = p_valid_to,
           status = coalesce(p_status, status),
           photo_url = nullif(trim(p_photo_url), '')
     where id = p_id
    returning id into nieuw_id;
    if nieuw_id is null then raise exception 'deal niet gevonden'; end if;
  end if;
  return json_build_object('id', nieuw_id);
end; $$;

-- De app krijgt de foto's mee. `photo_url` van de deal gaat voor die van de
-- partner; is er geen van beide, dan blijft hij null en toont de kaart alleen
-- het logo, zonder leeg vlak.
create or replace function public.pontdeal(p_stops text[] default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  gekozen public.deals;
  volgende public.deals;
  p public.partners;
  np public.partners;
  eigen public.deal_codes;
  week_count int := 0;
  heeft_voorkeur boolean := coalesce(array_length(p_stops, 1), 0) > 0;
begin
  select d.* into gekozen
  from public.deals d
  where d.status = 'actief'
    and now() >= d.valid_from and now() <= d.valid_to
    and (not heeft_voorkeur or d.stop_id = any(p_stops))
  order by (heeft_voorkeur and d.stop_id = any(p_stops)) desc, d.valid_to asc
  limit 1;

  select d.* into volgende
  from public.deals d
  where d.status = 'actief'
    and d.valid_from > now()
    and (not heeft_voorkeur or d.stop_id = any(p_stops))
  order by d.valid_from asc
  limit 1;

  if gekozen.id is not null then
    select * into p from public.partners where id = gekozen.partner_id;
    select count(*)::int into week_count
      from public.deal_codes c
     where c.deal_id = gekozen.id and c.redeemed_at is not null and not c.preview;
    select * into eigen
      from public.deal_codes c
     where c.deal_id = gekozen.id and c.user_id = auth.uid() and not c.preview;
  end if;
  if volgende.id is not null then
    select * into np from public.partners where id = volgende.partner_id;
  end if;

  return json_build_object(
    'preview', false,
    'deal', case when gekozen.id is null then null else json_build_object(
      'id', gekozen.id,
      'offer', gekozen.offer,
      'stop_id', gekozen.stop_id,
      'lines', gekozen.lines,
      'walk_min', gekozen.walk_min,
      'valid_from', gekozen.valid_from,
      'valid_to', gekozen.valid_to,
      'photo_url', coalesce(gekozen.photo_url, p.photo_url),
      'partner', json_build_object('name', p.name, 'slug', p.slug, 'logo_url', p.logo_url,
                                   'address', p.address, 'lat', p.lat, 'lng', p.lng)
    ) end,
    'next', case when volgende.id is null then null else json_build_object(
      'valid_from', volgende.valid_from,
      'stop_id', volgende.stop_id,
      'partner', json_build_object('name', np.name, 'logo_url', np.logo_url)
    ) end,
    'redeemed_week', week_count,
    'my_code', case when eigen.id is null then null else json_build_object(
      'code', eigen.code, 'redeemed_at', eigen.redeemed_at, 'preview', false) end
  );
end; $$;

create or replace function public.admin_preview_deal(p_deal uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  d public.deals;
  p public.partners;
  eigen public.deal_codes;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select * into d from public.deals where id = p_deal;
  if d.id is null then raise exception 'deal niet gevonden'; end if;
  select * into p from public.partners where id = d.partner_id;
  select * into eigen from public.deal_codes
   where deal_id = d.id and user_id = auth.uid() and preview;

  return json_build_object(
    'preview', true,
    'deal', json_build_object(
      'id', d.id,
      'offer', d.offer,
      'stop_id', d.stop_id,
      'lines', d.lines,
      'walk_min', d.walk_min,
      'valid_from', d.valid_from,
      'valid_to', d.valid_to,
      'status', d.status,
      'photo_url', coalesce(d.photo_url, p.photo_url),
      'partner', json_build_object('name', p.name, 'slug', p.slug, 'logo_url', p.logo_url,
                                   'address', p.address, 'lat', p.lat, 'lng', p.lng)
    ),
    'next', null,
    'redeemed_week', 0,
    'my_code', case when eigen.id is null then null else json_build_object(
      'code', eigen.code, 'redeemed_at', eigen.redeemed_at, 'preview', true) end
  );
end; $$;

drop function if exists public.admin_list_deals();
create or replace function public.admin_list_deals()
returns table(id uuid, partner_id uuid, partner_name text, partner_slug text, offer text,
              stop_id text, lines text[], walk_min int, valid_from timestamptz,
              valid_to timestamptz, status text, codes int, redeemed int, preview_codes int,
              photo_url text, partner_photo_url text, partner_logo_url text)
language sql stable security definer set search_path = public as $$
  select d.id, d.partner_id, p.name, p.slug, d.offer, d.stop_id, d.lines, d.walk_min,
         d.valid_from, d.valid_to, d.status,
         (select count(*)::int from public.deal_codes c where c.deal_id = d.id and not c.preview),
         (select count(*)::int from public.deal_codes c
           where c.deal_id = d.id and c.redeemed_at is not null and not c.preview),
         (select count(*)::int from public.deal_codes c where c.deal_id = d.id and c.preview),
         d.photo_url, p.photo_url, p.logo_url
  from public.deals d
  join public.partners p on p.id = d.partner_id
  where public.is_admin()
  order by d.valid_from desc;
$$;

drop function if exists public.admin_list_partners();
create or replace function public.admin_list_partners()
returns table(id uuid, slug text, name text, logo_url text, photo_url text, address text,
              has_pin boolean, locked_until timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.name, p.logo_url, p.photo_url, p.address,
         p.pin_hash is not null, p.locked_until, p.created_at
  from public.partners p
  where public.is_admin()
  order by p.name;
$$;

grant execute on function public.admin_save_partner(uuid, text, text, text, text, double precision, double precision, text) to authenticated;
grant execute on function public.admin_set_partner_media(uuid, text, text) to authenticated;
grant execute on function public.admin_save_deal(uuid, uuid, text, text, text[], int, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.admin_list_deals() to authenticated;
grant execute on function public.admin_list_partners() to authenticated;
grant execute on function public.pontdeal(text[]) to anon, authenticated;
grant execute on function public.admin_preview_deal(uuid) to authenticated;

-- ---- Het dashboard: kaartvorm en foto erbij ---------------------------------
--
-- Zelfde functie als in 0023, met twee uitsplitsingen erbij in het
-- Pontdeals-blok: het claim-percentage per kaartvorm (compact, normaal, vol)
-- en met of zonder foto. Zonder die twee weet je bij een verschil niet of het
-- aan de foto lag of aan het tijdstip waarop de kaart getoond werd.
--
-- Testcodes blijven overal uitgesloten, net als in 0022.

create or replace function public.analytics_dashboard(p_days int default 30, p_include_own boolean default false)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  result json;
  all_time boolean := coalesce(p_days, 30) <= 0;
  d int := least(greatest(coalesce(p_days, 30), 1), 3650);
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  start_day date;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if all_time then
    -- Vanaf het eerste echte event ooit; zelfde schoonmaakregels als `ev`.
    select coalesce(min((created_at at time zone 'Europe/Amsterdam')::date), today)
      into start_day
      from analytics_events
     where session_id not like 'test-%'
       and (p_include_own or user_id not in (select user_id from public.admins));
  else
    start_day := today - (d - 1);
  end if;

  with ev as ( -- schone events: geen test-data, optioneel zonder admin-activiteit
    select user_id, session_id, name, props, created_at,
           (created_at at time zone 'Europe/Amsterdam') as local_ts
    from analytics_events
    where session_id not like 'test-%'
      and (p_include_own or user_id not in (select user_id from public.admins))
  ),
  win as ( -- het gekozen venster (lokale dagen)
    select * from ev where local_ts::date >= start_day
  ),
  by_day as (
    select local_ts::date as day,
           count(distinct user_id)::int as users,
           count(distinct session_id)::int as sessions,
           count(*)::int as events
    from win group by 1
  ),
  daily as ( -- aangevuld met echte nullen
    select gs.day::date as day,
           coalesce(b.users, 0) as users, coalesce(b.sessions, 0) as sessions, coalesce(b.events, 0) as events
    from generate_series(start_day, today, interval '1 day') gs(day)
    left join by_day b on b.day = gs.day::date
  ),
  by_week as ( -- unieke tellingen per ISO-week (maandag = weekstart)
    select date_trunc('week', local_ts)::date as week_start,
           count(distinct user_id)::int as users,
           count(distinct session_id)::int as sessions,
           count(*)::int as events
    from win group by 1
  ),
  weekly as ( -- ook hier echte nullen voor weken zonder metingen
    select gs.w::date as week_start,
           coalesce(b.users, 0) as users, coalesce(b.sessions, 0) as sessions, coalesce(b.events, 0) as events
    from generate_series(
           date_trunc('week', start_day::timestamp),
           date_trunc('week', today::timestamp),
           interval '1 week') gs(w)
    left join by_week b on b.week_start = gs.w::date
  ),
  first_seen as ( -- állereerste event per gebruiker, ook van vóór het venster
    select user_id, date_trunc('week', min(local_ts))::date as first_week
    from ev group by user_id
  ),
  week_users as ( -- welke gebruiker was in welke week actief (binnen het venster)
    select date_trunc('week', local_ts)::date as week_start, user_id
    from win group by 1, 2
  ),
  by_newret as (
    select wu.week_start,
           count(*) filter (where fs.first_week >= wu.week_start)::int as nieuw,
           count(*) filter (where fs.first_week <  wu.week_start)::int as terugkerend
    from week_users wu
    join first_seen fs on fs.user_id = wu.user_id
    group by 1
  ),
  newret as ( -- lege weken ook hier als echte nullen
    select gs.w::date as week_start,
           coalesce(b.nieuw, 0) as nieuw, coalesce(b.terugkerend, 0) as terugkerend
    from generate_series(
           date_trunc('week', start_day::timestamp),
           date_trunc('week', today::timestamp),
           interval '1 week') gs(w)
    left join by_newret b on b.week_start = gs.w::date
  ),
  newret_summary as ( -- terugkerend = in minstens één week van het venster niet nieuw
    select count(distinct wu.user_id)::int as users,
           count(distinct wu.user_id) filter (where fs.first_week < wu.week_start)::int as returning_users
    from week_users wu
    join first_seen fs on fs.user_id = wu.user_id
  ),
  sess as ( -- funnel-vlaggen per sessie, genest
    select session_id,
           bool_or(name = 'heartbeat'
                   or name in ('ferry_pick', 'delay_report', 'disruption_dismiss',
                               'disruption_link', 'ontmoeting_join', 'ontmoeting_found',
                               'ontmoeting_matched', 'push_subscribe')) as clock,
           bool_or(name = 'push_subscribe') as notified
    from win group by session_id
  ),
  sdur as ( -- alleen sessies waar we echt een tijdsspanne zagen (>= 5 seconden)
    select session_id, extract(epoch from max(created_at) - min(created_at)) as sec
    from win group by session_id
    having count(*) >= 2
       and extract(epoch from max(created_at) - min(created_at)) >= 5
  ),
  ivar as ( -- install-events met hun variant; alleen wat een variant meestuurt
    select user_id, name, coalesce(props->>'variant', 'onbekend') as variant
    from win
    where name in ('install_prompt_shown', 'install_prompt_dismissed',
                   'install_prompt_ios_help_opened', 'installed')
  ),
  install as (
    select variant,
           count(distinct user_id) filter (where name = 'install_prompt_shown')::int as shown,
           count(distinct user_id) filter (where name = 'install_prompt_dismissed')::int as dismissed,
           count(distinct user_id) filter (where name = 'install_prompt_ios_help_opened')::int as ios_help,
           count(distinct user_id) filter (where name = 'installed')::int as installed
    from ivar group by variant
  ),
  cohort_first as ( -- eerste week ooit per gebruiker, ook van voor het venster
    select user_id, date_trunc('week', min(local_ts))::date as w0
    from ev group by user_id
  ),
  cohort_weeks as ( -- de laatste twaalf cohorten, jongste eerst weggesneden
    select w0, count(*)::int as size
    from cohort_first
    where w0 >= date_trunc('week', (today - 84)::timestamp)::date
    group by w0
  ),
  cohort_act as ( -- actieve gebruikers per cohort en per week erna
    select cf.w0,
           ((date_trunc('week', e.local_ts)::date - cf.w0) / 7)::int as wk,
           count(distinct e.user_id)::int as users
    from ev e
    join cohort_first cf on cf.user_id = e.user_id
    where cf.w0 >= date_trunc('week', (today - 84)::timestamp)::date
    group by 1, 2
  ),
  cohort_rows as (
    select cw.w0, cw.size,
           (select json_agg(
                     case
                       -- week nog niet voorbij: niets te melden
                       when cw.w0 + (k * 7) + 7 > today then null
                       else coalesce((select users from cohort_act a
                                       where a.w0 = cw.w0 and a.wk = k), 0)
                     end order by k)
              from generate_series(1, 4) k) as weeks
    from cohort_weeks cw
  ),
  deal_ev as ( -- de drie stappen die uit de app komen, per deal
    select coalesce(props->>'deal_id', 'onbekend') as deal_id, name, user_id,
           coalesce(props->>'card_mode', 'onbekend') as card_mode,
           coalesce(props->>'has_photo', 'onbekend') as has_photo
    from win
    where name in ('deal_seen', 'deal_claim', 'deal_code_shown')
  ),
  deal_by_mode as ( -- werkt de compacte kaart net zo goed als de volledige?
    select card_mode,
           count(distinct user_id) filter (where name = 'deal_seen')::int as seen,
           count(distinct user_id) filter (where name = 'deal_claim')::int as claimed
    from deal_ev where card_mode <> 'onbekend' group by card_mode
  ),
  deal_by_photo as ( -- en doet de foto er iets toe?
    select has_photo,
           count(distinct user_id) filter (where name = 'deal_seen')::int as seen,
           count(distinct user_id) filter (where name = 'deal_claim')::int as claimed
    from deal_ev where has_photo in ('true', 'false') group by has_photo
  ),
  deal_funnel as (
    select deal_id,
           count(distinct user_id) filter (where name = 'deal_seen')::int as seen,
           count(distinct user_id) filter (where name = 'deal_claim')::int as claimed,
           count(distinct user_id) filter (where name = 'deal_code_shown')::int as shown
    from deal_ev group by deal_id
  ),
  deal_rows as ( -- alle deals die in het venster liepen, met partner en steiger
    select d.id::text as deal_id, d.offer, d.stop_id, p.name as partner,
           d.valid_from, d.valid_to,
           (select count(*)::int from public.deal_codes c
             where c.deal_id = d.id and not c.preview) as codes,
           (select count(*)::int from public.deal_codes c
             where c.deal_id = d.id and c.redeemed_at is not null and not c.preview) as redeemed
    from public.deals d
    join public.partners p on p.id = d.partner_id
    where d.valid_to >= start_day::timestamptz
  ),
  code_weeks as ( -- in welke week pakte iemand een code?
    select date_trunc('week', (c.created_at at time zone 'Europe/Amsterdam'))::date as week_start,
           c.user_id
    from public.deal_codes c
    where not c.preview
    group by 1, 2
  ),
  active_weeks as ( -- in welke week was iemand actief in de app?
    select date_trunc('week', local_ts)::date as week_start, user_id
    from ev group by 1, 2
  ),
  return_base as ( -- per actieve gebruiker per week: had hij een code, en kwam hij terug?
    select a.week_start,
           a.user_id,
           (cw.user_id is not null) as had_deal,
           exists (select 1 from active_weeks a2
                    where a2.user_id = a.user_id and a2.week_start = a.week_start + 7) as kwam_terug
    from active_weeks a
    left join code_weeks cw on cw.user_id = a.user_id and cw.week_start = a.week_start
    -- Alleen weken waarvan de week erna al voorbij is.
    where a.week_start + 14 <= today
  ),
  deal_return as (
    select count(*) filter (where had_deal)::int as met_deal,
           count(*) filter (where had_deal and kwam_terug)::int as met_deal_terug,
           count(*) filter (where not had_deal)::int as zonder_deal,
           count(*) filter (where not had_deal and kwam_terug)::int as zonder_deal_terug
    from return_base
  ),
  versies as ( -- welke appversie draaien de toestellen in dit venster?
    select coalesce(props->>'app_version', 'onbekend') as version,
           count(distinct user_id)::int as users,
           count(distinct session_id)::int as sessions,
           min(created_at) as first_seen,
           max(created_at) as last_seen
    from win
    where props ? 'app_version'
    group by 1
  ),
  hourly as (
    select extract(hour from local_ts)::int as h, count(distinct session_id)::int as c
    from win group by 1
  ),
  dowt as (
    select extract(isodow from local_ts)::int as dd, count(distinct session_id)::int as c
    from win group by 1
  )
  select json_build_object(
    'quality', json_build_object(
      'last_event_at',      (select max(created_at) from analytics_events),
      'last_real_event_at', (select max(created_at) from ev),
      'events_today',       (select count(*) from ev where local_ts::date = today),
      'test_events',        (select count(*) from analytics_events where session_id like 'test-%'),
      'total_events',       (select count(*) from analytics_events),
      'own_included',       p_include_own
    ),
    'life', json_build_object(
      'users_today',   (select count(distinct user_id) from ev where local_ts::date = today),
      'users_7d',      (select count(distinct user_id) from ev where local_ts::date > today - 7),
      'users_30d',     (select count(distinct user_id) from ev where local_ts::date > today - 30),
      'users_total',   (select count(distinct user_id) from ev),
      'sessions_today',(select count(distinct session_id) from ev where local_ts::date = today),
      'sessions_7d',   (select count(distinct session_id) from ev where local_ts::date > today - 7),
      'sessions_per_user_7d', (select round(count(distinct session_id)::numeric
                                / nullif(count(distinct user_id), 0), 2)
                               from ev where local_ts::date > today - 7),
      'active_5m',     (select count(distinct user_id) from ev where created_at > now() - interval '5 minutes'),
      'median_session_sec', (select coalesce(round(percentile_cont(0.5) within group (order by sec)), 0) from sdur),
      'n_dur_sessions',     (select count(*) from sdur)
    ),
    'window', json_build_object(
      'days',     (today - start_day) + 1,
      'all_time', all_time,
      'start_day', start_day,
      'events',   (select count(*) from win),
      'users',    (select count(distinct user_id) from win),
      'sessions', (select count(distinct session_id) from win),
      'sessions_per_user', (select round(count(distinct session_id)::numeric
                             / nullif(count(distinct user_id), 0), 2) from win),
      'returning_users', (select returning_users from newret_summary),
      'summary_users',   (select users from newret_summary)
    ),
    'daily', (select json_agg(json_build_object('day', day, 'users', users, 'sessions', sessions, 'events', events) order by day) from daily),
    'weekly', (select json_agg(json_build_object('week_start', week_start, 'users', users, 'sessions', sessions, 'events', events) order by week_start) from weekly),
    'newret', (select json_agg(json_build_object('week_start', week_start, 'nieuw', nieuw, 'terugkerend', terugkerend) order by week_start) from newret),
    'funnel', json_build_object(
      'sessions', (select count(*) from sess),
      'clock',    (select count(*) from sess where clock or notified),
      'notified', (select count(*) from sess where notified)
    ),
    'install', (select coalesce(json_agg(json_build_object(
                  'variant', variant, 'shown', shown, 'dismissed', dismissed,
                  'ios_help', ios_help, 'installed', installed) order by variant), '[]'::json)
                from install),
    'cohorts', (select coalesce(json_agg(json_build_object(
                  'week_start', w0, 'size', size, 'weeks', weeks) order by w0 desc), '[]'::json)
                from cohort_rows),
    'deals', json_build_object(
      'rows', (select coalesce(json_agg(json_build_object(
                 'deal_id', r.deal_id, 'offer', r.offer, 'partner', r.partner,
                 'stop_id', r.stop_id, 'valid_from', r.valid_from, 'valid_to', r.valid_to,
                 'seen', coalesce(f.seen, 0), 'claimed', coalesce(f.claimed, 0),
                 'shown', coalesce(f.shown, 0), 'codes', r.codes, 'redeemed', r.redeemed)
                 order by r.valid_from desc), '[]'::json)
               from deal_rows r left join deal_funnel f on f.deal_id = r.deal_id),
      'by_stop', (select coalesce(json_agg(t), '[]'::json) from (
                    select r.stop_id as value,
                           sum(coalesce(f.seen, 0))::int as seen,
                           sum(coalesce(f.claimed, 0))::int as claimed,
                           sum(r.redeemed)::int as redeemed
                    from deal_rows r left join deal_funnel f on f.deal_id = r.deal_id
                    group by r.stop_id order by 2 desc limit 12) t),
      'by_mode', (select coalesce(json_agg(json_build_object(
                    'value', card_mode, 'seen', seen, 'claimed', claimed) order by seen desc), '[]'::json)
                  from deal_by_mode),
      'by_photo', (select coalesce(json_agg(json_build_object(
                     'value', has_photo, 'seen', seen, 'claimed', claimed) order by has_photo desc), '[]'::json)
                   from deal_by_photo),
      'return', (select json_build_object(
                   'with_deal', met_deal, 'with_deal_returned', met_deal_terug,
                   'without_deal', zonder_deal, 'without_deal_returned', zonder_deal_terug)
                 from deal_return)
    ),
    'versions', (select coalesce(json_agg(json_build_object(
                   'version', version, 'users', users, 'sessions', sessions,
                   'first_seen', first_seen, 'last_seen', last_seen) order by first_seen desc), '[]'::json)
                 from versies),
    'hourly', (select json_agg(coalesce(h2.c, 0) order by gs.h) from generate_series(0, 23) gs(h) left join hourly h2 on h2.h = gs.h),
    'dow',    (select json_agg(coalesce(d2.c, 0) order by gs.dd) from generate_series(1, 7) gs(dd) left join dowt d2 on d2.dd = gs.dd),
    'ferries', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'key' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'ferry_pick' and props ? 'key' group by 1 order by 2 desc limit 12) t),
    'devices', (select coalesce(json_agg(t), '[]'::json) from (
      select props->>'standalone' as value, count(distinct user_id)::int as users, count(*)::int as events
      from win where name = 'session_start' and props ? 'standalone' group by 1 order by 2 desc limit 12) t)
  ) into result;

  return result;
end; $$;

grant execute on function public.analytics_dashboard(int, boolean) to authenticated;
