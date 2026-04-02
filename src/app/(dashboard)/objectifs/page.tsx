"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Objectif, TransactionCA } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Target, AlertCircle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const MOIS_LABELS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

const YEARS = [2024, 2025, 2026, 2027];

const DEFAULT_OBJECTIFS = [
  { tjm_cible: 350, jours_cibles: 11.4 },
  { tjm_cible: 400, jours_cibles: 11 },
  { tjm_cible: 400, jours_cibles: 12 },
  { tjm_cible: 450, jours_cibles: 12 },
  { tjm_cible: 450, jours_cibles: 13 },
  { tjm_cible: 450, jours_cibles: 13 },
  { tjm_cible: 450, jours_cibles: 5 },
  { tjm_cible: 450, jours_cibles: 5 },
  { tjm_cible: 450, jours_cibles: 11 },
  { tjm_cible: 450, jours_cibles: 12 },
  { tjm_cible: 450, jours_cibles: 12 },
  { tjm_cible: 450, jours_cibles: 12 },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

interface ObjectifRow {
  mois: number;
  tjm_cible: string;
  jours_cibles: string;
}

export default function ObjectifsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [objectifCaAnnuel, setObjectifCaAnnuel] = useState("");
  const [objectifs, setObjectifs] = useState<ObjectifRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionCA[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [objectifsRes, transactionsRes, paramRes] = await Promise.all([
        supabase
          .from("objectifs")
          .select("*")
          .eq("annee", selectedYear)
          .order("mois", { ascending: true }),
        supabase
          .from("transactions_ca")
          .select("*")
          .eq("statut", "paye")
          .gte("date", `${selectedYear}-01-01`)
          .lte("date", `${selectedYear}-12-31`),
        supabase
          .from("parametres")
          .select("*")
          .eq("cle", `objectif_ca_annuel_${selectedYear}`)
          .maybeSingle(),
      ]);

      const firstError = objectifsRes.error || transactionsRes.error || paramRes.error;
      if (firstError) {
        setError("Impossible de charger les objectifs.");
        toast.error("Erreur de chargement", { description: firstError.message });
        return;
      }

      setObjectifCaAnnuel(paramRes.data?.valeur ?? "");

      const dbObjectifs = (objectifsRes.data as Objectif[]) ?? [];
      const rows: ObjectifRow[] = [];
      for (let m = 1; m <= 12; m++) {
        const existing = dbObjectifs.find((o) => o.mois === m);
        const defaults = DEFAULT_OBJECTIFS[m - 1];
        rows.push({
          mois: m,
          tjm_cible: String(existing?.tjm_cible ?? defaults.tjm_cible),
          jours_cibles: String(existing?.jours_cibles ?? defaults.jours_cibles),
        });
      }
      setObjectifs(rows);
      setTransactions((transactionsRes.data as TransactionCA[]) ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger les objectifs.");
      toast.error("Erreur reseau", { description: "Verifiez votre connexion internet." });
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function updateObjectif(
    index: number,
    field: "tjm_cible" | "jours_cibles",
    value: string
  ) {
    setObjectifs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function saveObjectifs() {
    setSaving(true);
    const supabase = createClient();

    const rows = objectifs.map((o) => ({
      annee: selectedYear,
      mois: o.mois,
      ca_cible: (parseFloat(o.tjm_cible) || 0) * (parseFloat(o.jours_cibles) || 0),
      tjm_cible: parseFloat(o.tjm_cible) || 0,
      jours_cibles: parseFloat(o.jours_cibles) || 0,
    }));

    const [objRes, paramRes] = await Promise.all([
      supabase.from("objectifs").upsert(rows, { onConflict: "annee,mois" }),
      supabase.from("parametres").upsert({
        cle: `objectif_ca_annuel_${selectedYear}`,
        valeur: objectifCaAnnuel,
        updated_at: new Date().toISOString(),
      }),
    ]);

    const err = objRes.error || paramRes.error;
    if (err) {
      toast.error("Erreur de sauvegarde", { description: err.message });
    } else {
      toast.success("Objectifs sauvegardes");
    }
    setSaving(false);
  }

  const totalCaCible = useMemo(
    () =>
      objectifs.reduce(
        (sum, o) =>
          sum + (parseFloat(o.tjm_cible) || 0) * (parseFloat(o.jours_cibles) || 0),
        0
      ),
    [objectifs]
  );

  const caRealiseParMois = useMemo(() => {
    const map: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) map[m] = 0;
    for (const t of transactions) {
      const mois = new Date(t.date).getMonth() + 1;
      map[mois] = (map[mois] || 0) + Number(t.montant);
    }
    return map;
  }, [transactions]);

  const totalCaRealise = useMemo(
    () => Object.values(caRealiseParMois).reduce((s, v) => s + v, 0),
    [caRealiseParMois]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </div>
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
          onClick={() => fetchData()}
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
          <h1 className="text-2xl font-bold">Objectifs</h1>
          <p className="text-muted-foreground">
            Definissez et suivez vos objectifs de chiffre d&apos;affaires.
          </p>
        </div>
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Section 1 : Edition des objectifs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4" />
            Objectifs CA {selectedYear}
          </CardTitle>
          <CardDescription>
            Total CA cible mensuel : {fmt(totalCaCible)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium whitespace-nowrap">
              Objectif CA annuel global
            </label>
            <Input
              type="number"
              min="0"
              step="1000"
              className="w-40"
              placeholder="Ex: 60000"
              value={objectifCaAnnuel}
              onChange={(e) => setObjectifCaAnnuel(e.target.value)}
            />
            {objectifCaAnnuel && (
              <span className="text-sm text-muted-foreground">
                {fmt(parseFloat(objectifCaAnnuel) || 0)}
              </span>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead>TJM cible (EUR)</TableHead>
                <TableHead>Jours cibles</TableHead>
                <TableHead>CA mensuel cible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectifs.map((o, i) => {
                const caCible =
                  (parseFloat(o.tjm_cible) || 0) *
                  (parseFloat(o.jours_cibles) || 0);
                return (
                  <TableRow key={o.mois}>
                    <TableCell className="font-medium">
                      {MOIS_LABELS[o.mois - 1]}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="w-28"
                        value={o.tjm_cible}
                        onChange={(e) =>
                          updateObjectif(i, "tjm_cible", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-24"
                        value={o.jours_cibles}
                        onChange={(e) =>
                          updateObjectif(i, "jours_cibles", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{fmt(caCible)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="font-bold">{fmt(totalCaCible)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          <Button onClick={saveObjectifs} disabled={saving}>
            <Save data-icon="inline-start" />
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </CardContent>
      </Card>

      {/* Section 2 : Tableau comparatif */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4" />
            Suivi {selectedYear}
          </CardTitle>
          <CardDescription>
            Comparaison objectifs vs CA realise (transactions payees).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">CA cible</TableHead>
                <TableHead className="text-right">CA realise</TableHead>
                <TableHead className="text-right">Ecart</TableHead>
                <TableHead className="text-right">% atteinte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectifs.map((o) => {
                const cible =
                  (parseFloat(o.tjm_cible) || 0) *
                  (parseFloat(o.jours_cibles) || 0);
                const realise = caRealiseParMois[o.mois] ?? 0;
                const ecart = realise - cible;
                const pct = cible > 0 ? (realise / cible) * 100 : 0;
                return (
                  <TableRow key={o.mois}>
                    <TableCell className="font-medium">
                      {MOIS_LABELS[o.mois - 1]}
                    </TableCell>
                    <TableCell className="text-right">{fmt(cible)}</TableCell>
                    <TableCell className="text-right">{fmt(realise)}</TableCell>
                    <TableCell
                      className={`text-right ${ecart >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                      {ecart >= 0 ? "+" : ""}
                      {fmt(ecart)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${pct >= 100 ? "text-green-500" : pct >= 75 ? "text-yellow-500" : "text-red-500"}`}
                    >
                      {pct.toFixed(0)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">
                  {fmt(totalCaCible)}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {fmt(totalCaRealise)}
                </TableCell>
                <TableCell
                  className={`text-right font-bold ${totalCaRealise - totalCaCible >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {totalCaRealise - totalCaCible >= 0 ? "+" : ""}
                  {fmt(totalCaRealise - totalCaCible)}
                </TableCell>
                <TableCell
                  className={`text-right font-bold ${totalCaCible > 0 && (totalCaRealise / totalCaCible) * 100 >= 100 ? "text-green-500" : "text-red-500"}`}
                >
                  {totalCaCible > 0
                    ? ((totalCaRealise / totalCaCible) * 100).toFixed(0)
                    : 0}
                  %
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
