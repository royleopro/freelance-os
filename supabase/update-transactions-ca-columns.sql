-- Ajout des colonnes manquantes a transactions_ca
-- libelle, date_paiement, source, qonto_id
-- + ajout de 'signe' au check constraint statut

-- Nouvelles colonnes
ALTER TABLE transactions_ca
  ADD COLUMN IF NOT EXISTS libelle text NOT NULL DEFAULT '';

ALTER TABLE transactions_ca
  ADD COLUMN IF NOT EXISTS date_paiement date;

ALTER TABLE transactions_ca
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manuel';

ALTER TABLE transactions_ca
  ADD COLUMN IF NOT EXISTS qonto_id text UNIQUE;

-- Mise a jour du check constraint statut pour ajouter 'signe'
ALTER TABLE transactions_ca DROP CONSTRAINT IF EXISTS transactions_ca_statut_check;
ALTER TABLE transactions_ca ADD CONSTRAINT transactions_ca_statut_check
  CHECK (statut IN ('paye', 'signe', 'en_attente'));
