-- Admin-uitnodigingen voor IJhop. Draai dit ná 0003/0004 in de Supabase SQL-editor.
-- Codes worden gehasht opgeslagen; alle gevoelige logica zit in SECURITY DEFINER
-- RPC's met een is_admin()-check. Clients kunnen niets direct in de tabellen doen.

create extension if not exists pgcrypto with schema extensions;

-- 1) Tabel ------------------------------------------------------------------
create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  created_by uuid,
  used_at timestamptz,
  used_by uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_invites_email_idx on public.admin_invites (lower(email));

alter table public.admin_invites enable row level security;
-- Bewust géén policies: directe client-toegang is geblokkeerd; alles via RPC's.

-- 2) Hash-helper ------------------------------------------------------------
create or replace function public.hash_code(p text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(upper(trim(p)), 'sha256'), 'hex');
$$;

-- 3) Invite aanmaken (admin) ------------------------------------------------
create or replace function public.create_admin_invite(p_email text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- geen 0/O/1/I
  v_code text := '';
  v_id uuid;
  v_exp timestamptz := now() + interval '7 days';
  i int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'e-mail vereist'; end if;

  for i in 1..8 loop
    v_code := v_code || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
  end loop;

  insert into public.admin_invites(email, code_hash, created_by, expires_at)
  values (lower(trim(p_email)), public.hash_code(v_code), auth.uid(), v_exp)
  returning id into v_id;

  return json_build_object('id', v_id, 'email', lower(trim(p_email)), 'code', v_code, 'expires_at', v_exp);
end; $$;

-- 4) Invite inwisselen (de uitgenodigde) ------------------------------------
create or replace function public.redeem_admin_invite(p_email text, p_code text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_inv public.admin_invites;
begin
  if auth.uid() is null then raise exception 'log eerst in'; end if;
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> lower(trim(p_email)) then
    raise exception 'e-mail komt niet overeen met je login';
  end if;

  select * into v_inv
  from public.admin_invites
  where lower(email) = lower(trim(p_email))
    and code_hash = public.hash_code(p_code)
    and used_at is null
  order by created_at desc
  limit 1;

  if v_inv.id is null then raise exception 'ongeldige of al gebruikte code'; end if;
  if v_inv.expires_at < now() then raise exception 'code is verlopen'; end if;

  insert into public.admins(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.admin_invites set used_at = now(), used_by = auth.uid() where id = v_inv.id;

  return json_build_object('ok', true);
end; $$;

-- 5) Beheer-overzichten (admin) ---------------------------------------------
create or replace function public.admin_list_admins()
returns table(user_id uuid, email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.user_id, u.email::text, a.created_at
  from public.admins a
  left join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by a.created_at;
$$;

create or replace function public.admin_list_invites()
returns table(id uuid, email text, status text, expires_at timestamptz, used_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, email,
    case when used_at is not null then 'gebruikt'
         when expires_at < now()  then 'verlopen'
         else 'open' end as status,
    expires_at, used_at, created_at
  from public.admin_invites
  where public.is_admin()
  order by created_at desc;
$$;

-- 6) Intrekken / verwijderen (admin) ----------------------------------------
create or replace function public.revoke_admin_invite(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.admin_invites where id = p_id and used_at is null;
  return json_build_object('ok', true);
end; $$;

create or replace function public.remove_admin(p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'je kunt jezelf niet verwijderen'; end if;
  delete from public.admins where user_id = p_user_id;
  return json_build_object('ok', true);
end; $$;

-- 7) Rechten ----------------------------------------------------------------
grant execute on function public.create_admin_invite(text)       to authenticated;
grant execute on function public.redeem_admin_invite(text, text) to anon, authenticated;
grant execute on function public.admin_list_admins()             to authenticated;
grant execute on function public.admin_list_invites()            to authenticated;
grant execute on function public.revoke_admin_invite(uuid)       to authenticated;
grant execute on function public.remove_admin(uuid)              to authenticated;
