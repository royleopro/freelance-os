"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  Devis,
  TransactionCA,
  SessionHeureAvecProjet,
  Parametre,
  Objectif,
  Provision,
} from "@/lib/types";
import { getEtiquette } from "@/lib/etiquettes";
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
  Target,
  Landmark,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import { CaMensuelChart } from "./ca-mensuel-chart";
import { RepartitionCAChart } from "./repartition-ca-chart";
import { RepartitionHeuresChart } from "./repartition-heures-chart";
import { EvolutionHeuresChart } from "./evolution-heures-chart";
import { SemaineChart } from "./semaine-chart";
import { toast } from "sonner";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = ["all", "2024", "2025", "2026"] as const;
const MOIS_NOMS = [
  "jan", "fev", "mar", "avr", "mai", "juin",
  "juil", "aout", "sep", "oct", "nov", "dec",
];

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

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const MOIS_LABELS = [
  "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aout", "Sep", "Oct", "Nov", "Dec",
];

const PERIOD_LABELS: Record<string, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
};


export default function DashboardPage() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionCA[]>([]);
  const [sessions, setSessions] = useState<SessionHeureAvecProjet[]>([]);
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [allDevis, setAllDevis] = useState<Devis[]>([]);
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));

  // Section 1 — period filter
  const [sessionPeriod, setSessionPeriod] = useState<string>("today");

  // Section 4 — Donut dropdowns
  const [donutCAYear, setDonutCAYear] = useState<string>(String(CURRENT_YEAR));
  const [donutHeuresYear, setDonutHeuresYear] = useState<string>(String(CURRENT_YEAR));

  // Section 5 — Evolution granularity
  const [evoGranularity, setEvoGranularity] = useState<string>("month");

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      async function fetchAllSessions() {
        const all: SessionHeureAvecProjet[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("sessions_heures")
            .select("*, projets(nom, type)")
            .order("date", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (error) return { data: null, error };
          all.push(...((data as SessionHeureAvecProjet[]) ?? []));
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return { data: all, error: null };
      }

      const [projetsRes, transactionsRes, sessionsRes, paramsRes, objectifsRes, devisRes, provisionsRes] =
        await Promise.all([
          supabase.from("projets_with_ca").select("*"),
          supabase
            .from("transactions_ca")
            .select("*")
            .order("date", { ascending: false }),
          fetchAllSessions(),
          supabase.from("parametres").select("*"),
          supabase
            .from("objectifs")
            .select("*")
            .eq("annee", CURRENT_YEAR)
            .order("mois", { ascending: true }),
          supabase
            .from("devis")
            .select("*")
            .eq("statut", "signe"),
          supabase.from("provisions").select("*"),
        ]);

      const firstError =
        projetsRes.error || transactionsRes.error || sessionsRes.error || paramsRes.error || objectifsRes.error;
      if (firstError) {
        setError("Impossible de charger les donnees du dashboard.");
        toast.error("Erreur de chargement", { description: firstError.message });
        return;
      }

      setProjets((projetsRes.data as Projet[]) ?? []);
      setAllTransactions((transactionsRes.data as TransactionCA[]) ?? []);
      setSessions(sessionsRes.data ?? []);
      setParametres((paramsRes.data as Parametre[]) ?? []);
      setObjectifs((objectifsRes.data as Objectif[]) ?? []);
      setAllDevis((devisRes.data as Devis[]) ?? []);
      setProvisions((provisionsRes.data as Provision[]) ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger les donnees du dashboard.");
      toast.error("Erreur reseau", { description: "Verifiez votre connexion internet." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ───── Section 1: Sessions by period ─────
  const filteredSessions = useMemo(() => {
    let minDate: string;
    if (sessionPeriod === "week") minDate = startOfWeek();
    else if (sessionPeriod === "month") minDate = startOfMonth();
    else minDate = todayStr();

    return sessions.filter((s) => s.date >= minDate);
  }, [sessions, sessionPeriod]);

  const totalHeuresPeriod = useMemo(
    () => filteredSessions.reduce((sum, s) => sum + s.duree, 0),
    [filteredSessions]
  );

  // ───── Shared: client project IDs ─────
  const clientProjetIds = useMemo(
    () => new Set(projets.filter((p) => p.type === "client").map((p) => p.id)),
    [projets]
  );

  // ───── Filter transactions by selected year (for CA chart + KPI CA) ─────
  const transactions = useMemo(() => {
    if (selectedYear === "all") return allTransactions;
    const year = parseInt(selectedYear);
    return allTransactions.filter((t) => new Date(t.date).getFullYear() === year);
  }, [allTransactions, selectedYear]);

  const isCurrentYear = selectedYear === String(CURRENT_YEAR);

  // ───── Section 2 KPI: Objectif annuel ─────
  const objectifAnnuel = useMemo(() => {
    if (objectifs.length > 0) return objectifs.reduce((sum, o) => sum + o.ca_cible, 0);
    return getParam(parametres, "objectif_ca_annuel", 60000);
  }, [objectifs, parametres]);

  const soldeComptePro = getParam(parametres, "solde_compte_pro", 0);
  const fraisMensuels = getParam(parametres, "frais_mensuels_fixes", 131.67);
  const soldeUpdatedAt = parametres.find((p) => p.cle === "solde_compte_pro")?.updated_at ?? null;

  const tauxUrssafParam = parametres.find((p) => p.cle === "taux_urssaf");
  const tauxImpotsParam = parametres.find((p) => p.cle === "taux_impots");
  const hasTaux = tauxUrssafParam != null && tauxImpotsParam != null;
  const tauxUrssaf = hasTaux ? parseFloat(tauxUrssafParam.valeur) : 0;
  const tauxImpots = hasTaux ? parseFloat(tauxImpotsParam.valeur) : 0;

  // ───── KPI: CA ─────
  const caEncaisse = useMemo(
    () =>
      transactions
        .filter((t) => t.statut === "paye" && clientProjetIds.has(t.projet_id))
        .reduce((sum, t) => sum + t.montant, 0),
    [transactions, clientProjetIds]
  );

  const caDevise = useMemo(
    () =>
      transactions
        .filter((t) => t.statut === "signe" && clientProjetIds.has(t.projet_id))
        .reduce((sum, t) => sum + t.montant, 0),
    [transactions, clientProjetIds]
  );

  // ───── KPI: Net mensuel — réel + à venir ─────
  const janFirst = `${CURRENT_YEAR}-01-01`;
  const coefNet = 1 - tauxUrssaf - tauxImpots;

  const netReel = useMemo(() => {
    if (!hasTaux) return null;
    const now = new Date();
    const moisEcoules = now.getMonth(); // 0-indexed = mois complets écoulés (en avril → 3)
    if (moisEcoules === 0) return null;

    const caPayeAnnee = allTransactions
      .filter((t) => {
        if (t.statut !== "paye") return false;
        const dp = t.date_paiement ?? t.date;
        return dp >= janFirst && clientProjetIds.has(t.projet_id);
      })
      .reduce((sum, t) => sum + t.montant, 0);

    return {
      montant: (caPayeAnnee / moisEcoules) * coefNet,
      mois: moisEcoules,
    };
  }, [allTransactions, clientProjetIds, hasTaux, coefNet, janFirst]);

  const netAVenir = useMemo(() => {
    if (!hasTaux) return null;

    // Transactions non-payées (signe + en_attente) de l'année en cours
    const txNonPayees = allTransactions.filter((t) => {
      if (t.statut === "paye") return false;
      const dp = t.date_paiement ?? t.date;
      return dp >= janFirst && clientProjetIds.has(t.projet_id);
    });

    if (txNonPayees.length === 0) return null;

    // Dernier mois parmi les non-payées
    let dernierMois = 0;
    for (const t of txNonPayees) {
      const dp = t.date_paiement ?? t.date;
      const m = new Date(dp).getMonth(); // 0-indexed
      if (m > dernierMois) dernierMois = m;
    }

    // Toutes les transactions (payé + signe + en_attente) de jan → dernier mois
    const nbMois = dernierMois + 1; // jan=0 → 1 mois, etc.
    const caTotal = allTransactions
      .filter((t) => {
        const dp = t.date_paiement ?? t.date;
        return dp >= janFirst && clientProjetIds.has(t.projet_id);
      })
      .reduce((sum, t) => sum + t.montant, 0);

    return {
      montant: (caTotal / nbMois) * coefNet,
      mois: nbMois,
      dernierMoisLabel: MOIS_NOMS[dernierMois],
    };
  }, [allTransactions, clientProjetIds, hasTaux, coefNet, janFirst]);

  // ───── KPI: Jours signes (current year) ─────
  const joursSignes = useMemo(() => {
    const year = CURRENT_YEAR;
    return allDevis
      .filter((d) => {
        const sigDate = d.date_signature ?? d.created_at;
        return new Date(sigDate).getFullYear() === year;
      })
      .reduce((sum, d) => sum + (d.jours_signes ?? 0), 0);
  }, [allDevis]);

  // ───── KPI: Tresorerie ─────
  const todayDate = new Date().toISOString().split("T")[0];
  const totalProvisions = useMemo(
    () =>
      provisions
        .filter((p) => !p.date_prevue || p.date_prevue >= todayDate)
        .reduce((sum, p) => sum + p.montant, 0),
    [provisions, todayDate]
  );
  const soldeDisponible = soldeComptePro - totalProvisions;
  const salaireVersable6m = (soldeDisponible - fraisMensuels * 6) / 6;

  // ───── Section 3: Chart data ─────
  const chartData = useMemo(() => {
    const objectifMensuel = isCurrentYear ? objectifAnnuel / 12 : 0;
    const payeParMois = new Array(12).fill(0);
    const attenteParMois = new Array(12).fill(0);

    for (const t of transactions) {
      if (!clientProjetIds.has(t.projet_id)) continue;
      const mois = new Date(t.date).getMonth();
      if (t.statut === "paye") payeParMois[mois] += t.montant;
      else if (t.statut === "signe" || t.statut === "en_attente") attenteParMois[mois] += t.montant;
    }

    return MOIS_LABELS.map((label, i) => ({
      mois: label,
      objectif: Math.round(objectifMensuel),
      paye: Math.round(payeParMois[i]),
      en_attente: Math.round(attenteParMois[i]),
    }));
  }, [transactions, objectifAnnuel, clientProjetIds, isCurrentYear]);

  // ───── Section 4a: Donut CA par projet ─────
  const donutCAData = useMemo(() => {
    const projetMap = new Map<string, { nom: string; montant: number }>();
    const filteredTx =
      donutCAYear === "all"
        ? allTransactions
        : allTransactions.filter((t) => new Date(t.date).getFullYear() === parseInt(donutCAYear));

    for (const t of filteredTx) {
      if (t.statut !== "paye" || !clientProjetIds.has(t.projet_id)) continue;
      const proj = projets.find((p) => p.id === t.projet_id);
      const nom = proj?.nom ?? "Inconnu";
      const existing = projetMap.get(t.projet_id);
      if (existing) existing.montant += t.montant;
      else projetMap.set(t.projet_id, { nom, montant: t.montant });
    }

    return [...projetMap.values()];
  }, [allTransactions, clientProjetIds, projets, donutCAYear]);

  // ───── Section 4b: Donut heures par projet ─────
  const donutHeuresData = useMemo(() => {
    const projetMap = new Map<string, { nom: string; heures: number }>();
    const filteredSes =
      donutHeuresYear === "all"
        ? sessions
        : sessions.filter((s) => new Date(s.date).getFullYear() === parseInt(donutHeuresYear));

    for (const s of filteredSes) {
      const nom = s.projets?.nom ?? "Inconnu";
      const existing = projetMap.get(s.projet_id);
      if (existing) existing.heures += s.duree;
      else projetMap.set(s.projet_id, { nom, heures: s.duree });
    }

    return [...projetMap.values()];
  }, [sessions, donutHeuresYear]);

  // ───── Section 5: Evolution heures ─────
  const evolutionData = useMemo(() => {
    // Start from Oct 2024
    const startDate = new Date(2024, 9, 1); // Oct 2024
    const now = new Date();

    if (evoGranularity === "month") {
      const points: { label: string; heures: number }[] = [];
      const cursor = new Date(startDate);

      while (cursor <= now) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        const key = `${MOIS_LABELS[m]} ${y.toString().slice(2)}`;
        const total = sessions
          .filter((s) => {
            const d = new Date(s.date);
            return d.getFullYear() === y && d.getMonth() === m;
          })
          .reduce((sum, s) => sum + s.duree, 0);
        points.push({ label: key, heures: Math.round(total * 10) / 10 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return points;
    }

    // Weekly
    const points: { label: string; heures: number }[] = [];
    const cursor = new Date(startDate);
    // Align to Monday
    const day = cursor.getDay();
    cursor.setDate(cursor.getDate() - day + (day === 0 ? -6 : 1));

    while (cursor <= now) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = cursor.toISOString().split("T")[0];
      const endStr = weekEnd.toISOString().split("T")[0];

      const total = sessions
        .filter((s) => s.date >= startStr && s.date <= endStr)
        .reduce((sum, s) => sum + s.duree, 0);

      const label = `${cursor.getDate()}/${cursor.getMonth() + 1}`;
      points.push({ label, heures: Math.round(total * 10) / 10 });
      cursor.setDate(cursor.getDate() + 7);
    }
    return points;
  }, [sessions, evoGranularity]);

  // ───── Loading ─────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
          <CardContent><Skeleton className="h-20 w-full" /></CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card size="sm" key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
              </CardHeader>
              <CardContent><Skeleton className="h-3 w-32" /></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
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
          <h1 className="text-2xl font-bold font-heading">Dashboard</h1>
          <p className="text-[#767676]">
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

      {/* ══════════ Section 1 — Aujourd'hui + Semaine ══════════ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Aujourd'hui — sessions list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              {PERIOD_LABELS[sessionPeriod]}
            </CardTitle>
            <CardAction>
              <Select value={sessionPeriod} onValueChange={(v) => { if (v) setSessionPeriod(v); }}>
                <SelectTrigger className="w-40" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            {filteredSessions.length === 0 ? (
              <p className="text-sm text-[#767676]">
                Aucune heure loguee {sessionPeriod === "today" ? "aujourd'hui" : sessionPeriod === "week" ? "cette semaine" : "ce mois"}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-2xl font-bold">{totalHeuresPeriod}h</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projet</TableHead>
                      <TableHead className="text-right">Duree</TableHead>
                      <TableHead>Etiquette</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.slice(0, 15).map((s) => {
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
                {filteredSessions.length > 15 && (
                  <p className="text-xs text-[#767676] text-center">
                    +{filteredSessions.length - 15} autres sessions
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Semaine en cours — stacked bar chart */}
        <SemaineChart />
      </div>

      {/* ══════════ Section 2 — 4 KPI Cards ══════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CA paye + barre */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Target className="size-3.5" />
              CA {selectedYear === "all" ? "all time" : selectedYear}
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(caEncaisse + caDevise)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCurrentYear && objectifAnnuel > 0 ? (
              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-[#0F0F0F] overflow-hidden flex">
                  <div
                    className="h-full bg-brand-accent transition-all"
                    style={{ width: `${Math.min((caEncaisse / objectifAnnuel) * 100, 100)}%` }}
                  />
                  <div
                    className="h-full bg-brand-accent/30 transition-all"
                    style={{ width: `${Math.min((caDevise / objectifAnnuel) * 100, Math.max(100 - (caEncaisse / objectifAnnuel) * 100, 0))}%` }}
                  />
                </div>
                <p className="text-xs text-[#767676]">
                  <span className="text-brand-accent">{formatEuro(caEncaisse)}</span>
                  {" + "}
                  <span className="text-brand-accent/50">{formatEuro(caDevise)} signes</span>
                  {" / "}
                  {formatEuro(objectifAnnuel)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#767676]">
                <span className="text-brand-accent">{formatEuro(caEncaisse)} payes</span>
                {" + "}
                <span className="text-brand-accent/50">{formatEuro(caDevise)} signes</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Net mensuel moyen — réel + à venir */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Euro className="size-3.5" />
              Net mensuel moyen {CURRENT_YEAR}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasTaux ? (
              <Link href="/parametres" className="text-xs text-brand-accent/50 hover:underline">
                Configurer les taux
              </Link>
            ) : (
              <div className="space-y-3">
                {/* Net réel */}
                <div>
                  <p className="text-xl font-bold text-white">
                    {netReel ? formatEuro(netReel.montant) : "—"}
                  </p>
                  <p className="text-xs text-[#767676] mt-0.5">
                    Moyenne sur {netReel?.mois ?? 0} mois (paye)
                  </p>
                </div>

                {/* Divider + Net à venir */}
                {netAVenir && (
                  <>
                    <div className="h-px bg-[rgba(255,255,255,0.06)]" />
                    <div>
                      <p className="text-lg font-bold text-brand-accent">
                        {formatEuro(netAVenir.montant)}
                      </p>
                      <p className="text-xs text-[#767676] mt-0.5">
                        Moyenne jan → {netAVenir.dernierMoisLabel} (paye + signe)
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tresorerie */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Landmark className="size-3.5" />
              Tresorerie Qonto
            </CardDescription>
            <CardTitle className="text-xl">
              {formatEuro(soldeComptePro)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5 text-xs text-[#767676]">
              {totalProvisions > 0 && (
                <p>
                  Provisions : <span className="text-red-400">-{formatEuro(totalProvisions)}</span>
                </p>
              )}
              <p>
                Solde disponible :{" "}
                <span style={{ color: "#0ACF83" }}>{formatEuro(soldeDisponible)}</span>
              </p>
              <p>
                Salaire versable /6m :{" "}
                <span className={salaireVersable6m >= 0 ? "text-brand-accent" : "text-red-400"}>
                  {formatEuro(salaireVersable6m)}
                </span>
              </p>
              <p>Frais mensuels : {formatEuro(fraisMensuels)}</p>
              {soldeUpdatedAt && (
                <p className="mt-1">
                  MAJ : {new Date(soldeUpdatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              <p className="mt-0.5" style={{ fontSize: "11px", color: "#767676" }}>
                Synchronise via Qonto
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Jours signes */}
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Jours signes {CURRENT_YEAR}
            </CardDescription>
            <CardTitle className="text-xl">
              {joursSignes}j
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#767676]">
              {(joursSignes * 8).toFixed(0)}h equivalentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ══════════ Section 3 — Graphique CA mensuel ══════════ */}
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

      {/* ══════════ Section 4 — Donuts côte à côte ══════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Donut CA */}
        <Card>
          <CardHeader>
            <CardTitle>Repartition CA par projet</CardTitle>
            <CardAction>
              <Select value={donutCAYear} onValueChange={(v) => { if (v) setDonutCAYear(v); }}>
                <SelectTrigger size="sm" className="w-28">
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
            </CardAction>
          </CardHeader>
          <CardContent>
            <RepartitionCAChart data={donutCAData} />
          </CardContent>
        </Card>

        {/* Donut heures */}
        <Card>
          <CardHeader>
            <CardTitle>Repartition heures par projet</CardTitle>
            <CardAction>
              <Select value={donutHeuresYear} onValueChange={(v) => { if (v) setDonutHeuresYear(v); }}>
                <SelectTrigger size="sm" className="w-28">
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
            </CardAction>
          </CardHeader>
          <CardContent>
            <RepartitionHeuresChart data={donutHeuresData} />
          </CardContent>
        </Card>
      </div>

      {/* ══════════ Section 5 — Courbe evolution heures ══════════ */}
      <Card>
        <CardHeader>
          <CardTitle>Evolution des heures</CardTitle>
          <CardAction>
            <Select value={evoGranularity} onValueChange={(v) => { if (v) setEvoGranularity(v); }}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Par mois</SelectItem>
                <SelectItem value="week">Par semaine</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          <EvolutionHeuresChart data={evolutionData} />
        </CardContent>
      </Card>
    </div>
  );
}
