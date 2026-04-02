"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TransactionCA } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Link2, Unlink, Wallet, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface GererPaiementsDialogProps {
  devisId: string;
  devisLibelle: string;
  projetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function GererPaiementsDialog({
  devisId,
  devisLibelle,
  projetId,
  open,
  onOpenChange,
  onChanged,
}: GererPaiementsDialogProps) {
  const [linked, setLinked] = useState<TransactionCA[]>([]);
  const [available, setAvailable] = useState<TransactionCA[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [editingTx, setEditingTx] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ montant: "", statut: "", date: "", note: "" });

  const fetchTransactions = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    const supabase = createClient();

    // Fetch linked transactions
    const { data: linkedData } = await supabase
      .from("transactions_ca")
      .select("*")
      .eq("devis_id", devisId)
      .order("date", { ascending: false });

    setLinked((linkedData as TransactionCA[]) ?? []);

    // Fetch available transactions (same project, no devis_id or different devis_id)
    if (projetId) {
      const { data: availData } = await supabase
        .from("transactions_ca")
        .select("*")
        .eq("projet_id", projetId)
        .is("devis_id", null)
        .order("date", { ascending: false });

      setAvailable((availData as TransactionCA[]) ?? []);
    } else {
      setAvailable([]);
    }

    setSelectedTxId("");
    setLoading(false);
  }, [open, devisId, projetId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function linkTransaction(txId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions_ca")
      .update({ devis_id: devisId })
      .eq("id", txId);
    if (error) {
      toast.error("Erreur", { description: "Impossible de lier le paiement." });
    } else {
      toast.success("Paiement lie au devis");
      setSelectedTxId("");
      fetchTransactions();
      onChanged();
    }
  }

  async function unlinkTransaction(txId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions_ca")
      .update({ devis_id: null })
      .eq("id", txId);
    if (error) {
      toast.error("Erreur", { description: "Impossible de delier le paiement." });
    } else {
      toast.success("Paiement delie");
      fetchTransactions();
      onChanged();
    }
  }

  function startEditTx(tx: TransactionCA) {
    setEditingTx(tx.id);
    setEditForm({
      montant: String(tx.montant),
      statut: tx.statut,
      date: tx.date,
      note: tx.note ?? "",
    });
  }

  async function saveEditTx(txId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions_ca")
      .update({
        montant: parseFloat(editForm.montant) || 0,
        statut: editForm.statut,
        date: editForm.date,
        date_paiement: editForm.statut === "paye" ? editForm.date : null,
        note: editForm.note,
      })
      .eq("id", txId);
    if (error) {
      toast.error("Erreur", { description: "Impossible de modifier le paiement." });
    } else {
      toast.success("Paiement modifie");
      setEditingTx(null);
      fetchTransactions();
      onChanged();
    }
  }

  async function deleteTransaction(txId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions_ca")
      .delete()
      .eq("id", txId);
    if (error) {
      toast.error("Erreur", { description: "Impossible de supprimer le paiement." });
    } else {
      toast.success("Paiement supprime");
      fetchTransactions();
      onChanged();
    }
  }

  const totalLinked = linked.reduce((s, t) => s + t.montant, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4" />
            Paiements — {devisLibelle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Linked transactions */}
          {linked.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun paiement lie a ce devis.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libelle</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linked.map((tx) => {
                    const isEditing = editingTx === tx.id;
                    return isEditing ? (
                      <TableRow key={tx.id} className="bg-primary/5">
                        <TableCell colSpan={5}>
                          <div className="space-y-3 py-1">
                            <div className="grid grid-cols-3 gap-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="h-8"
                                value={editForm.montant}
                                onChange={(e) => setEditForm((f) => ({ ...f, montant: e.target.value }))}
                                placeholder="Montant"
                              />
                              <select
                                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                                value={editForm.statut}
                                onChange={(e) => setEditForm((f) => ({ ...f, statut: e.target.value }))}
                              >
                                <option value="paye">Paye</option>
                                <option value="signe">Signe</option>
                                <option value="en_attente">En attente</option>
                              </select>
                              <Input
                                type="date"
                                className="h-8"
                                value={editForm.date}
                                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                className="h-8 flex-1"
                                value={editForm.note}
                                onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                                placeholder="Note (optionnel)"
                              />
                              <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => saveEditTx(tx.id)}>
                                <Check className="size-4 text-emerald-400" />
                              </Button>
                              <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => setEditingTx(null)}>
                                <X className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.libelle || "—"}</TableCell>
                        <TableCell className="text-right">{formatEuro(tx.montant)}</TableCell>
                        <TableCell>
                          {tx.statut === "paye" ? (
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Paye</Badge>
                          ) : tx.statut === "signe" ? (
                            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Signe</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">En attente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => startEditTx(tx)}
                              title="Modifier"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => unlinkTransaction(tx.id)}
                              title="Delier"
                            >
                              <Unlink className="size-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive cursor-pointer" title="Supprimer">
                                <Trash2 className="size-3.5" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Le paiement de {formatEuro(tx.montant)} sera definitivement supprime.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTransaction(tx.id)}
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground">
                Total lie : {formatEuro(totalLinked)}
              </p>
            </>
          )}

          {/* Link existing transaction */}
          {projetId && available.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">Lier un paiement existant</p>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedTxId}
                  onValueChange={(v) => { if (v) setSelectedTxId(v); }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choisir un paiement...">
                      {(value: string) => {
                        const tx = available.find((t) => t.id === value);
                        if (!tx) return "Choisir un paiement...";
                        return `${tx.libelle || "Paiement"} — ${formatEuro(tx.montant)}`;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((tx) => (
                      <SelectItem key={tx.id} value={tx.id}>
                        {tx.libelle || "Paiement"} — {formatEuro(tx.montant)} ({tx.statut})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedTxId || loading}
                  onClick={() => linkTransaction(selectedTxId)}
                >
                  <Link2 data-icon="inline-start" />
                  Lier
                </Button>
              </div>
            </div>
          )}

          {projetId && available.length === 0 && linked.length > 0 && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              Tous les paiements de ce projet sont deja lies a un devis.
            </p>
          )}

          {!projetId && (
            <p className="text-xs text-amber-400 border-t pt-3">
              Ce devis n&apos;est pas associe a un projet. Associez-le d&apos;abord pour pouvoir lier des paiements.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
