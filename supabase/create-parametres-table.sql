-- Table parametres (clé/valeur pour les reglages globaux)
create table if not exists parametres (
  cle text primary key,
  valeur text not null default '',
  updated_at timestamptz default now()
);

-- Valeurs par defaut
insert into parametres (cle, valeur) values
  ('objectif_ca_annuel', '60000'),
  ('mois_survie', '6'),
  ('taux_urssaf', '0.256'),
  ('taux_impots', '0.02'),
  ('objectif_net_mensuel', '2000'),
  ('frais_mensuels_fixes', '131.67'),
  ('solde_compte_pro', '0')
on conflict (cle) do nothing;
