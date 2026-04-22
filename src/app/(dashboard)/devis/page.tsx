"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Devis, DevisStatut } from "@/lib/types";
import { computeHeuresParDevis } from "@/lib/heures-par-devis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Plus, AlertCircle, X, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GererPaiementsDialog } from "@/components/gerer-paiements-dialog";

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

const statutConfig: Record<DevisStatut, { label: string; className: string }> = {
  en_cours: { label: "En cours", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  signe: { label: "Signe", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  refuse: { label: "Refuse", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

interface DevisAvecProjet extends Devis {
  projets: { nom: string } | null;
}

type FilterStatut = "tous" | DevisStatut;

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export default function DevisPage() {
  const [devisList, setDevisList] = useState<DevisAvecProjet[]>([]);
  const [projets, setProjets] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatut, setFilterStatut] = useState<FilterStatut>("tous");
  const [filterProjet, setFilterProjet] = useState("tous");
  const [filterAnnee, setFilterAnnee] = useState("tous");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newForm, setNewForm] = useState({
    projet_id: "",
    libelle: "",
    montant_total: "",
    jours_signes: "",
    base_journee: "7",
    statut: "signe" as DevisStatut,
    date_signature: todayStr(),
    date_debut: "",
    date_fin: "",
  });

  // Payments dialog
  const [paiementsDevis, setPaiementsDevis] = useState<DevisAvecProjet | null>(null);
  const [paiementsParDevis, setPaiementsParDevis] = useState<Record<string, number>>({});
  const [allSessions, setAllSessions] = useState<{ projet_id: string; date: string; duree: number; facturable: boolean }[]>([]);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const [devisRes, projetsRes, txRes, sessionsRes] = await Promise.all([
        supabase
          .from("devis")
          .select("*, projets(nom)")
          .order("created_at", { ascending: false }),
        supabase.from("projets").select("id, nom").order("nom", { ascending: true }),
        supabase
          .from("transactions_ca")
          .select("devis_id, montant")
          .not("devis_id", "is", null),
        supabase
          .from("sessions_heures")
          .select("projet_id, date, duree, facturable"),
      ]);
      if (devisRes.error) {
        setError("Impossible de charger les devis.");
        toast.error("Erreur", { description: devisRes.error.message });
        return;
      }
      setDevisList((devisRes.data as DevisAvecProjet[]) ?? []);
      setProjets((projetsRes.data as { id: string; nom: string }[]) ?? []);

      // Aggregate payment totals per devis
      const map: Record<string, number> = {};
      for (const tx of (txRes.data as { devis_id: string; montant: number }[]) ?? []) {
        map[tx.devis_id] = (map[tx.devis_id] ?? 0) + tx.montant;
      }
      setPaiementsParDevis(map);
      setAllSessions((sessionsRes.data as { projet_id: string; date: string; duree: number; facturable: boolean }[]) ?? []);

      setError(null);
    } catch {
      setError("Impossible de charger les devis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Filtering ---
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const d of devisList) {
      if (d.date_signature) set.add(String(new Date(d.date_signature).getFullYear()));
      else set.add(String(new Date(d.created_at).getFullYear()));
    }
    return Array.from(set).sort().reverse();
  }, [devisList]);

  const filtered = useMemo(() => {
    return devisList.filter((d) => {
      if (filterStatut !== "tous" && d.statut !== filterStatut) return false;
      if (filterProjet !== "tous" && d.projet_id !== filterProjet) return false;
      if (filterAnnee !== "tous") {
        const year = d.date_signature
          ? String(new Date(d.date_signature).getFullYear())
          : String(new Date(d.created_at).getFullYear());
        if (year !== filterAnnee) return false;
      }
      return true;
    });
  }, [devisList, filterStatut, filterProjet, filterAnnee]);

  const hasActiveFilters = filterStatut !== "tous" || filterProjet !== "tous" || filterAnnee !== "tous";

  // --- Totals (signed only) ---
  const totalMontantSigne = useMemo(
    () => filtered.filter((d) => d.statut === "signe").reduce((s, d) => s + d.montant_total, 0),
    [filtered]
  );
  const totalJoursSignes = useMemo(
    () => filtered.filter((d) => d.statut === "signe").reduce((s, d) => s + (d.jours_signes ?? 0), 0),
    [filtered]
  );

  // --- Heures attribuees par devis (attribution chronologique) ---
  const heuresParDevis = useMemo(() => {
    // Group devis by projet_id, compute per-project, merge results
    const byProjet = new Map<string, Devis[]>();
    for (const d of devisList) {
      if (!d.projet_id) continue;
      const list = byProjet.get(d.projet_id) ?? [];
      list.push(d);
      byProjet.set(d.projet_id, list);
    }
    const result: Record<string, number> = {};
    for (const [projetId, devis] of byProjet) {
      const computed = computeHeuresParDevis(devis, allSessions, projetId);
      Object.assign(result, computed);
    }
    return result;
  }, [devisList, allSessions]);

  // --- Inline edit ---
  function startEdit(id: string, field: string, currentValue: string | number) {
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
  }

  async function saveEdit(id: string, field: string) {
    setEditingCell(null);
    const supabase = createClient();
    let value: string | number | null = editValue;
    if (field === "montant_total" || field === "jours_signes") {
      value = parseFloat(editValue) || 0;
    } else if (field === "date_debut" || field === "date_fin") {
      value = editValue || null;
    }
    const { error } = await supabase.from("devis").update({ [field]: value }).eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de sauvegarder." });
    } else {
      setDevisList((prev) =>
        prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
      );
    }
  }

  async function updateStatut(id: string, statut: DevisStatut) {
    const supabase = createClient();
    const updates: Record<string, unknown> = { statut };
    if (statut === "signe") {
      const existing = devisList.find((d) => d.id === id);
      if (!existing?.date_signature) updates.date_signature = todayStr();
    }
    const { error } = await supabase.from("devis").update(updates).eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de mettre a jour le statut." });
    } else {
      setDevisList((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } as DevisAvecProjet : d))
      );
    }
  }

  async function updateBaseJournee(id: string, base: number) {
    const supabase = createClient();
    const { error } = await supabase
      .from("devis")
      .update({ base_journee: base })
      .eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de mettre a jour la base." });
    } else {
      setDevisList((prev) =>
        prev.map((d) => (d.id === id ? { ...d, base_journee: base } : d))
      );
    }
  }

  // --- New devis ---
  async function handleDeleteDevis(id: string) {
    const supabase = createClient();
    // Unlink transactions first
    await supabase.from("transactions_ca").update({ devis_id: null }).eq("devis_id", id);
    const { error } = await supabase.from("devis").delete().eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de supprimer le devis." });
    } else {
      toast.success("Devis supprime");
      fetchData();
    }
  }

  function updateNewForm(field: string, value: string) {
    setNewForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateDevis(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.projet_id || !newForm.libelle || !newForm.montant_total) return;

    setSavingNew(true);
    const supabase = createClient();
    const { error } = await supabase.from("devis").insert({
      projet_id: newForm.projet_id,
      libelle: newForm.libelle.trim(),
      montant_total: parseFloat(newForm.montant_total),
      jours_signes: newForm.jours_signes ? parseFloat(newForm.jours_signes) : 0,
      base_journee: parseInt(newForm.base_journee, 10),
      statut: newForm.statut,
      date_signature: newForm.statut === "signe" ? newForm.date_signature : null,
      date_debut: newForm.date_debut || null,
      date_fin: newForm.date_fin || null,
    });
    setSavingNew(false);

    if (error) {
      toast.error("Erreur", { description: "Impossible de creer le devis." });
    } else {
      toast.success("Devis cree");
      setNewForm({
        projet_id: "",
        libelle: "",
        montant_total: "",
        jours_signes: "",
        base_journee: "7",
        statut: "signe",
        date_signature: todayStr(),
        date_debut: "",
        date_fin: "",
      });
      setDialogOpen(false);
      fetchData();
    }
  }

  // --- Unique projets for filter ---
  const filterProjets = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of devisList) {
      if (d.projet_id && d.projets?.nom) map.set(d.projet_id, d.projets.nom);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [devisList]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="text-sm font-medium text-primary hover:underline"
        >
          Reessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devis</h1>
          <p className="text-muted-foreground">
            Gerez tous vos devis en un seul endroit.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Nouveau devis
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Statut</Label>
              <Select value={filterStatut} onValueChange={(v) => { if (v) setFilterStatut(v as FilterStatut); }}>
                <SelectTrigger className="w-36">
                  <SelectValue>
                    {(value: string) => {
                      if (value === "tous") return "Tous";
                      return statutConfig[value as DevisStatut]?.label ?? "Tous";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="signe">Signes</SelectItem>
                  <SelectItem value="refuse">Refuses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Projet</Label>
              <Select value={filterProjet} onValueChange={(v) => { if (v) setFilterProjet(v); }}>
                <SelectTrigger className="w-44">
                  <SelectValue>
                    {(value: string) => {
                      if (value === "tous") return "Tous les projets";
                      const p = filterProjets.find(([id]) => id === value);
                      return p?.[1] ?? "Tous les projets";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les projets</SelectItem>
                  {filterProjets.map(([id, nom]) => (
                    <SelectItem key={id} value={id}>{nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Annee</Label>
              <Select value={filterAnnee} onValueChange={(v) => { if (v) setFilterAnnee(v); }}>
                <SelectTrigger className="w-28">
                  <SelectValue>
                    {(value: string) => value === "tous" ? "Toutes" : value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Toutes</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatut("tous");
                  setFilterProjet("tous");
                  setFilterAnnee("tous");
                }}
              >
                <X className="size-3.5" />
                Reinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            {filtered.length} devis
          </CardTitle>
          {hasActiveFilters && (
            <CardDescription>Resultats filtres</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <FileText className="size-10 text-muted-foreground/50" />
              <p className="font-medium">Aucun devis</p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? "Modifiez vos filtres." : "Creez votre premier devis."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Libelle</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead className="text-center">Base</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Debut</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Heures fact.</TableHead>
                  <TableHead className="text-right">Paiements</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    {/* Projet — read-only link */}
                    <TableCell>
                      {d.projet_id ? (
                        <Link
                          href={`/projets/${d.projet_id}`}
                          className="font-medium hover:underline"
                        >
                          {d.projets?.nom ?? "—"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Non associe</span>
                      )}
                    </TableCell>

                    {/* Libelle — editable */}
                    <TableCell
                      className="cursor-pointer"
                      onClick={() => startEdit(d.id, "libelle", d.libelle)}
                    >
                      {editingCell?.id === d.id && editingCell.field === "libelle" ? (
                        <Input
                          autoFocus
                          className="h-7 w-full"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(d.id, "libelle")}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(d.id, "libelle"); if (e.key === "Escape") setEditingCell(null); }}
                        />
                      ) : (
                        <span className="font-medium">{d.libelle}</span>
                      )}
                    </TableCell>

                    {/* Montant — editable */}
                    <TableCell
                      className="text-right cursor-pointer"
                      onClick={() => startEdit(d.id, "montant_total", d.montant_total)}
                    >
                      {editingCell?.id === d.id && editingCell.field === "montant_total" ? (
                        <Input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-7 w-28 ml-auto"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(d.id, "montant_total")}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(d.id, "montant_total"); if (e.key === "Escape") setEditingCell(null); }}
                        />
                      ) : (
                        formatEuro(d.montant_total)
                      )}
                    </TableCell>

                    {/* Jours signes — editable */}
                    <TableCell
                      className="text-right cursor-pointer"
                      onClick={() => startEdit(d.id, "jours_signes", d.jours_signes ?? 0)}
                    >
                      {editingCell?.id === d.id && editingCell.field === "jours_signes" ? (
                        <Input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.5"
                          className="h-7 w-20 ml-auto"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(d.id, "jours_signes")}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(d.id, "jours_signes"); if (e.key === "Escape") setEditingCell(null); }}
                        />
                      ) : (
                        <span>{d.jours_signes ?? 0}j</span>
                      )}
                    </TableCell>

                    {/* Base journee — select inline */}
                    <TableCell className="text-center">
                      <Select
                        value={String(d.base_journee ?? 7)}
                        onValueChange={(v) => { if (v) updateBaseJournee(d.id, parseInt(v, 10)); }}
                      >
                        <SelectTrigger className="h-7 w-16 mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7h</SelectItem>
                          <SelectItem value="8">8h</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Statut — select inline */}
                    <TableCell>
                      <Select
                        value={d.statut}
                        onValueChange={(v) => { if (v) updateStatut(d.id, v as DevisStatut); }}
                      >
                        <SelectTrigger className="h-7 w-28 border-0 bg-transparent p-0">
                          <Badge variant="outline" className={statutConfig[d.statut]?.className}>
                            {statutConfig[d.statut]?.label ?? d.statut}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en_cours">En cours</SelectItem>
                          <SelectItem value="signe">Signe</SelectItem>
                          <SelectItem value="refuse">Refuse</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Date debut — editable */}
                    <TableCell
                      className="cursor-pointer text-muted-foreground"
                      onClick={() => startEdit(d.id, "date_debut", d.date_debut ?? "")}
                    >
                      {editingCell?.id === d.id && editingCell.field === "date_debut" ? (
                        <Input
                          autoFocus
                          type="date"
                          className="h-7 w-32"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(d.id, "date_debut")}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(d.id, "date_debut"); if (e.key === "Escape") setEditingCell(null); }}
                        />
                      ) : (
                        d.date_debut
                          ? new Date(d.date_debut).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                          : "—"
                      )}
                    </TableCell>

                    {/* Date fin — editable */}
                    <TableCell
                      className="cursor-pointer text-muted-foreground"
                      onClick={() => startEdit(d.id, "date_fin", d.date_fin ?? "")}
                    >
                      {editingCell?.id === d.id && editingCell.field === "date_fin" ? (
                        <Input
                          autoFocus
                          type="date"
                          className="h-7 w-32"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(d.id, "date_fin")}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(d.id, "date_fin"); if (e.key === "Escape") setEditingCell(null); }}
                        />
                      ) : (
                        d.date_fin
                          ? new Date(d.date_fin).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                          : "—"
                      )}
                    </TableCell>

                    {/* Heures facturables */}
                    <TableCell className="text-right text-muted-foreground">
                      {(heuresParDevis[d.id] ?? 0) > 0
                        ? `${(heuresParDevis[d.id]).toFixed(1)}h`
                        : "—"}
                    </TableCell>

                    {/* Paiements lies */}
                    <TableCell className="text-right">
                      {(paiementsParDevis[d.id] ?? 0) > 0
                        ? formatEuro(paiementsParDevis[d.id])
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-7 p-0"
                          onClick={() => setPaiementsDevis(d)}
                        >
                          <Wallet className="size-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive cursor-pointer">
                            <Trash2 className="size-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Le devis &quot;{d.libelle}&quot; sera supprime. Les paiements lies seront delies mais pas supprimes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteDevis(d.id)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">
                    Total signes
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatEuro(totalMontantSigne)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {totalJoursSignes}j
                  </TableCell>
                  <TableCell colSpan={7} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog nouveau devis */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau devis</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDevis} className="space-y-4">
            <div className="space-y-2">
              <Label>Projet *</Label>
              <Select
                value={newForm.projet_id}
                onValueChange={(v) => { if (v) updateNewForm("projet_id", v); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un projet">
                    {(value: string) => {
                      const p = projets.find((pr) => pr.id === value);
                      return p?.nom ?? "Choisir un projet";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-libelle">Libelle *</Label>
              <Input
                id="new-libelle"
                placeholder="Ex: Phase 1 — Design UX"
                value={newForm.libelle}
                onChange={(e) => updateNewForm("libelle", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-montant">Montant (EUR) *</Label>
                <Input
                  id="new-montant"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newForm.montant_total}
                  onChange={(e) => updateNewForm("montant_total", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-jours">Jours signes</Label>
                <Input
                  id="new-jours"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Ex: 10"
                  value={newForm.jours_signes}
                  onChange={(e) => updateNewForm("jours_signes", e.target.value)}
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
                      onClick={() => updateNewForm("base_journee", val)}
                      className={
                        "flex-1 rounded-sm px-3 py-1 text-sm transition-colors " +
                        (newForm.base_journee === val
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
                  value={newForm.statut}
                  onValueChange={(v) => { if (v) updateNewForm("statut", v); }}
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

            {newForm.statut === "signe" && (
              <div className="space-y-2">
                <Label htmlFor="new-date-sig">Date de signature</Label>
                <Input
                  id="new-date-sig"
                  type="date"
                  value={newForm.date_signature}
                  onChange={(e) => updateNewForm("date_signature", e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-date-debut">Date debut</Label>
                <Input
                  id="new-date-debut"
                  type="date"
                  value={newForm.date_debut}
                  onChange={(e) => updateNewForm("date_debut", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-date-fin">Date fin</Label>
                <Input
                  id="new-date-fin"
                  type="date"
                  value={newForm.date_fin}
                  onChange={(e) => updateNewForm("date_fin", e.target.value)}
                />
              </div>
            </div>

            {(() => {
              const jours = parseFloat(newForm.jours_signes) || 0;
              const base = parseInt(newForm.base_journee, 10) || 7;
              const montant = parseFloat(newForm.montant_total) || 0;
              const heuresSignees = jours * base;
              const tjmHoraire = jours > 0 && base > 0 ? montant / jours / base : 0;
              return (
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
              );
            })()}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Annuler</Button>} />
              <Button
                type="submit"
                disabled={savingNew || !newForm.projet_id || !newForm.libelle || !newForm.montant_total}
              >
                {savingNew ? "Enregistrement..." : "Creer le devis"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gerer paiements dialog */}
      {paiementsDevis && (
        <GererPaiementsDialog
          devisId={paiementsDevis.id}
          devisLibelle={paiementsDevis.libelle}
          projetId={paiementsDevis.projet_id}
          open={!!paiementsDevis}
          onOpenChange={(open) => { if (!open) setPaiementsDevis(null); }}
          onChanged={fetchData}
        />
      )}
    </div>
  );
}
