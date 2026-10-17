-- =============================================================================
-- Task categories, fiscal exercises, no more daily targets.
--
-- * Every task belongs to one category. A client is given the categories of
--   work that can be done for it; when logging time, only the tasks of the
--   client's categories are offered (and the database enforces it).
--   This replaces client-specific tasks (tasks.client_id).
-- * Every time entry belongs to a fiscal exercise ("2025", "2026"…), from a
--   single list shared by all clients and managed by admins.
-- * profiles.daily_target_minutes is removed.
--
-- Existing data is kept: tasks go to a "Général" category given to every
-- client, entries get the exercise named after the year of their date.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) > 0),
  description  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index categories_name_key on public.categories (lower(btrim(name)));
create trigger categories_touch before update on public.categories
  for each row execute function private.touch_updated_at();

create table public.client_categories (
  client_id    uuid not null references public.clients (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (client_id, category_id)
);
create index client_categories_category_idx on public.client_categories (category_id);

-- -----------------------------------------------------------------------------
-- Exercises
-- -----------------------------------------------------------------------------

create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index exercises_name_key on public.exercises (lower(btrim(name)));
create trigger exercises_touch before update on public.exercises
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Validation: the task must be in one of the client's categories.
-- Only checked when the client or task changes, so editing the comment of an
-- old entry still works after a category was removed from the client.
-- -----------------------------------------------------------------------------

create or replace function private.validate_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_total integer;
begin
  if tg_op = 'INSERT' or new.task_id <> old.task_id or new.client_id <> old.client_id then
    if not exists (
      select 1
      from public.tasks t
      join public.client_categories cc on cc.category_id = t.category_id
      where t.id = new.task_id and cc.client_id = new.client_id
    ) then
      raise exception 'This task is not in a category of the selected client'
        using errcode = 'check_violation', hint = 'task_client_mismatch';
    end if;
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

-- -----------------------------------------------------------------------------
-- Move existing data
-- -----------------------------------------------------------------------------

alter table public.tasks add column category_id uuid references public.categories (id) on delete restrict;

do $$
declare
  general uuid;
begin
  if exists (select 1 from public.tasks) then
    insert into public.categories (name, description)
    values ('Général', 'Catégorie créée automatiquement pour les tâches existantes')
    returning id into general;

    update public.tasks set category_id = general;

    insert into public.client_categories (client_id, category_id)
    select id, general from public.clients;
  end if;
end;
$$;

alter table public.tasks alter column category_id set not null;
drop index public.tasks_name_scope_key;
drop index public.tasks_client_idx;
alter table public.tasks drop column client_id;
create unique index tasks_name_category_key on public.tasks (lower(btrim(name)), category_id);
create index tasks_category_idx on public.tasks (category_id);

insert into public.exercises (name)
select distinct extract(year from work_date)::int::text from public.time_entries
union
select extract(year from current_date)::int::text;

alter table public.time_entries add column exercise_id uuid references public.exercises (id) on delete restrict;
update public.time_entries e
set exercise_id = x.id
from public.exercises x
where x.name = extract(year from e.work_date)::int::text;
alter table public.time_entries alter column exercise_id set not null;
create index time_entries_exercise_idx on public.time_entries (exercise_id);

alter table public.profiles drop column daily_target_minutes;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.categories        enable row level security;
alter table public.client_categories enable row level security;
alter table public.exercises         enable row level security;

create policy "categories: readable by members" on public.categories for select to authenticated
  using (private.my_role() is not null);
create policy "categories: staff inserts" on public.categories for insert to authenticated
  with check (private.is_staff());
create policy "categories: staff updates" on public.categories for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy "categories: staff deletes" on public.categories for delete to authenticated
  using (private.is_staff());

create policy "client_categories: readable by members" on public.client_categories for select to authenticated
  using (private.my_role() is not null);
create policy "client_categories: staff inserts" on public.client_categories for insert to authenticated
  with check (private.is_staff());
create policy "client_categories: staff deletes" on public.client_categories for delete to authenticated
  using (private.is_staff());

create policy "exercises: readable by members" on public.exercises for select to authenticated
  using (private.my_role() is not null);
create policy "exercises: admin inserts" on public.exercises for insert to authenticated
  with check (private.is_admin());
create policy "exercises: admin updates" on public.exercises for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "exercises: admin deletes" on public.exercises for delete to authenticated
  using (private.is_admin());

revoke all on public.categories, public.client_categories, public.exercises from anon;
grant select, insert, update, delete on public.categories        to authenticated;
grant select, insert, delete         on public.client_categories to authenticated;
grant select, insert, update, delete on public.exercises         to authenticated;
grant all on public.categories, public.client_categories, public.exercises to service_role;

-- -----------------------------------------------------------------------------
-- Reporting: add the exercise to the roll-up grain.
-- (The category is derived from the task on the client side.)
-- -----------------------------------------------------------------------------

drop function public.report_rollup(date, date);

create function public.report_rollup(p_from date, p_to date)
returns table (
  work_date    date,
  user_id      uuid,
  client_id    uuid,
  task_id      uuid,
  exercise_id  uuid,
  minutes      bigint,
  entry_count  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.work_date, e.user_id, e.client_id, e.task_id, e.exercise_id,
         sum(e.minutes)::bigint, count(*)::bigint
  from public.time_entries e
  where e.work_date between p_from and p_to
  group by e.work_date, e.user_id, e.client_id, e.task_id, e.exercise_id
  order by e.work_date, e.user_id, e.client_id, e.task_id, e.exercise_id
$$;

revoke all on function public.report_rollup(date, date) from public, anon;
grant execute on function public.report_rollup(date, date) to authenticated;
