-- =============================================================================
-- TimeLedger — initial schema
--
-- Roles
--   admin        : manages users, clients, tasks; sees every time entry
--   manager      : manages clients and tasks; sees entries of their team
--                  (profiles whose manager_id = them) and their own
--   collaborator : logs and edits their own time entries
-- =============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

create type public.app_role as enum ('admin', 'manager', 'collaborator');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text not null,
  full_name             text not null default '',
  role                  public.app_role not null default 'collaborator',
  manager_id            uuid references public.profiles (id) on delete set null,
  daily_target_minutes  integer not null default 480
                        check (daily_target_minutes between 0 and 1440),
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_manager_not_self check (manager_id is null or manager_id <> id)
);
create index profiles_manager_idx on public.profiles (manager_id);

create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) > 0),
  reference      text,
  contact_name   text,
  contact_email  text,
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index clients_name_key on public.clients (lower(btrim(name)));
create unique index clients_reference_key on public.clients (lower(btrim(reference)))
  where reference is not null and btrim(reference) <> '';

-- A task with client_id = null is available for every client;
-- otherwise it is specific to that client.
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) > 0),
  description  text,
  client_id    uuid references public.clients (id) on delete cascade,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index tasks_name_scope_key on public.tasks (
  lower(btrim(name)),
  coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index tasks_client_idx on public.tasks (client_id);

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete restrict,
  task_id     uuid not null references public.tasks (id) on delete restrict,
  work_date   date not null default current_date,
  minutes     integer not null check (minutes > 0 and minutes <= 1440),
  comment     text check (comment is null or length(comment) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index time_entries_date_idx        on public.time_entries (work_date);
create index time_entries_user_date_idx   on public.time_entries (user_id, work_date);
create index time_entries_client_date_idx on public.time_entries (client_id, work_date);
create index time_entries_task_idx        on public.time_entries (task_id);

-- -----------------------------------------------------------------------------
-- Generic triggers
-- -----------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch     before update on public.profiles     for each row execute function private.touch_updated_at();
create trigger clients_touch      before update on public.clients      for each row execute function private.touch_updated_at();
create trigger tasks_touch        before update on public.tasks        for each row execute function private.touch_updated_at();
create trigger time_entries_touch before update on public.time_entries for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Profile bootstrap: every auth user gets a profile.
-- The very first user of the instance becomes admin.
-- -----------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when exists (select 1 from public.profiles) then 'collaborator'::public.app_role
         else 'admin'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Never leave the instance without an active admin.
create function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.active
     and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from public.profiles
       where role = 'admin' and active and id <> old.id
     )
  then
    raise exception 'At least one active admin is required'
      using errcode = 'check_violation', hint = 'last_admin';
  end if;
  return new;
end;
$$;

create trigger profiles_keep_one_admin
  before update on public.profiles
  for each row execute function private.keep_one_admin();

-- -----------------------------------------------------------------------------
-- Authorization helpers (security definer → no RLS recursion on profiles)
-- -----------------------------------------------------------------------------

create function private.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid()) and active
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_role() = 'admin', false)
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_role() in ('admin', 'manager'), false)
$$;

-- Can the current user see the profile / time entries of `target`?
create function private.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target = (select auth.uid())
    or exists (
      select 1
      from public.profiles me
      where me.id = (select auth.uid())
        and me.active
        and (
          me.role = 'admin'
          or (
            me.role = 'manager'
            and exists (
              select 1 from public.profiles p
              where p.id = target and p.manager_id = me.id
            )
          )
        )
    )
$$;

revoke all on function private.my_role(), private.is_admin(), private.is_staff(), private.can_view_user(uuid) from public;
grant execute on function private.my_role(), private.is_admin(), private.is_staff(), private.can_view_user(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Time entry validation
-- -----------------------------------------------------------------------------

create function private.validate_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_client uuid;
  task_found  boolean;
  day_total   integer;
begin
  select true, t.client_id into task_found, task_client
  from public.tasks t where t.id = new.task_id;

  if task_found and task_client is not null and task_client <> new.client_id then
    raise exception 'This task does not belong to the selected client'
      using errcode = 'check_violation', hint = 'task_client_mismatch';
  end if;

  select coalesce(sum(e.minutes), 0) into day_total
  from public.time_entries e
  where e.user_id = new.user_id
    and e.work_date = new.work_date
    and e.id <> new.id;

  if day_total + new.minutes > 1440 then
    raise exception 'A day cannot exceed 24 hours'
      using errcode = 'check_violation', hint = 'day_overflow';
  end if;

  return new;
end;
$$;

create trigger time_entries_validate
  before insert or update on public.time_entries
  for each row execute function private.validate_time_entry();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.clients      enable row level security;
alter table public.tasks        enable row level security;
alter table public.time_entries enable row level security;

-- profiles: writes go through the admin-users edge function (service role)
-- or directly by an admin.
create policy "profiles: visible to self, team manager, admin"
  on public.profiles for select to authenticated
  using (private.can_view_user(id));

create policy "profiles: admin updates"
  on public.profiles for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- clients
create policy "clients: readable by members"
  on public.clients for select to authenticated
  using (private.my_role() is not null);

create policy "clients: staff inserts"
  on public.clients for insert to authenticated
  with check (private.is_staff());

create policy "clients: staff updates"
  on public.clients for update to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "clients: staff deletes"
  on public.clients for delete to authenticated
  using (private.is_staff());

-- tasks
create policy "tasks: readable by members"
  on public.tasks for select to authenticated
  using (private.my_role() is not null);

create policy "tasks: staff inserts"
  on public.tasks for insert to authenticated
  with check (private.is_staff());

create policy "tasks: staff updates"
  on public.tasks for update to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy "tasks: staff deletes"
  on public.tasks for delete to authenticated
  using (private.is_staff());

-- time entries
create policy "entries: visible to owner, team manager, admin"
  on public.time_entries for select to authenticated
  using (private.can_view_user(user_id));

create policy "entries: active members log their own time"
  on public.time_entries for insert to authenticated
  with check (user_id = (select auth.uid()) and private.my_role() is not null);

create policy "entries: owner or admin updates"
  on public.time_entries for update to authenticated
  using ((user_id = (select auth.uid()) and private.my_role() is not null) or private.is_admin())
  with check ((user_id = (select auth.uid()) and private.my_role() is not null) or private.is_admin());

create policy "entries: owner or admin deletes"
  on public.time_entries for delete to authenticated
  using ((user_id = (select auth.uid()) and private.my_role() is not null) or private.is_admin());

-- -----------------------------------------------------------------------------
-- Reporting
-- One row per (day, collaborator, client, task) for the period. RLS applies
-- (security invoker), so managers only get their team. The client rolls these
-- rows up by collaborator, client, task or day.
-- -----------------------------------------------------------------------------

create function public.report_rollup(p_from date, p_to date)
returns table (
  work_date    date,
  user_id      uuid,
  client_id    uuid,
  task_id      uuid,
  minutes      bigint,
  entry_count  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.work_date, e.user_id, e.client_id, e.task_id,
         sum(e.minutes)::bigint, count(*)::bigint
  from public.time_entries e
  where e.work_date between p_from and p_to
  group by e.work_date, e.user_id, e.client_id, e.task_id
  order by e.work_date, e.user_id, e.client_id, e.task_id
$$;

-- -----------------------------------------------------------------------------
-- Grants (explicit, independent of the project's auto-expose setting)
-- -----------------------------------------------------------------------------

revoke all on public.profiles, public.clients, public.tasks, public.time_entries from anon;
grant select, update                 on public.profiles     to authenticated;
grant select, insert, update, delete on public.clients      to authenticated;
grant select, insert, update, delete on public.tasks        to authenticated;
grant select, insert, update, delete on public.time_entries to authenticated;
grant all on public.profiles, public.clients, public.tasks, public.time_entries to service_role;

revoke all on function public.report_rollup(date, date) from public, anon;
grant execute on function public.report_rollup(date, date) to authenticated;
