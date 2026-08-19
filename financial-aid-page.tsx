"use client";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { ExternalLink, HelpCircle, Plus, Trash2 } from "lucide-react";
import { EmptyState, LoadingState, Pill, SampleBadge } from "@/components/ui";
import { estimateCost, grantLikelihood, type CostBreakdown } from "@/lib/cost";
import { INCOME_BAND_LABELS, type IncomeBand } from "@/lib/types";
import { fmtDate, fmtMoney, NOT_REPORTED } from "@/lib/format";
import type { College, Scholarship } from "@/lib/types";
import { useApp } from "@/store/AppProvider";

/** "How was this estimated?" popover for the grants line. */
function GrantsHelp({
  college, cost, incomeBand,
}: { college: College; cost: CostBreakdown; incomeBand: IncomeBand | "" }) {
  const [open, setOpen] = useState(false);
  const bandLabel = incomeBand ? INCOME_BAND_LABELS[incomeBand] : null;
  const bandNet = incomeBand ? college.netPriceByIncome?.[incomeBand] ?? null : null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="How estimated grants were calculated"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="ml-1 text-slate-400 hover:text-brand"
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-600 shadow-lift"
        >
          <strong className="block text-navy">How this was estimated</strong>
          {cost.usedIncomeBandNetPrice && bandLabel && bandNet !== null && cost.coa !== null ? (
            <span className="mt-1 block">
              This college reports an average net price of <strong>{fmtMoney(bandNet)}</strong> for
              households earning <strong>{bandLabel}</strong> (your income band on your profile).
              Estimated grants = cost of attendance {fmtMoney(cost.coa)} − {fmtMoney(bandNet)} ={" "}
              <strong>{fmtMoney(cost.grants)}</strong>.
            </span>
          ) : college.avgGrantAid !== null ? (
            <span className="mt-1 block">
              This college doesn&apos;t report a net price for your income band, so the estimate uses
              its <strong>average grant &amp; scholarship aid across all aided students</strong>:{" "}
              <strong>{fmtMoney(cost.grants)}</strong>. Set your household income range on your
              profile for a band-specific estimate where available.
            </span>
          ) : (
            <span className="mt-1 block">
              This college reports no grant data, so grants are shown as {fmtMoney(cost.grants)}.
              Use its official net price calculator for a real figure.
            </span>
          )}
          <span className="mt-1.5 block text-slate-400">
            Source: U.S. Dept. of Education data for this college. An estimate only — actual aid is
            decided by the college and is never guaranteed. Loans and work-study are never counted as grants.
          </span>
        </span>
      )}
    </span>
  );
}

const STATUS_TONES: Record<Scholarship["status"], "slate" | "navy" | "green" | "red"> = {
  planned: "slate",
  applied: "navy",
  awarded: "green",
  declined: "red",
};


/**
 * "Need met without loans" calculator using the college's published Common
 * Data Set (section H2). Formula (per college-planning practice):
 *   grants-only need met = I − [(L + M) / K]
 * where I = avg % of need met, K = avg need-based grant, L = avg need-based
 * self-help, M = avg need-based loan. All values are user-entered from the
 * college's own CDS — the app never invents them.
 */
function CdsNeedMetCalc() {
  const [i, setI] = React.useState("");
  const [k, setK] = React.useState("");
  const [l, setL] = React.useState("");
  const [m, setM] = React.useState("");
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/[$,%\s]/g, "")));
  const I = num(i), K = num(k), L = num(l), M = num(m);
  const valid = [I, K, L, M].every((n) => Number.isFinite(n)) && K > 0 && I >= 0;
  const loanShare = valid ? (L + M) / K : NaN;
  const result = valid ? I / 100 - loanShare : NaN;

  const field = (label: string, hint: string, v: string, set: (x: string) => void, ph: string) => (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <span className="block font-normal text-slate-400">{hint}</span>
      <input className="field mt-1" inputMode="decimal" placeholder={ph} value={v} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <section className="card p-6" aria-labelledby="cds-h">
      <h2 id="cds-h" className="text-lg font-semibold">Need met without loans — Common Data Set calculator</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Colleges advertise the share of financial need they &ldquo;meet,&rdquo; but that figure counts
        loans and work-study. This calculator strips those out. Look up the college&apos;s own{" "}
        <em>Common Data Set</em> (search &ldquo;[college name] common data set&rdquo; — every college
        page here has a link), open <strong>section H2</strong>, and copy four numbers:
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {field("I — Avg. % of need met", "CDS H2, row i (e.g. 77)", i, setI, "77")}
        {field("K — Avg. need-based grant", "CDS H2, row k ($)", k, setK, "23622")}
        {field("L — Avg. need-based self-help", "CDS H2, row l ($)", l, setL, "5317")}
        {field("M — Avg. need-based loan", "CDS H2, row m ($)", m, setM, "3425")}
      </div>
      {valid ? (
        <div className="mt-4 rounded-lg bg-surface p-4 text-sm">
          <p className="text-slate-600">
            {(I / 100).toFixed(2)} − [({fmtMoney(L)} + {fmtMoney(M)}) ÷ {fmtMoney(K)}] ={" "}
            {(I / 100).toFixed(2)} − {loanShare.toFixed(2)}
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-navy">
            Need met with grants only: {Math.round(result * 100)}%
            {result < 0 && " (loans exceed grants at this college — grants-only need met is effectively 0%)"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Of the need this college meets, roughly {Math.round(Math.min(Math.max(loanShare, 0), 1) * 100)} cents of every
            grant dollar is mirrored by loans/work-study you&apos;d repay or earn.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Enter all four values from the college&apos;s CDS to see the result.</p>
      )}
      <p className="mt-3 text-[11px] text-slate-500">
        These are averages for aided first-year students from the college&apos;s self-published Common
        Data Set — your package will differ, and this is not a promise of aid. Note: the FAFSA&apos;s
        &ldquo;Student Aid Index (SAI)&rdquo; is a separate federal number about your family, not the
        college; this tool measures how generously a <em>college</em> meets need without loans.
      </p>
    </section>
  );
}

export default function FinancialAidPage() {
  const { ready, profile, colleges, saved, scholarships, addScholarship, updateScholarship, removeScholarship } = useApp();
  const [draft, setDraft] = useState({ name: "", amount: "", deadline: "", collegeId: "", sourceUrl: "" });

  const savedColleges = useMemo(
    () =>
      saved
        .map((s) => colleges.find((c) => c.id === s.collegeId))
        .filter((c): c is College => Boolean(c)),
    [saved, colleges],
  );

  if (!ready) return <LoadingState label="Loading financial aid…" />;

  const awardedTotal = scholarships
    .filter((s) => s.status === "awarded")
    .reduce((a, s) => a + (s.amount ?? 0), 0);

  const submit = () => {
    if (!draft.name.trim()) return;
    addScholarship({
      name: draft.name.trim(),
      amount: draft.amount ? Number(draft.amount) : null,
      deadline: draft.deadline || null,
      collegeId: draft.collegeId || null,
      sourceUrl: draft.sourceUrl || null,
      renewable: false,
      status: "planned",
    });
    setDraft({ name: "", amount: "", deadline: "", collegeId: "", sourceUrl: "" });
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Financial Aid</p>
        <h1 className="text-2xl font-semibold lg:text-3xl">Aid &amp; scholarships</h1>
        <p className="mt-1 text-sm text-slate-600">
          Grants and scholarships lower what you pay. Loans and work-study never reduce the net
          prices shown in this app. Aid is estimated, never guaranteed.
        </p>
        <p className="mt-2 max-w-3xl rounded-lg bg-surface p-3 text-xs text-slate-600">
          <strong className="text-navy">What is scholarship displacement?</strong> Some colleges reduce
          the aid they give you when you win outside scholarships. Good policies reduce loans and
          work-study first; less favorable ones reduce grants. Rules vary by college and some states
          restrict displacement at public institutions — each college&apos;s policy is shown below when
          published, and it&apos;s always worth confirming with the aid office before accepting awards.
        </p>
      </header>

      <CdsNeedMetCalc />

      <section className="card p-6" aria-labelledby="sch-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sch-h" className="text-lg font-semibold">Scholarship tracker</h2>
          <Pill tone="green">Awarded so far: {fmtMoney(awardedTotal)}/yr</Pill>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <input aria-label="Scholarship name" className="field sm:col-span-2" placeholder="Scholarship name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input aria-label="Amount per year" className="field" type="number" min={0} placeholder="Amount $/yr" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
          <input aria-label="Deadline" className="field" type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />
          <select aria-label="Linked college" className="field" value={draft.collegeId} onChange={(e) => setDraft({ ...draft, collegeId: e.target.value })}>
            <option value="">Any college</option>
            {savedColleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input aria-label="Official source URL" className="field sm:col-span-4" placeholder="Official source URL (https://…)" value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} />
          <button className="btn-primary justify-center" onClick={submit}>
            <Plus size={15} /> Add
          </button>
        </div>

        {scholarships.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No scholarships tracked yet. Add real scholarships you find (with their official source link) — the app doesn&apos;t list outside scholarships itself, so nothing here is ever made up.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {scholarships.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-navy">
                    {s.isSample && <SampleBadge />}
                    {s.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmtMoney(s.amount)}/yr{s.renewable ? " · renewable" : ""} · deadline {fmtDate(s.deadline)}
                    {s.collegeId && ` · ${colleges.find((c) => c.id === s.collegeId)?.name ?? ""}`}
                    {s.sourceUrl && (
                      <>
                        {" · "}
                        <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">
                          source <ExternalLink size={10} />
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <select
                  aria-label={`Status for ${s.name}`}
                  className="field w-32 py-1.5 text-xs"
                  value={s.status}
                  onChange={(e) => updateScholarship(s.id, { status: e.target.value as Scholarship["status"] })}
                >
                  <option value="planned">Planned</option>
                  <option value="applied">Applied</option>
                  <option value="awarded">Awarded</option>
                  <option value="declined">Declined</option>
                </select>
                <Pill tone={STATUS_TONES[s.status]}>{s.status}</Pill>
                <button
                  aria-label={`Remove ${s.name}`}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-fitRed"
                  onClick={() => removeScholarship(s.id)}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="aid-h">
        <h2 id="aid-h" className="mb-3 text-lg font-semibold">Aid picture at your saved colleges</h2>
        {savedColleges.length === 0 ? (
          <EmptyState
            title="No saved colleges"
            body="Save colleges to compare their net prices, aid requirements and priority deadlines here."
            action={<Link href="/find" className="btn-primary">Find colleges</Link>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {savedColleges.map((c) => {
              const awarded = scholarships
                .filter((s) => s.status === "awarded" && (s.collegeId === null || s.collegeId === c.id))
                .reduce((a, s) => a + (s.amount ?? 0), 0);
              const cost = estimateCost(profile, c, { extraScholarships: awarded });
              const gl = grantLikelihood(profile, c);
              return (
                <div key={c.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.isSample && <SampleBadge />}
                    <Link href={`/college/${c.id}`} className="font-display text-base font-semibold text-navy hover:underline">
                      {c.name}
                    </Link>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-slate-500">Cost of attendance</dt><dd className="font-medium">{fmtMoney(cost.coa)}</dd></div>
                    <div className="flex justify-between"><dt className="flex items-center text-slate-500">Est. grants<GrantsHelp college={c} cost={cost} incomeBand={profile.householdIncomeRange} /></dt><dd className="font-medium text-fitGreen">− {fmtMoney(cost.grants)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Your awarded scholarships</dt><dd className="font-medium text-fitGreen">− {fmtMoney(cost.scholarships)}</dd></div>
                    <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="font-semibold text-navy">Est. net cost / yr</dt><dd className="font-bold text-teal">{fmtMoney(cost.netAnnual)}</dd></div>
                  </dl>
                  <div className="mt-3">
                    <Pill tone={gl.level === "Higher" ? "green" : gl.level === "Moderate" ? "amber" : gl.level === "Limited" ? "red" : "slate"}>
                      {gl.level === "Unknown" ? "Aid outlook: not enough data" : `${gl.level} likelihood of grants/scholarships`}
                    </Pill>
                  </div>
                  {c.financialAid?.scholarshipDisplacementPolicy && (
                    <p className="mt-2 text-xs text-slate-600">
                      <strong className="text-navy">Displacement policy:</strong>{" "}
                      {c.financialAid.scholarshipDisplacementPolicy}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <Pill tone="slate">FAFSA: {c.financialAid?.requiresFafsa == null ? NOT_REPORTED : c.financialAid.requiresFafsa ? "required" : "not required"}</Pill>
                    <Pill tone="slate">CSS: {c.financialAid?.requiresCssProfile == null ? NOT_REPORTED : c.financialAid.requiresCssProfile ? "required" : "not required"}</Pill>
                    {c.financialAid?.priorityAidDeadline && (
                      <Pill tone="amber">Priority aid: {fmtDate(c.financialAid.priorityAidDeadline)}</Pill>
                    )}
                  </div>
                  {c.netPriceCalculatorUrl && (
                    <a href={c.netPriceCalculatorUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                      Official net price calculator <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
