"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  ProjetStatut,
  ProjetType,
  SessionHeure,
  TransactionCA,
  Devis,
} from "@/lib/types";
import { getEtiquette } from "@/lib/etiquettes";
import { computeHeuresParDevis } from "@/lib/heures-par-devis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Euro,
  FileText,
  Pencil,
  Plus,
  TrendingUp,
  User,
  Wallet,
  AlertCircle,
  Trash2,
  Link2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
import { NouveauPaiementDialog } from "./nouveau-paiement-dialog";
import { NouveauDevisDialog } from "./nouveau-devis-dialog";
import { ProjetDialog } from "../projet-dialog";
import { GererPaiementsDialog } from "@/components/gerer-paiements-dialog";

const typeConfig: Record<ProjetType, { label: string; className: string }> = {
  client: {
    label: "Client",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  interne: {
    label: "Interne",
    className: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  },
  prospect: {
    label: "Prospect",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
};

const statutConfig: Record<
  ProjetStatut,
  { label: string; className: string }
> = {
  en_cours: {
    label: "En cours",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  cloture: {
    label: "Cloture",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  pas_signe: {
    label: "Pas signe",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  prospection: {
    label: "Prospection",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
};

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function progressColor(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function progressTextColor(pct: number): string {
  if (pct > 100) return "text-red-400";
  if (pct >= 80) return "text-amber-400";
  return "text-emerald-400";
}

function paiementBadge(totalPaye: number, totalCA: number) {
  if (totalCA <= 0)
    return { label: "—", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
  if (totalPaye >= totalCA)
    return { label: "Paye", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  if (totalPaye > 0)
    return { label: "En partie", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
  return { label: "En attente", className: "bg-red-500/20 text-red-400 border-red-500/30" };
}

export default function ProjetDetailPage() {
  const params = useParams<{ id: string }>();
  const [projet, setProjet] = useState<Projet | null>(null);
  const [sessions, setSessions] = useState<SessionHeure[]>([]);
  const [transactions, setTransactions] = useState<TransactionCA[]>([]);
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paiementDialogOpen, setPaiementDialogOpen] = useState(false);
  const [paiementDevisId, setPaiementDevisId] = useState<string | null>(null);
  const [devisDialogOpen, setDevisDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paiementsDevis, setPaiementsDevis] = useState<Devis | null>(null);
  const [unlinkedQontoDevis, setUnlinkedQontoDevis] = useState<Devis[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      const [projetRes, sessionsRes, transactionsRes, devisRes, qontoDevisRes] = await Promise.all([
        supabase.from("projets_with_ca").select("*").eq("id", params.id).single(),
        supabase
          .from("sessions_heures")
          .select("*", { count: "exact" })
          .eq("projet_id", params.id)
          .order("date", { ascending: false })
          .limit(5000),
        supabase
          .from("transactions_ca")
          .select("*")
          .eq("projet_id", params.id)
          .order("date", { ascending: false }),
        supabase
          .from("devis")
          .select("*")
          .eq("projet_id", params.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("devis")
          .select("*")
          .eq("source", "qonto")
          .is("projet_id", null)
          .order("created_at", { ascending: false }),
      ]);
      if (projetRes.error && projetRes.error.code !== "PGRST116") {
        setError("Impossible de charger le projet.");
        toast.error("Erreur de chargement", { description: projetRes.error.message });
        return;
      }
      setProjet(projetRes.data as Projet | null);
      setSessions((sessionsRes.data as SessionHeure[]) ?? []);
      setTransactions((transactionsRes.data as TransactionCA[]) ?? []);
      setDevisList((devisRes.data as Devis[]) ?? []);
      setUnlinkedQontoDevis((qontoDevisRes.data as Devis[]) ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger le projet.");
      toast.error("Erreur reseau", { description: "Verifiez votre connexion internet." });
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  async function handleDeleteTransaction(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("transactions_ca").delete().eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de supprimer le paiement." });
    } else {
      toast.success("Paiement supprime");
      fetchData();
    }
  }

  async function handleDeleteDevis(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("devis").delete().eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de supprimer le devis." });
    } else {
      toast.success("Devis supprime");
      fetchData();
    }
  }

  async function handleLinkQontoDevis(devisId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("devis")
      .update({ projet_id: params.id })
      .eq("id", devisId);
    if (error) {
      toast.error("Erreur", { description: "Impossible de lier le devis." });
    } else {
      toast.success("Devis lie au projet");
      fetchData();
    }
  }

  async function handleDeleteSession(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("sessions_heures").delete().eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de supprimer la session." });
    } else {
      toast.success("Session supprimee");
      fetchData();
    }
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalHeures = sessions.reduce((sum, s) => sum + s.duree, 0);
  const heuresFacturables = sessions
    .filter((s) => s.facturable)
    .reduce((sum, s) => sum + s.duree, 0);
  const heuresNonFacturables = totalHeures - heuresFacturables;

  // These come from the projets_with_ca view, but we need fallback for loading state
  const totalPaye = projet?.montant_paye ?? 0;
  const totalSigne = projet?.montant_signe ?? 0;
  const totalCA = projet?.montant_total ?? 0;

  // Heures signees vs passees
  const totalJoursSignes = devisList
    .filter((d) => d.statut === "signe")
    .reduce((sum, d) => sum + (d.jours_signes ?? 0), 0);
  const totalHeuresSignees = totalJoursSignes * 8;
  const pctAvancement = totalHeuresSignees > 0 ? (heuresFacturables / totalHeuresSignees) * 100 : 0;

  // Attribution chronologique des heures facturables par devis
  const heuresAttribueesParDevis = computeHeuresParDevis(
    devisList,
    sessions.map((s) => ({ date: s.date, duree: s.duree, facturable: s.facturable, projet_id: params.id })),
    params.id
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-1 h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card size="sm" key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
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

  if (!projet) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Projet introuvable.</p>
        <Link
          href="/projets"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour aux projets
        </Link>
      </div>
    );
  }

  const config = statutConfig[projet.statut];
  const rentabiliteEurH =
    totalHeures > 0 ? totalPaye / totalHeures : null;
  const paiementStatus = paiementBadge(totalPaye, totalCA);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/projets"
          className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{projet.nom}</h1>
            <Badge variant="outline" className={typeConfig[projet.type]?.className ?? typeConfig.client.className}>
              {typeConfig[projet.type]?.label ?? "Client"}
            </Badge>
            <Badge variant="outline" className={config.className}>
              {config.label}
            </Badge>
          </div>
          {projet.client && (
            <p className="text-muted-foreground">{projet.client}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
          <Pencil data-icon="inline-start" />
          Modifier
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Euro className="size-3.5" />
              Total CA
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(totalCA)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Euro className="size-3.5" />
                Paye
              </span>
              <Badge variant="outline" className={paiementStatus.className}>
                {paiementStatus.label}
              </Badge>
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(totalPaye)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Euro className="size-3.5" />
              Signe
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(totalSigne)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Heures loguees
            </CardDescription>
            <CardTitle className="text-xl">{totalHeures.toFixed(1)}h</CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5" />
              Rentabilite reelle
            </CardDescription>
            <CardTitle className="text-xl">
              {rentabiliteEurH !== null
                ? formatEuro(rentabiliteEurH) + "/h"
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recap avancement heures */}
      {totalJoursSignes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Avancement heures
            </CardTitle>
            <CardDescription>
              {totalJoursSignes}j signes ({totalHeuresSignees}h) — {heuresFacturables.toFixed(1)}h facturables / {totalHeures.toFixed(1)}h total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(pctAvancement)}`}
                  style={{ width: `${Math.min(pctAvancement, 100)}%` }}
                />
              </div>
              <span className={`text-sm font-bold ${progressTextColor(pctAvancement)}`}>
                {pctAvancement.toFixed(0)}%
              </span>
            </div>
            {pctAvancement > 100 && (
              <p className="text-xs text-red-400">
                Depassement de {(heuresFacturables - totalHeuresSignees).toFixed(1)}h
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="size-3" />
                Client
              </p>
              <p className="font-medium">{projet.client || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">TJM</p>
              <p className="font-medium">
                {projet.tjm > 0 ? formatEuro(projet.tjm) + "/j" : "—"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3" />
                Date debut
              </p>
              <p className="font-medium">{formatDate(projet.date_debut)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3" />
                Deadline
              </p>
              <p className="font-medium">{formatDate(projet.deadline)}</p>
            </div>
          </div>

          {rentabiliteEurH !== null && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Rentabilite reelle
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatEuro(totalPaye)} /{" "}
                  {totalHeures.toFixed(1)}h total ={" "}
                  <span className="font-medium text-foreground">
                    {formatEuro(rentabiliteEurH)}/h
                  </span>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section Devis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Devis
          </CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => setDevisDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              Ajouter un devis
            </Button>
          </CardAction>
          <CardDescription>
            {formatEuro(projet.montant_devis)} devis signes
            {projet.reste_a_payer > 0 && ` — ${formatEuro(projet.reste_a_payer)} reste a payer`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devisList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FileText className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Aucun devis enregistre pour ce projet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {devisList.map((d) => {
                const devisTransactions = transactions.filter(
                  (t) => t.devis_id === d.id
                );
                const totalPayeDevis = devisTransactions
                  .filter((t) => t.statut === "paye")
                  .reduce((sum, t) => sum + t.montant, 0);
                const devisJours = d.jours_signes ?? 0;
                const devisHeuresSignees = devisJours * 8;
                const devisHeuresAttribuees = heuresAttribueesParDevis[d.id] ?? 0;
                const devisPct = devisHeuresSignees > 0 ? (devisHeuresAttribuees / devisHeuresSignees) * 100 : 0;
                return (
                  <div key={d.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{d.libelle}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatEuro(d.montant_total)}
                            {devisJours > 0 && ` — ${devisJours}j (${devisHeuresSignees}h)`}
                            {d.date_signature &&
                              ` — signe le ${formatDate(d.date_signature)}`}
                          </p>
                          {(d.date_debut || d.date_fin) && (
                            <p className="text-xs text-muted-foreground">
                              {d.date_debut ? formatDate(d.date_debut) : "..."} → {d.date_fin ? formatDate(d.date_fin) : "..."}
                            </p>
                          )}
                        </div>
                        {d.statut === "signe" ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          >
                            Signe
                          </Badge>
                        ) : d.statut === "en_cours" ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/20 text-blue-400 border-blue-500/30"
                          >
                            En cours
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-500/20 text-red-400 border-red-500/30"
                          >
                            Refuse
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaiementsDevis(d)}
                        >
                          <Link2 data-icon="inline-start" />
                          Gerer paiements
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPaiementDevisId(d.id);
                            setPaiementDialogOpen(true);
                          }}
                        >
                          <Plus data-icon="inline-start" />
                          Nouveau paiement
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger className="text-muted-foreground hover:text-destructive cursor-pointer p-1">
                            <Trash2 className="size-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Supprimer ce devis ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irreversible. Le devis &quot;{d.libelle}&quot; sera definitivement supprime.
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
                    </div>
                    {devisTransactions.length > 0 ? (
                      <div className="ml-4 border-l-2 border-border pl-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">
                                Montant
                              </TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Note</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {devisTransactions.map((t) => (
                              <TableRow key={t.id}>
                                <TableCell className="text-muted-foreground">
                                  {new Date(t.date).toLocaleDateString(
                                    "fr-FR",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    }
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatEuro(t.montant)}
                                </TableCell>
                                <TableCell>
                                  {t.statut === "paye" ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    >
                                      Paye
                                    </Badge>
                                  ) : t.statut === "signe" ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-500/20 text-blue-400 border-blue-500/30"
                                    >
                                      Signe
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-500/20 text-amber-400 border-amber-500/30"
                                    >
                                      En attente
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {t.note || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Total paye : {formatEuro(totalPayeDevis)} /{" "}
                          {formatEuro(d.montant_total)}
                        </p>
                      </div>
                    ) : (
                      <p className="ml-4 text-sm text-muted-foreground">
                        Aucun paiement lie a ce devis.
                      </p>
                    )}
                    {devisJours > 0 ? (
                      <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progressColor(devisPct)}`}
                              style={{ width: `${Math.min(devisPct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${progressTextColor(devisPct)}`}>
                            {devisPct.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {devisHeuresAttribuees.toFixed(1)}h / {devisHeuresSignees}h signees
                        </p>
                      </div>
                    ) : d.statut === "signe" ? (
                      <p className="ml-4 text-xs text-amber-400">
                        Renseigner les jours signes
                      </p>
                    ) : null}
                    {d !== devisList[devisList.length - 1] && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Devis Qonto non associes */}
      {unlinkedQontoDevis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4" />
              Devis Qonto disponibles
            </CardTitle>
            <CardDescription>
              {unlinkedQontoDevis.length} devis Qonto non associes a un projet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Libelle</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinkedQontoDevis.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.libelle}</TableCell>
                    <TableCell className="text-right">{formatEuro(d.montant_total)}</TableCell>
                    <TableCell>
                      {d.statut === "signe" ? (
                        <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Signe
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          En cours
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLinkQontoDevis(d.id)}
                      >
                        <Link2 data-icon="inline-start" />
                        Lier a ce projet
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NouveauDevisDialog
        projetId={projet.id}
        open={devisDialogOpen}
        onOpenChange={setDevisDialogOpen}
        onCreated={fetchData}
      />

      {/* Section Paiements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" />
            Paiements
          </CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => { setPaiementDevisId(null); setPaiementDialogOpen(true); }}>
              <Plus data-icon="inline-start" />
              Ajouter un paiement
            </Button>
          </CardAction>
          <CardDescription>
            {formatEuro(totalPaye)} paye
            {totalSigne > 0 && ` — ${formatEuro(totalSigne)} signe`}
            {totalCA > 0 && ` sur ${formatEuro(totalCA)} total`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Wallet className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Aucun paiement enregistre pour ce projet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell className="text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatEuro(t.montant)}
                    </TableCell>
                    <TableCell>
                      {t.statut === "paye" ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        >
                          Paye
                        </Badge>
                      ) : t.statut === "signe" ? (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/20 text-blue-400 border-blue-500/30"
                        >
                          Signe
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/20 text-amber-400 border-amber-500/30"
                        >
                          En attente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.note || "—"}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer">
                          <Trash2 className="size-3.5" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irreversible. Le paiement de {formatEuro(t.montant)} sera definitivement supprime.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NouveauPaiementDialog
        projetId={projet.id}
        devisId={paiementDevisId}
        open={paiementDialogOpen}
        onOpenChange={setPaiementDialogOpen}
        onCreated={fetchData}
      />

      {/* Section Heures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4" />
            Heures
          </CardTitle>
          <CardDescription>
            {totalHeures.toFixed(1)}h total — {heuresFacturables.toFixed(1)}h
            facturables / {heuresNonFacturables.toFixed(1)}h non-facturables
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Clock className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Aucune session enregistree sur ce projet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Etiquette</TableHead>
                  <TableHead className="text-right">Duree</TableHead>
                  <TableHead className="text-center">Facturable</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const cfg = getEtiquette(s.etiquette);
                  return (
                    <TableRow key={s.id} className="group">
                      <TableCell className="text-muted-foreground">
                        {new Date(s.date).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cfg.className}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{s.duree}h</TableCell>
                      <TableCell className="text-center">
                        {s.facturable ? (
                          <span className="text-emerald-400">Oui</span>
                        ) : (
                          <span className="text-muted-foreground">Non</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer">
                            <Trash2 className="size-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irreversible. La session de {s.duree}h sera definitivement supprimee.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSession(s.id)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {paiementsDevis && (
        <GererPaiementsDialog
          devisId={paiementsDevis.id}
          devisLibelle={paiementsDevis.libelle}
          projetId={projet.id}
          open={!!paiementsDevis}
          onOpenChange={(open) => { if (!open) setPaiementsDevis(null); }}
          onChanged={fetchData}
        />
      )}

      <ProjetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={fetchData}
        projet={projet}
      />
    </div>
  );
}
