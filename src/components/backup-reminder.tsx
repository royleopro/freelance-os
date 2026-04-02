"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const BACKUP_LS_KEY = "freelance-os-last-backup";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function BackupReminder() {
  useEffect(() => {
    const last = localStorage.getItem(BACKUP_LS_KEY);
    const shouldRemind =
      !last || Date.now() - new Date(last).getTime() > SEVEN_DAYS_MS;

    if (shouldRemind) {
      // Delay to avoid showing during initial page load
      const timeout = setTimeout(() => {
        toast.warning("Aucune sauvegarde depuis 7 jours", {
          description: "Pensez a telecharger une sauvegarde de vos donnees.",
          action: {
            label: "Parametres",
            onClick: () => {
              window.location.href = "/parametres";
            },
          },
          duration: 10000,
        });
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, []);

  return null;
}
