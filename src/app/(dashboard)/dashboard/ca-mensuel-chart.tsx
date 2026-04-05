"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartDataItem {
  mois: string;
  objectif: number;
  paye: number;
  en_attente: number;
  urssaf?: number;
}

interface PreparedItem extends ChartDataItem {
  _max: number;
}

function formatEuroShort(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${n}`;
}

const formatEuro = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PreparedItem }[];
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-3 py-2 text-sm shadow-md">
      <p className="font-medium mb-1.5 text-white">{d.mois}</p>
      <p className="text-[#767676]">Objectif : {formatEuro(d.objectif)}</p>
      <p className="text-[#0ACF83]">Payé : {formatEuro(d.paye)}</p>
      <p style={{ color: "rgba(10,207,131,0.6)" }}>
        En attente : {formatEuro(d.en_attente)}
      </p>
      {d.urssaf !== undefined && d.urssaf > 0 && (
        <p style={{ color: "#EF9F27" }} className="mt-1 pt-1 border-t border-[rgba(255,255,255,0.06)]">
          URSSAF estimée : {formatEuro(d.urssaf)}
        </p>
      )}
    </div>
  );
}

function LayeredBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: PreparedItem;
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload || payload._max === 0) return null;

  const bottom = y + height;
  const r = 4; // border-radius top
  const ppu = height / payload._max; // pixels per unit

  const objH = payload.objectif * ppu;
  const totalSigneH = (payload.paye + payload.en_attente) * ppu;
  const payeH = payload.paye * ppu;

  // Notch position (from bottom)
  const notchY = bottom - objH;

  return (
    <g>
      {/* 1. Objectif background */}
      {payload.objectif > 0 && (
        <rect
          x={x}
          y={bottom - objH}
          width={width}
          height={objH}
          rx={r}
          ry={r}
          fill="#1E1E1E"
          stroke="#2A2A2A"
          strokeWidth={1}
        />
      )}

      {/* 2. En attente layer (payé + en_attente) */}
      {totalSigneH > 0 && (
        <rect
          x={x}
          y={bottom - totalSigneH}
          width={width}
          height={totalSigneH}
          rx={r}
          ry={r}
          fill="rgba(10,207,131,0.22)"
        />
      )}

      {/* 3. Payé layer */}
      {payeH > 0 && (
        <rect
          x={x}
          y={bottom - payeH}
          width={width}
          height={payeH}
          rx={r}
          ry={r}
          fill="#0ACF83"
        />
      )}

      {/* 4. Objectif notch — white line */}
      {payload.objectif > 0 && (
        <rect
          x={x - 3}
          y={notchY - 1}
          width={width + 6}
          height={2}
          rx={1}
          fill="rgba(255,255,255,0.5)"
        />
      )}
    </g>
  );
}

function CustomLegend() {
  const items = [
    { label: "Objectif", color: "#1E1E1E", border: "#2A2A2A" },
    { label: "En attente", color: "rgba(10,207,131,0.22)" },
    { label: "Payé", color: "#0ACF83" },
    { label: "Seuil objectif", type: "line" as const },
  ];

  return (
    <div className="flex items-center justify-center gap-5 pt-4 text-xs text-[#767676]">
      {items.map((item) =>
        item.type === "line" ? (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-4 h-[2px] rounded-full bg-white/50" />
            <span>{item.label}</span>
          </div>
        ) : (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-[2px]"
              style={{
                backgroundColor: item.color,
                border: item.border ? `1px solid ${item.border}` : undefined,
              }}
            />
            <span>{item.label}</span>
          </div>
        )
      )}
    </div>
  );
}

export function CaMensuelChart({ data }: { data: ChartDataItem[] }) {
  const prepared: PreparedItem[] = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        _max: Math.max(d.objectif, d.paye + d.en_attente, 1),
      })),
    [data]
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={prepared}
          margin={{ top: 8, right: 0, left: -10, bottom: 0 }}
          barCategoryGap="20%"
        >
          <XAxis
            dataKey="mois"
            tick={{ fill: "#767676", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatEuroShort}
            tick={{ fill: "#767676", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.02)" }}
          />
          <Bar
            dataKey="_max"
            shape={<LayeredBar />}
            maxBarSize={40}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      <CustomLegend />
    </div>
  );
}
