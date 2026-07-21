"use client";
import Link from "next/link";
import React, { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { EmptyState, LoadingState, Pill, SampleBadge } from "@/components/ui";
import { daysUntil, fmtDate, PLAN_LABELS } from "@/lib/format";
import type { ApplicationTask, TaskStatus } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  waived: "Waived",
  n_a: "N/A",
};

function TaskRow({ task }: { task: ApplicationTask }) {
  const { updateTask } = useApp();
  const days = daysUntil(task.dueDate);
  const overdue = days !== null && days < 0 && task.status !== "done" && task.status !== "n_a" && task.status !== "waived";
  return (
    <li className="grid grid-cols-1 gap-2 border-t border-slate-100 py-3 sm:grid-cols-[1fr_150px_150px] sm:items-center">
      <div>
        <p className={`text-sm font-medium ${task.status === "done" ? "text-slate-400 line-through" : "text-navy"}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {task.dueDate && (
            <span className={overdue ? "font-semibold text-fitRed" : ""}>
              Due {fmtDate(task.dueDate)}{overdue ? " · overdue" : days !== null && days >= 0 ? ` · ${days}d left` : ""}
            </span>
          )}
          {task.sourceUrl && (
            <a href={task.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
              Official source <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
      <select
        aria-label={`Status for ${task.title}`}
        className="field py-1.5 text-xs"
        value={task.status}
        onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })}
      >
        {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          aria-label={`Due date for ${task.title}`}
          type="date"
          className="field py-1.5 text-xs"
          value={task.dueDate ?? ""}
          onChange={(e) => updateTask(task.id, { dueDate: e.target.value || null })}
        />
      </div>
      <input
        aria-label={`Note for ${task.title}`}
        className="field py-1.5 text-xs sm:col-span-3"
        placeholder="Add a note…"
        value={task.note}
        onChange={(e) => updateTask(task.id, { note: e.target.value })}
      />
    </li>
  );
}

export default function ApplicationsPage() {
  const { ready, colleges, saved, tasks, updateSaved } = useApp();
  const [openId, setOpenId] = useState<string | null>(saved[0]?.collegeId ?? null);

  if (!ready) return <LoadingState label="Loading tracker…" />;

  const entries = saved
    .map((s) => ({ saved: s, college: colleges.find((c) => c.id === s.collegeId) }))
    .filter((e): e is { saved: (typeof saved)[number]; college: NonNullable<typeof e.college> } => Boolean(e.college));

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No applications tracked"
        body="Save a college and College Compass builds its full checklist — application, essays, transcripts, recommendations, FAFSA and more."
        action={<Link href="/find" className="btn-primary">Find colleges</Link>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Applications</p>
        <h1 className="text-2xl font-semibold lg:text-3xl">Application tracker</h1>
      </header>

      {entries.map(({ saved: s, college }) => {
        const cTasks = tasks.filter((t) => t.collegeId === college.id);
        const active = cTasks.filter((t) => t.status !== "n_a" && t.status !== "waived");
        const done = active.filter((t) => t.status === "done").length;
        const pct = active.length ? Math.round((done / active.length) * 100) : 0;
        const open = openId === college.id;
        return (
          <section key={college.id} className="card">
            <button
              onClick={() => setOpenId(open ? null : college.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {college.isSample && <SampleBadge />}
                  <span className="font-display text-base font-semibold text-navy">{college.name}</span>
                  {s.applicationPlan && <Pill tone="navy">{PLAN_LABELS[s.applicationPlan]}</Pill>}
                </div>
                <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{done} of {active.length} tasks done ({pct}%)</p>
              </div>
              {open ? <ChevronDown size={18} className="shrink-0 text-slate-400" /> : <ChevronRight size={18} className="shrink-0 text-slate-400" />}
            </button>
            {open && (
              <div className="border-t border-slate-100 px-4 pb-4">
                <div className="flex flex-wrap items-center gap-3 py-3">
                  <label htmlFor={`plan-${college.id}`} className="text-xs font-semibold text-slate-500">Application plan</label>
                  <select
                    id={`plan-${college.id}`}
                    className="field w-auto py-1.5 text-xs"
                    value={s.applicationPlan ?? ""}
                    onChange={(e) => updateSaved(college.id, { applicationPlan: (e.target.value || null) as typeof s.applicationPlan })}
                  >
                    <option value="">Not decided</option>
                    <option value="early_decision">Early Decision</option>
                    <option value="early_action">Early Action</option>
                    <option value="regular">Regular Decision</option>
                    <option value="rolling">Rolling</option>
                    <option value="priority">Priority</option>
                  </select>
                  <Link href={`/college/${college.id}`} className="ml-auto text-xs font-medium text-brand hover:underline">
                    View college →
                  </Link>
                </div>
                <ul>
                  {cTasks.map((t) => <TaskRow key={t.id} task={t} />)}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
