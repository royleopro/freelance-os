"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  TransactionCA,
  SessionHeureAvecProjet,
  Parametre,
} from "@/lib/types";
import { getEtiquette } from "@/lib/etiquettes";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Euro,
  TrendingUp,
  Target,
  ShieldCheck,
  Clock,
  FolderKanban,
  AlertCircle,
} from "lucide-react";
import { CaMensuelChart } from "./ca-mensuel-chart";
import { toast } from "sonner";

const TAUX_URSSAF = 0.256;
const TAUX_IMPOTS = 0.02;


function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function getParam(params: Parametre[], cle: string, fallback: number): number {
  const p = params.find((p) => p.cle === cle);
  return p ? parseFloat(p.valeur) || fallback : fallback;
}

const MOIS_LABELS = [
  "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aout", "Sep", "Oct", "Nov", "Dec",
];

export default function DashboardPage() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [transactions, setTransactions] = useState<TransactionCA[]>([]);
  const [sessions, setSessions] = useState<SessionHeureAvecProjet[]>([]);
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [projetsRes, transactionsRes, sessionsRes, paramsRes] =
        await Promise.all([
          supabase.from("projets_with_ca").select("*"),
          supabase
            .from("transactions_ca")
            .select("*")
            .gte("date", yearStart)
            .lte("date", yearEnd),
          supabase
            .from("sessions_heures")
            .select("*, projets(nom, type)")
            .order("date", { ascending: false })
            .limit(200),
          supabase.from("parametres").select("*"),
        ]);

      const firstError =
        projetsRes.error || transactionsRes.error || sessionsRes.error || paramsRes.error;
      if (firstError) {
        setError("Impossible de charger les donnees du dashboard.");
        toast.error("Erreur de chargement", {
          description: firstError.message,
        });
        return;
      }

      setProjets((projetsRes.data as Projet[]) ?? []);
      setTransactions((transactionsRes.data as TransactionCA[]) ?? []);
      setSessions((sessionsRes.data as SessionHeureAvecProjet[]) ?? []);
      setParametres((paramsRes.data as Parametre[]) ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger les donnees du dashboard.");
      toast.error("Erreur reseau", {
        description: "Verifiez votre connexion internet.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Calculs KPI ---
  const objectifAnnuel = getParam(parametres, "objectif_ca_annuel", 60000);
  const moisSurvie = getParam(parametres, "mois_survie", 6);

  // IDs des projets client uniquement (pour filtrer le CA)
  const clientProjetIds = useMemo(
    () => new Set(projets.filter((p) => p.type === "client").map((p) => p.id)),
    [projets]
  );

  const caPayeAnnee = useMemo(
    () =>
      transactions
        .filter((t) => t.statut === "paye" && clientProjetIds.has(t.projet_id))
        .reduce((sum, t) => sum + t.montant, 0),
    [transactions, clientProjetIds]
  );

  const progressionCA = objectifAnnuel > 0 ? (caPayeAnnee / objectifAnnuel) * 100 : 0;

  const moisEcoules = new Date().getMonth() + 1;
  const netMensuelMoyen =
    moisEcoules > 0
      ? (caPayeAnnee / moisEcoules) * (1 - TAUX_URSSAF - TAUX_IMPOTS)
      : 0;

  // Rentabilité moyenne projets actifs (type client uniquement)
  const projetsActifs = useMemo(
    () => projets.filter((p) => p.statut === "en_cours" && p.type === "client"),
    [projets]
  );

  const rentabiliteMoyenne = useMemo(() => {
    if (projetsActifs.length === 0) return null;
    const projetIds = new Set(projetsActifs.map((p) => p.id));

    const heuresFacturablesActifs = sessions
      .filter((s) => projetIds.has(s.projet_id) && s.facturable)
      .reduce((sum, s) => sum + s.duree, 0);

    const caPayeActifs = transactions
      .filter((t) => projetIds.has(t.projet_id) && t.statut === "paye")
      .reduce((sum, t) => sum + t.montant, 0);

    return heuresFacturablesActifs > 0
      ? caPayeActifs / heuresFacturablesActifs
      : null;
  }, [projetsActifs, sessions, transactions]);

  // --- Données graphique CA mensuel (projets client uniquement) ---
  const chartData = useMemo(() => {
    const objectifMensuel = objectifAnnuel / 12;
    const parMois = new Array(12).fill(0);

    for (const t of transactions) {
      if (t.statut === "paye" && clientProjetIds.has(t.projet_id)) {
        const mois = new Date(t.date).getMonth();
        parMois[mois] += t.montant;
      }
    }

    return MOIS_LABELS.map((label, i) => ({
      mois: label,
      objectif: Math.round(objectifMensuel),
      paye: Math.round(parMois[i]),
    }));
  }, [transactions, objectifAnnuel, clientProjetIds]);

  // --- Projets actifs avec stats ---
  const projetsActifsStats = useMemo(() => {
    return projetsActifs.map((p) => {
      const heures = sessions
        .filter((s) => s.projet_id === p.id && s.facturable)
        .reduce((sum, s) => sum + s.duree, 0);
      const paye = transactions
        .filter((t) => t.projet_id === p.id && t.statut === "paye")
        .reduce((sum, t) => sum + t.montant, 0);
      const rentabilite = heures > 0 ? paye / heures : null;
      return { ...p, heures, paye, rentabilite };
    });
  }, [projetsActifs, sessions, transactions]);

  // --- 5 dernières sessions ---
  const dernieresSessions = sessions.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card size="sm" key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
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
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble de votre activite freelance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CA paye vs objectif */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Target className="size-3.5" />
              CA paye {new Date().getFullYear()}
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(caPayeAnnee)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(progressionCA)}%</span>
                <span>Obj. {formatEuro(objectifAnnuel)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(progressionCA, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net mensuel moyen */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Euro className="size-3.5" />
              Net mensuel moyen
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(netMensuelMoyen)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Apres URSSAF ({(TAUX_URSSAF * 100).toFixed(1)}%) + impots (
              {(TAUX_IMPOTS * 100).toFixed(0)}%)
            </p>
          </CardContent>
        </Card>

        {/* Rentabilité moyenne */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5" />
              Rentabilite moyenne
            </CardDescription>
            <CardTitle className="text-xl">
              {rentabiliteMoyenne !== null
                ? formatEuro(rentabiliteMoyenne) + "/h"
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Sur {projetsActifs.length} projet
              {projetsActifs.length > 1 ? "s" : ""} actif
              {projetsActifs.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Mois de survie */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              Mois de survie
            </CardDescription>
            <CardTitle className="text-xl">{moisSurvie} mois</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Tresorerie de securite
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphique CA mensuel */}
      <Card>
        <CardHeader>
          <CardTitle>CA mensuel {new Date().getFullYear()}</CardTitle>
          <CardDescription>
            Objectif vs CA reellement paye par mois
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CaMensuelChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projets actifs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="size-4" />
              Projets clients actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projetsActifsStats.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FolderKanban className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Aucun projet en cours.
                </p>
                <Link
                  href="/projets"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Voir tous les projets
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead className="text-right">Paye</TableHead>
                    <TableHead className="text-right">Heures</TableHead>
                    <TableHead className="text-right">€/h</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projetsActifsStats.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/projets/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.nom}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatEuro(p.paye)}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.heures.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {p.rentabilite !== null
                          ? formatEuro(p.rentabilite) + "/h"
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dernières sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Dernieres sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dernieresSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Clock className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Aucune session enregistree.
                </p>
                <Link
                  href="/heures"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Loguer du temps
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead className="text-right">Duree</TableHead>
                    <TableHead>Etiquette</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dernieresSessions.map((s) => {
                    const cfg = getEtiquette(s.etiquette);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.projets?.nom ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{s.duree}h</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cfg.className}>
                            {cfg.label}
                          </Badge>
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
    </div>
  );
}
