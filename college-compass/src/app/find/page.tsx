"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { CollegeCard } from "@/components/CollegeCard";
import { EmptyState, ErrorState, LoadingState, Pill } from "@/components/ui";
import { distanceMiles } from "@/lib/geo";
import { valueScore, regionOf } from "@/lib/score";
import { estimateCost } from "@/lib/cost";
import { US_STATES } from "@/lib/geo";
import type { College } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

const PAGE_SIZE = 9;
const REGION_OPTIONS = ["Northeast", "Mid-Atlantic", "Southeast", "Midwest", "Southwest", "West"];

interface Filters {
  query: string;
  state: string;
  region: string;
  ownership: "" | "public" | "private";
  level: "" | "four_year" | "two_year";
  major: string;
  accMin: string;
  accMax: string;
  tuitionMax: string;
  netMax: string;
  gradMin: string;
  testOptional: boolean;
  size: "" | "small" | "medium" | "large";
  setting: "" | "urban" | "suburban" | "rural";
  ncaa: string;
  maxDistance: string;
}

const EMPTY: Filters = {
  query: "", state: "", region: "", ownership: "", level: "", major: "",
  accMin: "", accMax: "", tuitionMax: "", netMax: "", gradMin: "",
  testOptional: false, size: "", setting: "", ncaa: "", maxDistance: "",
};

type SortKey = "score" | "name" | "acceptance" | "net" | "grad";

export default function FindPage() {
  const { ready, profile, colleges, addColleges } = useApp();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const [page, setPage] = useState(1);
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "live" | "demo" | "error">("idle");
  const [apiError, setApiError] = useState("");

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  // Fetch live Scorecard results for the current name/state; falls back to demo.
  const fetchLive = useCallback(async () => {
    setApiStatus("loading");
    setApiError("");
    try {
      const params = new URLSearchParams({ per_page: "50" });
      if (filters.query) params.set("name", filters.query);
      if (filters.state) params.set("state", filters.state);
      if (filters.ownership === "public") params.set("ownership", "1");
      if (filters.ownership === "private") params.set("ownership", "2");
      if (filters.level === "four_year") params.set("level", "1");
      if (filters.level === "two_year") params.set("level", "2");
      const res = await fetch(`/api/scorecard?${params}`);
      const json = await res.json();
      if (res.status === 503 && json.demo) {
        setApiStatus("demo");
        return;
      }
      if (!res.ok) {
        setApiStatus("error");
        setApiError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      addColleges(json.colleges as College[]);
      setApiStatus("live");
    } catch (err) {
      setApiStatus("error");
      setApiError((err as Error).message);
    }
  }, [filters.query, filters.state, filters.ownership, filters.level, addColleges]);

  useEffect(() => {
    const t = setTimeout(fetchLive, 400); // debounce typing
    return () => clearTimeout(t);
  }, [fetchLive]);

  const results = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    let list = colleges.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !(c.city ?? "").toLowerCase().includes(q)) return false;
      if (filters.state && c.state !== filters.state) return false;
      if (filters.region && !(c.state && regionOf(c.state).includes(filters.region))) return false;
      if (filters.ownership === "public" && c.ownership !== "public") return false;
      if (filters.ownership === "private" && !c.ownership?.startsWith("private")) return false;
      if (filters.level && c.level !== filters.level) return false;
      if (filters.major) {
        const m = filters.major.toLowerCase();
        if (!c.majors.some((x) => x.toLowerCase().includes(m))) return false;
      }
      if (filters.accMin && (c.acceptanceRate === null || c.acceptanceRate * 100 < Number(filters.accMin))) return false;
      if (filters.accMax && (c.acceptanceRate === null || c.acceptanceRate * 100 > Number(filters.accMax))) return false;
      if (filters.tuitionMax) {
        const t = c.tuitionInState ?? c.tuitionOutState;
        if (t === null || t > Number(filters.tuitionMax)) return false;
      }
      if (filters.netMax) {
        const n = estimateCost(profile, c).netAnnual ?? c.avgNetPrice;
        if (n === null || n > Number(filters.netMax)) return false;
      }
      if (filters.gradMin && (c.graduationRate === null || c.graduationRate * 100 < Number(filters.gradMin))) return false;
      if (filters.testOptional && c.testPolicy !== "optional" && c.testPolicy !== "blind") return false;
      if (filters.size) {
        const e = c.enrollment;
        const bucket = e === null ? null : e < 5000 ? "small" : e < 15000 ? "medium" : "large";
        if (bucket !== filters.size) return false;
      }
      if (filters.setting && c.campusSetting !== filters.setting) return false;
      if (filters.ncaa && c.ncaaDivision !== filters.ncaa) return false;
      if (filters.maxDistance && profile.homeState && c.latitude !== null && c.longitude !== null) {
        const d = distanceMiles(profile.homeState, c.latitude, c.longitude);
        if (d === null || d > Number(filters.maxDistance)) return false;
      }
      return true;
    });

    const scoreOf = (c: College) => valueScore(profile, c).total;
    const netOf = (c: College) => estimateCost(profile, c).netAnnual ?? Number.POSITIVE_INFINITY;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name": return a.name.localeCompare(b.name);
        case "acceptance": return (b.acceptanceRate ?? -1) - (a.acceptanceRate ?? -1);
        case "net": return netOf(a) - netOf(b);
        case "grad": return (b.graduationRate ?? -1) - (a.graduationRate ?? -1);
        default: return scoreOf(b) - scoreOf(a);
      }
    });
    return list;
  }, [colleges, filters, sort, profile]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!ready) return <LoadingState label="Loading colleges…" />;

  const input = (key: keyof Filters, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`f-${key}`} className="label">{label}</label>
      <input
        id={`f-${key}`}
        className="field"
        value={filters[key] as string}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Filters>)}
        {...props}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Find Colleges</p>
        <h1 className="text-2xl font-semibold lg:text-3xl">Search every direction</h1>
        <p className="mt-1 text-sm text-slate-600">
          {apiStatus === "live" && <Pill tone="green">Live College Scorecard data</Pill>}
          {apiStatus === "demo" && (
            <Pill tone="amber">Sample data — add COLLEGE_SCORECARD_API_KEY for live results</Pill>
          )}
          {apiStatus === "loading" && <Pill tone="slate">Checking College Scorecard…</Pill>}
        </p>
      </header>

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              aria-label="Search colleges by name or city"
              className="field pl-9"
              placeholder="Search by college name or city…"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
            />
          </div>
          <select aria-label="Sort results" className="field sm:w-52" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="score">Sort: Value &amp; Fit score</option>
            <option value="name">Sort: Name A–Z</option>
            <option value="acceptance">Sort: Acceptance rate</option>
            <option value="net">Sort: Your est. net cost</option>
            <option value="grad">Sort: Graduation rate</option>
          </select>
          <button className="btn-ghost" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <Filter size={15} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 md:grid-cols-4">
            <div>
              <label htmlFor="f-state" className="label">State</label>
              <select id="f-state" className="field" value={filters.state} onChange={(e) => set({ state: e.target.value })}>
                <option value="">Any</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-region" className="label">Region</label>
              <select id="f-region" className="field" value={filters.region} onChange={(e) => set({ region: e.target.value })}>
                <option value="">Any</option>
                {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-own" className="label">Public / private</label>
              <select id="f-own" className="field" value={filters.ownership} onChange={(e) => set({ ownership: e.target.value as Filters["ownership"] })}>
                <option value="">Any</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-level" className="label">Level</label>
              <select id="f-level" className="field" value={filters.level} onChange={(e) => set({ level: e.target.value as Filters["level"] })}>
                <option value="">Any</option>
                <option value="four_year">4-year</option>
                <option value="two_year">2-year</option>
              </select>
            </div>
            {input("major", "Major", { placeholder: "e.g. Computer Science" })}
            {input("accMin", "Acceptance min %", { type: "number", min: 0, max: 100 })}
            {input("accMax", "Acceptance max %", { type: "number", min: 0, max: 100 })}
            {input("tuitionMax", "Max tuition $", { type: "number", min: 0 })}
            {input("netMax", "Max net price $/yr", { type: "number", min: 0 })}
            {input("gradMin", "Min grad rate %", { type: "number", min: 0, max: 100 })}
            <div>
              <label htmlFor="f-size" className="label">Campus size</label>
              <select id="f-size" className="field" value={filters.size} onChange={(e) => set({ size: e.target.value as Filters["size"] })}>
                <option value="">Any</option>
                <option value="small">Small (&lt;5k)</option>
                <option value="medium">Medium (5–15k)</option>
                <option value="large">Large (15k+)</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-setting" className="label">Setting</label>
              <select id="f-setting" className="field" value={filters.setting} onChange={(e) => set({ setting: e.target.value as Filters["setting"] })}>
                <option value="">Any</option>
                <option value="urban">Urban</option>
                <option value="suburban">Suburban</option>
                <option value="rural">Rural</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-ncaa" className="label">NCAA division</label>
              <select id="f-ncaa" className="field" value={filters.ncaa} onChange={(e) => set({ ncaa: e.target.value })}>
                <option value="">Any</option>
                <option value="I">Division I</option>
                <option value="II">Division II</option>
                <option value="III">Division III</option>
              </select>
            </div>
            {input("maxDistance", "Max distance (mi, approx.)", { type: "number", min: 0 })}
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={filters.testOptional}
                  onChange={(e) => set({ testOptional: e.target.checked })}
                />
                Test-optional or test-blind only
              </label>
            </div>
            <div className="flex items-end">
              <button className="btn-ghost" onClick={() => setFilters(EMPTY)}>Clear all filters</button>
            </div>
          </div>
        )}
      </div>

      {apiStatus === "error" && (
        <ErrorState
          title="Live search unavailable"
          body={`Showing local results only. ${apiError}`}
          retry={fetchLive}
        />
      )}

      <p className="text-sm text-slate-500" aria-live="polite">
        {results.length} {results.length === 1 ? "college matches" : "colleges match"} your filters.
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="No colleges match"
          body="Try widening your acceptance-rate range, raising the cost caps, or clearing a filter or two."
          action={<button className="btn-primary" onClick={() => setFilters(EMPTY)}>Clear filters</button>}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((c) => <CollegeCard key={c.id} college={c} />)}
          </div>
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
              <button className="btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button className="btn-ghost" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
