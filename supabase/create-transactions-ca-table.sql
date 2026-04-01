-- Table des transactions CA (paiements recus)
create table if not exists transactions_ca (
  id uuid default gen_random_uuid() primary key,
  projet_id uuid not null references projets(id) on delete cascade,
  montant numeric(10,2) not null default 0,
  date date not null default current_date,
  statut text not null default 'en_attente'
    check (statut in ('paye', 'en_attente')),
  note text not null default '',
  created_at timestamptz default now()
);

create index if not exists idx_transactions_projet on transactions_ca (projet_id);
create index if not exists idx_transactions_date on transactions_ca (date desc);
