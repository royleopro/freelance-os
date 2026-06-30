"use client";

import { useState, useMemo } from "react";
import type { TacheAvecProjet, SousTache, TacheStatut } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

interface ListViewProps {
  taches: TacheAvecProjet[];
  sousOuTaches: Record<string, SousTache[]>;
  onEdit: (tache: TacheAvecProjet) => void;
}

type SortField = "titre" | "projet" | "etiquette" | "statut" | "temps_estime" | "sous_taches";
type SortOrder = "asc" | "desc";

const statutLabels: Record<TacheStatut, string> = {
  backlog: "Backlog",
  a_faire: "À faire",
  en_cours: "En cours",
  review: "Review",
  termine: "Terminé",
};

const getStatutColor = (statut: TacheStatut) => {
  switch (statut) {
    case "backlog":
      return "bg-gray-500/10 text-gray-300";
    case "a_faire":
      return "bg-blue-500/10 text-blue-300";
    case "en_cours":
      return "bg-amber-500/10 text-amber-300";
    case "review":
      return "bg-purple-500/10 text-purple-300";
    case "termine":
      return "bg-green-500/10 text-green-300";
  }
};

export function ListView({
  taches,
  sousOuTaches,
  onEdit,
}: ListViewProps) {
  const supabase = createClient();
  const [sortField, setSortField] = useState<SortField>("titre");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const sortedTaches = useMemo(() => {
    const sorted = [...taches].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case "titre":
          aVal = a.titre.toLowerCase();
          bVal = b.titre.toLowerCase();
          break;
        case "projet":
          aVal = a.projets?.nom || "";
          bVal = b.projets?.nom || "";
          break;
        case "etiquette":
          aVal = a.etiquette || "";
          bVal = b.etiquette || "";
          break;
        case "statut":
          aVal = a.statut;
          bVal = b.statut;
          break;
        case "temps_estime":
          aVal = a.temps_estime || 0;
          bVal = b.temps_estime || 0;
          break;
        case "sous_taches":
          aVal = (sousOuTaches[a.id] || []).length;
          bVal = (sousOuTaches[b.id] || []).length;
          break;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [taches, sortField, sortOrder, sousOuTaches]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleStatutChange = async (tacheId: string, newStatut: string) => {
    try {
      const { error } = await supabase
        .from("taches")
        .update({ statut: newStatut })
        .eq("id", tacheId);

      if (error) throw error;
      toast.success("Statut mis à jour");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead
      className="cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </div>
    </TableHead>
  );

  return (
    <div className="border border-[rgba(255,255,255,0.06)] rounded-lg overflow-hidden">
      <Table>
        <TableHeader className="bg-[#1A1A1A]">
          <TableRow className="border-b border-[rgba(255,255,255,0.06)]">
            <SortHeader field="titre" label="Titre" />
            <SortHeader field="projet" label="Projet" />
            <SortHeader field="etiquette" label="Étiquette" />
            <SortHeader field="statut" label="Statut" />
            <SortHeader field="temps_estime" label="Temps" />
            <SortHeader field="sous_taches" label="Sous-tâches" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTaches.map((tache) => {
            const completed = (sousOuTaches[tache.id] || []).filter(
              (s) => s.terminee
            ).length;
            const total = (sousOuTaches[tache.id] || []).length;

            return (
              <TableRow
                key={tache.id}
                className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
                onClick={() => onEdit(tache)}
              >
                <TableCell className="font-medium">{tache.titre}</TableCell>
                <TableCell>
                  {tache.projets ? (
                    <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-300 rounded">
                      {tache.projets.nom}
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {tache.etiquette ? (
                    <span className="text-xs px-2 py-1 bg-[#0ACF83]/10 text-[#0ACF83] rounded">
                      {tache.etiquette}
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={tache.statut}
                    onValueChange={(value) =>
                      handleStatutChange(tache.id, value)
                    }
                  >
                    <SelectTrigger className={`w-32 text-xs ${getStatutColor(tache.statut)} bg-transparent border-0 h-7 px-2`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statutLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {tache.temps_estime ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="w-3 h-3" />
                      {tache.temps_estime}h
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {total > 0 ? (
                    <span className="text-xs">
                      {completed}/{total}
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
