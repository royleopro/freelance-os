-- Table devis : gère la hiérarchie projet → devis → paiements
CREATE TABLE IF NOT EXISTS devis (
  id uuid default gen_random_uuid() primary key,
  projet_id uuid references projets(id) on delete cascade,
  libelle text not null,
  montant_total numeric(10,2) not null default 0,
  statut text not null default 'signe'
    check (statut in ('en_cours', 'signe', 'refuse')),
  date_signature date,
  created_at timestamptz default now()
);

-- Ajout de devis_id sur transactions_ca
ALTER TABLE transactions_ca
  ADD COLUMN IF NOT EXISTS devis_id uuid REFERENCES devis(id);
