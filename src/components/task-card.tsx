"use client";

import type { TacheAvecProjet, SousTache } from "@/lib/types";
import { forwardRef } from "react";
import { Clock, RotateCw } from "lucide-react";
import { formatDoDate, isDatePassed } from "@/lib/recurrence";

interface TaskCardProps {
  tache: TacheAvecProjet;
  sousOuTaches: SousTache[];
  onClick?: () => void;
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(
  ({ tache, sousOuTaches, onClick }, ref) => {
    const completedSous = sousOuTaches.filter((s) => s.terminee).length;
    const totalSous = sousOuTaches.length;
    const completionPercentage = totalSous > 0 ? (completedSous / totalSous) * 100 : 0;

    const getProjetColor = (type?: string) => {
      switch (type) {
        case "client":
          return "bg-blue-500/20 text-blue-300 border-blue-500/30";
        case "interne":
          return "bg-purple-500/20 text-purple-300 border-purple-500/30";
        case "prospect":
          return "bg-amber-500/20 text-amber-300 border-amber-500/30";
        default:
          return "bg-gray-500/20 text-gray-300 border-gray-500/30";
      }
    };

    const getEtiquetteColor = () => {
      return "bg-[#0ACF83]/10 text-[#0ACF83]";
    };

    const isDone = tache.statut === "termine";

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`
          p-3 bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-lg cursor-pointer
          hover:border-[rgba(255,255,255,0.12)] hover:shadow-lg transition-all
          ${isDone ? "opacity-60" : ""}
        `}
      >
        <div className="space-y-2">
          <h3 className="font-medium text-sm line-clamp-2 text-white">
            {tache.titre}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {tache.projets && (
              <span
                className={`
                  text-xs px-2 py-0.5 rounded border
                  ${getProjetColor(tache.projets.type)}
                `}
              >
                {tache.projets.nom}
              </span>
            )}
            {tache.etiquette && (
              <span className={`text-xs px-2 py-0.5 rounded ${getEtiquetteColor()}`}>
                {tache.etiquette}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {tache.temps_estime && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{tache.temps_estime}h</span>
              </div>
            )}
            {tache.recurrence !== "aucune" && (
              <RotateCw className="w-3 h-3 text-[#0ACF83]" />
            )}
          </div>

          {tache.do_date && (
            <div
              className={`text-xs px-2 py-1 rounded ${
                isDatePassed(tache.do_date) && tache.statut !== "termine"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-gray-500/10 text-gray-300"
              }`}
            >
              {formatDoDate(tache.do_date)}
            </div>
          )}

          {totalSous > 0 && (
            <div className="pt-1 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Sous-tâches</span>
                <span>{completedSous}/{totalSous}</span>
              </div>
              <div className="w-full h-1.5 bg-[#0A0A0A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0ACF83] transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

TaskCard.displayName = "TaskCard";
