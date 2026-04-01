"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { TransactionStatut } from "@/lib/types";
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

interface NouveauPaiementDialogProps {
  projetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

const defaultForm = {
  montant: "",
  date: todayStr(),
  statut: "paye" as TransactionStatut,
  note: "",
};

export function NouveauPaiementDialog({
  projetId,
  open,
  onOpenChange,
  onCreated,
}: NouveauPaiementDialogProps) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.montant) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("transactions_ca").insert({
      projet_id: projetId,
      montant: parseFloat(form.montant),
      date: form.date,
      statut: form.statut,
      note: form.note.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error("Erreur", { description: "Impossible d'ajouter le paiement." });
    } else {
      toast.success("Paiement ajoute");
      setForm(defaultForm);
      onOpenChange(false);
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un paiement</DialogTitle>
          <DialogDescription>
            Enregistrez un paiement recu pour ce projet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montant">Montant (EUR) *</Label>
              <Input
                id="montant"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.montant}
                onChange={(e) => update("montant", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-paiement">Date</Label>
              <Input
                id="date-paiement"
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </div>
          </div>

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
                <SelectItem value="paye">Paye</SelectItem>
                <SelectItem value="signe">Signe</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              placeholder="Ex: Acompte 50%, Solde final..."
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || !form.montant}>
              {saving ? "Enregistrement..." : "Ajouter le paiement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
