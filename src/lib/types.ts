export type ProjetStatut = "en_cours" | "cloture" | "pas_signe" | "prospection";
export type ProjetType = "client" | "interne" | "prospect";

export type Etiquette =
  | "projet"
  | "prospection"
  | "wireframe"
  | "communication"
  | "design ui"
  | "réunion"
  | "analyse"
  | "organisation"
  | "administration"
  | "brainstorming"
  | "formation"
  | "tests utilisateurs"
  | "design system"
  | "prototypage"
  | "mail/discussion"
  | "study case"
  | "facturation"
  | "graphisme"
  | "outillage"
  | "design thinking"
  | "maintenance"
  | "benchmark"
  | "veille"
  | "retouches UI/UX"
  | "code"
  | "autre";

export interface Projet {
  id: string;
  nom: string;
  client: string;
  statut: ProjetStatut;
  type: ProjetType;
  tjm: number;
  heures_passees: number;
  date_debut: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  // Computed from projets_with_ca view
  montant_paye: number;
  montant_signe: number;
  montant_total: number;
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
  projets: { nom: string; type?: string } | null;
}

export type TransactionStatut = "paye" | "signe" | "en_attente";

export interface TransactionCA {
  id: string;
  projet_id: string;
  libelle: string;
  montant: number;
  date: string;
  date_paiement: string | null;
  statut: TransactionStatut;
  source: string;
  qonto_id: string | null;
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
