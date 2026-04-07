"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Projet,
  Devis,
  TransactionCA,
  SessionHeureAvecProjet,
  Parametre,
  Objectif,
} from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { toast } from "sonner";

type PeriodType = "mois" | "trimestre" | "annee";

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MOIS_LABELS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];
const MOIS_SLUGS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

const PROJECT_COLORS: Array<[number, number, number]> = [
  [10, 207, 131],
  [46, 138, 255],
  [239, 159, 39],
  [239, 68, 68],
  [147, 51, 234],
  [156, 163, 175],
];

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatEuroCompact(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k€`;
  return `${Math.round(n)}€`;
}

function formatHeures(h: number) {
  return `${h.toFixed(1)} h`;
}

function getParamNum(params: Parametre[], cle: string, fallback: number): number {
  const p = params.find((p) => p.cle === cle);
  return p ? parseFloat(p.valeur) || fallback : fallback;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function periodRange(
  type: PeriodType,
  year: number,
  monthOrQuarter: number
): { start: string; end: string } {
  if (type === "annee") {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (type === "trimestre") {
    const startMonth = (monthOrQuarter - 1) * 3;
    const endMonth = startMonth + 2;
    const lastDay = new Date(year, endMonth + 1, 0).getDate();
    return {
      start: `${year}-${pad2(startMonth + 1)}-01`,
      end: `${year}-${pad2(endMonth + 1)}-${pad2(lastDay)}`,
    };
  }
  const lastDay = new Date(year, monthOrQuarter, 0).getDate();
  return {
    start: `${year}-${pad2(monthOrQuarter)}-01`,
    end: `${year}-${pad2(monthOrQuarter)}-${pad2(lastDay)}`,
  };
}

function periodLabel(type: PeriodType, year: number, monthOrQuarter: number): string {
  if (type === "annee") return `${year}`;
  if (type === "trimestre") return `T${monthOrQuarter} ${year}`;
  return `${MOIS_LABELS[monthOrQuarter - 1]} ${year}`;
}

function periodTypeLabel(type: PeriodType): string {
  if (type === "annee") return "annuel";
  if (type === "trimestre") return "trimestriel";
  return "mensuel";
}

function periodSlug(type: PeriodType, year: number, monthOrQuarter: number): string {
  if (type === "annee") return `annee-${year}`;
  if (type === "trimestre") return `t${monthOrQuarter}-${year}`;
  return `${MOIS_SLUGS[monthOrQuarter - 1]}-${year}`;
}

function trunc(s: string, n = 32): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function RapportPage() {
  const [loading, setLoading] = useState(true);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [transactions, setTransactions] = useState<TransactionCA[]>([]);
  const [sessions, setSessions] = useState<SessionHeureAvecProjet[]>([]);
  const [parametres, setParametres] = useState<Parametre[]>([]);
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [exporting, setExporting] = useState(false);
  const [includeValeurTemps, setIncludeValeurTemps] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [periodType, setPeriodType] = useState<PeriodType>("mois");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [monthOrQuarter, setMonthOrQuarter] = useState<number>(now.getMonth() + 1);

  const handlePeriodTypeChange = (t: PeriodType) => {
    setPeriodType(t);
    if (t === "mois") setMonthOrQuarter(now.getMonth() + 1);
    else if (t === "trimestre") setMonthOrQuarter(Math.floor(now.getMonth() / 3) + 1);
    else setMonthOrQuarter(1);
  };

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      async function fetchAllSessions() {
        const all: SessionHeureAvecProjet[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("sessions_heures")
            .select("*, projets(nom, type)")
            .order("date", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (error) return { data: null, error };
          all.push(...((data as SessionHeureAvecProjet[]) ?? []));
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return { data: all, error: null };
      }

      const [projetsRes, txRes, sessRes, paramRes, objRes, devisRes] = await Promise.all([
        supabase.from("projets_with_ca").select("*"),
        supabase.from("transactions_ca").select("*"),
        fetchAllSessions(),
        supabase.from("parametres").select("*"),
        supabase.from("objectifs").select("*"),
        supabase.from("devis").select("*").eq("statut", "signe"),
      ]);

      setProjets((projetsRes.data as Projet[]) ?? []);
      setTransactions((txRes.data as TransactionCA[]) ?? []);
      setSessions(sessRes.data ?? []);
      setParametres((paramRes.data as Parametre[]) ?? []);
      setObjectifs((objRes.data as Objectif[]) ?? []);
      setDevis((devisRes.data as Devis[]) ?? []);
    } catch {
      toast.error("Erreur de chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { start: periodStart, end: periodEnd } = useMemo(
    () => periodRange(periodType, year, monthOrQuarter),
    [periodType, year, monthOrQuarter]
  );

  const label = periodLabel(periodType, year, monthOrQuarter);

  const clientProjetIds = useMemo(
    () => new Set(projets.filter((p) => p.type === "client").map((p) => p.id)),
    [projets]
  );

  // TJM par projet via devis signés
  const tjmParProjet = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...devis]
      .filter((d) => d.statut === "signe" && d.jours_signes > 0)
      .sort((a, b) => {
        const da = a.date_signature ?? a.created_at;
        const db = b.date_signature ?? b.created_at;
        return db.localeCompare(da);
      });
    for (const d of sorted) {
      if (d.projet_id && !map.has(d.projet_id)) {
        map.set(d.projet_id, d.montant_total / d.jours_signes);
      }
    }
    return map;
  }, [devis]);

  // ═══ Section 1 — CA ═══
  const txInPeriod = useMemo(() => {
    return transactions.filter((t) => {
      if (!clientProjetIds.has(t.projet_id)) return false;
      const d = t.date_paiement ?? t.date;
      return d >= periodStart && d <= periodEnd;
    });
  }, [transactions, clientProjetIds, periodStart, periodEnd]);

  const caPaye = useMemo(
    () =>
      txInPeriod.filter((t) => t.statut === "paye").reduce((s, t) => s + t.montant, 0),
    [txInPeriod]
  );
  const caSigne = useMemo(
    () =>
      txInPeriod
        .filter((t) => t.statut === "signe" || t.statut === "en_attente")
        .reduce((s, t) => s + t.montant, 0),
    [txInPeriod]
  );
  const tauxUrssaf = getParamNum(parametres, "taux_urssaf", 0.256);
  const tauxImpots = getParamNum(parametres, "taux_impots", 0.02);
  const coefNet = 1 - tauxUrssaf - tauxImpots;
  const netEstime = caPaye * coefNet;

  const objectifPeriode = useMemo(() => {
    const annuels = objectifs.filter((o) => o.annee === year);
    if (periodType === "annee") {
      return annuels.filter((o) => o.mois !== 0).reduce((s, o) => s + o.ca_cible, 0);
    }
    if (periodType === "trimestre") {
      const startM = (monthOrQuarter - 1) * 3 + 1;
      const endM = startM + 2;
      return annuels
        .filter((o) => o.mois >= startM && o.mois <= endM)
        .reduce((s, o) => s + o.ca_cible, 0);
    }
    return annuels
      .filter((o) => o.mois === monthOrQuarter)
      .reduce((s, o) => s + o.ca_cible, 0);
  }, [objectifs, year, periodType, monthOrQuarter]);

  const pctObjectif = objectifPeriode > 0 ? (caPaye / objectifPeriode) * 100 : 0;

  // CA chart data: semaines (mois) ou mois (trimestre/année)
  const caChartData = useMemo(() => {
    const payes = txInPeriod.filter((t) => t.statut === "paye");
    if (periodType === "mois") {
      const lastDay = new Date(year, monthOrQuarter, 0).getDate();
      const weeks: { label: string; value: number }[] = [];
      const ranges: Array<[number, number]> = [
        [1, 7],
        [8, 14],
        [15, 21],
        [22, 28],
        [29, lastDay],
      ];
      ranges.forEach(([from, to], i) => {
        if (from > lastDay) return;
        const realTo = Math.min(to, lastDay);
        const sum = payes
          .filter((t) => {
            const d = t.date_paiement ?? t.date;
            const day = parseInt(d.slice(8, 10));
            return day >= from && day <= realTo;
          })
          .reduce((s, t) => s + t.montant, 0);
        weeks.push({ label: `S${i + 1}`, value: sum });
      });
      return weeks;
    }
    // trimestre ou annee → par mois
    const startM = periodType === "trimestre" ? (monthOrQuarter - 1) * 3 : 0;
    const endM = periodType === "trimestre" ? startM + 2 : 11;
    const months: { label: string; value: number }[] = [];
    for (let m = startM; m <= endM; m++) {
      const sum = payes
        .filter((t) => {
          const d = t.date_paiement ?? t.date;
          const mm = parseInt(d.slice(5, 7)) - 1;
          const yy = parseInt(d.slice(0, 4));
          return yy === year && mm === m;
        })
        .reduce((s, t) => s + t.montant, 0);
      months.push({ label: MOIS_LABELS_SHORT[m], value: sum });
    }
    return months;
  }, [txInPeriod, periodType, year, monthOrQuarter]);

  // ═══ Section 2 — Heures ═══
  const sessionsInPeriod = useMemo(
    () => sessions.filter((s) => s.date >= periodStart && s.date <= periodEnd),
    [sessions, periodStart, periodEnd]
  );

  const totalHeures = sessionsInPeriod.reduce((s, x) => s + x.duree, 0);
  const heuresFacturables = sessionsInPeriod
    .filter((x) => x.facturable)
    .reduce((s, x) => s + x.duree, 0);
  const tauxFacturable =
    totalHeures > 0 ? (heuresFacturables / totalHeures) * 100 : 0;

  const heuresParProjet = useMemo(() => {
    const map = new Map<string, { nom: string; heures: number }>();
    for (const s of sessionsInPeriod) {
      if (!s.facturable) continue;
      const nom = s.projets?.nom ?? "Inconnu";
      const existing = map.get(s.projet_id);
      if (existing) existing.heures += s.duree;
      else map.set(s.projet_id, { nom, heures: s.duree });
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.heures - a.heures);
  }, [sessionsInPeriod]);

  // Top 5 projets + Autres (pour donut)
  const donutData = useMemo(() => {
    const top5 = heuresParProjet.slice(0, 5);
    const rest = heuresParProjet.slice(5);
    const autres = rest.reduce((s, p) => s + p.heures, 0);
    const base = top5.map((p) => ({ label: p.nom, value: p.heures }));
    return autres > 0 ? [...base, { label: "Autres", value: autres }] : base;
  }, [heuresParProjet]);

  // ═══ Section 3 — Valeur temps ═══
  const valeurTempsParProjet = useMemo(() => {
    return heuresParProjet.map((p) => {
      const tjm = tjmParProjet.get(p.id) ?? 0;
      const valeur = p.heures * (tjm / 8);
      return { ...p, tjm, valeur };
    });
  }, [heuresParProjet, tjmParProjet]);

  const valeurTempsTotale = valeurTempsParProjet.reduce((s, p) => s + p.valeur, 0);

  // ═══ Export PDF (vectoriel, jsPDF uniquement) ═══
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(now),
    [now]
  );

  async function downloadPdf() {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");

      const PAGE_W = 210;
      const PAGE_H = 297;
      const MARGIN = 20;
      const CONTENT_W = PAGE_W - 2 * MARGIN;

      const GREEN: [number, number, number] = [10, 207, 131];
      const DARK: [number, number, number] = [26, 26, 26];
      const GREY: [number, number, number] = [118, 118, 118];
      const LIGHT: [number, number, number] = [235, 235, 235];
      const BG_CARD: [number, number, number] = [250, 250, 250];

      let y = MARGIN;

      const ensureSpace = (needed: number) => {
        if (y + needed > PAGE_H - MARGIN) {
          pdf.addPage();
          y = MARGIN;
        }
      };

      // ─── Header ───
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(...DARK);
      pdf.text(`Rapport ${periodTypeLabel(periodType)} — ${label}`, MARGIN, y + 6);
      y += 10;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...GREY);
      pdf.text("Léo Roy — Product Designer", MARGIN, y + 4);
      pdf.text(`Généré le ${generatedAt}`, PAGE_W - MARGIN, y + 4, {
        align: "right",
      });
      y += 8;

      pdf.setDrawColor(...LIGHT);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 8;

      // ─── Helpers ───
      const sectionTitle = (txt: string) => {
        ensureSpace(12);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(...GREEN);
        pdf.text(txt, MARGIN, y + 4);
        y += 8;
      };

      const drawKpis = (
        kpis: { label: string; value: string; sub?: string }[]
      ) => {
        const n = kpis.length;
        const gap = 3;
        const w = (CONTENT_W - gap * (n - 1)) / n;
        const h = kpis.some((k) => k.sub) ? 22 : 18;
        ensureSpace(h + 5);
        kpis.forEach((k, i) => {
          const x = MARGIN + i * (w + gap);
          pdf.setDrawColor(...LIGHT);
          pdf.setFillColor(...BG_CARD);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(...GREY);
          pdf.text(k.label, x + 3, y + 5);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.setTextColor(...DARK);
          pdf.text(k.value, x + 3, y + 12);
          if (k.sub) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.setTextColor(...GREY);
            pdf.text(k.sub, x + 3, y + 18);
          }
        });
        y += h + 5;
      };

      const drawProgress = (
        label: string,
        current: number,
        target: number
      ) => {
        ensureSpace(12);
        const pct = target > 0 ? current / target : 0;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...GREY);
        pdf.text(
          `${label} : ${formatEuro(current)} / ${formatEuro(target)}  (${(
            pct * 100
          ).toFixed(0)}%)`,
          MARGIN,
          y + 3
        );
        y += 5;
        const barH = 3;
        pdf.setFillColor(...LIGHT);
        pdf.roundedRect(MARGIN, y, CONTENT_W, barH, 1, 1, "F");
        pdf.setFillColor(...GREEN);
        const fillW = CONTENT_W * Math.max(0, Math.min(pct, 1));
        if (fillW > 0) {
          pdf.roundedRect(MARGIN, y, fillW, barH, 1, 1, "F");
        }
        y += barH + 6;
      };

      const drawBarChart = (data: { label: string; value: number }[]) => {
        if (data.length === 0) return;
        const chartH = 45;
        ensureSpace(chartH + 12);
        const maxVal = Math.max(...data.map((d) => d.value), 1);
        const gap = 3;
        const barW = (CONTENT_W - gap * (data.length - 1)) / data.length;

        // Axe horizontal
        pdf.setDrawColor(...LIGHT);
        pdf.setLineWidth(0.2);
        pdf.line(MARGIN, y + chartH, MARGIN + CONTENT_W, y + chartH);

        data.forEach((d, i) => {
          const h = (d.value / maxVal) * (chartH - 6);
          const x = MARGIN + i * (barW + gap);
          const bY = y + chartH - h;
          pdf.setFillColor(...GREEN);
          pdf.rect(x, bY, barW, h, "F");

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(...GREY);
          pdf.text(d.label, x + barW / 2, y + chartH + 4, { align: "center" });

          if (d.value > 0) {
            pdf.setFontSize(7);
            pdf.setTextColor(...DARK);
            pdf.text(formatEuroCompact(d.value), x + barW / 2, bY - 1.2, {
              align: "center",
            });
          }
        });
        y += chartH + 10;
      };

      const drawDonut = (segments: { label: string; value: number }[]) => {
        const total = segments.reduce((s, x) => s + x.value, 0);
        if (total === 0) return;
        const donutH = 55;
        ensureSpace(donutH);

        const cx = MARGIN + 25;
        const cy = y + 25;
        const r = 22;
        const rInner = 12;
        let startAngle = -Math.PI / 2;

        segments.forEach((seg, i) => {
          const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
          const portion = seg.value / total;
          const endAngle = startAngle + portion * Math.PI * 2;
          const steps = Math.max(6, Math.ceil(portion * 80));
          pdf.setFillColor(...color);
          for (let k = 0; k < steps; k++) {
            const a1 = startAngle + ((endAngle - startAngle) * k) / steps;
            const a2 =
              startAngle + ((endAngle - startAngle) * (k + 1)) / steps;
            const x1 = cx + Math.cos(a1) * r;
            const y1 = cy + Math.sin(a1) * r;
            const x2 = cx + Math.cos(a2) * r;
            const y2 = cy + Math.sin(a2) * r;
            pdf.triangle(cx, cy, x1, y1, x2, y2, "F");
          }
          startAngle = endAngle;
        });

        // Centre blanc (effet donut)
        pdf.setFillColor(255, 255, 255);
        pdf.circle(cx, cy, rInner, "F");

        // Légende
        const legendX = MARGIN + 55;
        let legendY = y + 4;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        segments.forEach((seg, i) => {
          const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
          pdf.setFillColor(...color);
          pdf.rect(legendX, legendY, 3, 3, "F");
          pdf.setTextColor(...DARK);
          const pct = ((seg.value / total) * 100).toFixed(0);
          pdf.text(
            `${trunc(seg.label, 28)}  —  ${seg.value.toFixed(1)} h  (${pct}%)`,
            legendX + 5,
            legendY + 2.5
          );
          legendY += 6;
        });

        y += donutH;
      };

      const drawTable = (
        headers: string[],
        rows: string[][],
        aligns: ("l" | "r")[],
        colRatios?: number[]
      ) => {
        const rowH = 6;
        const n = headers.length;
        const ratios = colRatios ?? new Array(n).fill(1);
        const sumRatios = ratios.reduce((s, r) => s + r, 0);
        const colWidths = ratios.map((r) => (CONTENT_W * r) / sumRatios);
        const colX = colWidths.map((_, i) =>
          colWidths.slice(0, i).reduce((s, w) => s + w, MARGIN)
        );

        ensureSpace(rowH * (rows.length + 1) + 4);

        // Header
        pdf.setFillColor(...LIGHT);
        pdf.rect(MARGIN, y, CONTENT_W, rowH, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...DARK);
        headers.forEach((h, i) => {
          const align = aligns[i];
          const x =
            align === "r" ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
          pdf.text(h, x, y + 4, { align: align === "r" ? "right" : "left" });
        });
        y += rowH;

        // Rows
        pdf.setFont("helvetica", "normal");
        rows.forEach((row, ri) => {
          if (y + rowH > PAGE_H - MARGIN) {
            pdf.addPage();
            y = MARGIN;
          }
          if (ri % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(MARGIN, y, CONTENT_W, rowH, "F");
          }
          pdf.setTextColor(...DARK);
          row.forEach((cell, ci) => {
            const align = aligns[ci];
            const x =
              align === "r" ? colX[ci] + colWidths[ci] - 2 : colX[ci] + 2;
            pdf.text(cell, x, y + 4, {
              align: align === "r" ? "right" : "left",
            });
          });
          y += rowH;
        });
        y += 4;
      };

      // ─── Section 1 — CA ───
      sectionTitle("1. Chiffre d'affaires");
      drawKpis([
        { label: "CA payé", value: formatEuro(caPaye) },
        { label: "CA signé", value: formatEuro(caSigne) },
        {
          label: "Net estimé après taxes",
          value: formatEuro(netEstime),
          sub: `URSSAF ${(tauxUrssaf * 100).toFixed(1)}% + impôts ${(
            tauxImpots * 100
          ).toFixed(1)}%`,
        },
      ]);
      if (objectifPeriode > 0) {
        drawProgress("Objectif de la période", caPaye, objectifPeriode);
      }
      drawBarChart(caChartData);

      // ─── Section 2 — Heures ───
      sectionTitle("2. Heures");
      drawKpis([
        { label: "Total heures", value: formatHeures(totalHeures) },
        { label: "Heures facturables", value: formatHeures(heuresFacturables) },
        { label: "Taux facturable", value: `${tauxFacturable.toFixed(0)}%` },
      ]);

      if (donutData.length > 0) {
        drawDonut(donutData);
      }

      if (heuresParProjet.length > 0) {
        drawTable(
          ["Projet", "Heures facturables", "% du total"],
          heuresParProjet.map((p) => [
            trunc(p.nom, 40),
            formatHeures(p.heures),
            heuresFacturables > 0
              ? `${((p.heures / heuresFacturables) * 100).toFixed(0)}%`
              : "—",
          ]),
          ["l", "r", "r"],
          [2, 1, 1]
        );
      }

      // ─── Section 3 — Valeur temps (si toggle) ───
      if (includeValeurTemps) {
        sectionTitle("3. Valeur temps facturable");
        drawKpis([
          {
            label: "Valeur temps totale",
            value: formatEuro(valeurTempsTotale),
          },
        ]);

        if (valeurTempsParProjet.length > 0) {
          drawTable(
            ["Projet", "Heures fact.", "TJM", "Valeur produite"],
            valeurTempsParProjet.map((p) => [
              trunc(p.nom, 32),
              formatHeures(p.heures),
              p.tjm > 0 ? formatEuro(p.tjm) : "—",
              formatEuro(p.valeur),
            ]),
            ["l", "r", "r", "r"],
            [2, 1, 1, 1]
          );
        }
      }

      // Footer pages
      const pageCount = pdf.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        pdf.setPage(p);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(...GREY);
        pdf.text(
          `Freelance OS — Rapport ${label}`,
          MARGIN,
          PAGE_H - 10
        );
        pdf.text(`${p} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 10, {
          align: "right",
        });
      }

      const filename = `rapport-leo-roy-${periodSlug(
        periodType,
        year,
        monthOrQuarter
      )}.pdf`;
      pdf.save(filename);
      toast.success("Rapport téléchargé");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  }

  const years = useMemo(() => {
    const set = new Set<number>();
    transactions.forEach((t) => set.add(new Date(t.date).getFullYear()));
    sessions.forEach((s) => set.add(new Date(s.date).getFullYear()));
    set.add(now.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [transactions, sessions, now]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header contrôles */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rapport</h1>
          <p className="text-sm text-muted-foreground">
            Rapports synthétiques exportables en PDF vectoriel léger.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">
              Période
            </label>
            <Select
              value={periodType}
              onValueChange={(v) => v && handlePeriodTypeChange(v as PeriodType)}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mois">Mois</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="annee">Année</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodType !== "annee" && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                {periodType === "mois" ? "Mois" : "Trimestre"}
              </label>
              <Select
                value={String(monthOrQuarter)}
                onValueChange={(v) => v && setMonthOrQuarter(parseInt(v))}
              >
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodType === "mois"
                    ? MOIS_LABELS.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))
                    : [1, 2, 3, 4].map((q) => (
                        <SelectItem key={q} value={String(q)}>
                          T{q}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">
              Année
            </label>
            <Select
              value={String(year)}
              onValueChange={(v) => v && setYear(parseInt(v))}
            >
              <SelectTrigger className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={downloadPdf} disabled={exporting}>
            <Download data-icon="inline-start" />
            {exporting ? "Export..." : "Télécharger en PDF"}
          </Button>
        </div>
      </div>

      {/* Toggle valeur temps */}
      <div className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] px-4 py-3">
        <Switch
          id="valeur-temps-toggle"
          checked={includeValeurTemps}
          onCheckedChange={setIncludeValeurTemps}
        />
        <Label
          htmlFor="valeur-temps-toggle"
          className="cursor-pointer text-sm"
        >
          Inclure la valeur temps facturable
        </Label>
        <span className="text-xs text-muted-foreground">
          Ajoute une section détaillant la valeur produite par projet.
        </span>
      </div>

      {/* Aperçu */}
      <div className="space-y-6">
        {/* Header de rapport */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
          <div>
            <h2 className="text-xl font-bold font-heading">
              Rapport {periodTypeLabel(periodType)} — {label}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Léo Roy — Product Designer
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Généré le</div>
            <div className="text-sm font-medium">{generatedAt}</div>
          </div>
        </div>

        {/* Section 1 — CA */}
        <Card>
          <CardHeader>
            <CardTitle>1. Chiffre d&apos;affaires</CardTitle>
            <CardDescription>Période : {label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI label="CA payé" value={formatEuro(caPaye)} accent />
              <KPI label="CA signé" value={formatEuro(caSigne)} />
              <KPI
                label="Net estimé après taxes"
                value={formatEuro(netEstime)}
                sub={`URSSAF ${(tauxUrssaf * 100).toFixed(1)}% + impôts ${(
                  tauxImpots * 100
                ).toFixed(1)}%`}
              />
            </div>

            {objectifPeriode > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Objectif : {formatEuro(caPaye)} / {formatEuro(objectifPeriode)}
                  </span>
                  <span className="font-medium text-[#0ACF83]">
                    {pctObjectif.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#0F0F0F]">
                  <div
                    className="h-full rounded-full bg-[#0ACF83]"
                    style={{
                      width: `${Math.max(0, Math.min(pctObjectif, 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <MiniBarChart data={caChartData} />
          </CardContent>
        </Card>

        {/* Section 2 — Heures */}
        <Card>
          <CardHeader>
            <CardTitle>2. Heures</CardTitle>
            <CardDescription>
              Répartition du temps logué sur la période
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI label="Total heures" value={formatHeures(totalHeures)} />
              <KPI
                label="Heures facturables"
                value={formatHeures(heuresFacturables)}
                accent
              />
              <KPI
                label="Taux facturable"
                value={`${tauxFacturable.toFixed(0)}%`}
              />
            </div>

            {donutData.length > 0 && <DonutLegend data={donutData} />}

            {heuresParProjet.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead className="text-right">
                      Heures facturables
                    </TableHead>
                    <TableHead className="text-right">% du total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heuresParProjet.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.nom}</TableCell>
                      <TableCell className="text-right">
                        {formatHeures(p.heures)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {heuresFacturables > 0
                          ? `${((p.heures / heuresFacturables) * 100).toFixed(
                              0
                            )}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune heure facturable sur la période.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 3 — Valeur temps (si toggle) */}
        {includeValeurTemps && (
          <Card>
            <CardHeader>
              <CardTitle>3. Valeur temps facturable</CardTitle>
              <CardDescription>
                Heures facturables × TJM horaire par projet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-1">
                <KPI
                  label="Valeur temps totale de la période"
                  value={formatEuro(valeurTempsTotale)}
                  accent
                />
              </div>

              {valeurTempsParProjet.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projet</TableHead>
                      <TableHead className="text-right">
                        Heures fact.
                      </TableHead>
                      <TableHead className="text-right">TJM</TableHead>
                      <TableHead className="text-right">
                        Valeur produite
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valeurTempsParProjet.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.nom}</TableCell>
                        <TableCell className="text-right">
                          {formatHeures(p.heures)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {p.tjm > 0 ? formatEuro(p.tjm) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatEuro(p.valeur)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun projet avec heures facturables sur la période.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-xl font-bold ${
          accent ? "text-[#0ACF83]" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        CA payé par période
      </div>
      <div className="flex h-32 items-end gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-3">
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full text-center text-[10px] text-muted-foreground">
                {d.value > 0 ? formatEuroCompact(d.value) : ""}
              </div>
              <div
                className="w-full rounded-t bg-[#0ACF83]"
                style={{ height: `${h}%`, minHeight: d.value > 0 ? 2 : 0 }}
              />
              <div className="text-[10px] text-muted-foreground">{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutLegend({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const colors = [
    "#0ACF83",
    "#2E8AFF",
    "#EF9F27",
    "#EF4444",
    "#9333EA",
    "#9CA3AF",
  ];

  // Conic gradient
  let acc = 0;
  const stops = data
    .map((d, i) => {
      const from = (acc / total) * 100;
      acc += d.value;
      const to = (acc / total) * 100;
      return `${colors[i % colors.length]} ${from}% ${to}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div
        className="relative size-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div className="absolute inset-[22%] rounded-full bg-[#0A0A0A]" />
      </div>
      <div className="flex-1 space-y-1.5">
        {data.map((d, i) => {
          const pct = ((d.value / total) * 100).toFixed(0);
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="flex-1 truncate text-white">{d.label}</span>
              <span className="text-muted-foreground">
                {d.value.toFixed(1)} h ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
