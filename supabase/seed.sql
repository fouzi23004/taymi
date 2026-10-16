-- Demo data for local development (`npm run db:reset`).
-- Users are not seeded: create them from the app (Équipe → Ajouter) or with
-- `node scripts/create-user.mjs`. The first user created becomes admin.

insert into public.clients (name, reference, contact_name, contact_email) values
  ('Boulangerie Ben Salah', 'CLI-001', 'Karim Ben Salah', 'contact@boulangerie-bs.example'),
  ('Transports Méditerranée', 'CLI-002', 'Leïla Haddad', 'compta@transmed.example'),
  ('Clinique Les Oliviers', 'CLI-003', 'Dr. Sami Trabelsi', 'direction@oliviers.example'),
  ('Atelier Nour Design', 'CLI-004', 'Nour Jaziri', 'hello@nourdesign.example'),
  ('Hôtel Riviera', 'CLI-005', 'Marc Lefèvre', 'admin@riviera.example');

insert into public.tasks (name, description) values
  ('Saisie comptable', 'Saisie des pièces et rapprochements'),
  ('Déclaration TVA', 'Préparation et dépôt des déclarations'),
  ('Paie', 'Bulletins de salaire et déclarations sociales'),
  ('Bilan annuel', 'Clôture, états financiers et liasse'),
  ('Conseil / rendez-vous', 'Réunions et conseil au client'),
  ('Administratif', 'Courriers, relances, archivage');

insert into public.tasks (name, description, client_id)
select 'Inventaire de stock', 'Comptage et valorisation du stock', id
from public.clients where reference = 'CLI-001';
