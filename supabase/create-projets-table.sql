-- Table des projets freelance
create table if not exists projets (
  id uuid default gen_random_uuid() primary key,
  nom text not null,
  client text not null default '',
  statut text not null default 'prospection'
    check (statut in ('en_cours', 'cloture', 'pas_signe', 'prospection')),
  montant_devise numeric(10,2) not null default 0,
  montant_paye numeric(10,2) not null default 0,
  tjm numeric(10,2) not null default 0,
  heures_passees numeric(8,2) not null default 0,
  date_debut date,
  deadline date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index sur le statut pour filtrage rapide
create index if not exists idx_projets_statut on projets (statut);

-- Trigger pour mettre à jour updated_at automatiquement
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger projets_updated_at
  before update on projets
  for each row
  execute function update_updated_at();
