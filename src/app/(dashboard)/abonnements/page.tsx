"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Abonnement, Provision } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Plus, Trash2, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

const CATEGORIES = [
  "Outils design",
  "Dev & code",
  "Marketing",
  "Compta",
  "Bureau",
  "Assurance",
  "Mutuelle",
  "Logiciel",
  "IA",
  "Ressources design",
  "Divers",
];

const DONUT_COLORS = [
  "rgba(10,207,131,1)",
  "rgba(10,207,131,0.7)",
  "rgba(10,207,131,0.5)",
  "rgba(10,207,131,0.35)",
  "rgba(10,207,131,0.22)",
  "rgba(10,207,131,0.14)",
  "rgba(10,207,131,0.08)",
  "rgba(10,180,220,0.6)",
  "rgba(10,180,220,0.35)",
  "rgba(10,180,220,0.2)",
  "rgba(180,180,180,0.3)",
];

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; value: number; percent: number } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-white mb-0.5">{d.name}</p>
      <p className="text-[#0ACF83]">{formatEuro(d.value)}</p>
      <p className="text-[#767676]">{(d.percent * 100).toFixed(0)}%</p>
    </div>
  );
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

function coutMensuel(abo: Abonnement): number {
  if (!abo.actif) return 0;
  return abo.periodicite === "annuel" ? abo.montant / 12 : abo.montant;
}

export default function AbonnementsPage() {
  const [loading, setLoading] = useState(true);
  const [abonnements, setAbonnements] = useState<Abonnement[]>([]);
  const [provisions, setProvisions] = useState<Provision[]>([]);

  const supabase = createClient();

  const today = new Date().toISOString().split("T")[0];

  const syncFraisMensuels = useCallback(
    async (abos: Abonnement[]) => {
      const total = abos.reduce((sum, a) => sum + coutMensuel(a), 0);
      await supabase.from("parametres").upsert({
        cle: "frais_mensuels_fixes",
        valeur: String(Math.round(total * 100) / 100),
        updated_at: new Date().toISOString(),
      });
    },
    [supabase]
  );

  const fetchData = useCallback(async () => {
    const [aboRes, provRes] = await Promise.all([
      supabase
        .from("abonnements")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("provisions")
        .select("*")
        .order("date_prevue", { ascending: true }),
    ]);
    setAbonnements((aboRes.data as Abonnement[]) ?? []);
    setProvisions((provRes.data as Provision[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function addAbonnement() {
    const { data, error } = await supabase
      .from("abonnements")
      .insert({
        nom: "",
        montant: 0,
        periodicite: "mensuel",
        categorie: "Divers",
        actif: true,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de l'ajout");
      return;
    }

    const updated = [...abonnements, data as Abonnement];
    setAbonnements(updated);
  }

  async function updateField(id: string, field: string, value: string | number | boolean) {
    const { error } = await supabase
      .from("abonnements")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast.error("Erreur de sauvegarde");
      return;
    }

    const updated = abonnements.map((a) =>
      a.id === id ? { ...a, [field]: value } : a
    );
    setAbonnements(updated);
    await syncFraisMensuels(updated);
  }

  async function deleteAbonnement(id: string) {
    const { error } = await supabase.from("abonnements").delete().eq("id", id);
    if (error) {
      toast.error("Erreur de suppression");
      return;
    }
    const updated = abonnements.filter((a) => a.id !== id);
    setAbonnements(updated);
    await syncFraisMensuels(updated);
  }

  // ═══════ Provisions ═══════

  async function addProvision() {
    const { data, error } = await supabase
      .from("provisions")
      .insert({
        libelle: "",
        montant: 0,
        type: "prelevement",
        date_prevue: null,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de l'ajout");
      return;
    }
    setProvisions([...provisions, data as Provision]);
  }

  async function updateProvisionField(id: string, field: string, value: string | number) {
    const { error } = await supabase
      .from("provisions")
      .update({ [field]: value || null })
      .eq("id", id);

    if (error) {
      toast.error("Erreur de sauvegarde");
      return;
    }

    setProvisions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value || null } : p))
    );
  }

  async function deleteProvision(id: string) {
    const { error } = await supabase.from("provisions").delete().eq("id", id);
    if (error) {
      toast.error("Erreur de suppression");
      return;
    }
    setProvisions((prev) => prev.filter((p) => p.id !== id));
  }

  const totalProvisions = provisions.reduce((sum, p) => sum + p.montant, 0);

  const totalMensuel = abonnements.reduce((sum, a) => sum + coutMensuel(a), 0);

  // Donut par categorie
  const donutData = Object.entries(
    abonnements.reduce<Record<string, number>>((acc, a) => {
      if (!a.actif) return acc;
      const cat = a.categorie || "Divers";
      acc[cat] = (acc[cat] || 0) + coutMensuel(a);
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, percent: totalMensuel > 0 ? value / totalMensuel : 0 }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Tresorerie</h1>
        <p className="text-sm text-muted-foreground">
          Frais mensuels fixes : <span className="font-medium text-foreground">{formatEuro(totalMensuel)}</span>
        </p>
      </div>

      {/* Abonnements + Donut */}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Tableau */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="size-4" />
                  Abonnements
                </CardTitle>
                <CardDescription>
                  {abonnements.length} abonnement{abonnements.length > 1 ? "s" : ""}
                </CardDescription>
              </div>
              <Button size="sm" onClick={addAbonnement}>
                <Plus data-icon="inline-start" />
                Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Periodicite</TableHead>
                  <TableHead className="text-right">Cout mensuel</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abonnements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Aucun abonnement. Cliquez sur Ajouter pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  abonnements.map((abo) => (
                    <TableRow key={abo.id}>
                      <TableCell>
                        <Input
                          defaultValue={abo.nom}
                          placeholder="Nom de l'abonnement"
                          className="h-8 bg-transparent border-transparent hover:border-border focus:border-border"
                          onBlur={(e) => {
                            if (e.target.value !== abo.nom) {
                              updateField(abo.id, "nom", e.target.value);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={abo.montant}
                          className="h-8 w-24 text-right bg-transparent border-transparent hover:border-border focus:border-border ml-auto"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (val !== abo.montant) {
                              updateField(abo.id, "montant", val);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={abo.periodicite}
                          onValueChange={(v) => v && updateField(abo.id, "periodicite", v)}
                        >
                          <SelectTrigger className="h-8 w-28 bg-transparent border-transparent hover:border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mensuel">Mensuel</SelectItem>
                            <SelectItem value="annuel">Annuel</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {abo.actif ? formatEuro(coutMensuel(abo)) : "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={abo.categorie || "Divers"}
                          onValueChange={(v) => v && updateField(abo.id, "categorie", v)}
                        >
                          <SelectTrigger className="h-8 w-32 bg-transparent border-transparent hover:border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={abo.actif}
                          onCheckedChange={(v: boolean) => updateField(abo.id, "actif", v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                          onClick={() => deleteAbonnement(abo.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Donut repartition par categorie */}
        {donutData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Repartition</CardTitle>
              <CardDescription>Par categorie (mensuel lisse)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {donutData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium">{formatEuro(d.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Provisions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Paiements a venir
              </CardTitle>
              <CardDescription>
                Provisions et depenses prevues
              </CardDescription>
            </div>
            <span className="text-xl font-bold text-red-400">
              {formatEuro(totalProvisions)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libelle</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Date prevue</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {provisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucune provision. Cliquez sur Ajouter pour commencer.
                  </TableCell>
                </TableRow>
              ) : (
                provisions.map((prov) => {
                  const isPast = prov.date_prevue != null && prov.date_prevue < today;
                  return (
                    <TableRow key={prov.id} className={isPast ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={prov.libelle}
                            placeholder="Libelle"
                            className="h-8 bg-transparent border-transparent hover:border-border focus:border-border"
                            style={isPast ? { color: "#767676" } : undefined}
                            onBlur={(e) => {
                              if (e.target.value !== prov.libelle) {
                                updateProvisionField(prov.id, "libelle", e.target.value);
                              }
                            }}
                          />
                          {isPast && (
                            <Badge variant="outline" className="shrink-0 text-[#767676] border-[#767676]/30">
                              Passe
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={prov.montant}
                          className="h-8 w-24 text-right bg-transparent border-transparent hover:border-border focus:border-border ml-auto text-red-400"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (val !== prov.montant) {
                              updateProvisionField(prov.id, "montant", val);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          defaultValue={prov.date_prevue ?? ""}
                          className="h-8 w-36 bg-transparent border-transparent hover:border-border focus:border-border"
                          style={isPast ? { color: "#767676" } : undefined}
                          onBlur={(e) => {
                            if (e.target.value !== (prov.date_prevue ?? "")) {
                              updateProvisionField(prov.id, "date_prevue", e.target.value);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={prov.type}
                          onValueChange={(v) => v && updateProvisionField(prov.id, "type", v)}
                        >
                          <SelectTrigger className="h-8 w-32 bg-transparent border-transparent hover:border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="prelevement">Prelevement</SelectItem>
                            <SelectItem value="depense">Depense</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                          onClick={() => deleteProvision(prov.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" onClick={addProvision}>
            <Plus data-icon="inline-start" />
            Ajouter une provision
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
