"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Devis, DevisStatut } from "@/lib/types";
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

interface DevisDialogProps {
  projetId: string;
  devis?: Devis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

const emptyForm = {
  libelle: "",
  montant_total: "",
  jours_signes: "",
  base_journee: "7",
  statut: "signe" as DevisStatut,
  date_signature: todayStr(),
  date_debut: "",
  date_fin: "",
};

export function DevisDialog({
  projetId,
  devis,
  open,
  onOpenChange,
  onSaved,
}: DevisDialogProps) {
  const isEdit = !!devis;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (devis) {
        setForm({
          libelle: devis.libelle,
          montant_total: String(devis.montant_total ?? ""),
          jours_signes: devis.jours_signes ? String(devis.jours_signes) : "",
          base_journee: String(devis.base_journee ?? 7),
          statut: devis.statut,
          date_signature: devis.date_signature ?? todayStr(),
          date_debut: devis.date_debut ?? "",
          date_fin: devis.date_fin ?? "",
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, devis]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.libelle || !form.montant_total) return;

    setSaving(true);
    const supabase = createClient();
    const payload = {
      projet_id: projetId,
      libelle: form.libelle.trim(),
      montant_total: parseFloat(form.montant_total),
      jours_signes: form.jours_signes ? parseFloat(form.jours_signes) : 0,
      base_journee: parseInt(form.base_journee, 10),
      statut: form.statut,
      date_signature: form.statut === "signe" ? form.date_signature : null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
    };

    const { error } = isEdit && devis
      ? await supabase.from("devis").update(payload).eq("id", devis.id)
      : await supabase.from("devis").insert(payload);

    setSaving(false);

    if (error) {
      toast.error("Erreur", {
        description: isEdit
          ? "Impossible de sauvegarder le devis."
          : "Impossible d'ajouter le devis.",
      });
    } else {
      toast.success(isEdit ? "Devis mis a jour" : "Devis ajoute");
      onOpenChange(false);
      onSaved();
    }
  }

  const jours = parseFloat(form.jours_signes) || 0;
  const base = parseInt(form.base_journee, 10) || 7;
  const montant = parseFloat(form.montant_total) || 0;
  const heuresSignees = jours * base;
  const tjmHoraire = jours > 0 && base > 0 ? montant / jours / base : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le devis" : "Ajouter un devis"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez a jour les informations du devis."
              : "Enregistrez un devis pour ce projet."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="devis-libelle">Libelle *</Label>
            <Input
              id="devis-libelle"
              placeholder="Ex: Phase 1 — Design UX"
              value={form.libelle}
              onChange={(e) => update("libelle", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="devis-montant">Montant (EUR) *</Label>
              <Input
                id="devis-montant"
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
              <Label htmlFor="devis-jours">Jours signes</Label>
              <Input
                id="devis-jours"
                type="number"
                min="0"
                step="0.5"
                placeholder="Ex: 10"
                value={form.jours_signes}
                onChange={(e) => update("jours_signes", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base journee</Label>
              <div className="inline-flex w-full rounded-md border border-border p-0.5">
                {(["7", "8"] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update("base_journee", val)}
                    className={
                      "flex-1 rounded-sm px-3 py-1 text-sm transition-colors " +
                      (form.base_journee === val
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted")
                    }
                  >
                    {val}h / jour
                  </button>
                ))}
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
                  <SelectItem value="signe">Signe</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="refuse">Refuse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.statut === "signe" && (
            <div className="space-y-2">
              <Label htmlFor="devis-date-sig">Date de signature</Label>
              <Input
                id="devis-date-sig"
                type="date"
                value={form.date_signature}
                onChange={(e) => update("date_signature", e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="devis-date-debut">Date debut</Label>
              <Input
                id="devis-date-debut"
                type="date"
                value={form.date_debut}
                onChange={(e) => update("date_debut", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devis-date-fin">Date fin</Label>
              <Input
                id="devis-date-fin"
                type="date"
                value={form.date_fin}
                onChange={(e) => update("date_fin", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Calculs
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Heures signees</span>
              <span className="font-medium">{heuresSignees || 0}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TJM horaire</span>
              <span className="font-medium">
                {tjmHoraire > 0 ? `${tjmHoraire.toFixed(0)}€/h` : "—"}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving || !form.libelle || !form.montant_total}
            >
              {saving
                ? "Enregistrement..."
                : isEdit
                ? "Sauvegarder"
                : "Ajouter le devis"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
