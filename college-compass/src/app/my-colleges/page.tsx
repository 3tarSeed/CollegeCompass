"use client";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { CollegeCard } from "@/components/CollegeCard";
import { EmptyState, LoadingState } from "@/components/ui";
import { classifyFit, FIT_ORDER } from "@/lib/fit";
import { estimateCost } from "@/lib/cost";
import { valueScore } from "@/lib/score";
import type { College } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

type SortKey = "score" | "fit" | "net" | "name" | "added";

export default function MyCollegesPage() {
  const { ready, profile, colleges, saved, updateSaved } = useApp();
  const [sort, setSort] = useState<SortKey>("score");

  const entries = useMemo(() => {
    const list = saved
      .map((s) => ({ saved: s, college: colleges.find((c) => c.id === s.collegeId) }))
      .filter((e): e is { saved: (typeof saved)[number]; college: College } => Boolean(e.college));
    const scoreOf = (c: College) => valueScore(profile, c).total;
    const netOf = (c: College) => estimateCost(profile, c).netAnnual ?? Number.POSITIVE_INFINITY;
    return [...list].sort((a, b) => {
      switch (sort) {
        case "name": return a.college.name.localeCompare(b.college.name);
        case "net": return netOf(a.college) - netOf(b.college);
        case "fit":
          return (
            FIT_ORDER.indexOf(classifyFit(profile, a.college).category) -
            FIT_ORDER.indexOf(classifyFit(profile, b.college).category)
          );
        case "added": return 0; // saved order
        default: return scoreOf(b.college) - scoreOf(a.college);
      }
    });
  }, [saved, colleges, profile, sort]);

  if (!ready) return <LoadingState label="Loading your colleges…" />;

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No colleges saved yet"
        body="Tap the bookmark on any college in Find Colleges (or on its detail page) and it will be saved here — with its checklist, deadlines and cost estimates."
        action={<Link href="/find" className="btn-primary">Find colleges</Link>}
      />
    );
  }

  // Balance-of-list summary
  const counts = new Map<string, number>();
  for (const e of entries) {
    const cat = classifyFit(profile, e.college).category;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const balance = FIT_ORDER.filter((c) => counts.get(c)).map((c) => `${counts.get(c)} ${c}`).join(" · ");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">My Colleges</p>
          <h1 className="text-2xl font-semibold lg:text-3xl">
            {entries.length} saved {entries.length === 1 ? "college" : "colleges"}
          </h1>
          {balance && <p className="mt-1 text-sm text-slate-600">List balance: {balance}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Sort saved colleges" className="field w-52" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="score">Sort: Value &amp; Fit score</option>
            <option value="fit">Sort: Admissions fit</option>
            <option value="net">Sort: Your est. net cost</option>
            <option value="name">Sort: Name A–Z</option>
            <option value="added">Sort: Order saved</option>
          </select>
          <Link href="/compare" className="btn-ghost"><GitCompareArrows size={15} /> Compare</Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ saved: s, college }) => (
          <div key={college.id} className="flex flex-col gap-2">
            <CollegeCard college={college} />
            <input
              aria-label={`Your note on ${college.name}`}
              className="field py-1.5 text-xs"
              placeholder="Add a private note (e.g. visited 10/12, loved the campus)…"
              value={s.notes ?? ""}
              onChange={(e) => updateSaved(college.id, { notes: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
