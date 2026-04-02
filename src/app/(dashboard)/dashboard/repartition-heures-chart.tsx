"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ProjetHeures {
  nom: string;
  heures: number;
}

function generateColors(count: number): string[] {
  const base = [1, 0.7, 0.5, 0.35, 0.22, 0.14, 0.08];
  return Array.from({ length: count }, (_, i) => {
    const opacity = base[i % base.length];
    return `rgba(10,207,131,${opacity})`;
  });
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ProjetHeures & { percent: number } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-white mb-0.5">{d.nom}</p>
      <p className="text-[#0ACF83]">{d.heures.toFixed(1)}h</p>
      <p className="text-[#767676]">{(d.percent * 100).toFixed(0)}%</p>
    </div>
  );
}

export function RepartitionHeuresChart({ data }: { data: ProjetHeures[] }) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.heures - a.heures),
    [data]
  );

  const total = useMemo(
    () => sorted.reduce((s, d) => s + d.heures, 0),
    [sorted]
  );

  const withPercent = useMemo(
    () => sorted.map((d) => ({ ...d, percent: total > 0 ? d.heures / total : 0 })),
    [sorted, total]
  );

  const colors = useMemo(() => generateColors(sorted.length), [sorted.length]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-sm text-[#767676]">
        Aucune donnee
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={250}>
        <PieChart>
          <Pie
            data={withPercent}
            dataKey="heures"
            nameKey="nom"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            strokeWidth={0}
            paddingAngle={2}
          >
            {withPercent.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5 min-w-0">
        {sorted.slice(0, 6).map((item, i) => (
          <div key={item.nom} className="flex items-center gap-2 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: colors[i] }}
            />
            <span className="text-white truncate flex-1">{item.nom}</span>
            <span className="text-[#767676] shrink-0">{item.heures.toFixed(1)}h</span>
          </div>
        ))}
        {sorted.length > 6 && (
          <p className="text-xs text-[#767676] pl-[18px]">
            +{sorted.length - 6} autres
          </p>
        )}
      </div>
    </div>
  );
}
