"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Parametre, TransactionCA } from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  RefreshCw,
  Save,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

function getParam(params: Parametre[], cle: string): string {
  return params.find((p) => p.cle === cle)?.valeur ?? "";
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

interface SoldeInfo {
  solde_euros: number | null;
  iban_trouve: string | null;
  nb_comptes: number;
  erreur: string | null;
}

interface SyncResult {
  transactions: { imported: number; updated: number; skipped: number; total: number };
  factures: { imported: number; updated: number; error?: string | null };
  solde?: SoldeInfo;
}

export default function QontoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({
    qonto_login: "",
    qonto_secret_key: "",
    qonto_iban: "",
  });

  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [recentTx, setRecentTx] = useState<TransactionCA[]>([]);
  const [qontoInvoices, setQontoInvoices] = useState<TransactionCA[]>([]);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [soldeComptePro, setSoldeComptePro] = useState<string | null>(null);
  const [soldeDebug, setSoldeDebug] = useState<SoldeInfo | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [paramsRes, txRes, invoicesRes] = await Promise.all([
      supabase.from("parametres").select("*"),
      supabase
        .from("transactions_ca")
        .select("*")
        .eq("source", "qonto")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("transactions_ca")
        .select("*")
        .eq("source", "qonto_invoice")
        .order("created_at", { ascending: false }),
    ]);

    const params = (paramsRes.data as Parametre[]) ?? [];
    setForm({
      qonto_login: getParam(params, "qonto_login"),
      qonto_secret_key: getParam(params, "qonto_secret_key"),
      qonto_iban: getParam(params, "qonto_iban"),
    });

    const syncDate = getParam(params, "qonto_last_sync");
    setLastSync(syncDate || null);

    const syncResultStr = getParam(params, "qonto_last_sync_result");
    if (syncResultStr) {
      try {
        setLastSyncResult(JSON.parse(syncResultStr));
      } catch {
        setLastSyncResult(null);
      }
    }

    const soldeVal = getParam(params, "solde_compte_pro");
    setSoldeComptePro(soldeVal || null);

    setRecentTx((txRes.data as TransactionCA[]) ?? []);
    setQontoInvoices((invoicesRes.data as TransactionCA[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveCredentials() {
    setSaving(true);
    const supabase = createClient();
    const entries = Object.entries(form) as [string, string][];

    await Promise.all(
      entries.map(([cle, valeur]) =>
        supabase
          .from("parametres")
          .upsert({ cle, valeur, updated_at: new Date().toISOString() })
      )
    );

    setSaving(false);
    toast.success("Identifiants Qonto sauvegardes");
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/qonto/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error("Erreur de synchronisation", {
          description: data.error || "Erreur inconnue",
        });
      } else {
        const tx = data.transactions;
        const fct = data.factures;
        toast.success("Synchronisation terminee", {
          description: `Transactions: ${tx.imported} importees, ${tx.updated} MAJ — Factures: ${fct.imported} importees, ${fct.updated} MAJ`,
        });
        if (data.solde) {
          setSoldeDebug(data.solde);
        }
        fetchData();
      }
    } catch {
      toast.error("Erreur reseau", {
        description: "Impossible de contacter le serveur.",
      });
    }
    setSyncing(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-8 rounded-lg" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/parametres"
          className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Integration Qonto</h1>
          <p className="text-muted-foreground">
            Synchronisez vos transactions et factures automatiquement.
          </p>
        </div>
      </div>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>Identifiants API Qonto</CardTitle>
          <CardDescription>
            Retrouvez vos identifiants dans Qonto &gt; Parametres &gt;
            Integrateurs &gt; API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qonto_login">Login (Organization slug)</Label>
              <Input
                id="qonto_login"
                value={form.qonto_login}
                onChange={(e) => update("qonto_login", e.target.value)}
                placeholder="mon-entreprise-1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qonto_secret_key">Secret Key</Label>
              <Input
                id="qonto_secret_key"
                type="password"
                value={form.qonto_secret_key}
                onChange={(e) => update("qonto_secret_key", e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qonto_iban">IBAN du compte</Label>
            <Input
              id="qonto_iban"
              value={form.qonto_iban}
              onChange={(e) => update("qonto_iban", e.target.value)}
              placeholder="FR76..."
            />
          </div>

          <Button onClick={saveCredentials} disabled={saving}>
            <Save data-icon="inline-start" />
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader>
          <CardTitle>Synchronisation</CardTitle>
          <CardDescription>
            {lastSync ? (
              <>
                Derniere synchronisation :{" "}
                {new Date(lastSync).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            ) : (
              "Aucune synchronisation effectuee."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleSync}
            disabled={
              syncing || !form.qonto_login || !form.qonto_secret_key || !form.qonto_iban
            }
          >
            <RefreshCw
              data-icon="inline-start"
              className={syncing ? "animate-spin" : ""}
            />
            {syncing ? "Synchronisation en cours..." : "Synchroniser avec Qonto"}
          </Button>

          {lastSyncResult && lastSyncResult.transactions && (
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">Transactions</p>
                <p className="text-muted-foreground">
                  {lastSyncResult.transactions.imported} importees, {lastSyncResult.transactions.updated} MAJ, {lastSyncResult.transactions.skipped} ignorees
                </p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">Factures</p>
                {lastSyncResult.factures?.error ? (
                  <p className="text-red-400 text-xs">{lastSyncResult.factures.error}</p>
                ) : (
                  <p className="text-muted-foreground">
                    {lastSyncResult.factures?.imported ?? 0} importees, {lastSyncResult.factures?.updated ?? 0} MAJ
                  </p>
                )}
              </div>
              {soldeComptePro && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium">Solde compte pro</p>
                  <p className="text-muted-foreground">
                    {formatEuro(parseFloat(soldeComptePro))}
                  </p>
                </div>
              )}
            </div>
          )}

          {soldeDebug && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/70">Debug solde Qonto</p>
              <p>Solde : {soldeDebug.solde_euros !== null ? formatEuro(soldeDebug.solde_euros) : "—"}</p>
              <p>IBAN trouvé : {soldeDebug.iban_trouve ?? "—"}</p>
              <p>Nb comptes retournés : {soldeDebug.nb_comptes}</p>
              {soldeDebug.erreur && (
                <p className="text-red-400">Erreur : {soldeDebug.erreur}</p>
              )}
            </div>
          )}

          {!form.qonto_login && !form.qonto_secret_key && (
            <p className="text-xs text-muted-foreground">
              Configurez vos identifiants ci-dessus pour activer la
              synchronisation.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Factures Qonto */}
      {qontoInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Factures Qonto
            </CardTitle>
            <CardDescription>
              {qontoInvoices.length} facture{qontoInvoices.length > 1 ? "s" : ""} importee{qontoInvoices.length > 1 ? "s" : ""} depuis Qonto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(showAllInvoices ? qontoInvoices : qontoInvoices.slice(0, 5)).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.libelle || "—"}</TableCell>
                    <TableCell className="text-right">{formatEuro(inv.montant)}</TableCell>
                    <TableCell>
                      {inv.statut === "paye" ? (
                        <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Paye
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                          En attente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.date_paiement
                        ? new Date(inv.date_paiement).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                        : new Date(inv.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {qontoInvoices.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllInvoices(!showAllInvoices)}
              >
                {showAllInvoices
                  ? "Afficher moins"
                  : `Voir toutes (${qontoInvoices.length})`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Qonto transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            Dernieres transactions Qonto
          </CardTitle>
          <CardDescription>
            Les 10 dernieres transactions importees depuis Qonto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentTx.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <RefreshCw className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Aucune transaction Qonto importee.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Libelle</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date paiement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTx.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">
                      {tx.libelle || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatEuro(tx.montant)}
                    </TableCell>
                    <TableCell>
                      {tx.statut === "paye" ? (
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
                      {tx.date_paiement
                        ? new Date(tx.date_paiement).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
