"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/format";

export function PipelineChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <Tooltip cursor={{ fill: "var(--muted)" }} formatter={(v) => [v, "Stores"]} />
          <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostChart({ data }: { data: { label: string; est: number; actual: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} stroke="var(--muted-foreground)" />
          <YAxis tickFormatter={(v: number) => formatINR(v, true)} tick={{ fontSize: 11 }} width={72} stroke="var(--muted-foreground)" />
          <Tooltip formatter={(v) => formatINR(Number(v))} cursor={{ fill: "var(--muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="est" name="Estimated" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" name="Actual" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
