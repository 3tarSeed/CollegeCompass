"use client";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { INCOME_BAND_LABELS, RACE_LABELS, type College, type IncomeBand, type RaceKey } from "@/lib/types";
import { fmtMoney } from "@/lib/format";
import type { CostBreakdown } from "@/lib/cost";

export function NetPriceByIncomeChart({
  college,
  highlightBand,
}: {
  college: College;
  highlightBand?: IncomeBand | "";
}) {
  if (!college.netPriceByIncome) {
    return <p className="text-sm text-slate-500">Net price by income band: Not reported.</p>;
  }
  const data = (Object.keys(INCOME_BAND_LABELS) as IncomeBand[])
    .filter((b) => college.netPriceByIncome?.[b] != null)
    .map((b) => ({ band: b, label: INCOME_BAND_LABELS[b], value: college.netPriceByIncome![b] as number }));
  return (
    <div className="h-56" role="img" aria-label="Average net price by household income band">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={42} />
          <Tooltip formatter={(v) => fmtMoney(v as number)} labelFormatter={(l) => `Household income ${l}`} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.band} fill={d.band === highlightBand ? "#0F766E" : "#2563EB"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostStackChart({ cost }: { cost: CostBreakdown }) {
  const rows = [
    { label: "Tuition", value: cost.tuition },
    { label: "Fees", value: cost.fees },
    { label: "Housing & meals", value: cost.housingMeals },
    { label: "Books", value: cost.books },
    { label: "Transportation", value: cost.transportation },
    { label: "Personal", value: cost.personal },
  ].filter((r) => r.value !== null) as { label: string; value: number }[];
  if (rows.length === 0) return <p className="text-sm text-slate-500">Cost components: Not reported.</p>;
  return (
    <div className="h-52" role="img" aria-label="Annual cost components">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis type="number" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => fmtMoney(v as number)} />
          <Bar dataKey="value" fill="#17365D" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DemographicsChart({ college }: { college: College }) {
  if (!college.demographics) {
    return <p className="text-sm text-slate-500">Student demographics: Not reported.</p>;
  }
  const data = (Object.keys(RACE_LABELS) as RaceKey[])
    .map((k) => ({ label: RACE_LABELS[k], value: college.demographics?.[k] ?? null }))
    .filter((d): d is { label: string; value: number } => d.value !== null)
    .sort((a, b) => b.value - a.value);
  if (data.length === 0) return <p className="text-sm text-slate-500">Student demographics: Not reported.</p>;
  return (
    <div style={{ height: 30 * data.length + 30 }} role="img" aria-label="Share of enrolled students by race and ethnicity">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <XAxis type="number" domain={[0, Math.max(0.5, data[0].value)]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={190} tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `${((v as number) * 100).toFixed(1)}%`} />
          <Bar dataKey="value" fill="#2563EB" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
