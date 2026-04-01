-- Ajout du champ type au table projets
-- Valeurs possibles : 'client', 'interne', 'prospect'
alter table projets
  add column if not exists type text not null default 'client'
    check (type in ('client', 'interne', 'prospect'));

-- Index pour filtrage rapide par type
create index if not exists idx_projets_type on projets (type);
