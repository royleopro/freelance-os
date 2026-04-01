"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Projet, ProjetStatut } from "@/lib/types";
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
import { Plus } from "lucide-react";
import { NouveauProjetDialog } from "./nouveau-projet-dialog";

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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjets = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("projets")
      .select("*")
      .order("created_at", { ascending: false });
    setProjets((data as Projet[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjets();
  }, [fetchProjets]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projets</h1>
          <p className="text-muted-foreground">
            Gerez vos projets et clients.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Nouveau projet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les projets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">
              Chargement...
            </p>
          ) : projets.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Aucun projet. Creez votre premier projet !
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Devise</TableHead>
                  <TableHead className="text-right">Paye</TableHead>
                  <TableHead className="text-right">Rentabilite</TableHead>
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
                          className={config.className}
                        >
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatEuro(projet.montant_devise)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatEuro(projet.montant_paye)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {rentabilite(projet.montant_paye, projet.heures_passees)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NouveauProjetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchProjets}
      />
    </div>
  );
}
