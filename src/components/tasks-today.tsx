"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TacheAvecProjet } from "@/lib/types";
import { handleTacheStatusChange } from "@/lib/tache-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export function TasksToday() {
  const supabase = createClient();
  const [taches, setTaches] = useState<TacheAvecProjet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTachesToday = async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data } = await supabase
        .from("taches")
        .select("*, projets:projet_id(nom, type)")
        .eq("do_date", today)
        .neq("statut", "termine")
        .order("projet_id", { ascending: true });

      setTaches(data || []);
      setLoading(false);
    };

    fetchTachesToday();
  }, [supabase]);

  const handleMarkDone = async (tache: TacheAvecProjet) => {
    try {
      await handleTacheStatusChange(tache, "termine");
      setTaches((prev) => prev.filter((t) => t.id !== tache.id));
      toast.success("Tâche terminée");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  return (
    <Card className="bg-[#1A1A1A] border-[rgba(255,255,255,0.06)]">
      <CardHeader>
        <CardTitle className="text-base">Tâches du jour</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-gray-400">Chargement...</div>
        ) : taches.length === 0 ? (
          <div className="text-sm text-gray-400">Aucune tâche prévue aujourd'hui</div>
        ) : (
          <div className="space-y-2">
            {taches.map((tache) => (
              <div
                key={tache.id}
                className="flex items-start gap-3 p-2 bg-[#0A0A0A] rounded hover:bg-[rgba(255,255,255,0.04)] transition-colors"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => handleMarkDone(tache)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {tache.titre}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {tache.projets && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded">
                        {tache.projets.nom}
                      </span>
                    )}
                    {tache.etiquette && (
                      <span className="text-xs px-2 py-0.5 bg-[#0ACF83]/10 text-[#0ACF83] rounded">
                        {tache.etiquette}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
