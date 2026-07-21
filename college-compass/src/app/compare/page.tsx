"use client";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ConfidenceBadge, FitBadge } from "@/components/FitBadge";
import { EmptyState, LoadingState, Pill, SampleBadge } from "@/components/ui";
import { classifyFit } from "@/lib/fit";
import { estimateCost, type CostBreakdown } from "@/lib/cost";
import { valueScore } from "@/lib/score";
import {
  fmtDate, fmtMoney, fmtNum, fmtPct, fmtRange, NOT_REPORTED, OWNERSHIP_LABELS, PLAN_LABELS, TEST_POLICY_LABELS,
} from "@/lib/format";
import type { College } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

type Best = "high" | "low" | "none";
interface RowDef {
  label: string;
  best: Best;
  value: (c: College, cost: CostBreakdown) => number | null; // numeric for best-highlighting; null = non-numeric or missing
  render: (c: College, cost: CostBreakdown) => React.ReactNode;
}

function section(title: string, rows: RowDef[]) {
  return { title, rows };
}

export default function ComparePage() {
  const { ready, profile, colleges, compareIds, toggleCompare } = useApp();
  const [hideIdentical, setHideIdentical] = useState(false);
  const [highlightBest, setHighlightBest] = useState(true);

  const selected = compareIds
    .map((id) => colleges.find((c) => c.id === id))
    .filter((c): c is College => Boolean(c));

  const costs = useMemo(
    () => new Map(selected.map((c) => [c.id, estimateCost(profile, c)])),
    [selected, profile],
  );

  const sections = useMemo(() => {
    const money = (v: number | null) => fmtMoney(v);
    return [
      section("Personalized summary", [
        {
          label: "Admissions fit",
          best: "none",
          value: () => null,
          render: (c) => {
            const f = classifyFit(profile, c);
            return (
              <span className="flex flex-col items-start gap-1">
                <FitBadge category={f.category} />
                <ConfidenceBadge confidence={f.confidence} />
              </span>
            );
          },
        },
        {
          label: "Value & Fit score (personal)",
          best: "high",
          value: (c) => valueScore(profile, c).total,
          render: (c) => `${valueScore(profile, c).total}/100`,
        },
        {
          label: "Your est. net cost / yr",
          best: "low",
          value: (_c, cost) => cost.netAnnual,
          render: (_c, cost) => money(cost.netAnnual),
        },
      ]),
      section("Admissions", [
        { label: "Acceptance rate", best: "high", value: (c) => c.acceptanceRate, render: (c) => fmtPct(c.acceptanceRate) },
        { label: "ACT middle 50%", best: "none", value: () => null, render: (c) => fmtRange(c.act25, c.act75) },
        { label: "SAT middle 50%", best: "none", value: () => null, render: (c) => fmtRange(c.sat25, c.sat75) },
        { label: "Test policy", best: "none", value: () => null, render: (c) => TEST_POLICY_LABELS[c.testPolicy] },
      ]),
      section("Application requirements", [
        { label: "Application fee", best: "low", value: (c) => c.applicationFee, render: (c) => money(c.applicationFee) },
        {
          label: "Required materials",
          best: "none",
          value: () => null,
          render: (c) =>
            c.requirements.length
              ? c.requirements.filter((r) => r.required).map((r) => r.label).join(", ")
              : NOT_REPORTED,
        },
      ]),
      section("Deadlines", [
        {
          label: "Earliest application deadline",
          best: "none",
          value: () => null,
          render: (c) => {
            const d = c.deadlines
              .filter((x) => x.dueDate && x.plan !== "fafsa" && x.plan !== "css" && x.plan !== "scholarship")
              .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
            return d ? `${PLAN_LABELS[d.plan] ?? d.plan}: ${fmtDate(d.dueDate)}` : NOT_REPORTED;
          },
        },
        {
          label: "Regular decision deadline",
          best: "none",
          value: () => null,
          render: (c) => fmtDate(c.deadlines.find((d) => d.plan === "regular")?.dueDate ?? null),
        },
      ]),
      section("Cost of attendance", [
        { label: "Tuition (your residency)", best: "low", value: (_c, cost) => cost.tuition, render: (_c, cost) => money(cost.tuition) },
        { label: "Housing & meals", best: "low", value: (c) => c.housingMeals, render: (c) => money(c.housingMeals) },
        { label: "Total COA", best: "low", value: (_c, cost) => cost.coa, render: (_c, cost) => money(cost.coa) },
      ]),
      section("Estimated personal net cost", [
        { label: "Est. net cost / yr", best: "low", value: (_c, cost) => cost.netAnnual, render: (_c, cost) => money(cost.netAnnual) },
        { label: "Est. four-year cost", best: "low", value: (_c, cost) => cost.net4Year, render: (_c, cost) => money(cost.net4Year) },
        { label: "Est. borrowing (4 yrs)", best: "low", value: (_c, cost) => cost.borrowing4Year, render: (_c, cost) => money(cost.borrowing4Year) },
      ]),
      section("Grants & financial aid", [
        { label: "Average grant aid", best: "high", value: (c) => c.avgGrantAid, render: (c) => money(c.avgGrantAid) },
        { label: "Average net price (all students)", best: "low", value: (c) => c.avgNetPrice, render: (c) => money(c.avgNetPrice) },
        {
          label: "Meets full need",
          best: "none",
          value: () => null,
          render: (c) => (c.financialAid?.meetsFullNeed == null ? NOT_REPORTED : c.financialAid.meetsFullNeed ? "Yes" : "No"),
        },
        {
          label: "CSS Profile required",
          best: "none",
          value: () => null,
          render: (c) => (c.financialAid?.requiresCssProfile == null ? NOT_REPORTED : c.financialAid.requiresCssProfile ? "Yes" : "No"),
        },
      ]),
      section("Graduation & retention", [
        { label: "Graduation rate", best: "high", value: (c) => c.graduationRate, render: (c) => fmtPct(c.graduationRate) },
        { label: "Retention rate", best: "high", value: (c) => c.retentionRate, render: (c) => fmtPct(c.retentionRate) },
      ]),
      section("Debt & earnings", [
        { label: "Typical federal debt", best: "low", value: (c) => c.medianFederalDebt, render: (c) => money(c.medianFederalDebt) },
        { label: "Median earnings (10 yr)", best: "high", value: (c) => c.medianEarnings10yr, render: (c) => money(c.medianEarnings10yr) },
      ]),
      section("Campus characteristics", [
        { label: "Type", best: "none", value: () => null, render: (c) => (c.ownership ? OWNERSHIP_LABELS[c.ownership] : NOT_REPORTED) },
        { label: "Enrollment", best: "none", value: () => null, render: (c) => fmtNum(c.enrollment) },
        { label: "Setting", best: "none", value: () => null, render: (c) => c.campusSetting ?? NOT_REPORTED },
        { label: "NCAA division", best: "none", value: () => null, render: (c) => c.ncaaDivision ?? NOT_REPORTED },
        { label: "Location", best: "none", value: () => null, render: (c) => `${c.city ?? "—"}, ${c.state ?? "—"}` },
      ]),
      section("Academic programs", [
        {
          label: "Your intended majors offered",
          best: "high",
          value: (c) =>
            profile.intendedMajors.filter((m) =>
              c.majors.some((x) => x.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(x.toLowerCase())),
            ).length,
          render: (c) => {
            const matched = profile.intendedMajors.filter((m) =>
              c.majors.some((x) => x.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(x.toLowerCase())),
            );
            return matched.length ? matched.join(", ") : profile.intendedMajors.length ? "None of your majors" : "No majors set";
          },
        },
        { label: "Programs listed", best: "none", value: () => null, render: (c) => (c.majors.length ? c.majors.join(", ") : NOT_REPORTED) },
      ]),
    ];
  }, [profile]);

  if (!ready) return <LoadingState label="Loading comparison…" />;

  if (selected.length === 0) {
    return (
      <EmptyState
        title="Nothing to compare yet"
        body="Add up to five colleges to your comparison from Find Colleges or any college page."
        action={<Link href="/find" className="btn-primary">Find colleges</Link>}
      />
    );
  }

  const isIdentical = (row: RowDef) => {
    const rendered = selected.map((c) => {
      const node = row.render(c, costs.get(c.id)!);
      return typeof node === "string" || typeof node === "number" ? String(node) : "__complex__";
    });
    return rendered.every((v) => v !== "__complex__" && v === rendered[0]);
  };

  const bestIds = (row: RowDef): Set<string> => {
    if (row.best === "none") return new Set();
    const vals = selected
      .map((c) => ({ id: c.id, v: row.value(c, costs.get(c.id)!) }))
      .filter((x): x is { id: string; v: number } => x.v !== null && Number.isFinite(x.v));
    if (vals.length < 2) return new Set();
    const target = row.best === "high" ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
    return new Set(vals.filter((x) => x.v === target).map((x) => x.id));
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Compare</p>
          <h1 className="text-2xl font-semibold lg:text-3xl">Side by side ({selected.length}/5)</h1>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={hideIdentical} onChange={(e) => setHideIdentical(e.target.checked)} />
            Hide identical rows
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={highlightBest} onChange={(e) => setHighlightBest(e.target.checked)} />
            Highlight strongest result
          </label>
        </div>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-52 bg-white p-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-slate-500">
                Metric
              </th>
              {selected.map((c) => (
                <th key={c.id} className="sticky top-0 z-10 min-w-[180px] border-l border-slate-100 bg-white p-3 text-left align-bottom">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {c.isSample && <SampleBadge />}
                      <Link href={`/college/${c.id}`} className="mt-0.5 block font-display text-sm font-semibold leading-snug text-navy hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-[11px] font-normal text-slate-500">{c.city}, {c.state}</p>
                    </div>
                    <button
                      onClick={() => toggleCompare(c.id)}
                      aria-label={`Remove ${c.name} from comparison`}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-fitRed"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => {
              const rows = sec.rows.filter((r) => !(hideIdentical && selected.length > 1 && isIdentical(r)));
              if (rows.length === 0) return null;
              return (
                <React.Fragment key={sec.title}>
                  <tr>
                    <th
                      colSpan={selected.length + 1}
                      className="sticky left-0 bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-teal"
                    >
                      {sec.title}
                    </th>
                  </tr>
                  {rows.map((row) => {
                    const best = highlightBest ? bestIds(row) : new Set<string>();
                    return (
                      <tr key={row.label} className="border-t border-slate-100">
                        <th className="sticky left-0 z-10 bg-white p-3 text-left font-medium text-slate-600">
                          {row.label}
                        </th>
                        {selected.map((c) => (
                          <td
                            key={c.id}
                            className={`border-l border-slate-100 p-3 align-top ${best.has(c.id) ? "bg-green-50 font-semibold text-fitGreen" : "text-navy"}`}
                          >
                            {row.render(c, costs.get(c.id)!)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        <Pill tone="green">Green</Pill> marks the strongest value in each numeric row among the colleges shown.
        Estimates are app-generated; reported facts carry their source and data year on each college&apos;s page.
      </p>
    </div>
  );
}
