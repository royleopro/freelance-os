-- Autoriser mois = 0 dans la table objectifs
-- mois = 0 représente l'objectif CA annuel global (stocké comme ligne séparée)
-- mois = 1..12 représente les objectifs mensuels

ALTER TABLE objectifs DROP CONSTRAINT IF EXISTS objectifs_mois_check;
ALTER TABLE objectifs ADD CONSTRAINT objectifs_mois_check CHECK (mois BETWEEN 0 AND 12);
