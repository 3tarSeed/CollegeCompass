"use client";
import Link from "next/link";
import React from "react";
import { Bookmark, BookmarkCheck, GitCompareArrows, MapPin } from "lucide-react";
import { classifyFit } from "@/lib/fit";
import { estimateCost } from "@/lib/cost";
import { valueScore } from "@/lib/score";
import { fmtMoney, fmtPct, OWNERSHIP_LABELS, NOT_REPORTED } from "@/lib/format";
import type { College } from "@/lib/types";
import { useApp } from "@/store/AppProvider";
import { ConfidenceBadge, FitBadge } from "./FitBadge";
import { Pill, SampleBadge } from "./ui";

export function CollegeCard({ college }: { college: College }) {
  const { profile, isSaved, toggleSaved, compareIds, toggleCompare } = useApp();
  const fit = classifyFit(profile, college);
  const cost = estimateCost(profile, college);
  const score = valueScore(profile, college);
  const saved = isSaved(college.id);
  const comparing = compareIds.includes(college.id);
  const compareFull = compareIds.length >= 5 && !comparing;

  return (
    <article className="card flex flex-col p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {college.isSample && <SampleBadge />}
            <Link
              href={`/college/${college.id}`}
              className="font-display text-lg font-semibold leading-snug text-navy hover:underline"
            >
              {college.name}
            </Link>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={12} aria-hidden />
            {college.city ?? NOT_REPORTED}, {college.state ?? "—"} ·{" "}
            {college.ownership ? OWNERSHIP_LABELS[college.ownership] : NOT_REPORTED} ·{" "}
            {college.level === "two_year" ? "2-year" : "4-year"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => toggleSaved(college)}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${college.name} from saved` : `Save ${college.name}`}
            className={`rounded-lg border p-2 ${saved ? "border-teal bg-teal/10 text-teal" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
          <button
            onClick={() => toggleCompare(college.id)}
            disabled={compareFull}
            aria-pressed={comparing}
            aria-label={comparing ? `Remove ${college.name} from comparison` : `Add ${college.name} to comparison`}
            title={compareFull ? "Comparison is full (5 colleges max)" : undefined}
            className={`rounded-lg border p-2 disabled:opacity-40 ${comparing ? "border-brand bg-brand/10 text-brand" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
          >
            <GitCompareArrows size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FitBadge category={fit.category} />
        <ConfidenceBadge confidence={fit.confidence} />
        <Pill tone="navy">Value &amp; Fit {score.total}/100</Pill>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Acceptance</dt>
          <dd className="font-semibold text-navy">{fmtPct(college.acceptanceRate)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Your est. net/yr</dt>
          <dd className="font-semibold text-navy">{fmtMoney(cost.netAnnual)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Grad rate</dt>
          <dd className="font-semibold text-navy">{fmtPct(college.graduationRate)}</dd>
        </div>
      </dl>
    </article>
  );
}
