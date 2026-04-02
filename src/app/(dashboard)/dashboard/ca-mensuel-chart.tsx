"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartDataItem {
  mois: string;
  objectif: number;
  paye: number;
  en_attente: number;
}

const LABELS: Record<string, string> = {
  objectif: "Objectif",
  paye: "Paye",
  en_attente: "En attente",
};

function formatEuroShort(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${n}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {LABELS[entry.dataKey] ?? entry.dataKey} :{" "}
          {new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function CaMensuelChart({ data }: { data: ChartDataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(0 0% 20%)"
          vertical={false}
        />
        <XAxis
          dataKey="mois"
          tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatEuroShort}
          tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(0 0% 15%)" }} />
        <Legend
          formatter={(value: string) => LABELS[value] ?? value}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar
          dataKey="objectif"
          fill="hsl(0 0% 30%)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="paye"
          fill="hsl(152 60% 50%)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="en_attente"
          fill="#fbbf24"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
