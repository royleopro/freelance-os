"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Abonnement, Provision, TransactionCA, Parametre } from "@/lib/types";
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
import { CreditCard, Plus, Trash2, AlertTriangle, TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
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

interface ProjectionPoint {
  label: string;
  soldeDebut: number;
  caAttendu: number;
  frais: number;
  provisionsMonth: number;
  urssaf: number;
  salaire: number;
  soldeFin: number;
}

function ProjectionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ProjectionPoint }[];
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-3 py-2.5 text-sm shadow-md min-w-[180px]">
      <p className="font-medium text-white mb-1.5">{d.label}</p>
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-[#767676]">Solde debut</span>
          <span className="text-white">{formatEuroCompact(d.soldeDebut)}</span>
        </div>
        {d.caAttendu > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[#767676]">CA attendu</span>
            <span className="text-[#0ACF83]">+{formatEuroCompact(d.caAttendu)}</span>
          </div>
        )}
        {d.frais > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[#767676]">Frais mensuels</span>
            <span className="text-[#EF4444]">-{formatEuroCompact(d.frais)}</span>
          </div>
        )}
        {d.provisionsMonth > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[#767676]">Provisions</span>
            <span className="text-orange-400">-{formatEuroCompact(d.provisionsMonth)}</span>
          </div>
        )}
        {d.urssaf > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[#767676]">URSSAF</span>
            <span className="text-[#EF4444]">-{formatEuroCompact(d.urssaf)}</span>
          </div>
        )}
        {d.salaire > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[#767676]">Salaire simule</span>
            <span className="text-[#EF4444]">-{formatEuroCompact(d.salaire)}</span>
          </div>
        )}
        <div className="border-t border-[rgba(255,255,255,0.06)] mt-1.5 pt-1.5 flex justify-between gap-4">
          <span className="text-[#767676] font-medium">Solde fin</span>
          <span className={`font-bold ${d.soldeFin >= 0 ? "text-[#0ACF83]" : "text-[#EF4444]"}`}>
            {formatEuroCompact(d.soldeFin)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatEuroCompact(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
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
  const [transactions, setTransactions] = useState<TransactionCA[]>([]);
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [salaireMensuel, setSalaireMensuel] = useState<string>("");
  const [inclureCA, setInclureCA] = useState(true);

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
    const [aboRes, provRes, txRes, paramRes] = await Promise.all([
      supabase
        .from("abonnements")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("provisions")
        .select("*")
        .order("date_prevue", { ascending: true }),
      supabase
        .from("transactions_ca")
        .select("*"),
      supabase.from("parametres").select("*"),
    ]);
    setAbonnements((aboRes.data as Abonnement[]) ?? []);
    setProvisions((provRes.data as Provision[]) ?? []);
    setTransactions((txRes.data as TransactionCA[]) ?? []);
    setParametres((paramRes.data as Parametre[]) ?? []);
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

  // ═══════ Projection de trésorerie ═══════

  const getParam = useCallback(
    (cle: string): string => {
      const p = parametres.find((p) => p.cle === cle);
      return p?.valeur ?? "0";
    },
    [parametres]
  );

  const MOIS_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

  const projectionData = useMemo(() => {
    const soldeDepart = parseFloat(getParam("solde_compte_pro")) || 0;
    const fraisMensuels = parseFloat(getParam("frais_mensuels_fixes")) || 0;
    const tauxUrssaf = parseFloat(getParam("taux_urssaf")) || 0.256;
    const salaire = parseFloat(salaireMensuel) || 0;

    const now = new Date();
    const months: {
      label: string;
      soldeDebut: number;
      caAttendu: number;
      frais: number;
      provisionsMonth: number;
      urssaf: number;
      salaire: number;
      soldeFin: number;
    }[] = [];

    let soldeCourant = soldeDepart;

    for (let i = 0; i < 12; i++) {
      const moisDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const moisNum = moisDate.getMonth();
      const annee = moisDate.getFullYear();
      const label = MOIS_LABELS[moisNum];

      const soldeDebut = soldeCourant;

      // CA attendu : transactions avec date_paiement (ou date en fallback) dans ce mois
      // Si toggle actif : inclut signé + en_attente + payé. Sinon : uniquement payé.
      const statutsInclus = inclureCA
        ? ["signe", "en_attente", "paye"]
        : ["paye"];
      const caAttendu = transactions
        .filter((tx) => {
          if (!statutsInclus.includes(tx.statut)) return false;
          const dp = tx.date_paiement ?? tx.date;
          if (!dp) return false;
          const d = new Date(dp);
          return d.getMonth() === moisNum && d.getFullYear() === annee;
        })
        .reduce((sum, tx) => sum + tx.montant, 0);

      // Provisions du mois
      const provisionsMonth = provisions
        .filter((p) => {
          if (!p.date_prevue) return false;
          const d = new Date(p.date_prevue);
          return d.getMonth() === moisNum && d.getFullYear() === annee;
        })
        .reduce((sum, p) => sum + p.montant, 0);

      // URSSAF = CA du mois × taux
      const urssaf = caAttendu * tauxUrssaf;

      const soldeFin = soldeDebut + caAttendu - fraisMensuels - provisionsMonth - urssaf - salaire;

      months.push({
        label,
        soldeDebut,
        caAttendu,
        frais: fraisMensuels,
        provisionsMonth,
        urssaf,
        salaire,
        soldeFin,
      });

      soldeCourant = soldeFin;
    }

    return months;
  }, [transactions, provisions, parametres, salaireMensuel, inclureCA, getParam]);

  // Calcul du point de split pour le gradient (% de la hauteur où se trouve y=0)
  const gradientOffset = useMemo(() => {
    const values = projectionData.map((d) => d.soldeFin);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [projectionData]);

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

      {/* Projection de trésorerie */}
      <Card className="bg-[#0F0F0F] border-[rgba(255,255,255,0.06)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4" />
                Projection de tresorerie
              </CardTitle>
              <CardDescription>
                Evolution estimee sur 12 mois
              </CardDescription>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div>
              <label className="text-xs text-[#767676] block mb-1.5">
                Salaire mensuel simule
              </label>
              <div className="relative w-48">
                <Input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="0"
                  value={salaireMensuel}
                  onChange={(e) => setSalaireMensuel(e.target.value)}
                  className="h-9 pr-8 bg-[#0A0A0A] border-[rgba(255,255,255,0.06)] focus:border-[#0ACF83]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#767676]">
                  €
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Switch
                checked={inclureCA}
                onCheckedChange={(v: boolean) => setInclureCA(v)}
              />
              <label className="text-xs text-[#767676]">
                Inclure CA signe / en attente
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={projectionData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="projFillGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ACF83" stopOpacity={0.2} />
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#0ACF83" stopOpacity={0.02} />
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#EF4444" stopOpacity={0.02} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="projStrokeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#0ACF83" />
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#EF4444" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#767676", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#767676", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => {
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return `${v}`;
                }}
              />
              <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="6 4" strokeOpacity={0.4} />
              <Tooltip content={<ProjectionTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
              <Area
                type="monotone"
                dataKey="soldeFin"
                stroke="url(#projStrokeGradient)"
                strokeWidth={2}
                fill="url(#projFillGradient)"
                dot={(props) => {
                  const { cx, cy, payload, index } = props as { cx?: number; cy?: number; payload?: { soldeFin: number }; index?: number };
                  if (cx == null || cy == null) return <></>;
                  const color = (payload?.soldeFin ?? 0) >= 0 ? "#0ACF83" : "#EF4444";
                  return (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={color}
                      stroke="#0A0A0A"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={(props) => {
                  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { soldeFin: number } };
                  if (cx == null || cy == null) return <></>;
                  const color = (payload?.soldeFin ?? 0) >= 0 ? "#0ACF83" : "#EF4444";
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={color}
                      stroke="#0A0A0A"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
