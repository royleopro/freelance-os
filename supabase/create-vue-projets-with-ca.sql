-- Vue projets_with_ca : calcule les montants depuis transactions_ca
CREATE OR REPLACE VIEW projets_with_ca AS
SELECT
  p.*,
  COALESCE(SUM(CASE WHEN t.statut = 'paye' THEN t.montant ELSE 0 END), 0) as montant_paye,
  COALESCE(SUM(CASE WHEN t.statut = 'signe' THEN t.montant ELSE 0 END), 0) as montant_signe,
  COALESCE(SUM(t.montant), 0) as montant_total
FROM projets p
LEFT JOIN transactions_ca t ON t.projet_id = p.id
GROUP BY p.id;

-- Suppression des colonnes devenues inutiles sur la table projets
-- ATTENTION : a executer APRES avoir cree la vue
-- ALTER TABLE projets DROP COLUMN IF EXISTS montant_devise;
-- ALTER TABLE projets DROP COLUMN IF EXISTS montant_paye;
