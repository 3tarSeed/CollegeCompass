"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, GitCompareArrows, Printer } from "lucide-react";
import { CompassDial, ConfidenceBadge, FitBadge } from "@/components/FitBadge";
import { DataProvenance } from "@/components/DataProvenance";
import { CostStackChart, DemographicsChart, NetPriceByIncomeChart } from "@/components/charts";
import { EmptyState, LoadingState, Pill, SampleBadge } from "@/components/ui";
import { classifyFit } from "@/lib/fit";
import { estimateCost, grantLikelihood } from "@/lib/cost";
import { valueScore } from "@/lib/score";
import {
  daysUntil,
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtRange,
  NOT_REPORTED,
  OWNERSHIP_LABELS,
  PLAN_LABELS,
  TEST_POLICY_LABELS,
} from "@/lib/format";
import { INCOME_BAND_LABELS, type IncomeBand, MAX_COMPARE } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-navy">{value}</dd>
    </div>
  );
}

export default function CollegeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { ready, profile, getCollege, isSaved, toggleSaved, compareIds, toggleCompare } = useApp();
  const [extraScholarships, setExtraScholarships] = useState(0);

  if (!ready) return <LoadingState label="Loading college…" />;
  const college = getCollege(decodeURIComponent(id));
  if (!college) {
    return (
      <EmptyState
        title="College not found"
        body="This college isn't in your current dataset. Search for it again from Find Colleges."
        action={<Link href="/find" className="btn-primary">Back to search</Link>}
      />
    );
  }

  const fit = classifyFit(profile, college);
  const cost = estimateCost(profile, college, { extraScholarships });
  const score = valueScore(profile, college);
  const grants = grantLikelihood(profile, college);
  const saved = isSaved(college.id);
  const comparing = compareIds.includes(college.id);

  return (
    <div className="space-y-6">
      <header className="card p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {college.isSample && <SampleBadge />}
              <h1 className="text-2xl font-semibold lg:text-3xl">{college.name}</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {college.city ?? NOT_REPORTED}, {college.state ?? "—"} ·{" "}
              {college.ownership ? OWNERSHIP_LABELS[college.ownership] : NOT_REPORTED} ·{" "}
              {college.level === "two_year" ? "2-year" : "4-year"} ·{" "}
              {fmtNum(college.enrollment)} students
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {college.website && (
                <a href={college.website} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                  Official website <ExternalLink size={13} />
                </a>
              )}
              {college.admissionsUrl && (
                <a href={college.admissionsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                  Admissions <ExternalLink size={13} />
                </a>
              )}
              <button onClick={() => toggleSaved(college)} className={saved ? "btn-teal" : "btn-primary"} aria-pressed={saved}>
                {saved ? <><BookmarkCheck size={15} /> Saved</> : <><Bookmark size={15} /> Save college</>}
              </button>
              <button className="btn-ghost no-print" onClick={() => window.print()}>
                <Printer size={15} /> Print
              </button>
              <button
                onClick={() => toggleCompare(college.id)}
                disabled={compareIds.length >= MAX_COMPARE && !comparing}
                className="btn-ghost disabled:opacity-40"
                aria-pressed={comparing}
              >
                <GitCompareArrows size={15} /> {comparing ? "In comparison" : "Compare"}
              </button>
            </div>
          </div>
          <div className="shrink-0 rounded-card border border-slate-200 bg-surface px-6 py-4">
            <CompassDial category={fit.category} score={score.total} />
            <div className="mt-2 flex justify-center"><ConfidenceBadge confidence={fit.confidence} /></div>
          </div>
        </div>
        <DataProvenance provenance={college.provenance} verifyUrl={college.website} />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Admissions */}
        <section className="card p-6" aria-labelledby="adm-h">
          <h2 id="adm-h" className="text-lg font-semibold">Admissions</h2>
          <dl className="mt-2">
            <Row label="Acceptance rate" value={fmtPct(college.acceptanceRate)} />
            <Row label="ACT middle 50%" value={fmtRange(college.act25, college.act75)} />
            <Row label="SAT middle 50%" value={fmtRange(college.sat25, college.sat75)} />
            <Row label="Test policy" value={TEST_POLICY_LABELS[college.testPolicy]} />
            <Row label="Application fee" value={fmtMoney(college.applicationFee)} />
          </dl>
          <div className="mt-3 rounded-lg bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <FitBadge category={fit.category} />
              <ConfidenceBadge confidence={fit.confidence} />
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {fit.explanations.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              This is an app-generated estimate based on the data above — never a prediction or
              promise of admission. Holistic factors (essays, activities, recommendations) are not modeled.
            </p>
          </div>
          <DataProvenance provenance={college.provenance} verifyUrl={college.admissionsUrl} />
        </section>

        {/* Graduation, retention, outcomes */}
        <section className="card p-6" aria-labelledby="out-h">
          <h2 id="out-h" className="text-lg font-semibold">Outcomes</h2>
          <dl className="mt-2">
            <Row label="Graduation rate" value={fmtPct(college.graduationRate)} />
            <Row label="First-year retention" value={fmtPct(college.retentionRate)} />
            <Row label="Typical federal debt at graduation" value={fmtMoney(college.medianFederalDebt)} />
            <Row label="Median earnings (10 yrs after entry)" value={fmtMoney(college.medianEarnings10yr)} />
          </dl>
          <h3 className="mt-4 text-sm font-semibold text-navy">Majors by popularity</h3>
          {college.majorShares?.length ? (
            <>
              <p className="text-xs text-slate-500">Share of degrees awarded in each field, most popular first.</p>
              <ol className="mt-2 space-y-1.5">
                {college.majorShares.map((m, i) => {
                  const mine = profile.intendedMajors.some(
                    (x) => m.name.toLowerCase().includes(x.toLowerCase()) || x.toLowerCase().includes(m.name.toLowerCase()),
                  );
                  return (
                    <li key={m.name} className="flex items-center gap-2 text-sm">
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}.</span>
                      <span className={`min-w-0 flex-1 truncate ${mine ? "font-semibold text-teal" : "text-slate-700"}`}>
                        {m.name}{mine ? " ← your intended major" : ""}
                      </span>
                      <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((m.share / college.majorShares![0].share) * 100))}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">{(m.share * 100).toFixed(1)}%</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[11px] text-slate-500">
                Acceptance rate applies to the college overall ({fmtPct(college.acceptanceRate)}) — colleges
                don&apos;t publish per-major admission rates in federal data. Competitive direct-admit
                programs (e.g. nursing, engineering, CS) can be harder than the overall rate suggests;
                confirm with the department.
              </p>
            </>
          ) : college.majors.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {college.majors.map((m) => (
                <li key={m}>
                  <Pill tone={profile.intendedMajors.some((x) => m.toLowerCase().includes(x.toLowerCase()) || x.toLowerCase().includes(m.toLowerCase())) ? "green" : "slate"}>
                    {m}
                  </Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-500">{NOT_REPORTED}</p>
          )}
          <DataProvenance provenance={college.provenance} verifyUrl={college.website} />
        </section>

        {/* Student body */}
        <section className="card p-6" aria-labelledby="body-h">
          <h2 id="body-h" className="text-lg font-semibold">Student body</h2>
          <p className="text-xs text-slate-500">Share of enrolled students by race and ethnicity.</p>
          <div className="mt-3">
            <DemographicsChart college={college} />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-navy">Gender balance</h3>
          {college.genderShares ? (
            <div className="mt-2">
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Share of enrolled students by gender">
                {college.genderShares.men !== null && (
                  <span className="flex items-center justify-center bg-brand text-[10px] font-semibold text-white" style={{ width: `${college.genderShares.men * 100}%` }} />
                )}
                {college.genderShares.women !== null && (
                  <span className="flex items-center justify-center bg-teal text-[10px] font-semibold text-white" style={{ width: `${college.genderShares.women * 100}%` }} />
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-semibold text-brand">Men {fmtPct(college.genderShares.men)}</span>
                {" · "}
                <span className="font-semibold text-teal">Women {fmtPct(college.genderShares.women)}</span>
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Gender balance: {NOT_REPORTED}.</p>
          )}
          <dl className="mt-3">
            <Row label="Students receiving federal Pell Grants" value={fmtPct(college.pellGrantRate)} />
          </dl>
          <p className="mt-2 text-[11px] text-slate-500">
            These figures describe who is <em>enrolled</em>, not admission chances. Colleges don&apos;t
            publish acceptance rates by race or gender in federal data, and under the Supreme
            Court&apos;s 2023 ruling colleges may not consider race in admission decisions — so this
            app&apos;s fit estimate is the same for every applicant with the same academic record.
          </p>
          <DataProvenance provenance={college.provenance} verifyUrl={college.website} />
        </section>

        {/* Grant & scholarship outlook */}
        <section className="card p-6" aria-labelledby="grants-h">
          <h2 id="grants-h" className="text-lg font-semibold">Grant &amp; scholarship outlook</h2>
          <div className="mt-2">
            <Pill tone={grants.level === "Higher" ? "green" : grants.level === "Moderate" ? "amber" : grants.level === "Limited" ? "red" : "slate"}>
              {grants.level === "Unknown" ? "Not enough data" : `${grants.level} likelihood of grant/scholarship aid`}
            </Pill>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
            {grants.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">
            An app-generated indicator from this college&apos;s reported aid data — not a probability
            and never a promise. Actual awards are decided by the college after reviewing your application.
          </p>
          <h3 className="mt-4 text-sm font-semibold text-navy">Outside-scholarship displacement policy</h3>
          {college.financialAid?.scholarshipDisplacementPolicy ? (
            <p className="mt-1 text-sm text-slate-700">{college.financialAid.scholarshipDisplacementPolicy}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              {NOT_REPORTED}. Displacement rules (whether outside scholarships reduce the aid a college
              gives you) aren&apos;t published in federal data — ask this college&apos;s financial aid
              office whether outside awards reduce loans first or reduce grants.
            </p>
          )}
          <DataProvenance
            provenance={college.financialAid?.provenance ?? college.provenance}
            verifyUrl={college.website}
          />
        </section>

        {/* Cost of attendance */}
        <section className="card p-6" aria-labelledby="cost-h">
          <h2 id="cost-h" className="text-lg font-semibold">Cost of attendance</h2>
          <p className="text-xs text-slate-500">
            Shown for {cost.residency === "in_state" ? "in-state" : "out-of-state"} residency based on your profile.
          </p>
          <dl className="mt-2">
            <Row label="Tuition" value={fmtMoney(cost.tuition)} />
            <Row label="Fees" value={fmtMoney(cost.fees)} />
            <Row label="Housing & meals" value={fmtMoney(cost.housingMeals)} />
            <Row label="Books & supplies" value={fmtMoney(cost.books)} />
            <Row label="Transportation" value={fmtMoney(cost.transportation)} />
            <Row label="Personal expenses" value={fmtMoney(cost.personal)} />
            <Row label="Total cost of attendance" value={<strong>{fmtMoney(cost.coa)}</strong>} />
            <Row label="Average net price (all aided students)" value={fmtMoney(college.avgNetPrice)} />
          </dl>
          {cost.coaIncomplete && (
            <p className="mt-2 text-xs text-fitAmber">
              Some cost components were not reported and are excluded from the total — the real cost is likely higher.
            </p>
          )}
          <div className="mt-3"><CostStackChart cost={cost} /></div>
          <DataProvenance provenance={college.provenance} verifyUrl={college.netPriceCalculatorUrl} />
        </section>

        {/* Your true-cost estimate */}
        <section className="card p-6" aria-labelledby="net-h">
          <h2 id="net-h" className="text-lg font-semibold">Your true-cost estimate</h2>
          <label htmlFor="extra-sch" className="label mt-2">Outside scholarships you expect ($/yr)</label>
          <input
            id="extra-sch"
            type="number"
            min={0}
            className="field max-w-[200px]"
            value={extraScholarships || ""}
            placeholder="0"
            onChange={(e) => setExtraScholarships(Math.max(0, Number(e.target.value) || 0))}
          />
          <dl className="mt-3">
            <Row
              label={cost.usedIncomeBandNetPrice ? `Estimated grants (your income band, ${profile.householdIncomeRange ? INCOME_BAND_LABELS[profile.householdIncomeRange as IncomeBand] : ""})` : "Estimated grants (school average)"}
              value={`− ${fmtMoney(cost.grants)}`}
            />
            <Row label="Your scholarships" value={`− ${fmtMoney(cost.scholarships)}`} />
            <Row label="Estimated annual net cost" value={<strong className="text-teal">{fmtMoney(cost.netAnnual)}</strong>} />
            <Row label="Estimated four-year cost" value={fmtMoney(cost.net4Year)} />
            <Row label="Estimated borrowing (4 yrs, beyond your budget)" value={fmtMoney(cost.borrowing4Year)} />
            <Row label="Est. monthly loan payment (10 yr @ 6.53%)" value={fmtMoney(cost.monthlyLoanPayment, { cents: true })} />
          </dl>
          <p className="mt-2 text-[11px] text-slate-500">
            Grants and scholarships reduce your net price. Loans and work-study are money you repay
            or earn — they are shown separately and never subtracted from net price. This is an
            app-generated estimate, not an aid offer; the college&apos;s own calculator is authoritative.
          </p>
          {college.netPriceCalculatorUrl && (
            <a href={college.netPriceCalculatorUrl} target="_blank" rel="noopener noreferrer" className="btn-teal mt-3">
              Official net price calculator <ExternalLink size={13} />
            </a>
          )}
          <h3 className="mt-5 text-sm font-semibold text-navy">Net price by household income</h3>
          <NetPriceByIncomeChart college={college} highlightBand={profile.householdIncomeRange} />
          <Row label="Average grant aid" value={fmtMoney(college.avgGrantAid)} />
        </section>

        {/* Application plans & deadlines */}
        <section className="card p-6" aria-labelledby="dl-h">
          <h2 id="dl-h" className="text-lg font-semibold">Application plans &amp; deadlines</h2>
          {college.deadlines.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              {NOT_REPORTED}. Deadlines aren&apos;t included in College Scorecard data — check the
              college&apos;s admissions site and add them from your tracker.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {college.deadlines.map((d) => {
                const days = daysUntil(d.dueDate);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-navy">{d.label}</p>
                      <p className="text-xs text-slate-500">{PLAN_LABELS[d.plan] ?? d.plan}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{d.dueDate ? fmtDate(d.dueDate) : "Rolling"}</p>
                      {days !== null && days >= 0 && (
                        <Pill tone={days <= 14 ? "red" : days <= 45 ? "amber" : "slate"}>{days} days</Pill>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <DataProvenance
            provenance={college.deadlines[0]?.provenance ?? college.provenance}
            verifyUrl={college.admissionsUrl}
            warning="Deadlines change year to year — always confirm on the college's admissions site before planning."
          />
        </section>

        {/* Requirements & financial aid requirements */}
        <section className="card p-6" aria-labelledby="req-h">
          <h2 id="req-h" className="text-lg font-semibold">Application materials</h2>
          {college.requirements.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{NOT_REPORTED}. Verify on the admissions site.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {college.requirements.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-3">
                  <span className="text-slate-700">{r.label}{r.detail ? ` — ${r.detail}` : ""}</span>
                  <Pill tone={r.required ? "navy" : "slate"}>{r.required ? "Required" : "Optional"}</Pill>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-5 text-sm font-semibold text-navy">Financial-aid requirements</h3>
          {college.financialAid ? (
            <dl className="mt-1">
              <Row label="FAFSA" value={college.financialAid.requiresFafsa === null ? NOT_REPORTED : college.financialAid.requiresFafsa ? "Required" : "Not required"} />
              <Row label="CSS Profile" value={college.financialAid.requiresCssProfile === null ? NOT_REPORTED : college.financialAid.requiresCssProfile ? "Required" : "Not required"} />
              <Row label="Priority aid deadline" value={fmtDate(college.financialAid.priorityAidDeadline)} />
              <Row label="Meets full demonstrated need" value={college.financialAid.meetsFullNeed === null ? NOT_REPORTED : college.financialAid.meetsFullNeed ? "Yes" : "No"} />
              <Row label="Need-blind admissions" value={college.financialAid.needBlind === null ? NOT_REPORTED : college.financialAid.needBlind ? "Yes" : "No"} />
              <Row label="Merit aid available" value={college.financialAid.meritAidAvailable === null ? NOT_REPORTED : college.financialAid.meritAidAvailable ? "Yes" : "No"} />
            </dl>
          ) : (
            <p className="mt-1 text-sm text-slate-500">{NOT_REPORTED}.</p>
          )}
          {college.financialAid?.notes && <p className="mt-2 text-xs text-slate-600">{college.financialAid.notes}</p>}
          <p className="mt-3 text-[11px] text-slate-500">
            Financial aid is never guaranteed — actual awards depend on the college&apos;s review of your application.
          </p>
          <DataProvenance
            provenance={college.financialAid?.provenance ?? college.provenance}
            verifyUrl={college.website}
          />
        </section>
      </div>
      <p className="print-only text-[11px] text-slate-500">
        Printed from College Compass on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
        Fit categories, cost projections and the grant outlook are personalized estimates — not
        predictions or promises. Verify deadlines and aid policies on the college&apos;s website.
      </p>
    </div>
  );
}
