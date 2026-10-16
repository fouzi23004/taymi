-- Defence in depth against self sign-up.
--
-- Accounts are meant to be created only by admins (admin-users edge function).
-- If public sign-up is accidentally left on in the Auth settings, a stranger
-- holding the publishable key could still register. Such accounts now get an
-- *inactive* profile, which RLS treats as having no role → no access at all.
--
-- The very first account of the instance is still created active and admin,
-- so it can be bootstrapped from the dashboard (Authentication → Add user).
-- The edge function activates the profiles it creates.

alter table public.profiles alter column active set default false;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when is_first then 'admin'::public.app_role else 'collaborator'::public.app_role end,
    is_first
  );
  return new;
end;
$$;
