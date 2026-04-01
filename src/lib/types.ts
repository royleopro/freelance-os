export type ProjetStatut = "en_cours" | "cloture" | "pas_signe" | "prospection";

export type Etiquette =
  | "design_ui"
  | "wireframe"
  | "reunion"
  | "code"
  | "administration"
  | "prospection"
  | "autre";

export interface Projet {
  id: string;
  nom: string;
  client: string;
  statut: ProjetStatut;
  montant_devise: number;
  montant_paye: number;
  tjm: number;
  heures_passees: number;
  date_debut: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionHeure {
  id: string;
  projet_id: string;
  date: string;
  duree: number;
  etiquette: Etiquette;
  facturable: boolean;
  created_at: string;
}

export interface SessionHeureAvecProjet extends SessionHeure {
  projets: { nom: string } | null;
}

export type TransactionStatut = "paye" | "en_attente";

export interface TransactionCA {
  id: string;
  projet_id: string;
  montant: number;
  date: string;
  statut: TransactionStatut;
  note: string;
  created_at: string;
}

export interface Parametre {
  cle: string;
  valeur: string;
  updated_at: string;
}

export interface Objectif {
  id: string;
  annee: number;
  mois: number;
  ca_cible: number;
  tjm_cible: number;
  jours_cibles: number;
}
