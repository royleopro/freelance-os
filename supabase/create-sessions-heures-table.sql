-- Table des sessions d'heures
create table if not exists sessions_heures (
  id uuid default gen_random_uuid() primary key,
  projet_id uuid not null references projets(id) on delete cascade,
  date date not null default current_date,
  duree numeric(6,2) not null default 0,
  etiquette text not null default 'autre'
    check (etiquette in ('design_ui', 'wireframe', 'reunion', 'code', 'administration', 'prospection', 'autre')),
  facturable boolean not null default true,
  created_at timestamptz default now()
);

-- Index pour les requetes par projet et par date
create index if not exists idx_sessions_projet on sessions_heures (projet_id);
create index if not exists idx_sessions_date on sessions_heures (date desc);
