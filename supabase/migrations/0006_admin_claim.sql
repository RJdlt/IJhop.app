-- Automatisch admin worden zodra een uitgenodigd e-mailadres inlogt.
-- Draai dit ná 0005 in de Supabase SQL-editor.

create or replace function public.claim_admin_access()
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inv public.admin_invites; v_email text;
begin
  if auth.uid() is null then return false; end if;
  if public.is_admin() then return true; end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then return false; end if;

  select * into v_inv
  from public.admin_invites
  where lower(email) = v_email and used_at is null and expires_at > now()
  order by created_at desc
  limit 1;

  if v_inv.id is null then return false; end if;

  insert into public.admins(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.admin_invites set used_at = now(), used_by = auth.uid() where id = v_inv.id;
  return true;
end; $$;

grant execute on function public.claim_admin_access() to authenticated;
