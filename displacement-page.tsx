"use client";
import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DISPLACEMENT_DATA, type DisplacementCategory } from "@/data/displacement";

const CAT_META: Record<DisplacementCategory, { label: string; cls: string }> = {
  yes: { label: "Displaces", cls: "bg-red-100 text-red-800" },
  no: { label: "Does not displace", cls: "bg-green-100 text-green-800" },
  policy: { label: "Stated policy", cls: "bg-amber-100 text-amber-800" },
  unknown: { label: "No data", cls: "bg-slate-100 text-slate-500" },
};

const FILTERS: Array<{ key: DisplacementCategory | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "yes", label: "Displaces" },
  { key: "no", label: "Does not" },
  { key: "policy", label: "Stated policy" },
  { key: "unknown", label: "No data" },
];

export default function DisplacementPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DisplacementCategory | "all">("all");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DISPLACEMENT_DATA.filter(
      (e) =>
        (filter === "all" || e.c === filter) &&
        (needle === "" || e.n.toLowerCase().includes(needle))
    ).slice(0, 200);
  }, [q, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: DISPLACEMENT_DATA.length };
    for (const e of DISPLACEMENT_DATA) c[e.c] = (c[e.c] ?? 0) + 1;
    return c;
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="eyebrow">Financial aid reference</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold text-navy">Scholarship displacement</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Some colleges reduce (&ldquo;displace&rdquo;) your financial aid when you win an outside
        scholarship. The better ones reduce loans or work-study first; the worst reduce grants
        dollar-for-dollar. Look up a college below before assuming outside scholarships will lower
        your bill.
      </p>

      <div className="card mt-6 p-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field pl-9"
            placeholder="Search a college name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search colleges"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-navy text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label} ({counts[f.key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {results.map((e) => (
          <li key={e.n} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">{e.n}</p>
              {e.p && <p className="mt-0.5 text-xs text-slate-500">{e.p}</p>}
            </div>
            <span className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${CAT_META[e.c].cls}`}>
              {CAT_META[e.c].label}
            </span>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">No colleges match.</li>
        )}
      </ul>
      {results.length === 200 && (
        <p className="mt-2 text-xs text-slate-400">Showing first 200 — refine your search.</p>
      )}

      <div className="card mt-6 p-4 text-xs text-slate-500">
        <p>
          <strong className="text-navy">About this data:</strong> community-compiled cheat sheet
          based on each college&rsquo;s published financial-aid pages; policies change and entries
          marked &ldquo;No data&rdquo; had no findable policy (or the source page was unreachable).
          Always confirm with the college&rsquo;s financial aid office before counting on it —
          and ask <em>in writing</em> whether an outside scholarship will reduce grants, loans, or
          work-study. Note: Maryland, New Jersey, Pennsylvania, Washington and California limit
          scholarship displacement at public colleges by law.
        </p>
      </div>
    </div>
  );
}
