-- Vue projets_with_ca : calcule les montants depuis transactions_ca + devis
-- Note : on liste les colonnes de projets explicitement car la table
-- contient encore montant_paye / montant_devise (colonnes legacy).
CREATE OR REPLACE VIEW projets_with_ca AS
SELECT
  p.id,
  p.nom,
  p.client,
  p.statut,
  p.type,
  p.tjm,
  p.heures_passees,
  p.date_debut,
  p.deadline,
  p.created_at,
  p.updated_at,
  COALESCE(t_agg.montant_paye, 0) as montant_paye,
  COALESCE(t_agg.montant_signe, 0) as montant_signe,
  COALESCE(t_agg.montant_total, 0) as montant_total,
  COALESCE(d_agg.montant_devis, 0) as montant_devis,
  COALESCE(d_agg.montant_devis, 0) - COALESCE(t_agg.montant_paye, 0) as reste_a_payer
FROM projets p
LEFT JOIN (
  SELECT
    projet_id,
    SUM(CASE WHEN statut = 'paye' THEN montant ELSE 0 END) as montant_paye,
    SUM(CASE WHEN statut = 'signe' THEN montant ELSE 0 END) as montant_signe,
    SUM(montant) as montant_total
  FROM transactions_ca
  GROUP BY projet_id
) t_agg ON t_agg.projet_id = p.id
LEFT JOIN (
  SELECT
    projet_id,
    SUM(CASE WHEN statut = 'signe' THEN montant_total ELSE 0 END) as montant_devis
  FROM devis
  GROUP BY projet_id
) d_agg ON d_agg.projet_id = p.id;
