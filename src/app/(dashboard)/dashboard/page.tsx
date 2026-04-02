"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  TransactionCA,
  SessionHeureAvecProjet,
  Parametre,
  Objectif,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Euro,
  TrendingUp,
  Target,
  Landmark,
  Clock,
  FolderKanban,
  AlertCircle,
} from "lucide-react";
import { CaMensuelChart } from "./ca-mensuel-chart";
import { toast } from "sonner";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = ["all", "2024", "2025", "2026"] as const;

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
  const [allTransactions, setAllTransactions] = useState<TransactionCA[]>([]);
  const [sessions, setSessions] = useState<SessionHeureAvecProjet[]>([]);
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      const [projetsRes, transactionsRes, sessionsRes, paramsRes, objectifsRes] =
        await Promise.all([
          supabase.from("projets_with_ca").select("*"),
          supabase
            .from("transactions_ca")
            .select("*")
            .order("date", { ascending: false }),
          supabase
            .from("sessions_heures")
            .select("*, projets(nom, type)")
            .order("date", { ascending: false })
            .limit(200),
          supabase.from("parametres").select("*"),
          supabase
            .from("objectifs")
            .select("*")
            .eq("annee", CURRENT_YEAR)
            .order("mois", { ascending: true }),
        ]);

      const firstError =
        projetsRes.error || transactionsRes.error || sessionsRes.error || paramsRes.error || objectifsRes.error;
      if (firstError) {
        setError("Impossible de charger les donnees du dashboard.");
        toast.error("Erreur de chargement", {
          description: firstError.message,
        });
        return;
      }

      setProjets((projetsRes.data as Projet[]) ?? []);
      setAllTransactions((transactionsRes.data as TransactionCA[]) ?? []);
      setSessions((sessionsRes.data as SessionHeureAvecProjet[]) ?? []);
      setParametres((paramsRes.data as Parametre[]) ?? []);
      setObjectifs((objectifsRes.data as Objectif[]) ?? []);
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

  // --- Filter transactions by selected year ---
  const transactions = useMemo(() => {
    if (selectedYear === "all") return allTransactions;
    const year = parseInt(selectedYear);
    return allTransactions.filter((t) => new Date(t.date).getFullYear() === year);
  }, [allTransactions, selectedYear]);

  const isCurrentYear = selectedYear === String(CURRENT_YEAR);

  // --- Parametres ---
  const objectifAnnuel = useMemo(() => {
    if (objectifs.length > 0) {
      return objectifs.reduce((sum, o) => sum + o.ca_cible, 0);
    }
    return getParam(parametres, "objectif_ca_annuel", 60000);
  }, [objectifs, parametres]);

  const soldeComptePro = getParam(parametres, "solde_compte_pro", 0);
  const fraisMensuels = getParam(parametres, "frais_mensuels_fixes", 131.67);

  // Taux dynamiques depuis la table parametres
  const tauxUrssafParam = parametres.find((p) => p.cle === "taux_urssaf");
  const tauxImpotsParam = parametres.find((p) => p.cle === "taux_impots");
  const hasTaux = tauxUrssafParam != null && tauxImpotsParam != null;
  const tauxUrssaf = hasTaux ? parseFloat(tauxUrssafParam.valeur) : 0;
  const tauxImpots = hasTaux ? parseFloat(tauxImpotsParam.valeur) : 0;

  // --- IDs projets client ---
  const clientProjetIds = useMemo(
    () => new Set(projets.filter((p) => p.type === "client").map((p) => p.id)),
    [projets]
  );

  // --- KPI: CA Encaisse (paye) ---
  const caEncaisse = useMemo(
    () =>
      transactions
        .filter((t) => t.statut === "paye" && clientProjetIds.has(t.projet_id))
        .reduce((sum, t) => sum + t.montant, 0),
    [transactions, clientProjetIds]
  );

  // --- KPI: CA Devise (signe) ---
  const caDevise = useMemo(
    () =>
      transactions
        .filter((t) => t.statut === "signe" && clientProjetIds.has(t.projet_id))
        .reduce((sum, t) => sum + t.montant, 0),
    [transactions, clientProjetIds]
  );



  // --- KPI: Net mensuel moyen (current year only, months with CA > 0) ---
  const netMensuelMoyen = useMemo(() => {
    if (!hasTaux) return 0;
    const currentYearTransactions = allTransactions.filter(
      (t) =>
        new Date(t.date).getFullYear() === CURRENT_YEAR &&
        t.statut === "paye" &&
        clientProjetIds.has(t.projet_id)
    );
    const caPayeCurrentYear = currentYearTransactions.reduce(
      (sum, t) => sum + t.montant,
      0
    );
    // Count distinct months with CA paye
    const moisAvecCA = new Set(
      currentYearTransactions.map((t) => new Date(t.date).getMonth())
    );
    const nbMois = Math.max(moisAvecCA.size, 1);
    return (caPayeCurrentYear / nbMois) * (1 - tauxUrssaf - tauxImpots);
  }, [allTransactions, clientProjetIds, hasTaux, tauxUrssaf, tauxImpots]);

  // --- KPI: Tresorerie ---
  const salaireVersable6m = (soldeComptePro - fraisMensuels * 6) / 6;

  // --- Rentabilite moyenne projets actifs ---
  const projetsActifs = useMemo(
    () => projets.filter((p) => p.statut === "en_cours" && p.type === "client"),
    [projets]
  );

  const rentabiliteMoyenne = useMemo(() => {
    if (projetsActifs.length === 0) return null;
    const projetIds = new Set(projetsActifs.map((p) => p.id));

    const heuresTotalesActifs = sessions
      .filter((s) => projetIds.has(s.projet_id))
      .reduce((sum, s) => sum + s.duree, 0);

    const caPayeActifs = allTransactions
      .filter((t) => projetIds.has(t.projet_id) && t.statut === "paye")
      .reduce((sum, t) => sum + t.montant, 0);

    return heuresTotalesActifs > 0
      ? caPayeActifs / heuresTotalesActifs
      : null;
  }, [projetsActifs, sessions, allTransactions]);

  // --- Chart data (filtered by selected year) ---
  const chartData = useMemo(() => {
    const objectifMensuel = isCurrentYear ? objectifAnnuel / 12 : 0;
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
  }, [transactions, objectifAnnuel, clientProjetIds, isCurrentYear]);

  // --- Projets actifs stats ---
  const projetsActifsStats = useMemo(() => {
    return projetsActifs.map((p) => {
      const heures = sessions
        .filter((s) => s.projet_id === p.id)
        .reduce((sum, s) => sum + s.duree, 0);
      const paye = allTransactions
        .filter((t) => t.projet_id === p.id && t.statut === "paye")
        .reduce((sum, t) => sum + t.montant, 0);
      const rentabilite = heures > 0 ? paye / heures : null;
      return { ...p, heures, paye, rentabilite };
    });
  }, [projetsActifs, sessions, allTransactions]);

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
      {/* Header + Year selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d&apos;ensemble de votre activite freelance.
          </p>
        </div>
        <Select value={selectedYear} onValueChange={(v) => { if (v) setSelectedYear(v); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={y}>
                {y === "all" ? "All time" : y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CA — barre a deux segments */}
        <Card size="sm" className="sm:col-span-2">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Target className="size-3.5" />
              Chiffre d&apos;affaires
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(caEncaisse + caDevise)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCurrentYear && objectifAnnuel > 0 ? (
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min((caEncaisse / objectifAnnuel) * 100, 100)}%` }}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min((caDevise / objectifAnnuel) * 100, Math.max(100 - (caEncaisse / objectifAnnuel) * 100, 0))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-emerald-400">{formatEuro(caEncaisse)} encaisses</span>
                  {" + "}
                  <span className="text-amber-400">{formatEuro(caDevise)} signes</span>
                  {" = "}
                  {formatEuro(caEncaisse + caDevise)} / {formatEuro(objectifAnnuel)} objectif
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-400">{formatEuro(caEncaisse)} encaisses</span>
                {" + "}
                <span className="text-amber-400">{formatEuro(caDevise)} signes</span>
                {" — "}{selectedYear === "all" ? "all time" : selectedYear}
              </p>
            )}
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
              {hasTaux ? formatEuro(netMensuelMoyen) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasTaux ? (
              <p className="text-xs text-muted-foreground">
                Ref. {CURRENT_YEAR} — apres URSSAF ({(tauxUrssaf * 100).toFixed(1)}%) + impots (
                {(tauxImpots * 100).toFixed(0)}%)
              </p>
            ) : (
              <Link
                href="/parametres"
                className="text-xs text-amber-400 hover:underline"
              >
                Configurez vos taux dans les parametres
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Tresorerie */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Landmark className="size-3.5" />
              Tresorerie
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(soldeComptePro)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p>
                Salaire versable /6m :{" "}
                <span className={salaireVersable6m >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {formatEuro(salaireVersable6m)}
                </span>
              </p>
              <p>Frais mensuels : {formatEuro(fraisMensuels)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique CA mensuel */}
      <Card>
        <CardHeader>
          <CardTitle>
            CA mensuel {selectedYear === "all" ? "— All time" : selectedYear}
          </CardTitle>
          <CardDescription>
            {isCurrentYear
              ? "Objectif vs CA reellement paye par mois"
              : "CA paye par mois"}
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
            {rentabiliteMoyenne !== null && (
              <CardDescription className="flex items-center gap-1.5">
                <TrendingUp className="size-3" />
                Rentabilite reelle : {formatEuro(rentabiliteMoyenne)}/h
              </CardDescription>
            )}
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
                    <TableHead className="text-right">EUR/h</TableHead>
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

        {/* Dernieres sessions */}
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
