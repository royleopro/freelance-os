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
import { syncSessionToNotion } from "@/lib/sync-notion";
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
import { Plus, Clock, AlertCircle, Trash2, CheckSquare, X } from "lucide-react";
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

type PeriodeFilter = "mois_en_cours" | "mois_precedent" | "annee_en_cours" | "tout";
type FacturableFilter = "tous" | "facturable" | "non_facturable";

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

const SESSIONS_PAGE_SIZE = 200;

export default function HeuresPage() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [sessions, setSessions] = useState<SessionHeureAvecProjet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [filterProjet, setFilterProjet] = useState<string>("tous");
  const [filterEtiquette, setFilterEtiquette] = useState<string>("tous");
  const [filterFacturable, setFilterFacturable] = useState<FacturableFilter>("tous");
  const [filterPeriode, setFilterPeriode] = useState<PeriodeFilter>("tout");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

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
          .range(0, SESSIONS_PAGE_SIZE - 1),
      ]);
      const firstError = projetsRes.error || sessionsRes.error;
      if (firstError) {
        setError("Impossible de charger les sessions.");
        toast.error("Erreur de chargement", { description: firstError.message });
        return;
      }
      setProjets((projetsRes.data as Projet[]) ?? []);
      const data = (sessionsRes.data as SessionHeureAvecProjet[]) ?? [];
      setSessions(data);
      setHasMore(data.length === SESSIONS_PAGE_SIZE);
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

  async function loadMore() {
    setLoadingMore(true);
    const supabase = createClient();
    const from = sessions.length;
    const { data, error } = await supabase
      .from("sessions_heures")
      .select("*, projets(nom, type)")
      .order("date", { ascending: false })
      .range(from, from + SESSIONS_PAGE_SIZE - 1);
    if (error) {
      toast.error("Erreur", { description: "Impossible de charger plus de sessions." });
    } else {
      const newData = (data as SessionHeureAvecProjet[]) ?? [];
      setSessions((prev) => [...prev, ...newData]);
      setHasMore(newData.length === SESSIONS_PAGE_SIZE);
    }
    setLoadingMore(false);
  }

  // --- Filtered sessions ---
  const filteredSessions = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return sessions.filter((s) => {
      // Projet filter
      if (filterProjet !== "tous" && s.projet_id !== filterProjet) return false;

      // Etiquette filter
      if (filterEtiquette !== "tous" && s.etiquette !== filterEtiquette) return false;

      // Facturable filter
      if (filterFacturable === "facturable" && !s.facturable) return false;
      if (filterFacturable === "non_facturable" && s.facturable) return false;

      // Periode filter
      if (filterPeriode !== "tout") {
        const d = new Date(s.date);
        if (filterPeriode === "mois_en_cours") {
          if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return false;
        } else if (filterPeriode === "mois_precedent") {
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          if (d.getMonth() !== prevMonth || d.getFullYear() !== prevYear) return false;
        } else if (filterPeriode === "annee_en_cours") {
          if (d.getFullYear() !== currentYear) return false;
        }
      }

      return true;
    });
  }, [sessions, filterProjet, filterEtiquette, filterFacturable, filterPeriode]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterProjet, filterEtiquette, filterFacturable, filterPeriode]);

  // --- Unique etiquettes from sessions ---
  const uniqueEtiquettes = useMemo(() => {
    const set = new Set(sessions.map((s) => s.etiquette));
    return Array.from(set).sort();
  }, [sessions]);

  // --- Unique projets from sessions ---
  const uniqueProjets = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      if (s.projets?.nom && !map.has(s.projet_id)) {
        map.set(s.projet_id, s.projets.nom);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions]);

  const filteredIds = useMemo(
    () => new Set(filteredSessions.map((s) => s.id)),
    [filteredSessions]
  );

  const allVisibleSelected =
    filteredSessions.length > 0 &&
    filteredSessions.every((s) => selectedIds.has(s.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map((s) => s.id)));
    }
  }

  async function bulkSetFacturable(facturable: boolean) {
    const ids = Array.from(selectedIds).filter((id) => filteredIds.has(id));
    if (ids.length === 0) return;

    setBulkUpdating(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("sessions_heures")
      .update({ facturable })
      .in("id", ids);

    if (error) {
      toast.error("Erreur", { description: "Impossible de mettre a jour les sessions." });
    } else {
      toast.success(
        `${ids.length} session${ids.length > 1 ? "s" : ""} ${facturable ? "marquee(s) facturable(s)" : "marquee(s) non facturable(s)"}`
      );
      setSelectedIds(new Set());
      fetchData();
    }
    setBulkUpdating(false);
  }

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
      const projet = projets.find((p) => p.id === form.projet_id);
      syncSessionToNotion({
        title: `${projet?.nom ?? "Session"} — ${form.etiquette}`,
        projet_nom: projet?.nom ?? "",
        date: form.date,
        duree: parseFloat(form.duree),
        etiquette: form.etiquette,
        facturable: form.facturable,
      });
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

  const weeks = groupByWeek(filteredSessions);

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

  const hasActiveFilters =
    filterProjet !== "tous" ||
    filterEtiquette !== "tous" ||
    filterFacturable !== "tous" ||
    filterPeriode !== "tout";

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
                    <SelectValue placeholder="Choisir un projet">
                      {(value: string) => {
                        const p = projets.find((pr) => pr.id === value);
                        return p?.nom ?? "Choisir un projet";
                      }}
                    </SelectValue>
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

      {/* Filtres */}
      {!loading && !error && sessions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Projet</Label>
                <Select value={filterProjet} onValueChange={(v) => { if (v) setFilterProjet(v); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {(value: string) => {
                        if (value === "tous") return "Tous les projets";
                        const p = uniqueProjets.find(([id]) => id === value);
                        return p?.[1] ?? "Tous les projets";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les projets</SelectItem>
                    {uniqueProjets.map(([id, nom]) => (
                      <SelectItem key={id} value={id}>{nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Etiquette</Label>
                <Select value={filterEtiquette} onValueChange={(v) => { if (v) setFilterEtiquette(v); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue>
                      {(value: string) => {
                        if (value === "tous") return "Toutes";
                        return getEtiquette(value).label;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Toutes</SelectItem>
                    {uniqueEtiquettes.map((key) => (
                      <SelectItem key={key} value={key}>{getEtiquette(key).label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Facturable</Label>
                <Select value={filterFacturable} onValueChange={(v) => { if (v) setFilterFacturable(v as FacturableFilter); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue>
                      {(value: string) => {
                        if (value === "facturable") return "Facturable";
                        if (value === "non_facturable") return "Non facturable";
                        return "Tous";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous</SelectItem>
                    <SelectItem value="facturable">Facturable</SelectItem>
                    <SelectItem value="non_facturable">Non facturable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Periode</Label>
                <Select value={filterPeriode} onValueChange={(v) => { if (v) setFilterPeriode(v as PeriodeFilter); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue>
                      {(value: string) => {
                        if (value === "mois_en_cours") return "Mois en cours";
                        if (value === "mois_precedent") return "Mois precedent";
                        if (value === "annee_en_cours") return "Annee en cours";
                        return "Tout";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tout">Tout</SelectItem>
                    <SelectItem value="mois_en_cours">Mois en cours</SelectItem>
                    <SelectItem value="mois_precedent">Mois precedent</SelectItem>
                    <SelectItem value="annee_en_cours">Annee en cours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterProjet("tous");
                    setFilterEtiquette("tous");
                    setFilterFacturable("tous");
                    setFilterPeriode("tout");
                  }}
                >
                  <X className="size-3.5" />
                  Reinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barre d'actions en masse */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
          <CheckSquare className="size-4 text-primary" />
          <span className="text-sm font-medium">
            {selectedIds.size} session{selectedIds.size > 1 ? "s" : ""} selectionnee{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkUpdating}
              onClick={() => bulkSetFacturable(true)}
            >
              Marquer facturable
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkUpdating}
              onClick={() => bulkSetFacturable(false)}
            >
              Marquer non facturable
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="size-3.5" />
              Annuler
            </Button>
          </div>
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
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Clock className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">
              {hasActiveFilters ? "Aucune session pour ces filtres" : "Aucune session enregistree"}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Modifiez vos filtres pour voir d'autres sessions."
                : "Utilisez le formulaire ci-dessus pour loguer votre premiere session."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Select all button */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              <Checkbox
                checked={allVisibleSelected}
                className="pointer-events-none"
              />
              {allVisibleSelected ? "Tout deselectionner" : "Tout selectionner"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {filteredSessions.length} session{filteredSessions.length > 1 ? "s" : ""}
              {hasActiveFilters ? " (filtrees)" : ""}
            </span>
          </div>

          {weeks.map((week) => (
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
                      <TableHead className="w-10" />
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
                      const isSelected = selectedIds.has(s.id);
                      return (
                        <TableRow
                          key={s.id}
                          className={`group ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(s.id)}
                            />
                          </TableCell>
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
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Chargement..." : "Charger plus de sessions"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
