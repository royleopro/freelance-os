"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  Etiquette,
  SessionHeureAvecProjet,
} from "@/lib/types";
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
import { Plus, Clock } from "lucide-react";

const etiquetteConfig: Record<Etiquette, { label: string; className: string }> =
  {
    design_ui: {
      label: "Design UI",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    wireframe: {
      label: "Wireframe",
      className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    },
    reunion: {
      label: "Reunion",
      className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    },
    code: {
      label: "Code",
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    administration: {
      label: "Administration",
      className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    },
    prospection: {
      label: "Prospection",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    autre: {
      label: "Autre",
      className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    },
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
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    projet_id: "",
    date: todayStr(),
    duree: "",
    etiquette: "code" as Etiquette,
    facturable: true,
  });

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [projetsRes, sessionsRes] = await Promise.all([
      supabase
        .from("projets")
        .select("*")
        .order("nom", { ascending: true }),
      supabase
        .from("sessions_heures")
        .select("*, projets(nom)")
        .order("date", { ascending: false })
        .limit(200),
    ]);
    setProjets((projetsRes.data as Projet[]) ?? []);
    setSessions((sessionsRes.data as SessionHeureAvecProjet[]) ?? []);
    setLoading(false);
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

    if (!error) {
      setForm((prev) => ({ ...prev, duree: "", date: todayStr() }));
      fetchData();
    }
  }

  const weeks = groupByWeek(sessions);

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

      {/* Vue par semaine */}
      {loading ? (
        <p className="text-muted-foreground py-8 text-center">
          Chargement...
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          Aucune session enregistree.
        </p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {week.sessions.map((s) => {
                    const cfg = etiquetteConfig[s.etiquette];
                    return (
                      <TableRow key={s.id}>
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
