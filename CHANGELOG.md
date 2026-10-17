# Changelog

## 2026-10-17 (v0.2.0)

- Task categories: tasks now belong to a category, and each client lists the categories of work done for it. The entry form only offers matching tasks, and the database enforces this.
- Exercises (e.g. 2025, 2026): one shared list managed by admins. Every time entry is attached to an exercise, and the form remembers the last one used. Reports can group by category and exercise.
- Durations are entered as separate hours and minutes boxes, with quick picks.
- Daily targets were removed; activity reports now show working days filled in, missing days and a fill rate.
- New migration `20261017000000_categories_exercises.sql`, already applied to the online Supabase project.

## 2026-10-15 to 2026-10-16 (v0.1.0)

- First version of TimeLedger: daily time entry per client and task, manager dashboard, reports with CSV export, team/client/task administration, French and English UI.
- Supabase schema with row-level security, integrity triggers and the `admin-users` Edge Function for account management. Public sign-up is disabled.
- GitHub Pages deployment workflow (`.github/workflows/deploy.yml`), which builds with the publishable key only.
- The app uses the online Supabase project by default. Local secrets (database password, generated test credentials) are kept out of git.
