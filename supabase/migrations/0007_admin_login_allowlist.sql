-- Alleen toegestane adressen mogen een admin-inloglink ontvangen:
-- bestaande admins of een openstaande, niet-verlopen uitnodiging.
-- Draai dit ná 0006 in de Supabase SQL-editor.

create or replace function public.email_allowed_for_admin(p_email text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    join auth.users u on u.id = a.user_id
    where lower(u.email) = lower(trim(p_email))
  ) or exists (
    select 1 from public.admin_invites
    where lower(email) = lower(trim(p_email))
      and used_at is null and expires_at > now()
  );
$$;

grant execute on function public.email_allowed_for_admin(text) to anon, authenticated;
