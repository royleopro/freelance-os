"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Projet, ProjetStatut, ProjetType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { ProjetDialog } from "./projet-dialog";
import { toast } from "sonner";

const statutConfig: Record<
  ProjetStatut,
  { label: string; className: string }
> = {
  en_cours: {
    label: "En cours",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  cloture: {
    label: "Cloture",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  pas_signe: {
    label: "Pas signe",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  prospection: {
    label: "Prospection",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
};

const typeConfig: Record<ProjetType, { label: string; className: string }> = {
  client: {
    label: "Client",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  interne: {
    label: "Interne",
    className: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  },
  prospect: {
    label: "Prospect",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
};

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function rentabilite(paye: number, heures: number): string {
  if (heures <= 0) return "—";
  return formatEuro(paye / heures) + "/h";
}

export default function ProjetsPage() {
  const [projets, setProjets] = useState<Projet[]>([]);
  const [heuresParProjet, setHeuresParProjet] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProjet, setEditingProjet] = useState<Projet | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Projet | null>(null);

  const fetchProjets = useCallback(async () => {
    try {
      const supabase = createClient();
      const [projetsRes, sessionsRes] = await Promise.all([
        supabase
          .from("projets_with_ca")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions_heures")
          .select("projet_id, duree"),
      ]);
      if (projetsRes.error) {
        setError("Impossible de charger les projets.");
        toast.error("Erreur de chargement", {
          description: projetsRes.error.message,
        });
        return;
      }
      setProjets((projetsRes.data as Projet[]) ?? []);

      // Aggregate heures par projet
      const map: Record<string, number> = {};
      for (const s of (sessionsRes.data as { projet_id: string; duree: number }[]) ?? []) {
        map[s.projet_id] = (map[s.projet_id] ?? 0) + s.duree;
      }
      setHeuresParProjet(map);

      setError(null);
    } catch {
      setError("Impossible de charger les projets.");
      toast.error("Erreur reseau", {
        description: "Verifiez votre connexion internet.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjets();
  }, [fetchProjets]);

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
    const { error } = await supabase
      .from("projets")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erreur", {
        description: "Impossible de supprimer le projet.",
      });
    } else {
      toast.success("Projet supprime");
      fetchProjets();
    }
    setDeleteTarget(null);
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
            onClick={() => {
              setLoading(true);
              fetchProjets();
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Reessayer
          </button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tous les projets</CardTitle>
          </CardHeader>
          <CardContent>
            {projets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <FolderKanban className="size-10 text-muted-foreground/50" />
                <div>
                  <p className="font-medium">
                    Aucun projet pour l&apos;instant
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Creez votre premier projet pour commencer a suivre votre
                    activite.
                  </p>
                </div>
                <Button onClick={openCreate} size="sm">
                  <Plus data-icon="inline-start" />
                  Creer un projet
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Signe</TableHead>
                    <TableHead className="text-right">Paye</TableHead>
                    <TableHead className="text-right">Heures</TableHead>
                    <TableHead className="text-right">Rentabilite reelle</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projets.map((projet) => {
                    const config = statutConfig[projet.statut];
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
                            className={
                              typeConfig[projet.type]?.className ??
                              typeConfig.client.className
                            }
                          >
                            {typeConfig[projet.type]?.label ?? "Client"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={config.className}
                          >
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatEuro(projet.montant_signe)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatEuro(projet.montant_paye)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(heuresParProjet[projet.id] ?? 0) > 0
                            ? `${Math.round((heuresParProjet[projet.id]) * 10) / 10}h`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {rentabilite(
                            projet.montant_paye,
                            heuresParProjet[projet.id] ?? 0
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted cursor-pointer">
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(projet)}
                              >
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

      {/* Create / Edit dialog */}
      <ProjetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={fetchProjets}
        projet={editingProjet}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
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
