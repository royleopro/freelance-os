"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Parametre, TransactionCA } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, AlertCircle, Landmark, Receipt } from "lucide-react";
import { toast } from "sonner";

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

function getParam(params: Parametre[], cle: string): number | null {
  const p = params.find((p) => p.cle === cle);
  if (!p) return null;
  const v = parseFloat(p.valeur);
  return isNaN(v) ? null : v;
}

export default function SimulateurPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [transactions, setTransactions] = useState<TransactionCA[]>([]);
  const [montantBrut, setMontantBrut] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const [paramsRes, txRes] = await Promise.all([
        supabase.from("parametres").select("*"),
        supabase
          .from("transactions_ca")
          .select("*")
          .eq("statut", "paye")
          .order("date", { ascending: false }),
      ]);

      if (paramsRes.error || txRes.error) {
        setError("Impossible de charger les données.");
        toast.error("Erreur de chargement");
        return;
      }

      setParametres((paramsRes.data as Parametre[]) ?? []);
      setTransactions((txRes.data as TransactionCA[]) ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tauxUrssaf = getParam(parametres, "taux_urssaf");
  const tauxImpots = getParam(parametres, "taux_impots");
  const hasTaux = tauxUrssaf !== null && tauxImpots !== null;

  // ─── Simulateur ─────────────────────────────────────
  const simulation = useMemo(() => {
    const brut = parseFloat(montantBrut) || 0;
    if (brut <= 0 || !hasTaux) return null;
    const urssaf = brut * tauxUrssaf;
    const impots = brut * tauxImpots;
    const net = brut - urssaf - impots;
    return {
      brut,
      urssaf,
      impots,
      net,
      pctNet: (net / brut) * 100,
      pctUrssaf: (urssaf / brut) * 100,
      pctImpots: (impots / brut) * 100,
    };
  }, [montantBrut, hasTaux, tauxUrssaf, tauxImpots]);

  // ─── URSSAF par mois ────────────────────────────────
  const urssafParMois = useMemo(() => {
    if (!hasTaux) return [];
    const now = new Date();
    const mois: { annee: number; mois: number; ca: number; urssaf: number }[] =
      [];

    // 3 derniers mois + mois en cours = 4 mois
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const annee = d.getFullYear();
      const moisIdx = d.getMonth();
      const debut = `${annee}-${String(moisIdx + 1).padStart(2, "0")}-01`;
      const fin = new Date(annee, moisIdx + 1, 0);
      const finStr = `${annee}-${String(moisIdx + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;

      const ca = transactions
        .filter((t) => {
          const dp = t.date_paiement ?? t.date;
          return dp >= debut && dp <= finStr;
        })
        .reduce((sum, t) => sum + Number(t.montant), 0);

      mois.push({
        annee,
        mois: moisIdx,
        ca,
        urssaf: ca * tauxUrssaf,
      });
    }
    return mois;
  }, [transactions, hasTaux, tauxUrssaf]);

  const moisEnCours = urssafParMois[urssafParMois.length - 1];
  const historique = urssafParMois.slice(0, -1).reverse();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!hasTaux) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Simulateur</h1>
          <p className="text-[#767676]">
            Calcule tes charges URSSAF et impôts.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="size-8 text-[#767676]" />
            <p className="text-sm text-[#767676]">
              Les taux URSSAF et impôts ne sont pas configurés.
            </p>
            <Link
              href="/parametres"
              className="text-sm font-medium text-brand-accent hover:underline"
            >
              Configurer dans Paramètres
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading">Simulateur</h1>
        <p className="text-[#767676]">
          Calcule tes charges et ton net à partir d&apos;un montant brut.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ═══ Simulateur de revenu net ═══ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="size-4" />
              Simulateur revenu net
            </CardTitle>
            <CardDescription>
              URSSAF {(tauxUrssaf * 100).toFixed(1)}% • Impôts{" "}
              {(tauxImpots * 100).toFixed(1)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-[#767676] mb-1.5 block">
                Montant brut (€)
              </label>
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="Ex: 5000"
                value={montantBrut}
                onChange={(e) => setMontantBrut(e.target.value)}
                className="text-lg"
                autoFocus
              />
            </div>

            {simulation ? (
              <>
                {/* Barre stackée */}
                <div className="space-y-2">
                  <div className="h-3 w-full rounded-full bg-[#0F0F0F] overflow-hidden flex">
                    <div
                      className="h-full"
                      style={{
                        width: `${simulation.pctNet}%`,
                        backgroundColor: "#0ACF83",
                      }}
                    />
                    <div
                      className="h-full"
                      style={{
                        width: `${simulation.pctUrssaf}%`,
                        backgroundColor: "#EF9F27",
                      }}
                    />
                    <div
                      className="h-full"
                      style={{
                        width: `${simulation.pctImpots}%`,
                        backgroundColor: "#EF4444",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: "#0ACF83" }}
                      />
                      <span className="text-[#767676]">Net</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: "#EF9F27" }}
                      />
                      <span className="text-[#767676]">URSSAF</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: "#EF4444" }}
                      />
                      <span className="text-[#767676]">Impôts</span>
                    </div>
                  </div>
                </div>

                {/* Détail */}
                <div className="space-y-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#767676]">Brut</span>
                    <span className="text-sm font-medium text-white">
                      {fmt(simulation.brut)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#767676]">
                      URSSAF ({(tauxUrssaf * 100).toFixed(1)}%)
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "#EF9F27" }}
                    >
                      −{fmt(simulation.urssaf)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#767676]">
                      Impôts ({(tauxImpots * 100).toFixed(1)}%)
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "#EF4444" }}
                    >
                      −{fmt(simulation.impots)}
                    </span>
                  </div>
                  <div className="h-px bg-[rgba(255,255,255,0.06)] my-1" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Net</span>
                    <span
                      className="text-lg font-bold"
                      style={{ color: "#0ACF83" }}
                    >
                      {fmt(simulation.net)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#767676] text-center py-8">
                Entre un montant brut pour voir la répartition
              </p>
            )}
          </CardContent>
        </Card>

        {/* ═══ URSSAF à déclarer ═══ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-4" />
              URSSAF à déclarer
            </CardTitle>
            <CardDescription>
              Basé sur les transactions payées du mois
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mois en cours */}
            {moisEnCours && (
              <div className="rounded-lg border border-[rgba(10,207,131,0.15)] bg-[rgba(10,207,131,0.04)] p-4">
                <p className="text-xs text-[#767676] mb-1">
                  {MOIS_LABELS[moisEnCours.mois]} {moisEnCours.annee} (en cours)
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "#EF9F27" }}
                >
                  {fmt(moisEnCours.urssaf)}
                </p>
                <p className="text-xs text-[#767676] mt-1">
                  Basé sur {fmt(moisEnCours.ca)} de CA encaissé
                </p>
              </div>
            )}

            {/* Historique 3 derniers mois */}
            <div>
              <p className="text-xs font-medium text-[#767676] mb-2">
                3 derniers mois
              </p>
              <div className="space-y-1">
                {historique.map((m) => (
                  <div
                    key={`${m.annee}-${m.mois}`}
                    className="flex items-center justify-between rounded-md border border-[rgba(255,255,255,0.04)] bg-[#0F0F0F] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-white">
                        {MOIS_LABELS[m.mois]} {m.annee}
                      </p>
                      <p className="text-[11px] text-[#767676]">
                        {fmt(m.ca)} de CA
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Receipt className="size-3.5 text-[#767676]" />
                      <span
                        className="text-sm font-medium"
                        style={{ color: "#EF9F27" }}
                      >
                        {fmt(m.urssaf)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
