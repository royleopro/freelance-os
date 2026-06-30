"use client";

import { useState, useCallback, useMemo } from "react";
import type { TacheAvecProjet, SousTache, TacheStatut } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { handleTacheStatusChange } from "@/lib/tache-service";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "./task-card";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

interface KanbanViewProps {
  taches: TacheAvecProjet[];
  sousOuTaches: Record<string, SousTache[]>;
  onEdit: (tache: TacheAvecProjet) => void;
  onRefetch?: () => void;
}

const colonnes: { statut: TacheStatut; titre: string }[] = [
  { statut: "backlog", titre: "Backlog" },
  { statut: "a_faire", titre: "À faire" },
  { statut: "en_cours", titre: "En cours" },
  { statut: "review", titre: "Review" },
  { statut: "termine", titre: "Terminé" },
];

function KanbanColumn({
  statut,
  titre,
  taches,
  sousOuTaches,
  onEdit,
}: {
  statut: TacheStatut;
  titre: string;
  taches: TacheAvecProjet[];
  sousOuTaches: Record<string, SousTache[]>;
  onEdit: (tache: TacheAvecProjet) => void;
}) {
  const { setNodeRef } = useSortable({ id: statut });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-3 p-4 bg-[#0A0A0A] rounded-lg flex-1 min-h-[600px]"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">{titre}</h3>
        <span className="text-xs bg-[rgba(255,255,255,0.06)] px-2 py-1 rounded">
          {taches.length}
        </span>
      </div>

      <div className="space-y-2 flex-1">
        <SortableContext items={taches.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {taches.map((tache) => (
            <SortableTaskCard
              key={tache.id}
              tache={tache}
              sousOuTaches={sousOuTaches[tache.id] || []}
              onEdit={onEdit}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTaskCard({
  tache,
  sousOuTaches,
  onEdit,
}: {
  tache: TacheAvecProjet;
  sousOuTaches: SousTache[];
  onEdit: (tache: TacheAvecProjet) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: tache.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-2 items-start"
    >
      {/* Poignée de drag */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing hover:bg-[rgba(255,255,255,0.06)] rounded transition-colors"
        title="Glisser pour déplacer"
      >
        <GripVertical className="w-4 h-4 text-gray-500 hover:text-gray-300" />
      </div>

      {/* Contenu cliquable */}
      <div className="flex-1">
        <TaskCard
          tache={tache}
          sousOuTaches={sousOuTaches}
          onClick={() => onEdit(tache)}
        />
      </div>
    </div>
  );
}

export function KanbanView({
  taches,
  sousOuTaches,
  onEdit,
  onRefetch,
}: KanbanViewProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tachesByStatut = useMemo(() => {
    const grouped: Record<TacheStatut, TacheAvecProjet[]> = {
      backlog: [],
      a_faire: [],
      en_cours: [],
      review: [],
      termine: [],
    };

    taches.forEach((tache) => {
      grouped[tache.statut].push(tache);
    });

    return grouped;
  }, [taches]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !over.id) return;

      const activeTache = taches.find((t) => t.id === active.id);
      if (!activeTache) return;

      // Vérifier que over.id est un statut valide
      const validStatuts: TacheStatut[] = ["backlog", "a_faire", "en_cours", "review", "termine"];
      if (!validStatuts.includes(over.id as TacheStatut)) return;

      const newStatut = over.id as TacheStatut;

      if (activeTache.statut === newStatut) return;

      setLoading(true);
      try {
        const isRecurrenceApplied = await handleTacheStatusChange(activeTache, newStatut);

        if (isRecurrenceApplied) {
          toast.success("Tâche terminée, prochaine occurrence créée");
        } else {
          toast.success(`Tâche déplacée vers ${colonnes.find((c) => c.statut === newStatut)?.titre}`);
        }

        if (onRefetch) {
          await onRefetch();
        }
      } catch (error) {
        toast.error("Erreur lors du déplacement");
      } finally {
        setLoading(false);
      }
    },
    [taches, supabase, onRefetch]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {colonnes.map((colonne) => (
          <KanbanColumn
            key={colonne.statut}
            statut={colonne.statut}
            titre={colonne.titre}
            taches={tachesByStatut[colonne.statut]}
            sousOuTaches={sousOuTaches}
            onEdit={onEdit}
          />
        ))}
      </div>
    </DndContext>
  );
}
