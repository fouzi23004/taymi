# TimeLedger

Time tracking for service firms. At the end of each day every collaborator records what they did, client by client: **client → task → time spent → optional comment**. Managers then see:

- **what each person did** on a given day or over any period,
- **how much time each client took**, ready for invoicing (hours and decimal hours, CSV export),
- **collaborator performance**: days filled in, time logged against their daily target, missing days.

The interface is bilingual (French by default, English), and the layout works on desktop and mobile.

---

## Features

| Who | What |
| --- | --- |
| Collaborator | *Ma journée*: daily entry form, quick durations (`1h30`, `1,5`, `90m`…), week strip with daily totals, edit/delete own entries, personal reports |
| Manager | Everything above, plus an overview dashboard and reports for **their team** (people whose manager they are); manages clients and tasks |
| Admin | Everything, for **everyone**; manages the team (create accounts, roles, managers, daily targets, deactivate, reset passwords) |

- **Clients**: name, reference, contact, notes; archive instead of delete once used.
- **Tasks**: a shared catalogue (e.g. *Saisie comptable*, *Déclaration TVA*). A task can also be restricted to one client.
- **Reports** grouped by client, collaborator, task or day, with filters, a detail view and CSV export. French exports use `;` and a UTF-8 BOM so Excel opens them directly.
- **Performance**: expected time = daily target × working days (Mon–Fri) up to today. A daily target of `0h00` means the person doesn't log time (for example an admin), so they're left out of these figures.

## Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, i18next, Recharts
- **Backend**: [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security, one Edge Function)

Security is enforced in the database, not only in the UI:

- Row Level Security limits each person to their own entries, a manager to their team's, and an admin to everyone's.
- Triggers reject a task used with the wrong client and any day over 24h.
- Triggers keep at least one active admin.
- Only the `admin-users` Edge Function (using the service-role key) can create or deactivate accounts. Public sign-up is disabled.

---

## Running the app on your computer

Requirements: Node 20+ and a Supabase project (see [Deploying to production](#deploying-to-production) for the one-time setup).

```bash
npm install
cp .env.example .env      # then paste your project URL and publishable key
npm run dev               # http://localhost:5173
```

### Optional: a local Supabase copy for testing

This needs Docker Desktop. `npm run db:start` runs a throwaway Supabase in containers, with the migrations and demo clients/tasks. To use it, point `.env` at the URL and anon key it prints. `npm run db:seed-dev` then adds test accounts (listed in [`scripts/dev-users.json`](scripts/dev-users.json), passwords generated into the gitignored `scripts/dev-credentials.json`) and about 6 weeks of sample entries. `npm run db:stop` shuts it down.

| Script | |
| --- | --- |
| `npm run dev` / `build` / `preview` | Vite |
| `npm run typecheck` · `lint` · `test` | TypeScript, ESLint, Vitest |
| `npm run db:start` · `db:stop` · `db:reset` | Local Supabase (reset re-applies migrations + seed) |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` after a schema change |
| `npm run db:seed-dev` | Local test users and sample data (refuses non-local URLs) |
| `npm run db:check` | Local checks of row-level security and the `admin-users` function |

## Deploying to production

1. Create a project at [supabase.com](https://supabase.com).
2. Link it and push the schema and the function:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   npx supabase functions deploy admin-users
   ```
   `supabase/seed.sql` contains demo clients and tasks and is **not** applied by `db push`. Create your real clients and tasks in the app.
3. In the Supabase dashboard, open **Authentication → Sign In / Providers**: turn off **Allow new users to sign up**, but keep the Email provider enabled. As a safety net, any account that isn't created by an admin gets an inactive profile with no access (except the very first account; see step 4).
4. Create the **first admin**: **Authentication → Users → Add user** (email + password, auto-confirm). The first account on the instance automatically becomes admin. Everyone else is then added from the app (**Équipe → Ajouter un collaborateur**).
   For `npm run dev`, put the same two values in `.env` (gitignored).
5. Build the frontend with the project's URL and anon (publishable) key from **Project Settings → API**:
   ```bash
   VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon-key> npm run build
   ```
   Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages…). Configure the host to serve `index.html` for unknown paths (SPA fallback), and add the site URL under **Authentication → URL Configuration**.

### GitHub Pages (included)

`.github/workflows/deploy.yml` tests, builds and publishes the site on every push to `main`, at `https://<user>.github.io/<repo>/`. One-time setup in the GitHub repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**, twice:
   - `VITE_SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: the **publishable** key. Never use the secret key; the workflow refuses it.
3. Re-run the workflow from the **Actions** tab, or push a commit.

## Project structure

```
supabase/
  migrations/…_init.sql     schema, RLS policies, triggers, report_rollup()
  functions/admin-users/    account management (service role)
  seed.sql                  demo clients & tasks (local only)
scripts/                    local seeding and security checks
src/
  api/                      TanStack Query hooks (reference data, entries, reports, users)
  auth/                     session/profile context, route guards
  components/               UI kit, layout, duration input, range picker, chart
  features/
    timesheet/              daily entry ("Ma journée")
    dashboard/              manager overview
    reports/                reports + pure roll-up/performance logic (unit tested)
    admin/                  team, clients, tasks
    account/ auth/ misc/
  i18n/                     fr.ts (source of truth), en.ts
  lib/                      supabase client, dates, durations, CSV, errors, types
```

### Data model

```
profiles      id (= auth user) · full_name · email · role (admin|manager|collaborator)
              · manager_id → profiles · daily_target_minutes · active
clients       name · reference · contact_name · contact_email · notes · active
tasks         name · description · client_id → clients (null = every client) · active
time_entries  user_id → profiles · client_id · task_id · work_date · minutes · comment
```

Durations are stored as integer **minutes**. Reports read `report_rollup(from, to)`, which returns one row per *(day, collaborator, client, task)* with RLS applied. The app then rolls these rows up in whatever grouping the screen needs.
