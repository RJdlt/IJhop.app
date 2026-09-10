-- 0021: partnerfuncties zeggen voortaan of ze iets gedaan hebben.
-- Draai dit in de Supabase SQL-editor. Klein bestand: het vervangt twee
-- functies uit 0019 en raakt verder niets aan.
--
-- Wat er mis was: `admin_set_partner_pin` deed
--
--   update public.partners set pin_hash = ... where id = p_id;
--   return json_build_object('ok', true);
--
-- Een update die nul rijen raakt is in Postgres geen fout. Bij een id dat niet
-- bestaat (of null) gaf de functie dus vrolijk {"ok": true} terug terwijl er
-- niets veranderde. Dat is precies het soort antwoord waar je in de app niets
-- mee kunt: het scherm heeft geen enkele aanleiding om iets te melden, en de
-- pincode is toch niet gezet. `admin_save_partner` had bij het bijwerken
-- dezelfde blinde vlek en gaf dan {"id": null} terug.
--
-- Allebei controleren nu of er echt een rij geraakt is.

create or replace function public.admin_set_partner_pin(p_id uuid, p_pin text)
returns json language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  geraakt int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_id is null then raise exception 'geen partner gekozen'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then raise exception 'pincode is vier cijfers'; end if;
  if p_pin in ('0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321') then
    raise exception 'kies een minder voor de hand liggende pincode';
  end if;

  update public.partners
     set pin_hash = crypt(p_pin, gen_salt('bf')), pin_fails = 0, locked_until = null
   where id = p_id;

  get diagnostics geraakt = row_count;
  if geraakt = 0 then raise exception 'partner niet gevonden'; end if;

  return json_build_object('ok', true, 'id', p_id);
end; $$;

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
    if nieuw_id is null then raise exception 'partner niet gevonden'; end if;
  end if;
  return json_build_object('id', nieuw_id);
end; $$;

grant execute on function public.admin_set_partner_pin(uuid, text) to authenticated;
grant execute on function public.admin_save_partner(uuid, text, text, text, text, double precision, double precision) to authenticated;
