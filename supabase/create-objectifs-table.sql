-- Table objectifs CA mensuels
create table if not exists objectifs (
  id uuid default gen_random_uuid() primary key,
  annee integer not null,
  mois integer not null check (mois between 1 and 12),
  ca_cible numeric(10,2) not null default 0,
  tjm_cible numeric(10,2) not null default 0,
  jours_cibles numeric(6,2) not null default 0,
  unique (annee, mois)
);

create index if not exists idx_objectifs_annee on objectifs (annee);

-- Valeurs par defaut 2026
insert into objectifs (annee, mois, ca_cible, tjm_cible, jours_cibles) values
  (2026, 1,  4000, 350, 11.4),
  (2026, 2,  4400, 400, 11),
  (2026, 3,  4800, 400, 12),
  (2026, 4,  5400, 450, 12),
  (2026, 5,  5850, 450, 13),
  (2026, 6,  5850, 450, 13),
  (2026, 7,  2250, 450, 5),
  (2026, 8,  2250, 450, 5),
  (2026, 9,  4950, 450, 11),
  (2026, 10, 5400, 450, 12),
  (2026, 11, 5400, 450, 12),
  (2026, 12, 5400, 450, 12)
on conflict (annee, mois) do nothing;
