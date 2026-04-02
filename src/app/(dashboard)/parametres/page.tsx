"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Parametre } from "@/lib/types";
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
import { Save, Settings, AlertCircle, Upload, RefreshCw, Download, HardDrive } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface FinanceForm {
  taux_urssaf: string;
  taux_impots: string;
  objectif_net_mensuel: string;
  frais_mensuels_fixes: string;
  solde_compte_pro: string;
}

function getParam(params: Parametre[], cle: string, fallback: string): string {
  return params.find((p) => p.cle === cle)?.valeur ?? fallback;
}

const BACKUP_LS_KEY = "freelance-os-last-backup";

export default function ParametresPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingFinance, setSavingFinance] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const [finance, setFinance] = useState<FinanceForm>({
    taux_urssaf: "0.256",
    taux_impots: "0.02",
    objectif_net_mensuel: "2000",
    frais_mensuels_fixes: "131.67",
    solde_compte_pro: "0",
  });

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("parametres")
        .select("*");

      if (fetchError) {
        setError("Impossible de charger les parametres.");
        toast.error("Erreur de chargement", { description: fetchError.message });
        return;
      }

      const params = (data as Parametre[]) ?? [];
      setFinance({
        taux_urssaf: getParam(params, "taux_urssaf", "0.256"),
        taux_impots: getParam(params, "taux_impots", "0.02"),
        objectif_net_mensuel: getParam(params, "objectif_net_mensuel", "2000"),
        frais_mensuels_fixes: getParam(params, "frais_mensuels_fixes", "131.67"),
        solde_compte_pro: getParam(params, "solde_compte_pro", "0"),
      });
      setError(null);
    } catch {
      setError("Impossible de charger les parametres.");
      toast.error("Erreur reseau", { description: "Verifiez votre connexion internet." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    setLastBackup(localStorage.getItem(BACKUP_LS_KEY));
  }, [fetchData]);

  async function handleDownloadBackup() {
    setDownloading(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `freelance-os-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      localStorage.setItem(BACKUP_LS_KEY, now);
      setLastBackup(now);
      toast.success("Sauvegarde telechargee");
    } catch {
      toast.error("Erreur", { description: "Impossible de telecharger la sauvegarde." });
    } finally {
      setDownloading(false);
    }
  }

  function updateFinance(field: keyof FinanceForm, value: string) {
    setFinance((prev) => ({ ...prev, [field]: value }));
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
    toast.success("Parametres financiers sauvegardes");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parametres</h1>
          <p className="text-muted-foreground">
            Configurez votre espace de travail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/parametres/qonto" />}>
            <RefreshCw data-icon="inline-start" />
            Qonto
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/parametres/import" />}>
            <Upload data-icon="inline-start" />
            Import CSV
          </Button>
        </div>
      </div>

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

          <Button onClick={saveFinance} disabled={savingFinance}>
            <Save data-icon="inline-start" />
            {savingFinance ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </CardContent>
      </Card>

      {/* Section Sauvegardes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-4" />
            Sauvegardes
          </CardTitle>
          <CardDescription>
            Exportez toutes vos donnees en JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={handleDownloadBackup} disabled={downloading}>
              <Download data-icon="inline-start" />
              {downloading ? "Telechargement..." : "Telecharger une sauvegarde maintenant"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {lastBackup
              ? `Derniere sauvegarde : ${new Date(lastBackup).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : "Aucune sauvegarde effectuee."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
