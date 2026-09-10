-- 0022: preview van een Pontdeal voor admins.
-- Draai dit in de Supabase SQL-editor, na 0019 tot en met 0021.
--
-- Waarom: een deal is pas maandag te zien, en dan staat hij meteen live. Je
-- wilt hem daarvoor kunnen bekijken zoals een bezoeker hem krijgt, met de
-- kaart, de knop, de code en de QR, en je wilt de codes aan de kassa kunnen
-- uitproberen. Dat mag geen sporen nalaten in de cijfers.
--
-- Hoe: alleen een ingelogde admin krijgt via `admin_preview_deal()` een deal
-- terug, zonder venster- en steigerfilter. De controle staat in de database,
-- niet in de app, dus wie de URL raadt zonder admin te zijn krijgt gewoon
-- niets. `claim_preview_code()` zet `preview = true` op de code.
--
-- Codes met `preview = true` tellen nergens mee: niet in de teller onder de
-- dealkaart, niet in wat de partner ziet, niet in de dealtabel van het
-- dashboard en niet in de meting. De partnerpagina neemt ze wél aan, met
-- "testcode" erbij, want anders kun je de kassa niet uitproberen.
--
-- Let op de unieke sleutel: die was (deal_id, user_id) en wordt
-- (deal_id, user_id, preview). Anders bezet je eigen testcode de plek van de
-- echte code die je later als bezoeker zou pakken.

alter table public.deal_codes add column if not exists preview boolean not null default false;

alter table public.deal_codes drop constraint if exists deal_codes_deal_id_user_id_key;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'deal_codes_deal_user_preview_key'
  ) then
    alter table public.deal_codes
      add constraint deal_codes_deal_user_preview_key unique (deal_id, user_id, preview);
  end if;
end $$;

-- ---- De deal bekijken als admin --------------------------------------------

-- Zelfde vorm als `pontdeal()`, maar zonder venster en zonder steigerfilter,
-- en alleen voor admins. `preview` staat in het antwoord zodat de app weet dat
-- ze een voorvertoning laat zien en niet het echte werk.
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
      'partner', json_build_object('name', p.name, 'slug', p.slug, 'logo_url', p.logo_url,
                                   'address', p.address, 'lat', p.lat, 'lng', p.lng)
    ),
    'next', null,
    -- De teller blijft op nul: een preview hoort geen sociale bewijskracht te
    -- lenen van echte inwisselingen, en zeker niet van zichzelf.
    'redeemed_week', 0,
    'my_code', case when eigen.id is null then null else json_build_object(
      'code', eigen.code, 'redeemed_at', eigen.redeemed_at, 'preview', true) end
  );
end; $$;

-- Testcode pakken. Negeert het venster, want je previewt juist voordat de deal
-- loopt. Verder identiek aan `claim_deal_code`, inclusief het voorstel van de
-- app en de terugval op een zelfverzonnen code bij een botsing.
create or replace function public.claim_preview_code(p_deal uuid, p_code text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  d public.deals;
  uid uuid := auth.uid();
  kandidaat text;
  bestaand public.deal_codes;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if uid is null then raise exception 'inloggen vereist'; end if;

  select * into d from public.deals where id = p_deal;
  if d.id is null then raise exception 'deal niet gevonden'; end if;

  select * into bestaand from public.deal_codes
   where deal_id = d.id and user_id = uid and preview;
  if bestaand.id is not null then
    return json_build_object('code', bestaand.code, 'redeemed_at', bestaand.redeemed_at,
                             'preview', true, 'new', false);
  end if;

  kandidaat := upper(coalesce(trim(p_code), ''));
  if kandidaat !~ ('^[' || public.deal_code_alphabet() || ']{4}$') then
    kandidaat := public.make_deal_code();
  end if;

  for poging in 1..12 loop
    begin
      insert into public.deal_codes(deal_id, user_id, code, preview)
      values (d.id, uid, kandidaat, true);
      return json_build_object('code', kandidaat, 'redeemed_at', null, 'preview', true, 'new', true);
    exception when unique_violation then
      select * into bestaand from public.deal_codes
       where deal_id = d.id and user_id = uid and preview;
      if bestaand.id is not null then
        return json_build_object('code', bestaand.code, 'redeemed_at', bestaand.redeemed_at,
                                 'preview', true, 'new', false);
      end if;
      kandidaat := public.make_deal_code();
    end;
  end loop;
  raise exception 'geen vrije code gevonden';
end; $$;

-- ---- Bestaande functies: preview eruit filteren ------------------------------

-- `pontdeal` mag geen previewcode als "jouw code" teruggeven en telt ze niet
-- mee in de teller onder de kaart.
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

-- `claim_deal_code` pakt nu expliciet de niet-preview code, zodat een admin die
-- eerst previewde daarna gewoon een echte code kan krijgen.
create or replace function public.claim_deal_code(p_deal uuid, p_code text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  d public.deals;
  uid uuid := auth.uid();
  kandidaat text;
  bestaand public.deal_codes;
begin
  if uid is null then raise exception 'inloggen vereist'; end if;

  select * into d from public.deals
   where id = p_deal and status = 'actief' and now() >= valid_from and now() <= valid_to;
  if d.id is null then raise exception 'deal niet actief'; end if;

  select * into bestaand from public.deal_codes
   where deal_id = d.id and user_id = uid and not preview;
  if bestaand.id is not null then
    return json_build_object('code', bestaand.code, 'redeemed_at', bestaand.redeemed_at, 'new', false);
  end if;

  kandidaat := upper(coalesce(trim(p_code), ''));
  if kandidaat !~ ('^[' || public.deal_code_alphabet() || ']{4}$') then
    kandidaat := public.make_deal_code();
  end if;

  for poging in 1..12 loop
    begin
      insert into public.deal_codes(deal_id, user_id, code, preview)
      values (d.id, uid, kandidaat, false);
      return json_build_object('code', kandidaat, 'redeemed_at', null, 'new', true);
    exception when unique_violation then
      select * into bestaand from public.deal_codes
       where deal_id = d.id and user_id = uid and not preview;
      if bestaand.id is not null then
        return json_build_object('code', bestaand.code, 'redeemed_at', bestaand.redeemed_at, 'new', false);
      end if;
      kandidaat := public.make_deal_code();
    end;
  end loop;
  raise exception 'geen vrije code gevonden';
end; $$;

-- De kassa neemt een testcode aan en zegt erbij dat het er een is. Een
-- previewcode mag ook buiten het venster: je test nu juist vooraf.
create or replace function public.partner_redeem(p_slug text, p_pin text, p_code text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  p public.partners;
  toegang json;
  c public.deal_codes;
  d public.deals;
  schoon text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  toegang := public.partner_auth(p_slug, p_pin);
  if (toegang->>'ok')::boolean is not true then return toegang; end if;
  select * into p from public.partners where id = (toegang->>'id')::uuid;

  select c2.* into c
    from public.deal_codes c2
    join public.deals d2 on d2.id = c2.deal_id
   where c2.code = schoon and d2.partner_id = p.id
   order by c2.created_at desc
   limit 1;

  if c.id is null then
    return json_build_object('ok', false, 'reason', 'unknown');
  end if;

  select * into d from public.deals where id = c.deal_id;
  if now() > d.valid_to and not c.preview then
    return json_build_object('ok', false, 'reason', 'expired', 'offer', d.offer);
  end if;
  if c.redeemed_at is not null then
    return json_build_object('ok', false, 'reason', 'used', 'redeemed_at', c.redeemed_at,
                             'offer', d.offer, 'preview', c.preview);
  end if;

  update public.deal_codes set redeemed_at = now() where id = c.id and redeemed_at is null;
  if not found then
    return json_build_object('ok', false, 'reason', 'used', 'offer', d.offer, 'preview', c.preview);
  end if;

  return json_build_object('ok', true, 'offer', d.offer, 'code', c.code,
                           'redeemed_at', now(), 'preview', c.preview);
end; $$;

-- Wat de partner onderaan ziet telt alleen echte klanten.
create or replace function public.partner_stats(p_slug text, p_pin text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  p public.partners;
  toegang json;
  vandaag date;
  maandag date;
  huidig public.deals;
begin
  toegang := public.partner_auth(p_slug, p_pin);
  if (toegang->>'ok')::boolean is not true then return toegang; end if;
  select * into p from public.partners where id = (toegang->>'id')::uuid;
  vandaag := (now() at time zone 'Europe/Amsterdam')::date;
  maandag := vandaag - ((extract(isodow from vandaag)::int) - 1);

  select d.* into huidig from public.deals d
   where d.partner_id = p.id and d.status = 'actief'
     and now() >= d.valid_from and now() <= d.valid_to
   order by d.valid_to asc limit 1;

  return json_build_object(
    'ok', true,
    'partner', json_build_object('name', p.name, 'slug', p.slug, 'logo_url', p.logo_url),
    'today', (select count(*)::int from public.deal_codes c join public.deals d on d.id = c.deal_id
               where d.partner_id = p.id and c.redeemed_at is not null and not c.preview
                 and (c.redeemed_at at time zone 'Europe/Amsterdam')::date = vandaag),
    'week', (select count(*)::int from public.deal_codes c join public.deals d on d.id = c.deal_id
              where d.partner_id = p.id and c.redeemed_at is not null and not c.preview
                and (c.redeemed_at at time zone 'Europe/Amsterdam')::date >= maandag),
    'deal', case when huidig.id is null then null else json_build_object(
      'offer', huidig.offer, 'valid_to', huidig.valid_to) end
  );
end; $$;

-- De dealtabel in het dashboard telt echte codes, met de testcodes apart
-- ernaast zodat je ziet dat je eigen proefritten er niet tussen zitten.
drop function if exists public.admin_list_deals();
create or replace function public.admin_list_deals()
returns table(id uuid, partner_id uuid, partner_name text, partner_slug text, offer text,
              stop_id text, lines text[], walk_min int, valid_from timestamptz,
              valid_to timestamptz, status text, codes int, redeemed int, preview_codes int)
language sql stable security definer set search_path = public as $$
  select d.id, d.partner_id, p.name, p.slug, d.offer, d.stop_id, d.lines, d.walk_min,
         d.valid_from, d.valid_to, d.status,
         (select count(*)::int from public.deal_codes c where c.deal_id = d.id and not c.preview),
         (select count(*)::int from public.deal_codes c
           where c.deal_id = d.id and c.redeemed_at is not null and not c.preview),
         (select count(*)::int from public.deal_codes c where c.deal_id = d.id and c.preview)
  from public.deals d
  join public.partners p on p.id = d.partner_id
  where public.is_admin()
  order by d.valid_from desc;
$$;

grant execute on function public.admin_preview_deal(uuid) to authenticated;
grant execute on function public.claim_preview_code(uuid, text) to authenticated;
grant execute on function public.pontdeal(text[]) to anon, authenticated;
grant execute on function public.claim_deal_code(uuid, text) to authenticated;
grant execute on function public.partner_redeem(text, text, text) to anon, authenticated;
grant execute on function public.partner_stats(text, text) to anon, authenticated;
grant execute on function public.admin_list_deals() to authenticated;

-- ---- Het dashboard: testcodes tellen niet mee -------------------------------
--
-- Zelfde functie als in 0020, met twee filters erbij: de dealtabel telt alleen
-- echte codes, en wie een testcode pakte geldt niet als iemand die "een deal
-- had" in de terugkeervergelijking. Anders zou jij als admin je eigen
-- proefritten terugzien als klantgedrag.

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
    select coalesce(props->>'deal_id', 'onbekend') as deal_id, name, user_id
    from win
    where name in ('deal_seen', 'deal_claim', 'deal_code_shown')
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
      'return', (select json_build_object(
                   'with_deal', met_deal, 'with_deal_returned', met_deal_terug,
                   'without_deal', zonder_deal, 'without_deal_returned', zonder_deal_terug)
                 from deal_return)
    ),
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
