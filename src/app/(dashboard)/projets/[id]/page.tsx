"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  ProjetStatut,
  SessionHeure,
  Etiquette,
  TransactionCA,
} from "@/lib/types";
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
  Plus,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { NouveauPaiementDialog } from "./nouveau-paiement-dialog";

const etiquetteConfig: Record<Etiquette, { label: string; className: string }> =
  {
    design_ui: {
      label: "Design UI",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    wireframe: {
      label: "Wireframe",
      className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    },
    reunion: {
      label: "Reunion",
      className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    },
    code: {
      label: "Code",
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    administration: {
      label: "Administration",
      className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    },
    prospection: {
      label: "Prospection",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    autre: {
      label: "Autre",
      className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
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

function paiementBadge(totalPaye: number, montantDevise: number) {
  if (montantDevise <= 0)
    return { label: "—", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
  if (totalPaye >= montantDevise)
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
  const [paiementDialogOpen, setPaiementDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [projetRes, sessionsRes, transactionsRes] = await Promise.all([
      supabase.from("projets").select("*").eq("id", params.id).single(),
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
    setProjet(projetRes.data as Projet | null);
    setSessions((sessionsRes.data as SessionHeure[]) ?? []);
    setTransactions((transactionsRes.data as TransactionCA[]) ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalHeures = sessions.reduce((sum, s) => sum + s.duree, 0);
  const heuresFacturables = sessions
    .filter((s) => s.facturable)
    .reduce((sum, s) => sum + s.duree, 0);
  const heuresNonFacturables = totalHeures - heuresFacturables;

  const totalPaye = transactions
    .filter((t) => t.statut === "paye")
    .reduce((sum, t) => sum + t.montant, 0);
  const totalEnAttente = transactions
    .filter((t) => t.statut === "en_attente")
    .reduce((sum, t) => sum + t.montant, 0);

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Chargement...
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
  const paiementStatus = paiementBadge(totalPaye, projet.montant_devise);

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
            <Badge variant="outline" className={config.className}>
              {config.label}
            </Badge>
          </div>
          {projet.client && (
            <p className="text-muted-foreground">{projet.client}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Euro className="size-3.5" />
              Montant devise
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(projet.montant_devise)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Euro className="size-3.5" />
                Total paye
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
            {totalEnAttente > 0 && ` — ${formatEuro(totalEnAttente)} en attente`}
            {projet.montant_devise > 0 &&
              ` sur ${formatEuro(projet.montant_devise)} devise`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              Aucun paiement enregistre.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
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
            <p className="text-muted-foreground py-4 text-center">
              Aucune session enregistree sur ce projet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Etiquette</TableHead>
                  <TableHead className="text-right">Duree</TableHead>
                  <TableHead className="text-center">Facturable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const cfg = etiquetteConfig[s.etiquette];
                  return (
                    <TableRow key={s.id}>
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
