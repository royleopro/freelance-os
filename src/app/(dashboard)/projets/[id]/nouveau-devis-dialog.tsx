"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { DevisStatut } from "@/lib/types";
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

interface NouveauDevisDialogProps {
  projetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

const defaultForm = {
  libelle: "",
  montant_total: "",
  jours_signes: "",
  statut: "signe" as DevisStatut,
  date_signature: todayStr(),
  date_debut: "",
  date_fin: "",
};

export function NouveauDevisDialog({
  projetId,
  open,
  onOpenChange,
  onCreated,
}: NouveauDevisDialogProps) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.libelle || !form.montant_total) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("devis").insert({
      projet_id: projetId,
      libelle: form.libelle.trim(),
      montant_total: parseFloat(form.montant_total),
      jours_signes: form.jours_signes ? parseFloat(form.jours_signes) : 0,
      statut: form.statut,
      date_signature: form.statut === "signe" ? form.date_signature : null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
    });
    setSaving(false);

    if (error) {
      toast.error("Erreur", { description: "Impossible d'ajouter le devis." });
    } else {
      toast.success("Devis ajoute");
      setForm(defaultForm);
      onOpenChange(false);
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un devis</DialogTitle>
          <DialogDescription>
            Enregistrez un devis pour ce projet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="libelle-devis">Libelle *</Label>
            <Input
              id="libelle-devis"
              placeholder="Ex: Phase 1 — Design UX"
              value={form.libelle}
              onChange={(e) => update("libelle", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montant-devis">Montant (EUR) *</Label>
              <Input
                id="montant-devis"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.montant_total}
                onChange={(e) => update("montant_total", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jours-signes">Jours signes</Label>
              <Input
                id="jours-signes"
                type="number"
                min="0"
                step="0.5"
                placeholder="Ex: 10"
                value={form.jours_signes}
                onChange={(e) => update("jours_signes", e.target.value)}
              />
              {form.jours_signes && (
                <p className="text-xs text-muted-foreground">
                  = {(parseFloat(form.jours_signes) * 8).toFixed(0)}h
                </p>
              )}
            </div>
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
                  <SelectItem value="signe">Signe</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="refuse">Refuse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.statut === "signe" && (
              <div className="space-y-2">
                <Label htmlFor="date-signature">Date de signature</Label>
                <Input
                  id="date-signature"
                  type="date"
                  value={form.date_signature}
                  onChange={(e) => update("date_signature", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-debut-devis">Date debut</Label>
              <Input
                id="date-debut-devis"
                type="date"
                value={form.date_debut}
                onChange={(e) => update("date_debut", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-fin-devis">Date fin</Label>
              <Input
                id="date-fin-devis"
                type="date"
                value={form.date_fin}
                onChange={(e) => update("date_fin", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving || !form.libelle || !form.montant_total}
            >
              {saving ? "Enregistrement..." : "Ajouter le devis"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
