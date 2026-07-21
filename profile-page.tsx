"use client";
import React from "react";
import { RotateCcw } from "lucide-react";
import { WeightSliders } from "@/components/WeightSliders";
import { LoadingState, SampleBadge } from "@/components/ui";
import { US_STATES } from "@/lib/geo";
import { INCOME_BAND_LABELS, type IncomeBand, type StudentProfile } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

const REGIONS = ["Northeast", "Mid-Atlantic", "Southeast", "Midwest", "Southwest", "West"];

function csv(list: string[]): string {
  return list.join(", ");
}
function parseCsv(v: string): string[] {
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

/** Stable module-scope wrapper — defining this inside the page component
 *  would remount inputs on every keystroke and drop focus. */
function Field({
  id, label, children,
}: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
    </div>
  );
}

/** Comma-separated list input: keeps the raw text while you type (so commas and
 *  spaces aren't stripped mid-edit) and syncs the parsed list to the profile. */
function CsvInput({
  id, value, onChange, uppercase = false,
}: { id: string; value: string[]; onChange: (list: string[]) => void; uppercase?: boolean }) {
  const [text, setText] = React.useState(csv(value));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    if (!focused) setText(csv(value)); // adopt external changes (e.g. demo reset) when not typing
  }, [value, focused]);
  return (
    <input
      id={id}
      className="field"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(csv(value)); }}
      onChange={(e) => {
        const raw = uppercase ? e.target.value.toUpperCase() : e.target.value;
        setText(raw);
        onChange(parseCsv(raw));
      }}
    />
  );
}

export default function ProfilePage() {
  const { ready, profile, updateProfile, resetDemo, demoMode } = useApp();
  if (!ready) return <LoadingState label="Loading profile…" />;

  const num = (v: string): number | null => (v === "" ? null : Number(v));
  const p = profile;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Profile</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold lg:text-3xl">
            Your student profile {p.isSample && <SampleBadge label="Demo profile" />}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Everything here powers your fit estimates, cost projections and Value &amp; Fit score.
            Changes save automatically{demoMode ? " to this browser (demo mode)" : ""}.
          </p>
        </div>
        <button className="btn-ghost" onClick={resetDemo}>
          <RotateCcw size={14} /> Reset to demo data
        </button>
      </header>

      <section className="card p-6" aria-labelledby="basics-h">
        <h2 id="basics-h" className="text-lg font-semibold">Basics</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="firstName" label="First name">
            <input id="firstName" className="field" value={p.firstName} onChange={(e) => updateProfile({ firstName: e.target.value })} />
          </Field>
          <Field id="gradYear" label="Graduation year">
            <input id="gradYear" type="number" min={2024} max={2035} className="field" value={p.graduationYear ?? ""} onChange={(e) => updateProfile({ graduationYear: num(e.target.value) })} />
          </Field>
          <Field id="homeState" label="Home state">
            <select id="homeState" className="field" value={p.homeState} onChange={(e) => updateProfile({ homeState: e.target.value })}>
              <option value="">Select…</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field id="homeZip" label="ZIP code">
            <input id="homeZip" inputMode="numeric" pattern="\d{5}" maxLength={5} className="field" value={p.homeZip} onChange={(e) => updateProfile({ homeZip: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
      </section>

      <section className="card p-6" aria-labelledby="acad-h">
        <h2 id="acad-h" className="text-lg font-semibold">Academics</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="gpaW" label="Weighted GPA">
            <input id="gpaW" type="number" step="0.01" min={0} max={6} className="field" value={p.gpaWeighted ?? ""} onChange={(e) => updateProfile({ gpaWeighted: num(e.target.value) })} />
          </Field>
          <Field id="gpaU" label="Unweighted GPA">
            <input id="gpaU" type="number" step="0.01" min={0} max={4} className="field" value={p.gpaUnweighted ?? ""} onChange={(e) => updateProfile({ gpaUnweighted: num(e.target.value) })} />
          </Field>
          <Field id="act" label="ACT composite">
            <input id="act" type="number" min={1} max={36} className="field" value={p.actComposite ?? ""} onChange={(e) => updateProfile({ actComposite: num(e.target.value) })} />
          </Field>
          <Field id="actS" label="ACT superscore">
            <input id="actS" type="number" min={1} max={36} className="field" value={p.actSuperscore ?? ""} onChange={(e) => updateProfile({ actSuperscore: num(e.target.value) })} />
          </Field>
          <Field id="sat" label="SAT score">
            <input id="sat" type="number" min={400} max={1600} step={10} className="field" value={p.satScore ?? ""} onChange={(e) => updateProfile({ satScore: num(e.target.value) })} />
          </Field>
          <Field id="ap" label="AP courses">
            <input id="ap" type="number" min={0} className="field" value={p.apCourses} onChange={(e) => updateProfile({ apCourses: Number(e.target.value) || 0 })} />
          </Field>
          <Field id="ib" label="IB courses">
            <input id="ib" type="number" min={0} className="field" value={p.ibCourses} onChange={(e) => updateProfile({ ibCourses: Number(e.target.value) || 0 })} />
          </Field>
          <Field id="honors" label="Honors courses">
            <input id="honors" type="number" min={0} className="field" value={p.honorsCourses} onChange={(e) => updateProfile({ honorsCourses: Number(e.target.value) || 0 })} />
          </Field>
          <Field id="de" label="Dual-enrollment courses">
            <input id="de" type="number" min={0} className="field" value={p.dualEnrollmentCourses} onChange={(e) => updateProfile({ dualEnrollmentCourses: Number(e.target.value) || 0 })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field id="majors" label="Intended majors (comma-separated)">
              <CsvInput id="majors" value={p.intendedMajors} onChange={(list) => updateProfile({ intendedMajors: list })} />
            </Field>
          </div>
        </div>
      </section>

      <section className="card p-6" aria-labelledby="fin-h">
        <h2 id="fin-h" className="text-lg font-semibold">Family &amp; budget</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field id="income" label="Household income range">
            <select id="income" className="field" value={p.householdIncomeRange} onChange={(e) => updateProfile({ householdIncomeRange: e.target.value as IncomeBand | "" })}>
              <option value="">Prefer not to say</option>
              {(Object.keys(INCOME_BAND_LABELS) as IncomeBand[]).map((b) => (
                <option key={b} value={b}>{INCOME_BAND_LABELS[b]}</option>
              ))}
            </select>
          </Field>
          <Field id="famSize" label="Family size">
            <input id="famSize" type="number" min={1} className="field" value={p.familySize ?? ""} onChange={(e) => updateProfile({ familySize: num(e.target.value) })} />
          </Field>
          <Field id="budget" label="Max annual college budget ($)">
            <input id="budget" type="number" min={0} step={500} className="field" value={p.maxAnnualBudget ?? ""} onChange={(e) => updateProfile({ maxAnnualBudget: num(e.target.value) })} />
          </Field>
        </div>
      </section>

      <section className="card p-6" aria-labelledby="pref-h">
        <h2 id="pref-h" className="text-lg font-semibold">Preferences</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="prefStates" label="Preferred states (comma-separated)">
            <CsvInput id="prefStates" uppercase value={p.preferredStates} onChange={(list) => updateProfile({ preferredStates: list })} />
          </Field>
          <Field id="prefRegions" label="Preferred regions">
            <select
              id="prefRegions"
              multiple
              className="field h-24"
              value={p.preferredRegions}
              onChange={(e) => updateProfile({ preferredRegions: Array.from(e.target.selectedOptions).map((o) => o.value) })}
            >
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field id="schoolType" label="Public / private">
            <select id="schoolType" className="field" value={p.schoolTypePreference} onChange={(e) => updateProfile({ schoolTypePreference: e.target.value as StudentProfile["schoolTypePreference"] })}>
              <option value="any">No preference</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </Field>
          <Field id="size" label="Campus size">
            <select id="size" className="field" value={p.campusSizePreference} onChange={(e) => updateProfile({ campusSizePreference: e.target.value as StudentProfile["campusSizePreference"] })}>
              <option value="any">No preference</option>
              <option value="small">Small (&lt;5,000)</option>
              <option value="medium">Medium (5,000–15,000)</option>
              <option value="large">Large (15,000+)</option>
            </select>
          </Field>
          <Field id="setting" label="Setting">
            <select id="setting" className="field" value={p.settingPreference} onChange={(e) => updateProfile({ settingPreference: e.target.value as StudentProfile["settingPreference"] })}>
              <option value="any">No preference</option>
              <option value="urban">Urban</option>
              <option value="suburban">Suburban</option>
              <option value="rural">Rural</option>
            </select>
          </Field>
          <Field id="ncaa" label="NCAA / athletics">
            <select id="ncaa" className="field" value={p.ncaaPreference} onChange={(e) => updateProfile({ ncaaPreference: e.target.value as StudentProfile["ncaaPreference"] })}>
              <option value="any">No preference</option>
              <option value="I">Division I</option>
              <option value="II">Division II</option>
              <option value="III">Division III</option>
              <option value="club">Club sports</option>
              <option value="none">Not important</option>
            </select>
          </Field>
          <Field id="plan" label="Application-plan preference">
            <select id="plan" className="field" value={p.applicationPlanPreference} onChange={(e) => updateProfile({ applicationPlanPreference: e.target.value as StudentProfile["applicationPlanPreference"] })}>
              <option value="any">No preference</option>
              <option value="early_decision">Early Decision</option>
              <option value="early_action">Early Action</option>
              <option value="regular">Regular Decision</option>
              <option value="rolling">Rolling</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field id="ecs" label="Extracurricular activities (comma-separated)">
              <CsvInput id="ecs" value={p.extracurriculars} onChange={(list) => updateProfile({ extracurriculars: list })} />
            </Field>
          </div>
        </div>
      </section>

      <section className="card p-6" aria-labelledby="weights-h">
        <h2 id="weights-h" className="text-lg font-semibold">Value &amp; Fit score weights</h2>
        <div className="mt-3 max-w-lg">
          <WeightSliders weights={p.scoreWeights} onChange={(w) => updateProfile({ scoreWeights: w })} />
        </div>
      </section>
    </div>
  );
}
