import { createClient } from "@/lib/supabase/client";
import type { Tache } from "@/lib/types";
import { calculateNextOccurrence } from "@/lib/recurrence";

export async function handleTacheStatusChange(
  tache: Tache,
  newStatut: string
) {
  const supabase = createClient();

  // Si la tâche passe à "terminée" et qu'elle a une récurrence
  if (newStatut === "termine" && tache.recurrence !== "aucune" && tache.do_date) {
    const nextDate = calculateNextOccurrence(
      tache.do_date,
      tache.recurrence,
      tache.jours_recurrence
    );

    if (nextDate) {
      const today = new Date().toISOString().split("T")[0];

      // Mettre à jour la tâche
      await supabase
        .from("taches")
        .update({
          statut: "a_faire",
          do_date: nextDate,
          derniere_occurrence: today,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tache.id);

      // Remettre les sous-tâches à terminee = false
      await supabase
        .from("sous_taches")
        .update({ terminee: false })
        .eq("tache_id", tache.id);

      return true; // Indiquer que la récurrence a été appliquée
    }
  }

  // Sinon, juste mettre à jour le statut
  await supabase
    .from("taches")
    .update({
      statut: newStatut,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tache.id);

  return false;
}
