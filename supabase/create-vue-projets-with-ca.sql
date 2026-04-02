-- Vue projets_with_ca : calcule les montants depuis transactions_ca + devis
-- Les transactions comptent pour un projet si :
--   1. projet_id = p.id (lien direct)
--   2. OU devis_id pointe vers un devis du projet
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
    COALESCE(d.projet_id, t.projet_id) as projet_id,
    SUM(CASE WHEN t.statut = 'paye' THEN t.montant ELSE 0 END) as montant_paye,
    SUM(CASE WHEN t.statut = 'signe' THEN t.montant ELSE 0 END) as montant_signe,
    SUM(t.montant) as montant_total
  FROM transactions_ca t
  LEFT JOIN devis d ON t.devis_id = d.id
  GROUP BY COALESCE(d.projet_id, t.projet_id)
) t_agg ON t_agg.projet_id = p.id
LEFT JOIN (
  SELECT
    projet_id,
    SUM(CASE WHEN statut = 'signe' THEN montant_total ELSE 0 END) as montant_devis
  FROM devis
  GROUP BY projet_id
) d_agg ON d_agg.projet_id = p.id;
