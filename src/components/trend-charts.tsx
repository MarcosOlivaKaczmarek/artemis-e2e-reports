"use client";

import { TrendPoint } from "@/lib/types";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function PassRateChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleDateString()}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${Number(value)?.toFixed(1)}%`, "Pass Rate"]}
        />
        <Line
          type="monotone"
          dataKey="avg_pass_rate"
          stroke="hsl(142, 76%, 36%)"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Pass Rate"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CoverageChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleDateString()}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${Number(value)?.toFixed(1)}%`, "Coverage"]}
        />
        <Area
          type="monotone"
          dataKey="avg_coverage"
          stroke="hsl(221, 83%, 53%)"
          fill="hsl(221, 83%, 53%)"
          fillOpacity={0.2}
          strokeWidth={2}
          name="Coverage"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
