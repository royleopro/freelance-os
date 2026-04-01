"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  Etiquette,
  ProjetType,
  SessionHeureAvecProjet,
} from "@/lib/types";
import { etiquetteConfig, getEtiquette } from "@/lib/etiquettes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Clock, AlertCircle, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const typeConfig: Record<ProjetType, { label: string; color: string }> = {
  client: { label: "Client", color: "hsl(217 70% 55%)" },
  interne: { label: "Interne", color: "hsl(270 60% 60%)" },
  prospect: { label: "Prospect", color: "hsl(38 80% 55%)" },
};


function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("fr-FR", opts)} — ${sunday.toLocaleDateString("fr-FR", opts)}`;
}

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

interface WeekGroup {
  weekKey: string;
  label: string;
  sessions: SessionHeureAvecProjet[];
  total: number;
}

function groupByWeek(sessions: SessionHeureAvecProjet[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();

  for (const s of sessions) {
    const monday = getMonday(new Date(s.date));
    const key = monday.toISOString().split("T")[0];
    if (!map.has(key)) {
      map.set(key, {
        weekKey: key,
        label: formatWeekLabel(monday),
        sessions: [],
        total: 0,
      });
    }
    const group = map.get(key)!;
    group.sessions.push(s);
    group.total += s.duree;
  }

  return Array.from(map.values()).sort((a, b) =>
    b.weekKey.localeCompare(a.weekKey)
  );
}

export default function HeuresPage() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [sessions, setSessions] = useState<SessionHeureAvecProjet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    projet_id: "",
    date: todayStr(),
    duree: "",
    etiquette: "design ui" as Etiquette,
    facturable: true,
  });

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const [projetsRes, sessionsRes] = await Promise.all([
        supabase
          .from("projets")
          .select("*")
          .order("nom", { ascending: true }),
        supabase
          .from("sessions_heures")
          .select("*, projets(nom, type)")
          .order("date", { ascending: false })
          .limit(200),
      ]);
      const firstError = projetsRes.error || sessionsRes.error;
      if (firstError) {
        setError("Impossible de charger les sessions.");
        toast.error("Erreur de chargement", { description: firstError.message });
        return;
      }
      setProjets((projetsRes.data as Projet[]) ?? []);
      setSessions((sessionsRes.data as SessionHeureAvecProjet[]) ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger les sessions.");
      toast.error("Erreur reseau", { description: "Verifiez votre connexion internet." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projet_id || !form.duree) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("sessions_heures").insert({
      projet_id: form.projet_id,
      date: form.date,
      duree: parseFloat(form.duree),
      etiquette: form.etiquette,
      facturable: form.facturable,
    });
    setSaving(false);

    if (error) {
      toast.error("Erreur", { description: "Impossible d'ajouter la session." });
    } else {
      toast.success("Session ajoutee");
      setForm((prev) => ({ ...prev, duree: "", date: todayStr() }));
      fetchData();
    }
  }

  async function handleDeleteSession(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("sessions_heures").delete().eq("id", id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de supprimer la session." });
    } else {
      toast.success("Session supprimee");
      fetchData();
    }
  }

  const weeks = groupByWeek(sessions);

  // --- Chart data: heures par type de projet ---
  const heuresParType = useMemo(() => {
    const map: Record<string, number> = { client: 0, interne: 0, prospect: 0 };
    for (const s of sessions) {
      const type = (s.projets?.type as ProjetType) ?? "client";
      map[type] = (map[type] ?? 0) + s.duree;
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: typeConfig[key as ProjetType]?.label ?? key,
        value: Math.round(value * 10) / 10,
        color: typeConfig[key as ProjetType]?.color ?? "hsl(0 0% 50%)",
      }));
  }, [sessions]);

  // --- Chart data: heures par etiquette ---
  const heuresParEtiquette = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      map[s.etiquette] = (map[s.etiquette] ?? 0) + s.duree;
    }
    return Object.entries(map)
      .map(([key, value]) => ({
        name: getEtiquette(key).label,
        etiquette: key,
        heures: Math.round(value * 10) / 10,
      }))
      .sort((a, b) => b.heures - a.heures);
  }, [sessions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Heures</h1>
        <p className="text-muted-foreground">
          Suivez votre temps de travail.
        </p>
      </div>

      {/* Formulaire de saisie rapide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            Saisie rapide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Projet *</Label>
                <Select
                  value={form.projet_id}
                  onValueChange={(v) => {
                    if (v) update("projet_id", v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    {projets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duree">Duree (h) *</Label>
                <Input
                  id="duree"
                  type="number"
                  min="0.25"
                  step="0.25"
                  placeholder="1.5"
                  value={form.duree}
                  onChange={(e) => update("duree", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Etiquette</Label>
                <Select
                  value={form.etiquette}
                  onValueChange={(v) => {
                    if (v) update("etiquette", v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(etiquetteConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2 pb-1.5">
                  <Checkbox
                    checked={form.facturable}
                    onCheckedChange={(checked) =>
                      update("facturable", checked === true)
                    }
                  />
                  <Label className="cursor-pointer">Facturable</Label>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving || !form.projet_id || !form.duree}
            >
              {saving ? "Enregistrement..." : "Ajouter"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Graphiques de repartition */}
      {!loading && !error && sessions.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Repartition par type de projet */}
          <Card>
            <CardHeader>
              <CardTitle>Heures par type de projet</CardTitle>
              <CardDescription>
                Repartition client / interne / prospect
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={heuresParType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={0}
                    label={({ name, value }) => `${name} ${value}h`}
                  >
                    {heuresParType.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-muted-foreground">{d.value}h</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Repartition par etiquette */}
          <Card>
            <CardHeader>
              <CardTitle>Heures par etiquette</CardTitle>
              <CardDescription>
                Repartition par type d&apos;activite
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={heuresParEtiquette}
                  layout="vertical"
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(0 0% 20%)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    unit="h"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-muted-foreground">{d.heures}h</p>
                        </div>
                      );
                    }}
                    cursor={{ fill: "hsl(0 0% 15%)" }}
                  />
                  <Bar dataKey="heures" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {heuresParEtiquette.map((entry) => (
                      <Cell
                        key={entry.etiquette}
                        fill={getEtiquette(entry.etiquette).color}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vue par semaine */}
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
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
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Clock className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Aucune session enregistree</p>
            <p className="text-sm text-muted-foreground">
              Utilisez le formulaire ci-dessus pour loguer votre premiere session.
            </p>
          </div>
        </div>
      ) : (
        weeks.map((week) => (
          <Card key={week.weekKey}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4" />
                {week.label}
              </CardTitle>
              <CardDescription>
                Total : {week.total.toFixed(1)}h
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jour</TableHead>
                    <TableHead>Projet</TableHead>
                    <TableHead>Etiquette</TableHead>
                    <TableHead className="text-right">Duree</TableHead>
                    <TableHead className="text-center">Facturable</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {week.sessions.map((s) => {
                    const cfg = getEtiquette(s.etiquette);
                    return (
                      <TableRow key={s.id} className="group">
                        <TableCell className="text-muted-foreground">
                          {formatDayLabel(s.date)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.projets?.nom ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cfg.className}>
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.duree}h
                        </TableCell>
                        <TableCell className="text-center">
                          {s.facturable ? (
                            <span className="text-emerald-400">Oui</span>
                          ) : (
                            <span className="text-muted-foreground">Non</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer">
                              <Trash2 className="size-3.5" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irreversible. La session de {s.duree}h sera definitivement supprimee.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteSession(s.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
