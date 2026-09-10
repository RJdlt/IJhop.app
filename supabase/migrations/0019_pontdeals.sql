-- 0019: Pontdeals. Partners, deals en persoonlijke codes.
-- Draai dit in de Supabase SQL-editor, vóór 0020.
--
-- Uitgangspunten:
--
-- * Eén deal tegelijk zichtbaar. De tabel mag er meer bevatten (ingepland voor
--   volgende weken), maar `pontdeal()` geeft er hooguit één terug.
-- * Niemand praat rechtstreeks met deze tabellen. RLS staat aan en er is maar
--   één policy: je mag je eigen code lezen. Al het andere loopt via de
--   functies hieronder, die security definer zijn en zelf controleren wie er
--   belt.
-- * De partner achter de kassa heeft geen Supabase-account. Hij logt in met
--   een pincode van vier cijfers, die als bcrypt-hash in `partners` staat.
--   Vier cijfers zijn te raden, dus na tien misgrepen gaat het slot er een
--   kwartier op. Het aantal pogingen staat in de tabel zelf.

create extension if not exists pgcrypto with schema extensions;

-- ---- Tabellen ---------------------------------------------------------------

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  address text,
  lat double precision,
  lng double precision,
  pin_hash text,
  pin_fails int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  -- Het aanbod in maximaal zes woorden, bijv. 'Pizza Margherita 9 euro i.p.v. 14'.
  offer text not null,
  -- De steiger waar dit bij hoort, plus de lijnen die daar aanleggen. Alleen
  -- wie op zo'n lijn wacht ziet de deal.
  stop_id text not null,
  lines text[] not null default '{}',
  walk_min int,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  status text not null default 'concept' check (status in ('concept', 'actief', 'gestopt')),
  created_at timestamptz not null default now()
);
create index if not exists deals_window_idx on public.deals (valid_from, valid_to) where status = 'actief';

create table if not exists public.deal_codes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid not null,
  code text not null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  -- Eén code per persoon per deal, en binnen een deal is een code uniek.
  unique (deal_id, user_id),
  unique (deal_id, code)
);
create index if not exists deal_codes_redeemed_idx on public.deal_codes (redeemed_at) where redeemed_at is not null;

alter table public.partners enable row level security;
alter table public.deals enable row level security;
alter table public.deal_codes enable row level security;

-- Partners en deals: geen enkele policy, dus geen directe clienttoegang.
-- Codes: je mag alleen die van jezelf zien.
drop policy if exists "eigen code lezen" on public.deal_codes;
create policy "eigen code lezen" on public.deal_codes for select
  using (user_id = auth.uid());

-- ---- Codes ------------------------------------------------------------------

-- Alfabet zonder 0/O/1/I/L/5/S: die worden aan de kassa verkeerd overgetypt.
-- Dezelfde reeks staat in src/lib/dealCode.ts; die twee horen gelijk te zijn.
create or replace function public.deal_code_alphabet()
returns text language sql immutable as $$ select 'ABCDEFGHJKMNPQRTUVWXYZ2346789' $$;

create or replace function public.make_deal_code()
returns text language plpgsql volatile as $$
declare
  alfabet text := public.deal_code_alphabet();
  uitkomst text := '';
begin
  for i in 1..4 loop
    uitkomst := uitkomst || substr(alfabet, 1 + floor(random() * length(alfabet))::int, 1);
  end loop;
  return uitkomst;
end; $$;

-- ---- Wat de app ophaalt -----------------------------------------------------

-- De deal van dit moment voor deze steigers, plus de eerstvolgende (voor de
-- rustige teaser op donderdag t/m zondag) en het aantal inwisselingen van deze
-- week (sociale bevestiging, maar de app toont het pas vanaf tien).
--
-- `p_stops` is de lijst steigers waar deze bezoeker op wacht. Leeg of null
-- betekent: geen voorkeur, geef de eerste actieve deal.
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
  -- Bij meerdere: die van de eigen steiger eerst, dan de kortst lopende.
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
    -- Een deal loopt maandag tot en met woensdag, dus alle inwisselingen
    -- ervan vallen per definitie in deze week.
    select count(*)::int into week_count
      from public.deal_codes c
     where c.deal_id = gekozen.id and c.redeemed_at is not null;
    select * into eigen
      from public.deal_codes c
     where c.deal_id = gekozen.id and c.user_id = auth.uid();
  end if;
  if volgende.id is not null then
    select * into np from public.partners where id = volgende.partner_id;
  end if;

  return json_build_object(
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
      'code', eigen.code, 'redeemed_at', eigen.redeemed_at) end
  );
end; $$;

-- Pak je deal: geeft de code van deze gebruiker terug en maakt hem aan als hij
-- er nog geen heeft. Twee keer tikken levert dus dezelfde code op.
--
-- `p_code` is een voorstel van de app (zie src/lib/dealCode.ts). Voldoet het
-- niet aan het alfabet, of is het al vergeven binnen deze deal, dan verzint de
-- database er zelf een. Zo blijft de unieke sleutel de waarheid en hoeft de
-- app niet te weten wat er al bestaat.
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

  select * into bestaand from public.deal_codes where deal_id = d.id and user_id = uid;
  if bestaand.id is not null then
    return json_build_object('code', bestaand.code, 'redeemed_at', bestaand.redeemed_at, 'new', false);
  end if;

  kandidaat := upper(coalesce(trim(p_code), ''));
  if kandidaat !~ ('^[' || public.deal_code_alphabet() || ']{4}$') then
    kandidaat := public.make_deal_code();
  end if;

  for poging in 1..12 loop
    begin
      insert into public.deal_codes(deal_id, user_id, code) values (d.id, uid, kandidaat);
      return json_build_object('code', kandidaat, 'redeemed_at', null, 'new', true);
    exception when unique_violation then
      -- Botsing op (deal, user) betekent: iemand anders was ons voor in een
      -- tweede tabblad. Geef dan gewoon de bestaande code terug.
      select * into bestaand from public.deal_codes where deal_id = d.id and user_id = uid;
      if bestaand.id is not null then
        return json_build_object('code', bestaand.code, 'redeemed_at', bestaand.redeemed_at, 'new', false);
      end if;
      kandidaat := public.make_deal_code();
    end;
  end loop;
  raise exception 'geen vrije code gevonden';
end; $$;

-- ---- De partner achter de kassa --------------------------------------------

-- Controleert de pincode.
--
-- (De eerste versie gaf hier een partners-rij terug; drop maakt het opnieuw
-- draaien van dit bestand mogelijk zonder handwerk.)
--
-- Geeft json terug in plaats van te struikelen, en dat is geen stijlkeuze: een
-- `raise` draait in dezelfde transactie ook de bijgewerkte pogingenteller
-- terug. Wie zo telt, telt nooit, en dan gaat het slot er nooit op. Een
-- mislukte inlog is hier dus een gewone uitkomst, geen fout.
--
-- {"ok": true, "id": "<uuid>"} of {"ok": false, "reason": "pin" | "locked"}
drop function if exists public.partner_auth(text, text);
create or replace function public.partner_auth(p_slug text, p_pin text)
returns json language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  p public.partners;
begin
  select * into p from public.partners where slug = lower(trim(p_slug));
  if p.id is null then
    -- Zelfde antwoord als bij een verkeerde pin: niet verklappen welke
    -- zaken meedoen.
    return json_build_object('ok', false, 'reason', 'pin');
  end if;
  if p.locked_until is not null and p.locked_until > now() then
    return json_build_object('ok', false, 'reason', 'locked', 'until', p.locked_until);
  end if;
  if p.pin_hash is null or crypt(coalesce(p_pin, ''), p.pin_hash) <> p.pin_hash then
    update public.partners
       set pin_fails = pin_fails + 1,
           locked_until = case when pin_fails + 1 >= 10 then now() + interval '15 minutes' else null end
     where id = p.id;
    return json_build_object('ok', false, 'reason', 'pin');
  end if;
  if p.pin_fails <> 0 or p.locked_until is not null then
    update public.partners set pin_fails = 0, locked_until = null where id = p.id;
  end if;
  return json_build_object('ok', true, 'id', p.id);
end; $$;

-- Inwisselen. Eenmalig: een code die al gebruikt is geeft 'used' terug, met
-- het moment erbij zodat de kassa kan zien wanneer dat was.
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
  if now() > d.valid_to then
    return json_build_object('ok', false, 'reason', 'expired', 'offer', d.offer);
  end if;
  if c.redeemed_at is not null then
    return json_build_object('ok', false, 'reason', 'used', 'redeemed_at', c.redeemed_at, 'offer', d.offer);
  end if;

  update public.deal_codes set redeemed_at = now() where id = c.id and redeemed_at is null;
  if not found then
    return json_build_object('ok', false, 'reason', 'used', 'offer', d.offer);
  end if;

  return json_build_object('ok', true, 'offer', d.offer, 'code', c.code, 'redeemed_at', now());
end; $$;

-- Wat de partner onderaan zijn scherm ziet: vandaag en deze week, plus de deal
-- die nu loopt. Amsterdamse dagen en een week die op maandag begint.
-- Volatile en niet stable: `partner_auth` schrijft de pogingenteller bij, en
-- dat mag niet vanuit een alleen-lezen functie.
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
               where d.partner_id = p.id and c.redeemed_at is not null
                 and (c.redeemed_at at time zone 'Europe/Amsterdam')::date = vandaag),
    'week', (select count(*)::int from public.deal_codes c join public.deals d on d.id = c.deal_id
              where d.partner_id = p.id and c.redeemed_at is not null
                and (c.redeemed_at at time zone 'Europe/Amsterdam')::date >= maandag),
    'deal', case when huidig.id is null then null else json_build_object(
      'offer', huidig.offer, 'valid_to', huidig.valid_to) end
  );
end; $$;

-- ---- Beheer (alleen admins) -------------------------------------------------

create or replace function public.admin_list_partners()
returns table(id uuid, slug text, name text, logo_url text, address text,
              has_pin boolean, locked_until timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.name, p.logo_url, p.address,
         p.pin_hash is not null, p.locked_until, p.created_at
  from public.partners p
  where public.is_admin()
  order by p.name;
$$;

create or replace function public.admin_save_partner(
  p_id uuid, p_slug text, p_name text, p_logo_url text default null,
  p_address text default null, p_lat double precision default null, p_lng double precision default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  nieuw_id uuid;
  v_slug text := lower(regexp_replace(coalesce(trim(p_slug), ''), '[^a-zA-Z0-9-]', '-', 'g'));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if v_slug = '' or coalesce(trim(p_name), '') = '' then raise exception 'naam en slug zijn verplicht'; end if;

  if p_id is null then
    insert into public.partners(slug, name, logo_url, address, lat, lng)
    values (v_slug, trim(p_name), nullif(trim(p_logo_url), ''), nullif(trim(p_address), ''), p_lat, p_lng)
    returning id into nieuw_id;
  else
    update public.partners
       set slug = v_slug, name = trim(p_name), logo_url = nullif(trim(p_logo_url), ''),
           address = nullif(trim(p_address), ''), lat = p_lat, lng = p_lng
     where id = p_id
    returning id into nieuw_id;
  end if;
  return json_build_object('id', nieuw_id);
end; $$;

-- Pincode zetten. Vier cijfers, en we weigeren de flauwe reeksen; de partner
-- typt dit tientallen keren per week in het zicht van klanten.
create or replace function public.admin_set_partner_pin(p_id uuid, p_pin text)
returns json language plpgsql volatile security definer
set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then raise exception 'pincode is vier cijfers'; end if;
  if p_pin in ('0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321') then
    raise exception 'kies een minder voor de hand liggende pincode';
  end if;
  update public.partners
     set pin_hash = crypt(p_pin, gen_salt('bf')), pin_fails = 0, locked_until = null
   where id = p_id;
  return json_build_object('ok', true);
end; $$;

create or replace function public.admin_list_deals()
returns table(id uuid, partner_id uuid, partner_name text, partner_slug text, offer text,
              stop_id text, lines text[], walk_min int, valid_from timestamptz,
              valid_to timestamptz, status text, codes int, redeemed int)
language sql stable security definer set search_path = public as $$
  select d.id, d.partner_id, p.name, p.slug, d.offer, d.stop_id, d.lines, d.walk_min,
         d.valid_from, d.valid_to, d.status,
         (select count(*)::int from public.deal_codes c where c.deal_id = d.id),
         (select count(*)::int from public.deal_codes c where c.deal_id = d.id and c.redeemed_at is not null)
  from public.deals d
  join public.partners p on p.id = d.partner_id
  where public.is_admin()
  order by d.valid_from desc;
$$;

create or replace function public.admin_save_deal(
  p_id uuid, p_partner uuid, p_offer text, p_stop text, p_lines text[],
  p_walk_min int, p_valid_from timestamptz, p_valid_to timestamptz, p_status text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  nieuw_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_offer), '') = '' then raise exception 'aanbod is verplicht'; end if;
  if p_valid_to <= p_valid_from then raise exception 'einde ligt voor het begin'; end if;

  if p_id is null then
    insert into public.deals(partner_id, offer, stop_id, lines, walk_min, valid_from, valid_to, status)
    values (p_partner, trim(p_offer), p_stop, coalesce(p_lines, '{}'), p_walk_min,
            p_valid_from, p_valid_to, coalesce(p_status, 'concept'))
    returning id into nieuw_id;
  else
    update public.deals
       set partner_id = p_partner, offer = trim(p_offer), stop_id = p_stop,
           lines = coalesce(p_lines, '{}'), walk_min = p_walk_min,
           valid_from = p_valid_from, valid_to = p_valid_to, status = coalesce(p_status, status)
     where id = p_id
    returning id into nieuw_id;
  end if;
  return json_build_object('id', nieuw_id);
end; $$;

-- ---- Rechten ----------------------------------------------------------------

-- De pincontrole zelf is niet voor de buitenwereld; alleen redeem en stats
-- mogen hem aanroepen, en die draaien als eigenaar.
revoke all on function public.partner_auth(text, text) from public, anon, authenticated;

grant execute on function public.pontdeal(text[]) to anon, authenticated;
grant execute on function public.claim_deal_code(uuid, text) to authenticated;
grant execute on function public.partner_redeem(text, text, text) to anon, authenticated;
grant execute on function public.partner_stats(text, text) to anon, authenticated;
grant execute on function public.admin_list_partners() to authenticated;
grant execute on function public.admin_save_partner(uuid, text, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.admin_set_partner_pin(uuid, text) to authenticated;
grant execute on function public.admin_list_deals() to authenticated;
grant execute on function public.admin_save_deal(uuid, uuid, text, text, text[], int, timestamptz, timestamptz, text) to authenticated;
