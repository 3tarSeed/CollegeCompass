"use client";
import Link from "next/link";
import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, Pill, SampleBadge } from "@/components/ui";
import { FitBadge } from "@/components/FitBadge";
import { classifyFit } from "@/lib/fit";
import { estimateCost } from "@/lib/cost";
import { valueScore } from "@/lib/score";
import { fmtMoney } from "@/lib/format";
import type { College } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

const PRIORITIES = [
  "Low cost / best value",
  "Scholarships & grants",
  "Strong program in my major (curriculum)",
  "Location / close to home",
  "Campus diversity",
  "Greek life (fraternities & sororities)",
  "Big sports scene",
  "Academic reputation",
  "Small classes / personal attention",
  "Internships & job outcomes",
] as const;

interface Rec {
  collegeId: string;
  rank: number;
  headline: string;
  reasons: string[];
  watchouts: string[];
}
interface AdvisorResult {
  recommendations: Rec[];
  generalAdvice?: string;
}

export default function AdvisorPage() {
  const { ready, profile, colleges, saved, toggleSaved } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [vibe, setVibe] = useState("balanced");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "nokey" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [pool, setPool] = useState<Map<string, College>>(new Map());
  const [scanNote, setScanNote] = useState("");

  if (!ready) return <LoadingState label="Loading advisor…" />;

  const toggle = (p: string) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const savedIds = new Set(saved.map((s) => s.collegeId));

  /**
   * Build the candidate pool: everything loaded in the app PLUS a nationwide
   * scan of the federal College Scorecard (preferred states, home state, and
   * the largest U.S. colleges). Saved colleges are always included; the rest
   * are ranked by the student's weighted value score and capped at 60.
   */
  const buildPool = async (): Promise<{ candidates: College[]; map: Map<string, College>; note: string }> => {
    const map = new Map<string, College>();
    for (const c of colleges) map.set(c.id, c);

    const queries: string[] = [];
    const prefStates = profile.preferredStates.filter(Boolean);
    if (prefStates.length) queries.push(`state=${encodeURIComponent(prefStates.join(","))}`);
    if (profile.homeState && !prefStates.includes(profile.homeState))
      queries.push(`state=${encodeURIComponent(profile.homeState)}`);
    queries.push(""); // nationwide, largest colleges first

    let scanned = 0;
    let anyLive = false;
    for (const q of queries) {
      try {
        const res = await fetch(`/api/scorecard?level=1&per_page=100${q ? `&${q}` : ""}`);
        const json = await res.json();
        if (res.ok && Array.isArray(json.colleges)) {
          anyLive = true;
          for (const c of json.colleges as College[]) {
            scanned++;
            if (!map.has(c.id)) map.set(c.id, c);
          }
        }
      } catch {
        /* scan is best-effort; saved + loaded colleges still work */
      }
    }

    const all = [...map.values()];
    const savedList = all.filter((c) => savedIds.has(c.id));
    const rest = all
      .filter((c) => !savedIds.has(c.id))
      .sort((a, b) => valueScore(profile, b).total - valueScore(profile, a).total);
    const candidates = [...savedList, ...rest].slice(0, 60);
    const note = anyLive
      ? `Scanned ${scanned} U.S. colleges from the College Scorecard; sent the ${candidates.length} best matches for your profile (all saved colleges included).`
      : `Live nationwide scan unavailable — compared the ${candidates.length} colleges already in your app.`;
    return { candidates, map, note };
  };

  const ask = async () => {
    setStatus("loading");
    setError("");
    setResult(null);
    const { candidates, map, note } = await buildPool();
    setPool(map);
    setScanNote(note);
    const payload = {
      priorities: selected,
      vibe,
      notes,
      profile: {
        gpaWeighted: profile.gpaWeighted,
        bestTest: profile.actSuperscore ?? profile.actComposite ?? profile.satScore,
        intendedMajors: profile.intendedMajors,
        homeState: profile.homeState,
        householdIncomeRange: profile.householdIncomeRange,
        maxAnnualBudget: profile.maxAnnualBudget,
        preferredStates: profile.preferredStates,
        campusSizePreference: profile.campusSizePreference,
        settingPreference: profile.settingPreference,
      },
      colleges: candidates.map((c) => {
        const cost = estimateCost(profile, c);
        return {
          id: c.id,
          name: c.name,
          isSample: c.isSample,
          saved: savedIds.has(c.id),
          city: c.city,
          state: c.state,
          ownership: c.ownership,
          enrollment: c.enrollment,
          setting: c.campusSetting,
          ncaaDivision: c.ncaaDivision,
          acceptanceRate: c.acceptanceRate,
          testRange: { act25: c.act25, act75: c.act75, sat25: c.sat25, sat75: c.sat75 },
          graduationRate: c.graduationRate,
          appFitCategory: classifyFit(profile, c).category,
          estNetCostPerYear: cost.netAnnual,
          avgNetPrice: c.avgNetPrice,
          pellGrantRate: c.pellGrantRate,
          demographics: c.demographics,
          topMajors: c.majorShares?.slice(0, 6) ?? c.majors.slice(0, 6),
          meritAidAvailable: c.financialAid?.meritAidAvailable ?? null,
          meetsFullNeed: c.financialAid?.meetsFullNeed ?? null,
          scholarshipDisplacementPolicy: c.financialAid?.scholarshipDisplacementPolicy ?? null,
          medianEarnings10yr: c.medianEarnings10yr,
        };
      }),
    };
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.status === 503 && json.fallback) {
        setStatus("nokey");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      setResult(json as AdvisorResult);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">AI Advisor</p>
        <h1 className="text-2xl font-semibold lg:text-3xl">Find your best-fit college</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Tell the advisor what matters to you and it ranks your candidate colleges using their real
          data — cost, aid, demographics, majors, outcomes — plus general knowledge for things like
          Greek life and sports culture (labeled as reputation, since those aren&apos;t in federal data).
        </p>
      </header>

      <section className="card p-6">
        <h2 className="text-sm font-semibold text-navy">What matters most to you? (pick any)</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => toggle(p)}
              aria-pressed={selected.includes(p)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                selected.includes(p)
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <h2 className="mt-5 text-sm font-semibold text-navy">Social scene</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {[
            ["quiet", "Quieter, studious campus"],
            ["balanced", "Balanced"],
            ["lively", "Lively social / party scene"],
          ].map(([v, label]) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="radio"
                name="vibe"
                className="accent-brand"
                checked={vibe === v}
                onChange={() => setVibe(v)}
              />
              {label}
            </label>
          ))}
        </div>

        <h2 className="mt-5 text-sm font-semibold text-navy">Anything else? (your own words)</h2>
        <textarea
          className="field mt-2 min-h-[70px]"
          placeholder="e.g. I want a strong CS program, warm weather, an HBCU or a very diverse campus, D1 football games, need most of my cost covered by scholarships…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button className="btn-primary mt-4" onClick={ask} disabled={status === "loading"}>
          <Sparkles size={15} /> {status === "loading" ? "Thinking…" : "Rank my colleges"}
        </button>
        <p className="mt-2 text-[11px] text-slate-500">
          Scans a nationwide pool of U.S. four-year colleges from the federal College Scorecard —
          not just your saved list — then sends the best matches for your profile (saved colleges
          always included). AI suggestions are a starting point, not admissions or financial
          advice — verify anything important on the college&apos;s website.
        </p>
      </section>

      {status === "loading" && <LoadingState label="Scanning U.S. colleges and thinking…" />}
      {status === "nokey" && (
        <EmptyState
          title="AI advisor isn't configured yet"
          body="Add an OPENAI_API_KEY (from platform.openai.com) to the site's environment variables and redeploy to turn this feature on. The key stays server-side."
        />
      )}
      {status === "error" && <ErrorState title="Advisor unavailable" body={error} retry={ask} />}

      {status === "done" && result?.recommendations?.length ? (
        <section className="space-y-4" aria-label="Advisor recommendations">
          {scanNote && <p className="text-xs text-slate-500">{scanNote}</p>}
          {result.recommendations
            .sort((a, b) => a.rank - b.rank)
            .map((rec) => {
              const college = pool.get(rec.collegeId) ?? colleges.find((c) => c.id === rec.collegeId);
              if (!college) return null;
              const isSaved = savedIds.has(college.id);
              return (
                <article key={rec.collegeId} className="card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-white">
                      {rec.rank}
                    </span>
                    {college.isSample && <SampleBadge />}
                    <Link href={`/college/${college.id}`} className="font-display text-lg font-semibold text-navy hover:underline">
                      {college.name}
                    </Link>
                    <FitBadge category={classifyFit(profile, college).category} />
                    <Pill tone="navy">Est. {fmtMoney(estimateCost(profile, college).netAnnual)}/yr</Pill>
                    <button
                      onClick={() => toggleSaved(college)}
                      className="ml-auto rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {isSaved ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">{rec.headline}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {rec.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                  {rec.watchouts?.length > 0 && (
                    <p className="mt-2 text-xs text-fitAmber">
                      Watch out: {rec.watchouts.join(" ")}
                    </p>
                  )}
                </article>
              );
            })}
          {result.generalAdvice && (
            <p className="rounded-card bg-surface p-4 text-sm text-slate-600">{result.generalAdvice}</p>
          )}
          <p className="text-[11px] text-slate-500">
            AI-generated ranking based on your stated priorities and each college&apos;s reported data.
            Reputation-based points (Greek life, party scene, sports culture) come from general
            knowledge and can be outdated — verify with current students or a campus visit. Never a
            prediction of admission or a promise of aid.
          </p>
        </section>
      ) : null}
    </div>
  );
}
