"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Projet, ProjetStatut, ProjetType, TransactionStatut } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  FolderKanban,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { normalizeEtiquette } from "@/lib/etiquettes";

// --- Constants ---

const VALID_STATUTS: ProjetStatut[] = [
  "en_cours",
  "cloture",
  "pas_signe",
  "prospection",
];

const VALID_TYPES: ProjetType[] = ["client", "interne", "prospect"];

const PROJET_COLUMNS = [
  "nom",
  "client",
  "type",
  "statut",
  "tjm",
  "date_debut",
  "deadline",
];

const SESSION_COLUMNS = [
  "projet",
  "date",
  "duree_heures",
  "etiquette",
  "facturable",
];

const TRANSACTION_COLUMNS = [
  "libelle",
  "projet",
  "montant",
  "statut",
  "date_paiement",
  "source",
];

const VALID_TX_STATUTS: TransactionStatut[] = ["paye", "signe", "en_attente"];

// --- CSV Parser ---

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === "," || char === ";") {
          cells.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

// --- Validation ---

interface ProjetRow {
  nom: string;
  client: string;
  type: ProjetType;
  statut: ProjetStatut;
  tjm: number;
  date_debut: string | null;
  deadline: string | null;
  errors: string[];
}

interface SessionRow {
  projet: string;
  projet_id: string | null;
  unmatched: boolean; // true if projet name didn't match any existing project
  date: string;
  duree: number;
  etiquette: string;
  facturable: boolean;
  errors: string[]; // errors OTHER than unmatched projet
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function isValidDate(s: string): boolean {
  if (!s) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function parseProjetRows(rows: string[][], headers: string[]): ProjetRow[] {
  const colIndex = (name: string) => {
    const normalized = headers.map(normalizeHeader);
    return normalized.indexOf(name);
  };

  const iNom = colIndex("nom");
  const iClient = colIndex("client");
  const iType = colIndex("type");
  const iStatut = colIndex("statut");
  const iTjm = colIndex("tjm");
  const iDateDebut = colIndex("date_debut");
  const iDeadline = colIndex("deadline");

  return rows.map((row) => {
    const errors: string[] = [];

    const nom = row[iNom]?.trim() ?? "";
    if (!nom) errors.push("Nom requis");

    const client = row[iClient]?.trim() ?? "";

    const rawType = row[iType]?.trim().toLowerCase() ?? "";
    const type = VALID_TYPES.includes(rawType as ProjetType)
      ? (rawType as ProjetType)
      : "client";
    if (rawType && !VALID_TYPES.includes(rawType as ProjetType)) {
      errors.push(`Type invalide: "${rawType}"`);
    }

    const rawStatut = row[iStatut]?.trim().toLowerCase() ?? "";
    const statut = VALID_STATUTS.includes(rawStatut as ProjetStatut)
      ? (rawStatut as ProjetStatut)
      : "prospection";
    if (rawStatut && !VALID_STATUTS.includes(rawStatut as ProjetStatut)) {
      errors.push(`Statut invalide: "${rawStatut}"`);
    }

    const tjm = parseFloat(row[iTjm] ?? "") || 0;

    const rawDateDebut = row[iDateDebut]?.trim() ?? "";
    const date_debut =
      rawDateDebut && isValidDate(rawDateDebut) ? rawDateDebut : null;
    if (rawDateDebut && !date_debut) errors.push("Date debut invalide");

    const rawDeadline = row[iDeadline]?.trim() ?? "";
    const deadline =
      rawDeadline && isValidDate(rawDeadline) ? rawDeadline : null;
    if (rawDeadline && !deadline) errors.push("Deadline invalide");

    return {
      nom,
      client,
      type,
      statut,
      tjm,
      date_debut,
      deadline,
      errors,
    };
  });
}

function parseSessionRows(
  rows: string[][],
  headers: string[],
  projetsMap: Map<string, string>
): SessionRow[] {
  const colIndex = (name: string) => {
    const normalized = headers.map(normalizeHeader);
    return normalized.indexOf(name);
  };

  const iProjet = colIndex("projet");
  const iDate = colIndex("date");
  const iDuree = colIndex("duree_heures");
  const iEtiquette = colIndex("etiquette");
  const iFacturable = colIndex("facturable");

  return rows.map((row) => {
    const errors: string[] = [];

    const projetNom = row[iProjet]?.trim() ?? "";
    const projet_id = projetsMap.get(projetNom.toLowerCase()) ?? null;
    let unmatched = false;

    if (!projetNom) {
      errors.push("Projet requis");
    } else if (!projet_id) {
      unmatched = true; // warning, not a blocking error
    }

    const rawDate = row[iDate]?.trim() ?? "";
    const date = rawDate && isValidDate(rawDate) ? rawDate : "";
    if (!date) errors.push("Date requise ou invalide");

    const duree = parseFloat(row[iDuree] ?? "") || 0;
    if (duree <= 0) errors.push("Duree invalide");

    const rawEtiquette = row[iEtiquette]?.trim() ?? "";
    const etiquette = normalizeEtiquette(rawEtiquette);

    const rawFacturable = row[iFacturable]?.trim().toLowerCase() ?? "";
    const facturable =
      rawFacturable === "non" ||
      rawFacturable === "false" ||
      rawFacturable === "0"
        ? false
        : true;

    return {
      projet: projetNom,
      projet_id,
      unmatched,
      date,
      duree,
      etiquette,
      facturable,
      errors,
    };
  });
}

interface TransactionRow {
  libelle: string;
  projet: string;
  projet_id: string | null;
  unmatched: boolean;
  montant: number;
  statut: TransactionStatut;
  date_paiement: string | null;
  source: string;
  errors: string[];
}

function parseTransactionRows(
  rows: string[][],
  headers: string[],
  projetsMap: Map<string, string>
): TransactionRow[] {
  const colIndex = (name: string) => {
    const normalized = headers.map(normalizeHeader);
    return normalized.indexOf(name);
  };

  const iLibelle = colIndex("libelle");
  const iProjet = colIndex("projet");
  const iMontant = colIndex("montant");
  const iStatut = colIndex("statut");
  const iDate = colIndex("date_paiement");
  const iSource = colIndex("source");

  return rows.map((row) => {
    const errors: string[] = [];

    const libelle = row[iLibelle]?.trim() ?? "";

    const projetNom = row[iProjet]?.trim() ?? "";
    const projet_id = projetsMap.get(projetNom.toLowerCase()) ?? null;
    let unmatched = false;
    if (!projetNom) {
      errors.push("Projet requis");
    } else if (!projet_id) {
      unmatched = true;
    }

    const montant = parseFloat(row[iMontant] ?? "") || 0;
    if (montant <= 0) errors.push("Montant invalide");

    const rawStatut = row[iStatut]?.trim().toLowerCase() ?? "";
    const statut = VALID_TX_STATUTS.includes(rawStatut as TransactionStatut)
      ? (rawStatut as TransactionStatut)
      : "en_attente";
    if (rawStatut && !VALID_TX_STATUTS.includes(rawStatut as TransactionStatut)) {
      errors.push(`Statut invalide: "${rawStatut}"`);
    }

    const rawDate = row[iDate]?.trim() ?? "";
    const date_paiement = rawDate && isValidDate(rawDate) ? rawDate : null;
    if (rawDate && !date_paiement) errors.push("Date paiement invalide");

    const source = row[iSource]?.trim() || "manuel";

    return { libelle, projet: projetNom, projet_id, unmatched, montant, statut, date_paiement, source, errors };
  });
}

// --- Component ---

type ImportType = "projets" | "sessions" | "transactions";

export default function ImportPage() {
  const [projetsMap, setProjetsMap] = useState<Map<string, string>>(new Map());
  const [projetsList, setProjetsList] = useState<
    Pick<Projet, "id" | "nom">[]
  >([]);

  // Projets import state
  const [projetRows, setProjetRows] = useState<ProjetRow[]>([]);
  const [projetFileName, setProjetFileName] = useState<string | null>(null);
  const [importingProjets, setImportingProjets] = useState(false);

  // Sessions import state
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [sessionFileName, setSessionFileName] = useState<string | null>(null);
  const [importingSessions, setImportingSessions] = useState(false);

  // Transactions import state
  const [txRows, setTxRows] = useState<TransactionRow[]>([]);
  const [txFileName, setTxFileName] = useState<string | null>(null);
  const [importingTx, setImportingTx] = useState(false);

  // Manual project mappings: unmatched CSV name (lowercase) → selected projet_id
  // Shared across sessions and transactions
  const [manualMappings, setManualMappings] = useState<Record<string, string>>(
    {}
  );

  // Load existing projets for session matching
  const fetchProjets = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("projets")
      .select("id, nom")
      .order("nom", { ascending: true });
    const list = (data as Pick<Projet, "id" | "nom">[]) ?? [];
    const map = new Map<string, string>();
    for (const p of list) {
      map.set(p.nom.toLowerCase(), p.id);
    }
    setProjetsMap(map);
    setProjetsList(list);
  }, []);

  useEffect(() => {
    fetchProjets();
  }, [fetchProjets]);

  // --- Unique unmatched project names (sessions) ---
  const unmatchedSessionNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of sessionRows) {
      if (r.unmatched) set.add(r.projet.toLowerCase());
    }
    return set;
  }, [sessionRows]);

  // --- Unique unmatched project names (transactions) ---
  const unmatchedTxNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of txRows) {
      if (r.unmatched) set.add(r.projet.toLowerCase());
    }
    return set;
  }, [txRows]);

  // --- Resolve projet_id considering manual mappings ---
  function resolveProjetId(row: { projet_id: string | null; unmatched: boolean; projet: string }): string | null {
    if (row.projet_id) return row.projet_id;
    if (row.unmatched) {
      return manualMappings[row.projet.toLowerCase()] ?? null;
    }
    return null;
  }

  // --- Session counts ---
  const sessionCounts = useMemo(() => {
    let valid = 0;
    let warnings = 0;
    let errors = 0;
    for (const r of sessionRows) {
      if (r.errors.length > 0) {
        errors++;
      } else if (r.unmatched) {
        if (manualMappings[r.projet.toLowerCase()]) {
          valid++;
        } else {
          warnings++;
        }
      } else {
        valid++;
      }
    }
    return { valid, warnings, errors };
  }, [sessionRows, manualMappings]);

  // --- Transaction counts ---
  const txCounts = useMemo(() => {
    let valid = 0;
    let warnings = 0;
    let errors = 0;
    for (const r of txRows) {
      if (r.errors.length > 0) {
        errors++;
      } else if (r.unmatched) {
        if (manualMappings[r.projet.toLowerCase()]) {
          valid++;
        } else {
          warnings++;
        }
      } else {
        valid++;
      }
    }
    return { valid, warnings, errors };
  }, [txRows, manualMappings]);

  function handleFile(type: ImportType, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast.error("Fichier vide ou invalide");
        return;
      }

      const headers = parsed[0];
      const dataRows = parsed.slice(1);

      if (type === "projets") {
        setProjetRows(parseProjetRows(dataRows, headers));
        setProjetFileName(file.name);
      } else if (type === "sessions") {
        setSessionRows(parseSessionRows(dataRows, headers, projetsMap));
        setSessionFileName(file.name);
        setManualMappings({});
      } else {
        setTxRows(parseTransactionRows(dataRows, headers, projetsMap));
        setTxFileName(file.name);
        setManualMappings({});
      }
    };
    reader.readAsText(file);
  }

  function onDrop(type: ImportType, e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(type, file);
  }

  function onFileInput(
    type: ImportType,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (file) handleFile(type, file);
    e.target.value = "";
  }

  async function importProjets() {
    const valid = projetRows.filter((r) => r.errors.length === 0 && r.nom);
    if (valid.length === 0) {
      toast.error("Aucune ligne valide a importer");
      return;
    }

    setImportingProjets(true);
    const supabase = createClient();

    const payload = valid.map((r) => ({
      nom: r.nom,
      client: r.client,
      type: r.type,
      statut: r.statut,
      tjm: r.tjm,
      date_debut: r.date_debut,
      deadline: r.deadline,
    }));

    const { error } = await supabase.from("projets").insert(payload);
    setImportingProjets(false);

    if (error) {
      toast.error("Erreur d'import", { description: error.message });
    } else {
      toast.success(
        `${valid.length} projet${valid.length > 1 ? "s" : ""} importe${valid.length > 1 ? "s" : ""}`
      );
      setProjetRows([]);
      setProjetFileName(null);
      fetchProjets();
    }
  }

  async function importSessions() {
    // Build final list: rows with no errors and a resolved projet_id
    const importable = sessionRows.filter((r) => {
      if (r.errors.length > 0) return false;
      return resolveProjetId(r) !== null;
    });

    if (importable.length === 0) {
      toast.error("Aucune ligne valide a importer");
      return;
    }

    setImportingSessions(true);
    const supabase = createClient();

    const payload = importable.map((r) => ({
      projet_id: resolveProjetId(r)!,
      date: r.date,
      duree: r.duree,
      etiquette: r.etiquette,
      facturable: r.facturable,
    }));

    const { error } = await supabase.from("sessions_heures").insert(payload);
    setImportingSessions(false);

    if (error) {
      toast.error("Erreur d'import", { description: error.message });
    } else {
      toast.success(
        `${importable.length} session${importable.length > 1 ? "s" : ""} importee${importable.length > 1 ? "s" : ""}`
      );
      setSessionRows([]);
      setSessionFileName(null);
      setManualMappings({});
    }
  }

  async function importTransactions() {
    const importable = txRows.filter((r) => {
      if (r.errors.length > 0) return false;
      return resolveProjetId(r) !== null;
    });

    if (importable.length === 0) {
      toast.error("Aucune ligne valide a importer");
      return;
    }

    setImportingTx(true);
    const supabase = createClient();

    const payload = importable.map((r) => ({
      projet_id: resolveProjetId(r)!,
      libelle: r.libelle,
      montant: r.montant,
      statut: r.statut,
      date: r.date_paiement ?? new Date().toISOString().split("T")[0],
      date_paiement: r.date_paiement,
      source: r.source,
    }));

    const { error } = await supabase.from("transactions_ca").insert(payload);
    setImportingTx(false);

    if (error) {
      toast.error("Erreur d'import", { description: error.message });
    } else {
      toast.success(
        `${importable.length} transaction${importable.length > 1 ? "s" : ""} importee${importable.length > 1 ? "s" : ""}`
      );
      setTxRows([]);
      setTxFileName(null);
      setManualMappings({});
    }
  }

  const projetErrors = projetRows.filter((r) => r.errors.length > 0).length;
  const projetValid = projetRows.filter(
    (r) => r.errors.length === 0 && r.nom
  ).length;

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
          <h1 className="text-2xl font-bold">Import CSV</h1>
          <p className="text-muted-foreground">
            Importez vos projets et sessions d&apos;heures en masse.
          </p>
        </div>
      </div>

      {/* Import Projets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="size-4" />
            Import de projets
          </CardTitle>
          <CardDescription>
            Colonnes attendues : {PROJET_COLUMNS.join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projetRows.length === 0 ? (
            <DropZone
              type="projets"
              onDrop={onDrop}
              onFileInput={onFileInput}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                  <span className="font-medium">{projetFileName}</span>
                  <span className="text-muted-foreground">
                    — {projetRows.length} ligne
                    {projetRows.length > 1 ? "s" : ""}
                  </span>
                  {projetValid > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    >
                      {projetValid} valide{projetValid > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {projetErrors > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-red-500/20 text-red-400 border-red-500/30"
                    >
                      {projetErrors} erreur{projetErrors > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setProjetRows([]);
                    setProjetFileName(null);
                  }}
                >
                  <X className="size-3.5" />
                  Effacer
                </Button>
              </div>

              <div className="max-h-80 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Nom</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">TJM</TableHead>
                      <TableHead>Debut</TableHead>
                      <TableHead>Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projetRows.map((row, i) => (
                      <TableRow
                        key={i}
                        className={
                          row.errors.length > 0 ? "bg-red-500/5" : ""
                        }
                      >
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <AlertCircle className="size-3.5 text-red-400" />
                          ) : (
                            <CheckCircle2 className="size-3.5 text-emerald-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.nom || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.client || "—"}
                        </TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.statut}</TableCell>
                        <TableCell className="text-right">
                          {row.tjm || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.date_debut || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.deadline || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {projetErrors > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
                  <p className="font-medium text-red-400 mb-1">
                    Erreurs detectees ({projetErrors} ligne
                    {projetErrors > 1 ? "s" : ""})
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {projetRows
                      .map((r, i) =>
                        r.errors.length > 0
                          ? { i, errors: r.errors }
                          : null
                      )
                      .filter(Boolean)
                      .slice(0, 10)
                      .map((item) => (
                        <li key={item!.i}>
                          Ligne {item!.i + 1} : {item!.errors.join(", ")}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={importProjets}
                  disabled={importingProjets || projetValid === 0}
                >
                  <Upload data-icon="inline-start" />
                  {importingProjets
                    ? "Import en cours..."
                    : `Importer ${projetValid} projet${projetValid > 1 ? "s" : ""}`}
                </Button>
                {projetErrors > 0 && projetValid > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Les lignes en erreur seront ignorees.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Import Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4" />
            Import de sessions d&apos;heures
          </CardTitle>
          <CardDescription>
            Colonnes attendues : {SESSION_COLUMNS.join(", ")}
            <br />
            <span className="text-xs">
              La colonne &quot;projet&quot; est matchee automatiquement avec vos
              projets existants. Les noms non reconnus peuvent etre associes
              manuellement.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionRows.length === 0 ? (
            <DropZone
              type="sessions"
              onDrop={onDrop}
              onFileInput={onFileInput}
            />
          ) : (
            <>
              {/* Summary badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                  <span className="font-medium">{sessionFileName}</span>
                  <span className="text-muted-foreground">
                    — {sessionRows.length} ligne
                    {sessionRows.length > 1 ? "s" : ""}
                  </span>
                  {sessionCounts.valid > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    >
                      {sessionCounts.valid} valide
                      {sessionCounts.valid > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {sessionCounts.warnings > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-amber-500/20 text-amber-400 border-amber-500/30"
                    >
                      {sessionCounts.warnings} sans projet
                    </Badge>
                  )}
                  {sessionCounts.errors > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-red-500/20 text-red-400 border-red-500/30"
                    >
                      {sessionCounts.errors} erreur
                      {sessionCounts.errors > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSessionRows([]);
                    setSessionFileName(null);
                    setManualMappings({});
                  }}
                >
                  <X className="size-3.5" />
                  Effacer
                </Button>
              </div>

              {/* Manual mapping panel for unmatched projects */}
              {unmatchedSessionNames.size > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">
                        {unmatchedSessionNames.size} nom
                        {unmatchedSessionNames.size > 1 ? "s" : ""} de projet non
                        reconnu{unmatchedSessionNames.size > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Associez-les a un projet existant ou laissez vide pour
                        ignorer ces lignes.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Array.from(unmatchedSessionNames).map((name) => {
                      // Find original casing from first matching row
                      const originalName =
                        sessionRows.find(
                          (r) => r.projet.toLowerCase() === name
                        )?.projet ?? name;
                      const count = sessionRows.filter(
                        (r) => r.projet.toLowerCase() === name
                      ).length;
                      return (
                        <div
                          key={name}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="min-w-0 shrink-0 font-medium truncate max-w-48">
                            &quot;{originalName}&quot;
                          </span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            ({count} ligne{count > 1 ? "s" : ""})
                          </span>
                          <div className="flex-1 max-w-64">
                            <Select
                              value={manualMappings[name] ?? ""}
                              onValueChange={(v) => {
                                if (!v) return;
                                setManualMappings((prev) => {
                                  const next = { ...prev };
                                  if (v === "__ignore__") {
                                    delete next[name];
                                  } else {
                                    next[name] = v;
                                  }
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Associer a un projet..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">
                                  <span className="text-muted-foreground">
                                    Ignorer
                                  </span>
                                </SelectItem>
                                {projetsList.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nom}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {manualMappings[name] && (
                            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="max-h-80 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Projet</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Duree</TableHead>
                      <TableHead>Etiquette</TableHead>
                      <TableHead className="text-center">Facturable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionRows.map((row, i) => {
                      const hasError = row.errors.length > 0;
                      const isUnmapped =
                        row.unmatched &&
                        !manualMappings[row.projet.toLowerCase()];
                      const isMapped =
                        row.unmatched &&
                        !!manualMappings[row.projet.toLowerCase()];
                      const mappedProjetName = isMapped
                        ? projetsList.find(
                            (p) =>
                              p.id ===
                              manualMappings[row.projet.toLowerCase()]
                          )?.nom
                        : null;

                      return (
                        <TableRow
                          key={i}
                          className={
                            hasError
                              ? "bg-red-500/5"
                              : isUnmapped
                                ? "bg-amber-500/5"
                                : ""
                          }
                        >
                          <TableCell>
                            {hasError ? (
                              <AlertCircle className="size-3.5 text-red-400" />
                            ) : isUnmapped ? (
                              <AlertTriangle className="size-3.5 text-amber-400" />
                            ) : (
                              <CheckCircle2 className="size-3.5 text-emerald-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span
                                className={
                                  isUnmapped
                                    ? "font-medium text-amber-400"
                                    : "font-medium"
                                }
                              >
                                {row.projet || "—"}
                              </span>
                              {isMapped && (
                                <span className="text-xs text-emerald-400">
                                  → {mappedProjetName}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.date || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.duree}h
                          </TableCell>
                          <TableCell>{row.etiquette}</TableCell>
                          <TableCell className="text-center">
                            {row.facturable ? (
                              <span className="text-emerald-400">Oui</span>
                            ) : (
                              <span className="text-muted-foreground">
                                Non
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Error details */}
              {sessionCounts.errors > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
                  <p className="font-medium text-red-400 mb-1">
                    Erreurs detectees ({sessionCounts.errors} ligne
                    {sessionCounts.errors > 1 ? "s" : ""})
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {sessionRows
                      .map((r, i) =>
                        r.errors.length > 0
                          ? { i, errors: r.errors }
                          : null
                      )
                      .filter(Boolean)
                      .slice(0, 10)
                      .map((item) => (
                        <li key={item!.i}>
                          Ligne {item!.i + 1} : {item!.errors.join(", ")}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Import button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={importSessions}
                  disabled={importingSessions || sessionCounts.valid === 0}
                >
                  <Upload data-icon="inline-start" />
                  {importingSessions
                    ? "Import en cours..."
                    : `Importer ${sessionCounts.valid} session${sessionCounts.valid > 1 ? "s" : ""}`}
                </Button>
                {(sessionCounts.errors > 0 || sessionCounts.warnings > 0) &&
                  sessionCounts.valid > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {sessionCounts.errors > 0 &&
                        `${sessionCounts.errors} ligne${sessionCounts.errors > 1 ? "s" : ""} en erreur`}
                      {sessionCounts.errors > 0 &&
                        sessionCounts.warnings > 0 &&
                        " et "}
                      {sessionCounts.warnings > 0 &&
                        `${sessionCounts.warnings} sans projet`}{" "}
                      seront ignoree{sessionCounts.errors + sessionCounts.warnings > 1 ? "s" : ""}.
                    </p>
                  )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Import Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" />
            Import de transactions CA
          </CardTitle>
          <CardDescription>
            Colonnes attendues : {TRANSACTION_COLUMNS.join(", ")}
            <br />
            <span className="text-xs">
              La colonne &quot;projet&quot; est matchee automatiquement avec vos
              projets existants. Statuts : paye, signe, en_attente.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {txRows.length === 0 ? (
            <DropZone
              type="transactions"
              onDrop={onDrop}
              onFileInput={onFileInput}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                  <span className="font-medium">{txFileName}</span>
                  <span className="text-muted-foreground">
                    — {txRows.length} ligne{txRows.length > 1 ? "s" : ""}
                  </span>
                  {txCounts.valid > 0 && (
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {txCounts.valid} valide{txCounts.valid > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {txCounts.warnings > 0 && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      {txCounts.warnings} sans projet
                    </Badge>
                  )}
                  {txCounts.errors > 0 && (
                    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                      {txCounts.errors} erreur{txCounts.errors > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTxRows([]); setTxFileName(null); setManualMappings({}); }}
                >
                  <X className="size-3.5" />
                  Effacer
                </Button>
              </div>

              {/* Manual mapping for unmatched projects */}
              {unmatchedTxNames.size > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">
                        {unmatchedTxNames.size} nom{unmatchedTxNames.size > 1 ? "s" : ""} de projet non reconnu{unmatchedTxNames.size > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Associez-les a un projet existant ou laissez vide pour ignorer.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Array.from(unmatchedTxNames).map((name) => {
                      const originalName = txRows.find((r) => r.projet.toLowerCase() === name)?.projet ?? name;
                      const count = txRows.filter((r) => r.projet.toLowerCase() === name).length;
                      return (
                        <div key={name} className="flex items-center gap-3 text-sm">
                          <span className="min-w-0 shrink-0 font-medium truncate max-w-48">
                            &quot;{originalName}&quot;
                          </span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            ({count} ligne{count > 1 ? "s" : ""})
                          </span>
                          <div className="flex-1 max-w-64">
                            <Select
                              value={manualMappings[name] ?? ""}
                              onValueChange={(v) => {
                                if (!v) return;
                                setManualMappings((prev) => {
                                  const next = { ...prev };
                                  if (v === "__ignore__") { delete next[name]; } else { next[name] = v; }
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Associer a un projet..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">
                                  <span className="text-muted-foreground">Ignorer</span>
                                </SelectItem>
                                {projetsList.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {manualMappings[name] && (
                            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="max-h-80 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Libelle</TableHead>
                      <TableHead>Projet</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date paiement</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txRows.map((row, i) => {
                      const hasError = row.errors.length > 0;
                      const isUnmapped = row.unmatched && !manualMappings[row.projet.toLowerCase()];
                      const isMapped = row.unmatched && !!manualMappings[row.projet.toLowerCase()];
                      const mappedName = isMapped
                        ? projetsList.find((p) => p.id === manualMappings[row.projet.toLowerCase()])?.nom
                        : null;

                      return (
                        <TableRow key={i} className={hasError ? "bg-red-500/5" : isUnmapped ? "bg-amber-500/5" : ""}>
                          <TableCell>
                            {hasError ? (
                              <AlertCircle className="size-3.5 text-red-400" />
                            ) : isUnmapped ? (
                              <AlertTriangle className="size-3.5 text-amber-400" />
                            ) : (
                              <CheckCircle2 className="size-3.5 text-emerald-400" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{row.libelle || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className={isUnmapped ? "font-medium text-amber-400" : "font-medium"}>
                                {row.projet || "—"}
                              </span>
                              {isMapped && (
                                <span className="text-xs text-emerald-400">→ {mappedName}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{row.montant}</TableCell>
                          <TableCell>{row.statut}</TableCell>
                          <TableCell className="text-muted-foreground">{row.date_paiement || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{row.source}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {txCounts.errors > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
                  <p className="font-medium text-red-400 mb-1">
                    Erreurs detectees ({txCounts.errors} ligne{txCounts.errors > 1 ? "s" : ""})
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {txRows
                      .map((r, i) => r.errors.length > 0 ? { i, errors: r.errors } : null)
                      .filter(Boolean)
                      .slice(0, 10)
                      .map((item) => (
                        <li key={item!.i}>Ligne {item!.i + 1} : {item!.errors.join(", ")}</li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={importTransactions} disabled={importingTx || txCounts.valid === 0}>
                  <Upload data-icon="inline-start" />
                  {importingTx
                    ? "Import en cours..."
                    : `Importer ${txCounts.valid} transaction${txCounts.valid > 1 ? "s" : ""}`}
                </Button>
                {(txCounts.errors > 0 || txCounts.warnings > 0) && txCounts.valid > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {txCounts.errors > 0 && `${txCounts.errors} en erreur`}
                    {txCounts.errors > 0 && txCounts.warnings > 0 && " et "}
                    {txCounts.warnings > 0 && `${txCounts.warnings} sans projet`}
                    {" "}seront ignoree{txCounts.errors + txCounts.warnings > 1 ? "s" : ""}.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- DropZone ---

function DropZone({
  type,
  onDrop,
  onFileInput,
}: {
  type: ImportType;
  onDrop: (type: ImportType, e: React.DragEvent) => void;
  onFileInput: (
    type: ImportType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const id = `file-${type}`;

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        onDrop(type, e);
      }}
    >
      <FileSpreadsheet className="size-8 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium">
          Glissez un fichier CSV ici ou cliquez pour parcourir
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Separateur : virgule ou point-virgule
        </p>
      </div>
      <input
        id={id}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFileInput(type, e)}
      />
    </label>
  );
}
