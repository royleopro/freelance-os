import type { RecurrenceType, JourSemaine } from "./types";

const joursSemaine: Record<number, JourSemaine> = {
  1: "lun",
  2: "mar",
  3: "mer",
  4: "jeu",
  5: "ven",
  6: "sam",
  0: "dim",
};

export function calculateNextOccurrence(
  doDate: string,
  recurrence: RecurrenceType,
  joursRecurrence: JourSemaine[] | null
): string | null {
  if (recurrence === "aucune") return null;

  const date = new Date(doDate);
  date.setHours(0, 0, 0, 0);

  switch (recurrence) {
    case "quotidien":
      date.setDate(date.getDate() + 1);
      return date.toISOString().split("T")[0];

    case "hebdomadaire":
      date.setDate(date.getDate() + 7);
      return date.toISOString().split("T")[0];

    case "mensuel": {
      const day = date.getDate();
      date.setMonth(date.getMonth() + 1);
      // Gérer les mois avec moins de jours
      const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(day, maxDay));
      return date.toISOString().split("T")[0];
    }

    case "personnalise": {
      if (!joursRecurrence || joursRecurrence.length === 0) return null;

      // Convertir les jours en numéros (dimanche = 0)
      const targetDays = joursRecurrence.map((jour) => {
        const keys = Object.entries(joursSemaine).find(([_, v]) => v === jour);
        return keys ? parseInt(keys[0]) : -1;
      });

      // Chercher le prochain jour
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + i);
        const dayOfWeek = nextDate.getDay();

        if (targetDays.includes(dayOfWeek)) {
          return nextDate.toISOString().split("T")[0];
        }
      }

      return null;
    }

    default:
      return null;
  }
}

export function formatDoDate(doDate: string | null): string {
  if (!doDate) return "";

  const date = new Date(doDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Comparaison
  if (date.getTime() === today.getTime()) {
    return "Aujourd'hui";
  }

  if (date.getTime() === tomorrow.getTime()) {
    return "Demain";
  }

  // Formatage personnalisé pour les autres dates
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };

  return date.toLocaleDateString("fr-FR", options);
}

export function isDatePassed(doDate: string | null): boolean {
  if (!doDate) return false;

  const date = new Date(doDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
}

export const joursSemaneListe: { value: JourSemaine; label: string }[] = [
  { value: "lun", label: "Lundi" },
  { value: "mar", label: "Mardi" },
  { value: "mer", label: "Mercredi" },
  { value: "jeu", label: "Jeudi" },
  { value: "ven", label: "Vendredi" },
  { value: "sam", label: "Samedi" },
  { value: "dim", label: "Dimanche" },
];

export const recurrenceLabels: Record<RecurrenceType, string> = {
  aucune: "Aucune",
  quotidien: "Quotidien",
  hebdomadaire: "Hebdomadaire",
  mensuel: "Mensuel",
  personnalise: "Jours personnalisés",
};
