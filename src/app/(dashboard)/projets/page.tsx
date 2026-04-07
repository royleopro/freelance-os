"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Projet, ProjetStatut, ProjetType, Devis } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  FolderKanban,
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjetDialog } from "./projet-dialog";
import { toast } from "sonner";

const statutConfig: Record<ProjetStatut, { label: string; className: string }> = {
  en_cours: { label: "En cours", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  cloture: { label: "Cloture", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  pas_signe: { label: "Pas signe", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  prospection: { label: "Prospection", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
};

const typeConfig: Record<ProjetType, { label: string; className: string }> = {
  client: { label: "Client", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  interne: { label: "Interne", className: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  prospect: { label: "Prospect", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

const TYPES: ("tous" | ProjetType)[] = ["tous", "client", "interne", "prospect"];
const STATUTS: ("tous" | ProjetStatut)[] = ["tous", "en_cours", "cloture", "pas_signe", "prospection"];

type SortField = "nom" | "paye" | "heures" | "tjm" | "rentabilite";
type SortDir = "asc" | "desc";

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function rentabiliteValue(paye: number, heures: number): number | null {
  return heures > 0 ? paye / heures : null;
}

function rentabiliteLabel(paye: number, heures: number): string {
  if (heures <= 0) return "—";
  return formatEuro(paye / heures) + "/h";
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
            value === opt
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export default function ProjetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projets, setProjets] = useState<Projet[]>([]);
  const [heuresParProjet, setHeuresParProjet] = useState<Record<string, number>>({});
  const [tjmParProjet, setTjmParProjet] = useState<Record<string, { valeur: number; libelle: string; montant: number; jours: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters from URL
  const filterType = (searchParams.get("type") ?? "tous") as "tous" | ProjetType;
  const filterStatut = (searchParams.get("statut") ?? "tous") as "tous" | ProjetStatut;
  const searchQuery = searchParams.get("q") ?? "";
  const sortField = (searchParams.get("sort") ?? "nom") as SortField;
  const sortDir = (searchParams.get("dir") ?? "asc") as SortDir;

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "tous" || value === "" || (key === "sort" && value === "nom") || (key === "dir" && value === "asc")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/projets", { scroll: false });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setFilter("dir", sortDir === "asc" ? "desc" : "asc");
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", field);
      params.set("dir", "desc");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProjet, setEditingProjet] = useState<Projet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Projet | null>(null);

  const fetchProjets = useCallback(async () => {
    try {
      const supabase = createClient();

      type SessionRow = { projet_id: string; duree: number };
      async function fetchAllSessionRows() {
        const all: SessionRow[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("sessions_heures")
            .select("projet_id, duree")
            .range(from, from + PAGE_SIZE - 1);
          if (error) return { data: null, error };
          all.push(...((data as SessionRow[]) ?? []));
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return { data: all, error: null };
      }

      const [projetsRes, sessionsRes, devisRes] = await Promise.all([
        supabase
          .from("projets_with_ca")
          .select("*")
          .order("created_at", { ascending: false }),
        fetchAllSessionRows(),
        supabase
          .from("devis")
          .select("projet_id, montant_total, jours_signes, libelle, date_signature, created_at")
          .eq("statut", "signe")
          .gt("jours_signes", 0),
      ]);
      if (projetsRes.error) {
        setError("Impossible de charger les projets.");
        toast.error("Erreur de chargement", { description: projetsRes.error.message });
        return;
      }
      setProjets((projetsRes.data as Projet[]) ?? []);

      const map: Record<string, number> = {};
      for (const s of sessionsRes.data ?? []) {
        map[s.projet_id] = (map[s.projet_id] ?? 0) + s.duree;
      }
      setHeuresParProjet(map);

      // Dernier devis signé par projet → TJM
      const tjmMap: Record<string, { valeur: number; libelle: string; montant: number; jours: number }> = {};
      const devisSorted = ((devisRes.data as Devis[]) ?? []).sort((a, b) => {
        const da = a.date_signature ?? a.created_at;
        const db = b.date_signature ?? b.created_at;
        return db.localeCompare(da);
      });
      for (const d of devisSorted) {
        if (d.projet_id && !tjmMap[d.projet_id]) {
          tjmMap[d.projet_id] = {
            valeur: Math.round(d.montant_total / d.jours_signes),
            libelle: d.libelle,
            montant: d.montant_total,
            jours: d.jours_signes,
          };
        }
      }
      setTjmParProjet(tjmMap);
      setError(null);
    } catch {
      setError("Impossible de charger les projets.");
      toast.error("Erreur reseau", { description: "Verifiez votre connexion internet." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjets();
  }, [fetchProjets]);

  // --- Filtered + sorted ---
  const filteredProjets = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = projets.filter((p) => {
      if (filterType !== "tous" && p.type !== filterType) return false;
      if (filterStatut !== "tous" && p.statut !== filterStatut) return false;
      if (q && !p.nom.toLowerCase().includes(q) && !(p.client ?? "").toLowerCase().includes(q)) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "nom":
          cmp = a.nom.localeCompare(b.nom);
          break;
        case "paye":
          cmp = a.montant_paye - b.montant_paye;
          break;
        case "heures":
          cmp = (heuresParProjet[a.id] ?? 0) - (heuresParProjet[b.id] ?? 0);
          break;
        case "tjm": {
          const ta = tjmParProjet[a.id]?.valeur ?? -Infinity;
          const tb = tjmParProjet[b.id]?.valeur ?? -Infinity;
          cmp = ta - tb;
          break;
        }
        case "rentabilite": {
          const ra = rentabiliteValue(a.montant_paye, heuresParProjet[a.id] ?? 0) ?? -Infinity;
          const rb = rentabiliteValue(b.montant_paye, heuresParProjet[b.id] ?? 0) ?? -Infinity;
          cmp = ra - rb;
          break;
        }
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [projets, heuresParProjet, tjmParProjet, filterType, filterStatut, searchQuery, sortField, sortDir]);

  function openCreate() {
    setEditingProjet(null);
    setDialogOpen(true);
  }

  function openEdit(projet: Projet) {
    setEditingProjet(projet);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const supabase = createClient();
    const { error } = await supabase.from("projets").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erreur", { description: "Impossible de supprimer le projet." });
    } else {
      toast.success("Projet supprime");
      fetchProjets();
    }
    setDeleteTarget(null);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="size-3" />
      : <ArrowDown className="size-3" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projets</h1>
          <p className="text-muted-foreground">
            Gerez vos projets et clients.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Nouveau projet
        </Button>
      </div>

      {/* Filters */}
      {!loading && !error && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Type</p>
                <PillToggle
                  options={TYPES}
                  value={filterType}
                  onChange={(v) => setFilter("type", v)}
                  labels={{ tous: "Tous", client: "Client", interne: "Interne", prospect: "Prospect" }}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Statut</p>
                <PillToggle
                  options={STATUTS}
                  value={filterStatut}
                  onChange={(v) => setFilter("statut", v)}
                  labels={{ tous: "Tous", en_cours: "En cours", cloture: "Cloture", pas_signe: "Pas signe", prospection: "Prospection" }}
                />
              </div>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un projet ou client..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setFilter("q", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <AlertCircle className="size-10 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchProjets(); }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Reessayer
          </button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredProjets.length} projet{filteredProjets.length > 1 ? "s" : ""}
              {filterType !== "tous" || filterStatut !== "tous" || searchQuery ? " (filtres)" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProjets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <FolderKanban className="size-10 text-muted-foreground/50" />
                <div>
                  <p className="font-medium">
                    {projets.length === 0 ? "Aucun projet pour l'instant" : "Aucun projet pour ces filtres"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {projets.length === 0
                      ? "Creez votre premier projet pour commencer."
                      : "Modifiez vos filtres pour voir d'autres projets."}
                  </p>
                </div>
                {projets.length === 0 && (
                  <Button onClick={openCreate} size="sm">
                    <Plus data-icon="inline-start" />
                    Creer un projet
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => toggleSort("nom")}>
                        Projet <SortIcon field="nom" />
                      </button>
                    </TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Signe</TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center gap-1 ml-auto cursor-pointer hover:text-foreground" onClick={() => toggleSort("paye")}>
                        Paye <SortIcon field="paye" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center gap-1 ml-auto cursor-pointer hover:text-foreground" onClick={() => toggleSort("heures")}>
                        Heures <SortIcon field="heures" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center gap-1 ml-auto cursor-pointer hover:text-foreground" onClick={() => toggleSort("tjm")}>
                        TJM <SortIcon field="tjm" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button className="flex items-center gap-1 ml-auto cursor-pointer hover:text-foreground" onClick={() => toggleSort("rentabilite")}>
                        EUR/h <SortIcon field="rentabilite" />
                      </button>
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjets.map((projet) => {
                    const config = statutConfig[projet.statut];
                    const isClient = projet.type === "client";
                    const naCell = <span style={{ color: "#2A2A2A" }}>—</span>;
                    return (
                      <TableRow key={projet.id} className="group">
                        <TableCell>
                          <Link
                            href={`/projets/${projet.id}`}
                            className="font-medium hover:underline"
                          >
                            {projet.nom}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {projet.client || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={typeConfig[projet.type]?.className ?? typeConfig.client.className}
                          >
                            {typeConfig[projet.type]?.label ?? "Client"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.className}>
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isClient ? formatEuro(projet.montant_signe) : naCell}
                        </TableCell>
                        <TableCell className="text-right">
                          {isClient ? formatEuro(projet.montant_paye) : naCell}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(heuresParProjet[projet.id] ?? 0) > 0
                            ? `${Math.round((heuresParProjet[projet.id]) * 10) / 10}h`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isClient ? naCell : tjmParProjet[projet.id] ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <span className="font-medium cursor-default">
                                    {formatEuro(tjmParProjet[projet.id].valeur)}/j
                                  </span>
                                }
                              />
                              <TooltipContent>
                                Base sur le devis &quot;{tjmParProjet[projet.id].libelle}&quot; — {formatEuro(tjmParProjet[projet.id].montant)} / {tjmParProjet[projet.id].jours}j
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-[#767676]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {isClient
                            ? rentabiliteLabel(projet.montant_paye, heuresParProjet[projet.id] ?? 0)
                            : naCell}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted cursor-pointer">
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(projet)}>
                                <Pencil />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(projet)}
                              >
                                <Trash2 />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <ProjetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={fetchProjets}
        projet={editingProjet}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.nom}
              </span>{" "}
              ? Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
