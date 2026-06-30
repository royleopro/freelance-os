"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tache, Projet, TacheStatut, RecurrenceType, JourSemaine } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { joursSemaneListe, recurrenceLabels } from "@/lib/recurrence";
import { toast } from "sonner";

interface TacheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tache?: Tache | null;
  projets: Projet[];
  onSave: (tache: Tache) => void;
}

const statuts: TacheStatut[] = ["backlog", "a_faire", "en_cours", "review", "termine"];
const etiquettes = [
  "projet",
  "prospection",
  "wireframe",
  "communication",
  "design ui",
  "réunion",
  "analyse",
  "organisation",
  "administration",
  "brainstorming",
  "formation",
  "tests utilisateurs",
  "design system",
  "prototypage",
  "mail/discussion",
  "study case",
  "facturation",
  "graphisme",
  "outillage",
  "design thinking",
  "maintenance",
  "benchmark",
  "veille",
  "retouches UI/UX",
  "code",
  "autre",
];

export function TacheDialog({
  open,
  onOpenChange,
  tache,
  projets,
  onSave,
}: TacheDialogProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titre: tache?.titre || "",
    projet_id: tache?.projet_id || "",
    etiquette: tache?.etiquette || "",
    description: tache?.description || "",
    temps_estime: tache?.temps_estime || "",
    statut: (tache?.statut || "backlog") as TacheStatut,
    do_date: tache?.do_date || "",
    recurrence: (tache?.recurrence || "aucune") as RecurrenceType,
    jours_recurrence: (tache?.jours_recurrence || []) as JourSemaine[],
  });

  const selectedProjet = projets.find((p) => p.id === formData.projet_id);

  const toggleJourRecurrence = (jour: JourSemaine) => {
    const jours = formData.jours_recurrence || [];
    if (jours.includes(jour)) {
      setFormData({
        ...formData,
        jours_recurrence: jours.filter((j) => j !== jour),
      });
    } else {
      setFormData({
        ...formData,
        jours_recurrence: [...jours, jour],
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.titre.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    setLoading(true);
    try {
      if (tache) {
        const { data, error } = await supabase
          .from("taches")
          .update({
            titre: formData.titre,
            projet_id: formData.projet_id || null,
            etiquette: formData.etiquette || null,
            description: formData.description || null,
            temps_estime: formData.temps_estime ? Number(formData.temps_estime) : null,
            statut: formData.statut,
            do_date: formData.do_date || null,
            recurrence: formData.recurrence,
            jours_recurrence: formData.recurrence === "personnalise" ? formData.jours_recurrence : null,
          })
          .eq("id", tache.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
        toast.success("Tâche mise à jour");
      } else {
        const maxOrdreRes = await supabase
          .from("taches")
          .select("ordre", { count: "exact" })
          .order("ordre", { ascending: false })
          .limit(1);

        const maxOrdre =
          maxOrdreRes.data && maxOrdreRes.data.length > 0
            ? maxOrdreRes.data[0].ordre + 1
            : 0;

        const { data, error } = await supabase
          .from("taches")
          .insert([
            {
              titre: formData.titre,
              projet_id: formData.projet_id || null,
              etiquette: formData.etiquette || null,
              description: formData.description || null,
              temps_estime: formData.temps_estime ? Number(formData.temps_estime) : null,
              statut: formData.statut,
              do_date: formData.do_date || null,
              recurrence: formData.recurrence,
              jours_recurrence: formData.recurrence === "personnalise" ? formData.jours_recurrence : null,
              ordre: maxOrdre,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        onSave(data);
        toast.success("Tâche créée");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)]">
        <DialogHeader>
          <DialogTitle>{tache ? "Éditer la tâche" : "Nouvelle tâche"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)]"
              placeholder="Titre de la tâche"
            />
          </div>

          <div>
            <Label htmlFor="projet">Projet</Label>
            <Select
              value={formData.projet_id}
              onValueChange={(value) =>
                setFormData({ ...formData, projet_id: value })
              }
            >
              <SelectTrigger className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)]">
                <SelectValue placeholder="Sélectionner un projet">
                  {selectedProjet?.nom || "Sélectionner un projet"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun projet</SelectItem>
                {projets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="etiquette">Étiquette</Label>
            <Select
              value={formData.etiquette}
              onValueChange={(value) =>
                setFormData({ ...formData, etiquette: value })
              }
            >
              <SelectTrigger className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)]">
                <SelectValue placeholder="Sélectionner une étiquette" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucune étiquette</SelectItem>
                {etiquettes.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)] min-h-24"
              placeholder="Description de la tâche"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="temps_estime">Temps estimé (heures)</Label>
              <Input
                id="temps_estime"
                type="number"
                step="0.5"
                value={formData.temps_estime}
                onChange={(e) =>
                  setFormData({ ...formData, temps_estime: e.target.value })
                }
                className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)]"
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="statut">Statut</Label>
              <Select
                value={formData.statut}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    statut: value as TacheStatut,
                  })
                }
              >
                <SelectTrigger className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuts.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "a_faire" ? "À faire" : s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="do_date">Date prévue</Label>
            <DatePicker
              id="do_date"
              value={formData.do_date}
              onChange={(e) => setFormData({ ...formData, do_date: e.target.value })}
              className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)]"
            />
          </div>

          <div>
            <Label htmlFor="recurrence">Récurrence</Label>
            <Select
              value={formData.recurrence}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  recurrence: value as RecurrenceType,
                  jours_recurrence: [],
                })
              }
            >
              <SelectTrigger className="bg-[#0A0A0A] border-[rgba(255,255,255,0.06)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(recurrenceLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.recurrence === "personnalise" && (
            <div>
              <Label>Jours de la semaine</Label>
              <div className="grid grid-cols-4 gap-2">
                {joursSemaneListe.map((jour) => (
                  <label
                    key={jour.value}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={(formData.jours_recurrence || []).includes(jour.value)}
                      onCheckedChange={() => toggleJourRecurrence(jour.value)}
                    />
                    {jour.label.substring(0, 3)}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-brand-accent text-[#0A0A0A] hover:bg-[#0aa373]"
          >
            {loading ? "Enregistrement..." : tache ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
