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
import { Save, Target, AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const MOIS_LABELS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

const YEARS = [2024, 2025, 2026, 2027];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

interface ObjectifRow {
  mois: number;
  tjm_cible: string;
  ca_cible: string;
}

function computeJours(caCible: string, tjmCible: string): number {
  const ca = parseFloat(caCible) || 0;
  const tjm = parseFloat(tjmCible) || 0;
  if (tjm <= 0) return 0;
  return Math.round((ca / tjm) * 10) / 10;
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
      const [objectifsRes, transactionsRes] = await Promise.all([
        supabase
          .from("objectifs")
          .select("*")
          .eq("annee", selectedYear)
          .order("mois", { ascending: true }),
        supabase
          .from("transactions_ca")
          .select("*")
          .in("statut", ["paye", "en_attente"])
          .gte("date", `${selectedYear}-01-01`)
          .lte("date", `${selectedYear}-12-31`),
      ]);

      const firstError = objectifsRes.error || transactionsRes.error;
      if (firstError) {
        setError("Impossible de charger les objectifs.");
        toast.error("Erreur de chargement", { description: firstError.message });
        return;
      }

      const dbObjectifs = (objectifsRes.data as Objectif[]) ?? [];

      // Mois = 0 représente l'objectif annuel global
      const annuel = dbObjectifs.find((o) => o.mois === 0);
      setObjectifCaAnnuel(annuel ? String(annuel.ca_cible) : "");

      const rows: ObjectifRow[] = [];
      for (let m = 1; m <= 12; m++) {
        const existing = dbObjectifs.find((o) => o.mois === m);
        rows.push({
          mois: m,
          tjm_cible: existing ? String(existing.tjm_cible) : "450",
          ca_cible: existing ? String(existing.ca_cible) : "",
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
    field: "tjm_cible" | "ca_cible",
    value: string
  ) {
    setObjectifs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function repartirSurDouzeMois() {
    const annuel = parseFloat(objectifCaAnnuel) || 0;
    if (annuel <= 0) {
      toast.error("Saisis d'abord un objectif annuel");
      return;
    }
    const parMois = Math.round(annuel / 12);
    setObjectifs((prev) =>
      prev.map((o) => ({ ...o, ca_cible: String(parMois) }))
    );
    toast.success(`Répartition : ${fmt(parMois)} / mois`);
  }

  function handleAnnuelBlur() {
    const annuel = parseFloat(objectifCaAnnuel) || 0;
    if (annuel <= 0) return;
    // Auto-répartition si tous les mois sont vides ou à 0
    const tousVides = objectifs.every((o) => (parseFloat(o.ca_cible) || 0) === 0);
    if (tousVides) {
      const parMois = Math.round(annuel / 12);
      setObjectifs((prev) =>
        prev.map((o) => ({ ...o, ca_cible: String(parMois) }))
      );
    }
  }

  async function saveObjectifs() {
    setSaving(true);
    const supabase = createClient();

    const monthlyRows = objectifs.map((o) => {
      const tjm = parseFloat(o.tjm_cible) || 0;
      const ca = parseFloat(o.ca_cible) || 0;
      const jours = tjm > 0 ? Math.round((ca / tjm) * 10) / 10 : 0;
      return {
        annee: selectedYear,
        mois: o.mois,
        tjm_cible: tjm,
        ca_cible: ca,
        jours_cibles: jours,
      };
    });

    const annuelRow = {
      annee: selectedYear,
      mois: 0,
      tjm_cible: 0,
      ca_cible: parseFloat(objectifCaAnnuel) || 0,
      jours_cibles: 0,
    };

    const { error: err } = await supabase
      .from("objectifs")
      .upsert([annuelRow, ...monthlyRows], { onConflict: "annee,mois" });

    if (err) {
      toast.error("Erreur de sauvegarde", { description: err.message });
    } else {
      toast.success("Objectifs sauvegardés");
    }
    setSaving(false);
  }

  const totalMensuel = useMemo(
    () => objectifs.reduce((sum, o) => sum + (parseFloat(o.ca_cible) || 0), 0),
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

  const objectifAnnuelNum = parseFloat(objectifCaAnnuel) || 0;
  const ecartAnnuel = totalMensuel - objectifAnnuelNum;
  const estEquilibre = objectifAnnuelNum > 0 && Math.abs(ecartAnnuel) < 1;

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
          <h1 className="text-2xl font-bold font-heading">Objectifs</h1>
          <p className="text-[#767676]">
            Définissez et suivez vos objectifs de chiffre d&apos;affaires.
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

      {/* Objectif annuel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4" />
            Objectif CA annuel {selectedYear}
          </CardTitle>
          <CardDescription>
            Définis ton objectif annuel puis répartis-le sur 12 mois.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              step="1000"
              className="w-48"
              placeholder="Ex: 60000"
              value={objectifCaAnnuel}
              onChange={(e) => setObjectifCaAnnuel(e.target.value)}
              onBlur={handleAnnuelBlur}
            />
            <Button variant="outline" onClick={repartirSurDouzeMois}>
              Répartir sur 12 mois
            </Button>
          </div>

          {objectifAnnuelNum > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#767676]">
                Total mensuel : {fmt(totalMensuel)}
              </span>
              {estEquilibre ? (
                <span className="flex items-center gap-1" style={{ color: "#0ACF83" }}>
                  <CheckCircle2 className="size-3.5" />
                  Équilibré
                </span>
              ) : (
                <span className="text-orange-400">
                  Écart : {ecartAnnuel >= 0 ? "+" : ""}
                  {fmt(ecartAnnuel)} — ajuste tes mois pour équilibrer
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tableau objectifs mensuels */}
      <Card>
        <CardHeader>
          <CardTitle>Objectifs mensuels {selectedYear}</CardTitle>
          <CardDescription>
            Les jours cibles sont calculés automatiquement (CA ÷ TJM).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead>TJM cible</TableHead>
                <TableHead>CA mensuel cible</TableHead>
                <TableHead className="text-right">Jours cibles</TableHead>
                <TableHead className="text-right">CA réalisé</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectifs.map((o, i) => {
                const jours = computeJours(o.ca_cible, o.tjm_cible);
                const ca = parseFloat(o.ca_cible) || 0;
                const realise = caRealiseParMois[o.mois] ?? 0;
                const ecart = realise - ca;
                return (
                  <TableRow key={o.mois}>
                    <TableCell className="font-medium">
                      {MOIS_LABELS[o.mois - 1]}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        className="w-24"
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
                        step="100"
                        className="w-28"
                        value={o.ca_cible}
                        onChange={(e) =>
                          updateObjectif(i, "ca_cible", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-[#767676]">
                      {jours > 0 ? `${jours} j` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{fmt(realise)}</TableCell>
                    <TableCell
                      className="text-right"
                      style={{ color: ecart >= 0 ? "#0ACF83" : "#f87171" }}
                    >
                      {ca > 0 ? `${ecart >= 0 ? "+" : ""}${fmt(ecart)}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell />
                <TableCell className="font-bold">{fmt(totalMensuel)}</TableCell>
                <TableCell />
                <TableCell className="text-right font-bold">
                  {fmt(
                    Object.values(caRealiseParMois).reduce((s, v) => s + v, 0)
                  )}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>

          <Button onClick={saveObjectifs} disabled={saving}>
            <Save data-icon="inline-start" />
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
