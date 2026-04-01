"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Projet, ProjetStatut, ProjetType } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  projet?: Projet | null;
}

const emptyForm = {
  nom: "",
  client: "",
  statut: "prospection" as ProjetStatut,
  type: "client" as ProjetType,
  tjm: "",
  date_debut: "",
  deadline: "",
};

function projetToForm(p: Projet) {
  return {
    nom: p.nom,
    client: p.client,
    statut: p.statut,
    type: p.type,
    tjm: p.tjm ? String(p.tjm) : "",
    date_debut: p.date_debut ?? "",
    deadline: p.deadline ?? "",
  };
}

export function ProjetDialog({
  open,
  onOpenChange,
  onSaved,
  projet,
}: ProjetDialogProps) {
  const isEdit = !!projet;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(projet ? projetToForm(projet) : emptyForm);
    }
  }, [open, projet]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) return;

    setSaving(true);
    const supabase = createClient();

    const payload = {
      nom: form.nom.trim(),
      client: form.client.trim(),
      statut: form.statut,
      type: form.type,
      tjm: parseFloat(form.tjm) || 0,
      date_debut: form.date_debut || null,
      deadline: form.deadline || null,
    };

    const { error } = isEdit
      ? await supabase.from("projets").update(payload).eq("id", projet.id)
      : await supabase.from("projets").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Erreur", {
        description: isEdit
          ? "Impossible de modifier le projet."
          : "Impossible de creer le projet.",
      });
    } else {
      toast.success(isEdit ? "Projet modifie" : "Projet cree");
      onOpenChange(false);
      onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le projet" : "Nouveau projet"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifiez les informations du projet."
              : "Remplissez les informations du projet."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du projet *</Label>
            <Input
              id="nom"
              placeholder="Ex: Refonte site web"
              value={form.nom}
              onChange={(e) => update("nom", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Input
              id="client"
              placeholder="Nom du client"
              value={form.client}
              onChange={(e) => update("client", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={form.statut}
                onValueChange={(v) => {
                  if (v) update("statut", v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospection">Prospection</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="cloture">Cloture</SelectItem>
                  <SelectItem value="pas_signe">Pas signe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  if (v) update("type", v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="interne">Interne</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tjm">TJM (EUR)</Label>
            <Input
              id="tjm"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={form.tjm}
              onChange={(e) => update("tjm", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_debut">Date debut</Label>
              <Input
                id="date_debut"
                type="date"
                value={form.date_debut}
                onChange={(e) => update("date_debut", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => update("deadline", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || !form.nom.trim()}>
              {saving
                ? "Enregistrement..."
                : isEdit
                  ? "Enregistrer"
                  : "Creer le projet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
