import type { Devis } from "@/lib/types";

/**
 * Attribute billable sessions to devis in chronological order.
 *
 * Sessions are sorted by date ASC and attributed to devis sorted by
 * date_signature ASC (then created_at). Each devis receives hours
 * up to jours_signes × 8. Remaining hours overflow to the next devis.
 *
 * Returns a map of devis id → attributed hours.
 */
export function computeHeuresParDevis(
  devisList: Devis[],
  sessions: { date: string; duree: number; facturable: boolean; projet_id: string }[],
  projetId: string
): Record<string, number> {
  // Only facturable sessions for this project, sorted chronologically
  const facturables = sessions
    .filter((s) => s.facturable && s.projet_id === projetId)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Sort devis by date_signature (nulls last), then created_at
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
    const capacity = (devis.jours_signes ?? 0) * 8;
    if (capacity <= 0) continue; // skip devis without jours_signes

    let filled = 0;
    while (sessionIndex < facturables.length && filled < capacity) {
      const remaining = capacity - filled;
      const session = facturables[sessionIndex];

      if (session.duree <= remaining) {
        filled += session.duree;
        sessionIndex++;
      } else {
        // Partial: this session overflows to next devis
        filled += remaining;
        // Reduce session duration for next devis
        facturables[sessionIndex] = { ...session, duree: session.duree - remaining };
        break;
      }
    }
    result[devis.id] = filled;
  }

  // Any remaining hours go to the last devis with capacity, or create overflow on the last one
  if (sessionIndex < facturables.length && sortedDevis.length > 0) {
    const lastDevis = sortedDevis[sortedDevis.length - 1];
    let overflow = 0;
    for (let i = sessionIndex; i < facturables.length; i++) {
      overflow += facturables[i].duree;
    }
    result[lastDevis.id] = (result[lastDevis.id] ?? 0) + overflow;
  }

  return result;
}
