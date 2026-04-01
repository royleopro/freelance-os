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
} from "@/lib/types";
import { getEtiquette } from "@/lib/etiquettes";
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
  Pencil,
  Plus,
  TrendingUp,
  User,
  Wallet,
  AlertCircle,
  Trash2,
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
import { ProjetDialog } from "../projet-dialog";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paiementDialogOpen, setPaiementDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const [projetRes, sessionsRes, transactionsRes] = await Promise.all([
        supabase.from("projets_with_ca").select("*").eq("id", params.id).single(),
        supabase
          .from("sessions_heures")
          .select("*")
          .eq("projet_id", params.id)
          .order("date", { ascending: false }),
        supabase
          .from("transactions_ca")
          .select("*")
          .eq("projet_id", params.id)
          .order("date", { ascending: false }),
      ]);
      if (projetRes.error && projetRes.error.code !== "PGRST116") {
        setError("Impossible de charger le projet.");
        toast.error("Erreur de chargement", { description: projetRes.error.message });
        return;
      }
      setProjet(projetRes.data as Projet | null);
      setSessions((sessionsRes.data as SessionHeure[]) ?? []);
      setTransactions((transactionsRes.data as TransactionCA[]) ?? []);
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
    heuresFacturables > 0 ? totalPaye / heuresFacturables : null;
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
              Rentabilite
            </CardDescription>
            <CardTitle className="text-xl">
              {rentabiliteEurH !== null
                ? formatEuro(rentabiliteEurH) + "/h"
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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
                  Calcul de rentabilite
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatEuro(totalPaye)} /{" "}
                  {heuresFacturables.toFixed(1)}h facturables ={" "}
                  <span className="font-medium text-foreground">
                    {formatEuro(rentabiliteEurH)}/h
                  </span>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section Paiements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" />
            Paiements
          </CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => setPaiementDialogOpen(true)}>
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

      <ProjetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={fetchData}
        projet={projet}
      />
    </div>
  );
}
