"use client";
import Link from "next/link";
import React from "react";
import { ArrowRight, CalendarClock, GitCompareArrows, Search } from "lucide-react";
import { CompassDial } from "@/components/FitBadge";
import { CollegeCard } from "@/components/CollegeCard";
import { EmptyState, LoadingState, Pill, SampleBadge } from "@/components/ui";
import { classifyFit } from "@/lib/fit";
import { daysUntil, fmtDate, PLAN_LABELS } from "@/lib/format";
import { valueScore } from "@/lib/score";
import { useApp } from "@/store/AppProvider";

export default function DashboardPage() {
  const { ready, profile, colleges, saved, tasks } = useApp();
  if (!ready) return <LoadingState label="Loading your dashboard…" />;

  const savedColleges = saved
    .map((s) => colleges.find((c) => c.id === s.collegeId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const upcoming = savedColleges
    .flatMap((c) => c.deadlines.map((d) => ({ college: c, deadline: d })))
    .filter((x) => x.deadline.dueDate && (daysUntil(x.deadline.dueDate) ?? -1) >= 0)
    .sort((a, b) => (a.deadline.dueDate! < b.deadline.dueDate! ? -1 : 1))
    .slice(0, 4);

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "n_a" && t.status !== "waived");
  const topPick = savedColleges
    .map((c) => ({ c, score: valueScore(profile, c).total }))
    .sort((a, b) => b.score - a.score)[0];

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between lg:p-8">
          <div>
            <p className="eyebrow">Your admissions season, oriented</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight lg:text-4xl">
              Welcome back, {profile.firstName || "student"}.
            </h1>
            <p className="mt-2 max-w-lg text-sm text-slate-600">
              Class of {profile.graduationYear ?? "—"} · {savedColleges.length} saved{" "}
              {savedColleges.length === 1 ? "college" : "colleges"} · {openTasks.length} open tasks.
              {profile.isSample && (
                <span className="ml-2 inline-flex align-middle"><SampleBadge label="Demo profile" /></span>
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/find" className="btn-primary"><Search size={15} /> Find colleges</Link>
              <Link href="/compare" className="btn-ghost"><GitCompareArrows size={15} /> Compare</Link>
              <Link href="/deadlines" className="btn-ghost"><CalendarClock size={15} /> Deadlines</Link>
            </div>
          </div>
          {topPick && (
            <div className="shrink-0 rounded-card border border-slate-200 bg-surface px-6 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Strongest overall match
              </p>
              <CompassDial category={classifyFit(profile, topPick.c).category} score={topPick.score} />
              <Link href={`/college/${topPick.c.id}`} className="mt-1 block text-sm font-semibold text-brand hover:underline">
                {topPick.c.name}
              </Link>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="deadlines-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="deadlines-h" className="text-xl font-semibold">Upcoming deadlines</h2>
          <Link href="/deadlines" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            All deadlines <ArrowRight size={14} />
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming deadlines"
            body="Save colleges from Find Colleges and their application and aid deadlines will appear here."
            action={<Link href="/find" className="btn-primary">Browse colleges</Link>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.map(({ college, deadline }) => {
              const days = daysUntil(deadline.dueDate);
              const tone = days !== null && days <= 14 ? "red" : days !== null && days <= 45 ? "amber" : "navy";
              return (
                <div key={deadline.id} className="card p-4">
                  <Pill tone={tone}>{days === 0 ? "Due today" : `${days} days left`}</Pill>
                  <p className="mt-2 text-sm font-semibold text-navy">{deadline.label}</p>
                  <p className="text-xs text-slate-500">{college.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {PLAN_LABELS[deadline.plan] ?? deadline.plan} · {fmtDate(deadline.dueDate)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="saved-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="saved-h" className="text-xl font-semibold">Your list</h2>
          <Link href="/applications" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            Application tracker <ArrowRight size={14} />
          </Link>
        </div>
        {savedColleges.length === 0 ? (
          <EmptyState
            title="Your list is empty"
            body="Save a few colleges to see fit estimates, cost projections and a checklist for each one."
            action={<Link href="/find" className="btn-primary">Find colleges</Link>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {savedColleges.slice(0, 4).map((c) => (
              <CollegeCard key={c.id} college={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
