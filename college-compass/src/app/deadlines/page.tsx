"use client";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, List } from "lucide-react";
import { EmptyState, LoadingState, Pill } from "@/components/ui";
import { daysUntil, fmtDate, PLAN_LABELS } from "@/lib/format";
import type { College, CollegeDeadline } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

interface Item {
  college: College;
  deadline: CollegeDeadline;
}

function toneFor(days: number | null): "red" | "amber" | "navy" | "slate" {
  if (days === null) return "slate";
  if (days < 0) return "slate";
  if (days <= 14) return "red";
  if (days <= 45) return "amber";
  return "navy";
}

function buildIcs(items: Item[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//College Compass//Deadlines//EN",
  ];
  for (const { college, deadline } of items) {
    if (!deadline.dueDate) continue;
    const dt = deadline.dueDate.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${deadline.id}@college-compass`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dt}`,
      `SUMMARY:${college.name}: ${deadline.label}`,
      `DESCRIPTION:${PLAN_LABELS[deadline.plan] ?? deadline.plan} — verify on the college website before relying on this date.`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export default function DeadlinesPage() {
  const { ready, colleges, saved } = useApp();
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const items: Item[] = useMemo(() => {
    const savedColleges = saved
      .map((s) => colleges.find((c) => c.id === s.collegeId))
      .filter((c): c is College => Boolean(c));
    return savedColleges
      .flatMap((c) => c.deadlines.map((d) => ({ college: c, deadline: d })))
      .filter((x) => !collegeFilter || x.college.id === collegeFilter)
      .filter((x) => !typeFilter || x.deadline.plan === typeFilter)
      .sort((a, b) => {
        if (!a.deadline.dueDate) return 1;
        if (!b.deadline.dueDate) return -1;
        return a.deadline.dueDate < b.deadline.dueDate ? -1 : 1;
      });
  }, [colleges, saved, collegeFilter, typeFilter]);

  if (!ready) return <LoadingState label="Loading deadlines…" />;

  const savedColleges = saved
    .map((s) => colleges.find((c) => c.id === s.collegeId))
    .filter((c): c is College => Boolean(c));

  if (savedColleges.length === 0) {
    return (
      <EmptyState
        title="No deadlines yet"
        body="Save colleges and their application and financial-aid deadlines will populate this dashboard."
        action={<Link href="/find" className="btn-primary">Find colleges</Link>}
      />
    );
  }

  const upcoming = items.filter((x) => (daysUntil(x.deadline.dueDate) ?? -1) >= 0).slice(0, 3);
  const planTypes = Array.from(new Set(items.map((x) => x.deadline.plan)));

  const exportIcs = () => {
    const blob = new Blob([buildIcs(items)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "college-compass-deadlines.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calendar grid for the selected month.
  const monthKey = (d: string) => d.slice(0, 7);
  const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const byDay = new Map<number, Item[]>();
  for (const it of items) {
    if (it.deadline.dueDate && monthKey(it.deadline.dueDate) === monthStr) {
      const day = Number(it.deadline.dueDate.slice(8, 10));
      byDay.set(day, [...(byDay.get(day) ?? []), it]);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Deadlines</p>
          <h1 className="text-2xl font-semibold lg:text-3xl">Deadline dashboard</h1>
          <p className="mt-1 text-xs text-fitAmber">
            ⚠ Deadlines may have changed since they were recorded — confirm each date on the college&apos;s website.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={view === "calendar" ? "btn-primary" : "btn-ghost"} onClick={() => setView("calendar")} aria-pressed={view === "calendar"}>
            <CalendarDays size={15} /> Calendar
          </button>
          <button className={view === "timeline" ? "btn-primary" : "btn-ghost"} onClick={() => setView("timeline")} aria-pressed={view === "timeline"}>
            <List size={15} /> Timeline
          </button>
          <button className="btn-teal" onClick={exportIcs}>
            <Download size={15} /> Export to calendar (.ics)
          </button>
        </div>
      </header>

      {upcoming.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {upcoming.map(({ college, deadline }) => {
            const days = daysUntil(deadline.dueDate);
            return (
              <div key={deadline.id} className="card p-4">
                <Pill tone={toneFor(days)}>{days === 0 ? "Due today" : `${days} days left`}</Pill>
                <p className="mt-2 text-sm font-semibold text-navy">{deadline.label}</p>
                <p className="text-xs text-slate-500">{college.name} · {fmtDate(deadline.dueDate)}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="card flex flex-wrap gap-3 p-4">
        <div>
          <label htmlFor="dl-college" className="label">College</label>
          <select id="dl-college" className="field w-56" value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
            <option value="">All saved colleges</option>
            {savedColleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dl-type" className="label">Deadline type</label>
          <select id="dl-type" className="field w-48" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {planTypes.map((p) => <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>)}
          </select>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button className="btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-lg font-semibold">
              {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <button className="btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200 text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-surface p-2 text-center font-semibold text-slate-500">{d}</div>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[74px] bg-white" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayItems = byDay.get(day) ?? [];
              return (
                <div key={day} className="min-h-[74px] bg-white p-1.5">
                  <span className="text-[11px] font-medium text-slate-400">{day}</span>
                  {dayItems.map((it) => (
                    <Link
                      key={it.deadline.id}
                      href={`/college/${it.college.id}`}
                      className="mt-0.5 block truncate rounded bg-brand/10 px-1 py-0.5 text-[10px] font-medium text-brand hover:bg-brand/20"
                      title={`${it.college.name}: ${it.deadline.label}`}
                    >
                      {it.deadline.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ol className="card divide-y divide-slate-100">
          {items.length === 0 && (
            <li className="p-6 text-sm text-slate-500">No deadlines match your filters.</li>
          )}
          {items.map(({ college, deadline }) => {
            const days = daysUntil(deadline.dueDate);
            return (
              <li key={deadline.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="w-24 shrink-0 text-sm font-semibold text-navy">
                  {deadline.dueDate ? fmtDate(deadline.dueDate) : "Rolling"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy">{deadline.label}</p>
                  <p className="text-xs text-slate-500">
                    <Link href={`/college/${college.id}`} className="hover:underline">{college.name}</Link>
                    {" · "}{PLAN_LABELS[deadline.plan] ?? deadline.plan}
                  </p>
                </div>
                <Pill tone={toneFor(days)}>
                  {days === null ? "Anytime" : days < 0 ? "Passed" : days === 0 ? "Due today" : `${days} days`}
                </Pill>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
