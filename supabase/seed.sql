-- Demo data for the optional local Supabase (`npm run db:reset`). Not used online.
-- Users are not seeded: create them with `node scripts/seed-dev.mjs`.

insert into public.clients (name, reference, contact_name, contact_email) values
  ('Boulangerie Ben Salah', 'CLI-001', 'Karim Ben Salah', 'contact@boulangerie-bs.example'),
  ('Transports Méditerranée', 'CLI-002', 'Leïla Haddad', 'compta@transmed.example'),
  ('Clinique Les Oliviers', 'CLI-003', 'Dr. Sami Trabelsi', 'direction@oliviers.example'),
  ('Atelier Nour Design', 'CLI-004', 'Nour Jaziri', 'hello@nourdesign.example'),
  ('Hôtel Riviera', 'CLI-005', 'Marc Lefèvre', 'admin@riviera.example');

insert into public.categories (name, description) values
  ('Comptabilité', 'Tenue et révision des comptes'),
  ('Fiscalité', 'Déclarations et conseil fiscal'),
  ('Social', 'Paie et déclarations sociales'),
  ('Conseil', 'Rendez-vous et accompagnement');

insert into public.tasks (name, description, category_id)
select t.name, t.description, c.id
from (values
  ('Saisie comptable', 'Saisie des pièces et rapprochements', 'Comptabilité'),
  ('Bilan annuel', 'Clôture, états financiers et liasse', 'Comptabilité'),
  ('Inventaire de stock', 'Comptage et valorisation du stock', 'Comptabilité'),
  ('Déclaration TVA', 'Préparation et dépôt des déclarations', 'Fiscalité'),
  ('Paie', 'Bulletins de salaire et déclarations sociales', 'Social'),
  ('Conseil / rendez-vous', 'Réunions et conseil au client', 'Conseil'),
  ('Administratif', 'Courriers, relances, archivage', 'Conseil')
) as t(name, description, category)
join public.categories c on c.name = t.category;

-- Every client gets accounting, tax and advice; only some have payroll.
insert into public.client_categories (client_id, category_id)
select cl.id, ca.id
from public.clients cl
cross join public.categories ca
where ca.name <> 'Social' or cl.reference in ('CLI-002', 'CLI-003', 'CLI-005');

insert into public.exercises (name) values ('2025'), ('2026');
