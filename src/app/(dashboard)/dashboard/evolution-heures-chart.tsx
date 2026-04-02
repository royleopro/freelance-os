"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
} from "recharts";

interface DataPoint {
  label: string;
  heures: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-white mb-0.5">{label}</p>
      <p className="text-[#0ACF83]">{payload[0].value.toFixed(1)}h</p>
    </div>
  );
}

export function EvolutionHeuresChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-[#767676]">
        Aucune donnee
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="heuresGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ACF83" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#0ACF83" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "#767676", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#767676", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}h`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
        <Area
          type="monotone"
          dataKey="heures"
          fill="url(#heuresGradient)"
          stroke="transparent"
        />
        <Line
          type="monotone"
          dataKey="heures"
          stroke="#0ACF83"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#0ACF83", stroke: "#0A0A0A", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
