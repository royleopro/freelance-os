"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { ChevronLeft, ChevronRight, BarChart3, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SessionHeureAvecProjet, Devis } from "@/lib/types";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PROJECT_PALETTE = [
  "#0ACF83", "#0891B2", "#06B6D4", "#10B981", "#34D399", "#6EE7B7", "#A78BFA",
];

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS_COURTS = [
  "jan.", "fév.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function getMondayOf(offset: number): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  monday.setDate(monday.getDate() + offset * 7);
  return monday;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const formatHeures = (h: number): string => {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm > 0 ? hh + "h" + String(mm).padStart(2, "0") : hh + "h";
};

function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const dM = monday.getDate();
  const mM = MOIS_COURTS[monday.getMonth()];
  const dS = sunday.getDate();
  const mS = MOIS_COURTS[sunday.getMonth()];
  if (monday.getMonth() === sunday.getMonth()) {
    return `${dM} – ${dS} ${mS}`;
  }
  return `${dM} ${mM} – ${dS} ${mS}`;
}

interface DayData {
  jour: string;
  date: string;
  total: number;
  isToday: boolean;
  [key: string]: string | number | boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DayTick(props: any) {
  const { x, y, payload, todayJour } = props;
  const isToday = payload.value === todayJour;
  return (
    <text
      x={x}
      y={y + 14}
      textAnchor="middle"
      fill={isToday ? "#ffffff" : "#767676"}
      fontSize={11}
      fontWeight={isToday ? 600 : 400}
    >
      {payload.value}
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderTotalLabel(props: any) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const w = Number(props.width ?? 0);
  const v = Number(props.value ?? 0);
  if (v <= 0) return null;
  return (
    <text
      x={x + w / 2}
      y={y - 8}
      textAnchor="middle"
      fill="#767676"
      fontSize={11}
    >
      {formatHeures(v)}
    </text>
  );
}

function CustomTooltip({
  active,
  payload,
  colorMap,
}: {
  active?: boolean;
  payload?: { name: string; value: number; dataKey: string }[];
  label?: string;
  colorMap: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.dataKey !== "total" && p.value > 0);
  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: "#1A1A1A",
        border: "1px solid #2A2A2A",
        borderRadius: 6,
        padding: 8,
        fontSize: 12,
      }}
    >
      {items.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2" style={{ padding: "2px 0" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: colorMap[item.dataKey] || "#999",
              flexShrink: 0,
            }}
          />
          <span style={{ color: "#999", fontSize: 12 }}>{item.dataKey}</span>
          <span style={{ color: colorMap[item.dataKey] || "#fff", fontSize: 12, fontWeight: 500, marginLeft: "auto" }}>
            {formatHeures(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const formatEuro = (n: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export function SemaineChart() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [sessions, setSessions] = useState<SessionHeureAvecProjet[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);

  const monday = useMemo(() => getMondayOf(weekOffset), [weekOffset]);
  const sunday = useMemo(() => {
    const s = new Date(monday);
    s.setDate(monday.getDate() + 6);
    return s;
  }, [monday]);

  const isCurrentWeek = weekOffset === 0;
  const todayISO = toISO(new Date());

  const fetchWeekSessions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [sessionsRes, devisRes] = await Promise.all([
      supabase
        .from("sessions_heures")
        .select("*, projets(nom, type)")
        .gte("date", toISO(monday))
        .lte("date", toISO(sunday))
        .order("date", { ascending: true }),
      supabase
        .from("devis")
        .select("*")
        .eq("statut", "signe"),
    ]);
    setSessions((sessionsRes.data as SessionHeureAvecProjet[]) ?? []);
    setDevis((devisRes.data as Devis[]) ?? []);
    setLoading(false);
  }, [monday, sunday]);

  useEffect(() => {
    fetchWeekSessions();
  }, [fetchWeekSessions]);

  const { data, projectNames, colorMap, todayJour } = useMemo(() => {
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(toISO(d));
    }

    const projectSet = new Set<string>();
    sessions.forEach((s) => projectSet.add(s.projets?.nom ?? "Sans projet"));
    const projectNames = Array.from(projectSet);

    const colorMap: Record<string, string> = {};
    projectNames.forEach((name, i) => {
      colorMap[name] = PROJECT_PALETTE[i % PROJECT_PALETTE.length];
    });

    let todayJour = "";

    const data: DayData[] = weekDates.map((date, i) => {
      const isToday = date === todayISO;
      if (isToday) todayJour = JOURS[i];

      const row: DayData = { jour: JOURS[i], date, total: 0, isToday };
      const daySessions = sessions.filter((s) => s.date === date);
      projectNames.forEach((name) => {
        const sum = daySessions
          .filter((s) => (s.projets?.nom ?? "Sans projet") === name)
          .reduce((acc, s) => acc + s.duree, 0);
        row[name] = sum;
        row.total += sum;
      });
      return row;
    });

    return { data, projectNames, colorMap, todayJour };
  }, [sessions, monday, todayISO]);

  const totalSemaine = useMemo(
    () => data.reduce((sum, d) => sum + d.total, 0),
    [data],
  );

  // TJM par projet = montant_total / jours_signes du dernier devis signé
  const valeurTempsBreakdown = useMemo(() => {
    const tjmMap = new Map<string, number>();
    const sorted = [...devis]
      .filter((d) => d.jours_signes > 0)
      .sort((a, b) => {
        const da = a.date_signature ?? a.created_at;
        const db = b.date_signature ?? b.created_at;
        return db.localeCompare(da);
      });
    for (const d of sorted) {
      if (d.projet_id && !tjmMap.has(d.projet_id)) {
        tjmMap.set(d.projet_id, d.montant_total / d.jours_signes);
      }
    }

    const byProjet = new Map<string, { nom: string; valeur: number }>();
    for (const s of sessions) {
      if (!s.facturable) continue;
      const tjm = tjmMap.get(s.projet_id) || 0;
      if (tjm <= 0) continue;
      const val = s.duree * (tjm / 8);
      const existing = byProjet.get(s.projet_id);
      if (existing) existing.valeur += val;
      else
        byProjet.set(s.projet_id, {
          nom: s.projets?.nom ?? "Inconnu",
          valeur: val,
        });
    }
    const list = [...byProjet.values()].sort((a, b) => b.valeur - a.valeur);
    const total = list.reduce((sum, p) => sum + p.valeur, 0);
    return { list, total };
  }, [sessions, devis]);

  const valeurTemps = valeurTempsBreakdown.total;

  const hasData = projectNames.length > 0 && totalSemaine > 0;

  return (
    <div
      style={{
        background: "#0F0F0F",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <BarChart3 className="size-4" />
          Semaine en cours
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-md p-1 text-[#767676] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs font-medium text-[#999] min-w-[120px] text-center select-none">
            {weekLabel(monday)}
          </span>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={isCurrentWeek}
            className="rounded-md p-1 text-[#767676] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#767676]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="mt-3">
        <p className="text-xs text-[#767676]">Total</p>
        <p className="text-2xl font-bold text-white">{loading ? "…" : formatHeures(totalSemaine)}</p>
        {!loading && valeurTemps > 0 && (
          <div className="flex items-center gap-1.5">
            <p className="text-sm" style={{ color: "#0ACF83" }}>
              Valeur temps : {formatEuro(Math.round(valeurTemps))}
            </p>
            <UITooltip>
              <TooltipTrigger
                render={
                  <button className="text-[#767676] hover:text-[#0ACF83] transition">
                    <Info className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent
                side="right"
                className="max-w-xs !bg-[#1A1A1A] !text-white border border-[#2A2A2A] !px-3 !py-2"
              >
                <div className="space-y-1 min-w-[180px]">
                  <p className="text-[11px] font-medium text-[#767676] mb-1.5">
                    Détail par projet
                  </p>
                  {valeurTempsBreakdown.list.map((p) => (
                    <div
                      key={p.nom}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-white">{p.nom}</span>
                      <span
                        className="font-medium"
                        style={{ color: "#0ACF83" }}
                      >
                        {formatEuro(Math.round(p.valeur))}
                      </span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </UITooltip>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 180 }} className="mt-2">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#767676]">Chargement…</p>
          </div>
        ) : hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 8, left: -20, bottom: 4 }}
              barSize={24}
              barCategoryGap="25%"
            >
              <XAxis
                dataKey="jour"
                axisLine={false}
                tickLine={false}
                tick={<DayTick todayJour={todayJour} />}
                interval={0}
              />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip content={<CustomTooltip colorMap={colorMap} />} cursor={false} />

              {todayJour && (
                <ReferenceArea x1={todayJour} x2={todayJour} fill="#1A1A1A" fillOpacity={0.5} />
              )}

              {projectNames.map((name, pi) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="a"
                  fill={colorMap[name]}
                  radius={pi === projectNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  label={pi === projectNames.length - 1 ? renderTotalLabel : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#767676]">Aucune heure cette semaine</p>
          </div>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="flex flex-wrap mt-3" style={{ gap: 12 }}>
          {projectNames.map((name) => (
            <div key={name} className="flex items-center gap-1.5" style={{ fontSize: 11, color: "#767676" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: colorMap[name],
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
