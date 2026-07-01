"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tache, Projet, TacheAvecProjet, SousTache } from "@/lib/types";
import { useTaches } from "@/hooks/use-taches";
import { TacheDialog } from "@/components/tache-dialog";
import { KanbanView } from "@/components/kanban-view";
import { ListView } from "@/components/list-view";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, LayoutGrid, List } from "lucide-react";

type ViewMode = "kanban" | "list";

export default function TachesPage() {
  const supabase = createClient();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [projets, setProjets] = useState<Projet[]>([]);
  const [selectedProjet, setSelectedProjet] = useState<string | null>("");
  const [selectedEtiquette, setSelectedEtiquette] = useState<string | null>("");
  const [selectedDateFilter, setSelectedDateFilter] = useState<"toutes" | "avec" | "sans">("toutes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTache, setEditingTache] = useState<Tache | null>(null);
  const [allTaches, setAllTaches] = useState<TacheAvecProjet[]>([]);
  const [sousOuTaches, setSousOuTaches] = useState<Record<string, SousTache[]>>({});
  const [loading, setLoading] = useState(true);
  const [etiquettes, setEtiquettes] = useState<string[]>([]);

  // Charger les projets
  useEffect(() => {
    const fetchProjets = async () => {
      const { data } = await supabase
        .from("projets")
        .select("*")
        .order("nom", { ascending: true });

      setProjets(data || []);
    };

    fetchProjets();
  }, [supabase]);

  // Charger les tâches et sous-tâches
  const fetchTaches = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("taches")
        .select("*, projets:projet_id(nom, type)")
        .order("ordre", { ascending: true });

      if (selectedProjet) {
        query = query.eq("projet_id", selectedProjet);
      }

      const { data: tacheData } = await query;
      setAllTaches(tacheData || []);

      // Extraire les étiquettes uniques
      const uniqueEtiquettes = Array.from(
        new Set(
          (tacheData || [])
            .map((t) => t.etiquette)
            .filter((e) => e !== null)
        )
      ) as string[];
      setEtiquettes(uniqueEtiquettes.sort());

      // Charger les sous-tâches
      if (tacheData && tacheData.length > 0) {
        const tacheIds = tacheData.map((t) => t.id);
        const { data: sousData } = await supabase
          .from("sous_taches")
          .select("*")
          .in("tache_id", tacheIds)
          .order("ordre", { ascending: true });

        const grouped: Record<string, SousTache[]> = {};
        (sousData || []).forEach((sous) => {
          if (!grouped[sous.tache_id]) {
            grouped[sous.tache_id] = [];
          }
          grouped[sous.tache_id].push(sous);
        });
        setSousOuTaches(grouped);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaches();
  }, [supabase, selectedProjet]);

  // Filtrer les tâches par étiquette
  const filteredTaches = allTaches
    .filter((t) => (selectedEtiquette ? t.etiquette === selectedEtiquette : true))
    .filter((t) => {
      if (selectedDateFilter === "avec") return t.do_date !== null;
      if (selectedDateFilter === "sans") return t.do_date === null;
      return true;
    });

  const handleOpenDialog = () => {
    setEditingTache(null);
    setDialogOpen(true);
  };

  const handleEditTache = (tache: TacheAvecProjet) => {
    setEditingTache(tache);
    setDialogOpen(true);
  };

  const handleSaveTache = (tache: Tache) => {
    setDialogOpen(false);

    // Recharger les tâches
    const fetchTaches = async () => {
      let query = supabase
        .from("taches")
        .select("*, projets:projet_id(nom, type)")
        .order("ordre", { ascending: true });

      if (selectedProjet) {
        query = query.eq("projet_id", selectedProjet);
      }

      const { data: tacheData } = await query;
      setAllTaches(tacheData || []);
    };

    fetchTaches();
  };

  return (
    <div className="space-y-6">
      {/* Header avec contrôles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Tâches</h1>
          <Button
            onClick={handleOpenDialog}
            className="gap-2 bg-brand-accent text-[#0A0A0A] hover:bg-[#0aa373]"
          >
            <Plus className="w-4 h-4" />
            Nouvelle tâche
          </Button>
        </div>

        {/* Filtres et sélecteurs de vue */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 flex-1">
            {/* Filtre projet */}
            <Select value={selectedProjet} onValueChange={setSelectedProjet}>
              <SelectTrigger className="w-full sm:w-48 bg-[#1A1A1A] border-[rgba(255,255,255,0.06)]">
                <SelectValue placeholder="Tous les projets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les projets</SelectItem>
                {projets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtre étiquette */}
            {etiquettes.length > 0 && (
              <Select value={selectedEtiquette} onValueChange={setSelectedEtiquette}>
                <SelectTrigger className="w-full sm:w-48 bg-[#1A1A1A] border-[rgba(255,255,255,0.06)]">
                  <SelectValue placeholder="Toutes les étiquettes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes les étiquettes</SelectItem>
                  {etiquettes.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtre date */}
            <Select value={selectedDateFilter} onValueChange={(v) => setSelectedDateFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-40 bg-[#1A1A1A] border-[rgba(255,255,255,0.06)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les dates</SelectItem>
                <SelectItem value="avec">Avec date</SelectItem>
                <SelectItem value="sans">Sans date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggle de vue */}
          <div className="flex items-center gap-2 bg-[#1A1A1A] p-1 rounded border border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setViewMode("kanban")}
              className={`
                p-2 rounded transition-colors
                ${
                  viewMode === "kanban"
                    ? "bg-brand-accent text-[#0A0A0A]"
                    : "text-gray-400 hover:text-white"
                }
              `}
              title="Vue Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`
                p-2 rounded transition-colors
                ${
                  viewMode === "list"
                    ? "bg-brand-accent text-[#0A0A0A]"
                    : "text-gray-400 hover:text-white"
                }
              `}
              title="Vue Liste"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Chargement...</div>
        </div>
      ) : filteredTaches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <p>Aucune tâche trouvée</p>
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanView
          taches={filteredTaches}
          sousOuTaches={sousOuTaches}
          onEdit={handleEditTache}
          onRefetch={fetchTaches}
        />
      ) : (
        <ListView
          taches={filteredTaches}
          sousOuTaches={sousOuTaches}
          onEdit={handleEditTache}
        />
      )}

      {/* Dialog de création/édition */}
      <TacheDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tache={editingTache}
        projets={projets}
        onSave={handleSaveTache}
      />
    </div>
  );
}
