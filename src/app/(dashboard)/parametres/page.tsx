"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Parametre, Objectif } from "@/lib/types";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, Settings, Target } from "lucide-react";

const MOIS_LABELS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

const DEFAULT_OBJECTIFS = [
  { ca_cible: 4000, tjm_cible: 350, jours_cibles: 11.4 },
  { ca_cible: 4400, tjm_cible: 400, jours_cibles: 11 },
  { ca_cible: 4800, tjm_cible: 400, jours_cibles: 12 },
  { ca_cible: 5400, tjm_cible: 450, jours_cibles: 12 },
  { ca_cible: 5850, tjm_cible: 450, jours_cibles: 13 },
  { ca_cible: 5850, tjm_cible: 450, jours_cibles: 13 },
  { ca_cible: 2250, tjm_cible: 450, jours_cibles: 5 },
  { ca_cible: 2250, tjm_cible: 450, jours_cibles: 5 },
  { ca_cible: 4950, tjm_cible: 450, jours_cibles: 11 },
  { ca_cible: 5400, tjm_cible: 450, jours_cibles: 12 },
  { ca_cible: 5400, tjm_cible: 450, jours_cibles: 12 },
  { ca_cible: 5400, tjm_cible: 450, jours_cibles: 12 },
];

interface FinanceForm {
  taux_urssaf: string;
  taux_impots: string;
  objectif_net_mensuel: string;
  frais_mensuels_fixes: string;
  solde_compte_pro: string;
}

interface ObjectifRow {
  mois: number;
  ca_cible: string;
  tjm_cible: string;
  jours_cibles: string;
}

function getParam(params: Parametre[], cle: string, fallback: string): string {
  return params.find((p) => p.cle === cle)?.valeur ?? fallback;
}

export default function ParametresPage() {
  const [loading, setLoading] = useState(true);
  const [savingFinance, setSavingFinance] = useState(false);
  const [savingObjectifs, setSavingObjectifs] = useState(false);
  const [financeSaved, setFinanceSaved] = useState(false);
  const [objectifsSaved, setObjectifsSaved] = useState(false);

  const [finance, setFinance] = useState<FinanceForm>({
    taux_urssaf: "0.256",
    taux_impots: "0.02",
    objectif_net_mensuel: "2000",
    frais_mensuels_fixes: "131.67",
    solde_compte_pro: "0",
  });

  const [objectifs, setObjectifs] = useState<ObjectifRow[]>([]);

  const year = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [paramsRes, objectifsRes] = await Promise.all([
      supabase.from("parametres").select("*"),
      supabase
        .from("objectifs")
        .select("*")
        .eq("annee", year)
        .order("mois", { ascending: true }),
    ]);

    const params = (paramsRes.data as Parametre[]) ?? [];
    setFinance({
      taux_urssaf: getParam(params, "taux_urssaf", "0.256"),
      taux_impots: getParam(params, "taux_impots", "0.02"),
      objectif_net_mensuel: getParam(params, "objectif_net_mensuel", "2000"),
      frais_mensuels_fixes: getParam(params, "frais_mensuels_fixes", "131.67"),
      solde_compte_pro: getParam(params, "solde_compte_pro", "0"),
    });

    const dbObjectifs = (objectifsRes.data as Objectif[]) ?? [];
    const rows: ObjectifRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const existing = dbObjectifs.find((o) => o.mois === m);
      const defaults = DEFAULT_OBJECTIFS[m - 1];
      rows.push({
        mois: m,
        ca_cible: String(existing?.ca_cible ?? defaults.ca_cible),
        tjm_cible: String(existing?.tjm_cible ?? defaults.tjm_cible),
        jours_cibles: String(existing?.jours_cibles ?? defaults.jours_cibles),
      });
    }
    setObjectifs(rows);
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function updateFinance(field: keyof FinanceForm, value: string) {
    setFinance((prev) => ({ ...prev, [field]: value }));
    setFinanceSaved(false);
  }

  function updateObjectif(
    index: number,
    field: "ca_cible" | "tjm_cible" | "jours_cibles",
    value: string
  ) {
    setObjectifs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setObjectifsSaved(false);
  }

  async function saveFinance() {
    setSavingFinance(true);
    const supabase = createClient();
    const entries = Object.entries(finance) as [keyof FinanceForm, string][];

    await Promise.all(
      entries.map(([cle, valeur]) =>
        supabase
          .from("parametres")
          .upsert({ cle, valeur, updated_at: new Date().toISOString() })
      )
    );

    setSavingFinance(false);
    setFinanceSaved(true);
  }

  async function saveObjectifs() {
    setSavingObjectifs(true);
    const supabase = createClient();

    const rows = objectifs.map((o) => ({
      annee: year,
      mois: o.mois,
      ca_cible: parseFloat(o.ca_cible) || 0,
      tjm_cible: parseFloat(o.tjm_cible) || 0,
      jours_cibles: parseFloat(o.jours_cibles) || 0,
    }));

    await supabase
      .from("objectifs")
      .upsert(rows, { onConflict: "annee,mois" });

    setSavingObjectifs(false);
    setObjectifsSaved(true);
  }

  const totalCaCible = objectifs.reduce(
    (sum, o) => sum + (parseFloat(o.ca_cible) || 0),
    0
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parametres</h1>
        <p className="text-muted-foreground">
          Configurez votre espace de travail.
        </p>
      </div>

      {/* Section 1 : Parametres financiers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4" />
            Parametres financiers
          </CardTitle>
          <CardDescription>
            Taux, objectifs et informations de tresorerie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="taux_urssaf">Taux URSSAF</Label>
              <Input
                id="taux_urssaf"
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={finance.taux_urssaf}
                onChange={(e) => updateFinance("taux_urssaf", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {(parseFloat(finance.taux_urssaf) * 100 || 0).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taux_impots">Taux impots</Label>
              <Input
                id="taux_impots"
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={finance.taux_impots}
                onChange={(e) => updateFinance("taux_impots", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {(parseFloat(finance.taux_impots) * 100 || 0).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectif_net_mensuel">
                Objectif net mensuel (EUR)
              </Label>
              <Input
                id="objectif_net_mensuel"
                type="number"
                min="0"
                step="1"
                value={finance.objectif_net_mensuel}
                onChange={(e) =>
                  updateFinance("objectif_net_mensuel", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frais_mensuels_fixes">
                Frais mensuels fixes (EUR)
              </Label>
              <Input
                id="frais_mensuels_fixes"
                type="number"
                min="0"
                step="0.01"
                value={finance.frais_mensuels_fixes}
                onChange={(e) =>
                  updateFinance("frais_mensuels_fixes", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="solde_compte_pro">Solde compte pro (EUR)</Label>
              <Input
                id="solde_compte_pro"
                type="number"
                step="0.01"
                value={finance.solde_compte_pro}
                onChange={(e) =>
                  updateFinance("solde_compte_pro", e.target.value)
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveFinance} disabled={savingFinance}>
              <Save data-icon="inline-start" />
              {savingFinance ? "Enregistrement..." : "Sauvegarder"}
            </Button>
            {financeSaved && (
              <span className="text-sm text-emerald-400">Enregistre !</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2 : Objectifs CA annuels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4" />
            Objectifs CA {year}
          </CardTitle>
          <CardDescription>
            Total CA cible :{" "}
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(totalCaCible)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead>CA cible (EUR)</TableHead>
                <TableHead>TJM cible (EUR)</TableHead>
                <TableHead>Jours cibles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectifs.map((o, i) => (
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
                      value={o.ca_cible}
                      onChange={(e) =>
                        updateObjectif(i, "ca_cible", e.target.value)
                      }
                    />
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
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center gap-3">
            <Button onClick={saveObjectifs} disabled={savingObjectifs}>
              <Save data-icon="inline-start" />
              {savingObjectifs ? "Enregistrement..." : "Sauvegarder tout"}
            </Button>
            {objectifsSaved && (
              <span className="text-sm text-emerald-400">Enregistre !</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
