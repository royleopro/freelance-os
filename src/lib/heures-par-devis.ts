import type { Devis } from "@/lib/types";

export function devisCapacityHeures(devis: Pick<Devis, "jours_signes" | "base_journee">): number {
  const base = devis.base_journee ?? 7;
  return (devis.jours_signes ?? 0) * base;
}

/**
 * Attribute billable sessions to devis in chronological order.
 *
 * Sessions are sorted by date ASC. Devis are sorted by date_signature ASC
 * (then created_at). Each devis receives hours up to jours_signes × base_journee.
 *
 * Un devis clôturé (statut_heures = 'cloture') :
 *   - n'attribue que les sessions datées <= date_cloture, cappées à sa capacité
 *   - tout surplus pré-clôture (capacité dépassée avant date_cloture) est perdu
 *   - le devis suivant ne reçoit que les sessions datées > date_cloture
 *
 * Returns a map of devis id → attributed hours.
 */
export function computeHeuresParDevis(
  devisList: Devis[],
  sessions: { date: string; duree: number; facturable: boolean; projet_id: string }[],
  projetId: string
): Record<string, number> {
  const facturables = sessions
    .filter((s) => s.facturable && s.projet_id === projetId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const sortedDevis = [...devisList]
    .filter((d) => d.projet_id === projetId)
    .sort((a, b) => {
      const da = a.date_signature ?? a.created_at;
      const db = b.date_signature ?? b.created_at;
      return da.localeCompare(db);
    });

  const result: Record<string, number> = {};
  for (const d of sortedDevis) result[d.id] = 0;

  let sessionIndex = 0;

  for (const devis of sortedDevis) {
    const capacity = devisCapacityHeures(devis);
    if (capacity <= 0) continue;

    const isClosed = devis.statut_heures === "cloture";
    const dateCloture = devis.date_cloture;

    let filled = 0;
    while (sessionIndex < facturables.length && filled < capacity) {
      const session = facturables[sessionIndex];

      if (isClosed && dateCloture && session.date > dateCloture) {
        break;
      }

      const remaining = capacity - filled;
      if (session.duree <= remaining) {
        filled += session.duree;
        sessionIndex++;
      } else {
        filled += remaining;
        facturables[sessionIndex] = { ...session, duree: session.duree - remaining };
        break;
      }
    }
    result[devis.id] = filled;

    // Devis clôturé : tout surplus pré-clôture est perdu (non reporté sur le devis suivant).
    if (isClosed && dateCloture) {
      while (
        sessionIndex < facturables.length &&
        facturables[sessionIndex].date <= dateCloture
      ) {
        sessionIndex++;
      }
    }
  }

  // Heures restantes (toutes post-clôture si le dernier devis est clôturé) : au dernier devis ouvert.
  if (sessionIndex < facturables.length) {
    const lastOpenDevis = [...sortedDevis]
      .reverse()
      .find((d) => d.statut_heures !== "cloture" && (d.jours_signes ?? 0) > 0);
    if (lastOpenDevis) {
      let overflow = 0;
      for (let i = sessionIndex; i < facturables.length; i++) {
        overflow += facturables[i].duree;
      }
      result[lastOpenDevis.id] = (result[lastOpenDevis.id] ?? 0) + overflow;
    }
  }

  return result;
}
