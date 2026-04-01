"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjetStatut } from "@/lib/types";
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

interface NouveauProjetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const defaultForm = {
  nom: "",
  client: "",
  statut: "prospection" as ProjetStatut,
  montant_devise: "",
  tjm: "",
  date_debut: "",
  deadline: "",
};

export function NouveauProjetDialog({
  open,
  onOpenChange,
  onCreated,
}: NouveauProjetDialogProps) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("projets").insert({
      nom: form.nom.trim(),
      client: form.client.trim(),
      statut: form.statut,
      montant_devise: parseFloat(form.montant_devise) || 0,
      tjm: parseFloat(form.tjm) || 0,
      date_debut: form.date_debut || null,
      deadline: form.deadline || null,
    });

    setSaving(false);
    if (!error) {
      setForm(defaultForm);
      onOpenChange(false);
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
          <DialogDescription>
            Remplissez les informations du projet.
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

          <div className="space-y-2">
            <Label>Statut</Label>
            <Select
              value={form.statut}
              onValueChange={(v) => { if (v) update("statut", v); }}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montant_devise">Montant devise (EUR)</Label>
              <Input
                id="montant_devise"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.montant_devise}
                onChange={(e) => update("montant_devise", e.target.value)}
              />
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
              {saving ? "Enregistrement..." : "Creer le projet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
