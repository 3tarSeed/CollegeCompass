"use client";

/**
 * Student Aid Index (SAI) estimator — Formula A (dependent students), per the
 * federal FAFSA Simplification Act methodology published by Federal Student
 * Aid. This is a PLANNING ESTIMATE:
 *  - Allowance tables (income protection allowance, AAI brackets) are the
 *    published federal values, rounded, for the 2025-26 cycle, and every
 *    allowance is editable so users can substitute exact figures from the
 *    official SAI Formula Guide.
 *  - It is NOT the official calculation. The FAFSA's own estimator governs.
 * No college-specific data is used here; nothing is fabricated — all numbers
 * come from the user or the labeled federal tables.
 */

import React, { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/format";

type Household = "two_parent" | "one_parent";

/** 2025-26 parent income protection allowance (rounded), by family size. */
const IPA_TWO_PARENT: Record<number, number> = { 2: 24600, 3: 30600, 4: 37800, 5: 44600, 6: 52200 };
const IPA_ONE_PARENT: Record<number, number> = { 2: 30900, 3: 38400, 4: 47400, 5: 56000, 6: 65500 };
/** 2025-26 student income protection allowance (rounded). */
const STUDENT_IPA_DEFAULT = 11800;

/** Parent contribution brackets on Adjusted Available Income (rounded 2025-26). */
const AAI_BRACKETS: Array<{ upTo: number; rate: number }> = [
  { upTo: 20400, rate: 0.22 },
  { upTo: 25600, rate: 0.25 },
  { upTo: 30800, rate: 0.29 },
  { upTo: 36000, rate: 0.34 },
  { upTo: 41200, rate: 0.4 },
  { upTo: Infinity, rate: 0.47 },
];

function parentContributionFromAAI(aai: number): number {
  if (aai <= 0) return Math.max(aai * 0.22, -1500); // negative AAI flows through at 22%
  let owed = 0;
  let prev = 0;
  for (const b of AAI_BRACKETS) {
    const slice = Math.min(aai, b.upTo) - prev;
    if (slice <= 0) break;
    owed += slice * b.rate;
    prev = b.upTo;
  }
  return owed;
}

const money = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      {hint && <span className="block font-normal text-slate-400">{hint}</span>}
      <input
        className="field mt-1"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function SaiPage() {
  const [household, setHousehold] = useState<Household>("two_parent");
  const [familySize, setFamilySize] = useState(4);

  // Parent inputs
  const [pIncome, setPIncome] = useState("");
  const [pFedTax, setPFedTax] = useState("");
  const [pOtherAllow, setPOtherAllow] = useState("");
  const [pAssets, setPAssets] = useState("");
  // Student inputs
  const [sIncome, setSIncome] = useState("");
  const [sAssets, setSAssets] = useState("");
  // Editable allowances (prefilled from federal tables)
  const ipaDefault = (household === "two_parent" ? IPA_TWO_PARENT : IPA_ONE_PARENT)[Math.min(Math.max(familySize, 2), 6)];
  const [ipaOverride, setIpaOverride] = useState("");
  const [sIpaOverride, setSIpaOverride] = useState("");

  const calc = useMemo(() => {
    const income = money(pIncome);
    const fedTax = money(pFedTax);
    const other = money(pOtherAllow);
    const payroll = Math.min(income, 176100) * 0.0765; // FICA estimate on earned income
    const ipa = ipaOverride.trim() ? money(ipaOverride) : ipaDefault;

    const allowances = fedTax + payroll + other + ipa;
    const availableIncome = income - allowances;

    const assets = money(pAssets);
    const assetContribution = Math.max(assets, 0) * 0.12; // asset protection allowance is $0 under SAI

    const aai = availableIncome + assetContribution;
    const parentContribution = Math.max(parentContributionFromAAI(aai), -1500);

    const sIpa = sIpaOverride.trim() ? money(sIpaOverride) : STUDENT_IPA_DEFAULT;
    const sInc = money(sIncome);
    const sPayroll = Math.min(sInc, 176100) * 0.0765;
    const studentFromIncome = Math.max((sInc - sPayroll - sIpa) * 0.5, 0);
    const studentFromAssets = Math.max(money(sAssets), 0) * 0.2;

    const sai = Math.max(Math.round(parentContribution + studentFromIncome + studentFromAssets), -1500);

    return {
      payroll, ipa, allowances, availableIncome, assetContribution, aai,
      parentContribution, sIpa, studentFromIncome, studentFromAssets, sai,
      // Sensitivities (real arithmetic on this formula):
      perStudentAsset10k: 0.2 * 10000,
      perParentAsset10k: (() => {
        // marginal parent rate at current AAI
        let rate = 0.22;
        let prev = 0;
        for (const b of AAI_BRACKETS) { if (aai > prev) rate = b.rate; prev = b.upTo; }
        return 0.12 * 10000 * (aai > 0 ? rate : 0.22);
      })(),
    };
  }, [pIncome, pFedTax, pOtherAllow, pAssets, sIncome, sAssets, ipaOverride, sIpaOverride, ipaDefault]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Financial Aid</p>
        <h1 className="text-2xl font-semibold lg:text-3xl">SAI estimator</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          The Student Aid Index (SAI) is the federal number colleges subtract from their cost of
          attendance to find your financial need. This estimator follows the federal formula for
          dependent students (Formula A). It&apos;s a planning estimate — the FAFSA&apos;s official
          calculation governs.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-6" aria-labelledby="sai-in">
          <h2 id="sai-in" className="text-lg font-semibold">Your numbers</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Household
              <select className="field mt-1" value={household} onChange={(e) => setHousehold(e.target.value as Household)}>
                <option value="two_parent">Two-parent household</option>
                <option value="one_parent">One-parent household</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Family size (incl. student)
              <select className="field mt-1" value={familySize} onChange={(e) => setFamilySize(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}{n === 6 ? "+" : ""}</option>)}
              </select>
            </label>
          </div>

          <h3 className="pt-1 text-sm font-semibold text-navy">Parents</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Total income (AGI)" hint="From the tax return two years before enrollment (the FAFSA 'prior-prior' year)" value={pIncome} onChange={setPIncome} />
            <Field label="Federal income tax paid" hint="Tax liability line on that return" value={pFedTax} onChange={setPFedTax} />
            <Field label="Reportable assets" hint="Cash, savings, investments, 529s. Excludes retirement accounts and your primary home (FAFSA)" value={pAssets} onChange={setPAssets} />
            <Field label="Other allowances (optional)" hint="e.g. state tax allowance from the federal table" value={pOtherAllow} onChange={setPOtherAllow} />
          </div>

          <h3 className="pt-1 text-sm font-semibold text-navy">Student</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Student income" value={sIncome} onChange={setSIncome} />
            <Field label="Student assets" hint="Accounts in the student's own name (custodial UGMA/UTMA included; 529s count as parent assets)" value={sAssets} onChange={setSAssets} />
          </div>

          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">Advanced: override federal allowances</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Parent income protection allowance" hint={`Prefilled ${fmtMoney(ipaDefault)} (2025-26 table, rounded)`} value={ipaOverride} onChange={setIpaOverride} />
              <Field label="Student income protection allowance" hint={`Prefilled ${fmtMoney(STUDENT_IPA_DEFAULT)} (2025-26, rounded)`} value={sIpaOverride} onChange={setSIpaOverride} />
            </div>
          </details>
        </section>

        <section className="card p-6" aria-labelledby="sai-out">
          <h2 id="sai-out" className="text-lg font-semibold">Estimated SAI</h2>
          <p className="mt-2 font-display text-4xl font-semibold text-navy">{fmtMoney(calc.sai)}</p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Parent allowances (taxes est. + protection)</dt><dd>− {fmtMoney(Math.round(calc.allowances))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Parent available income</dt><dd>{fmtMoney(Math.round(calc.availableIncome))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Parent assets × 12%</dt><dd>{fmtMoney(Math.round(calc.assetContribution))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Parent contribution (22–47% brackets)</dt><dd className="font-medium">{fmtMoney(Math.round(calc.parentContribution))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Student income above {fmtMoney(calc.sIpa)} × 50%</dt><dd>{fmtMoney(Math.round(calc.studentFromIncome))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Student assets × 20%</dt><dd>{fmtMoney(Math.round(calc.studentFromAssets))}</dd></div>
          </dl>

          <h3 className="mt-5 text-sm font-semibold text-navy">What actually moves this number</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Every $10,000 held in the <strong>student&apos;s</strong> name adds {fmtMoney(calc.perStudentAsset10k)} to SAI;
              the same $10,000 as a <strong>parent</strong> asset (e.g. a parent-owned 529) adds about {fmtMoney(Math.round(calc.perParentAsset10k))}.
            </li>
            <li>Retirement accounts and your primary home aren&apos;t reported on the FAFSA — money already there doesn&apos;t raise SAI.</li>
            <li>Income counts from the tax year <em>two years</em> before enrollment, so income timing matters early.</li>
            <li>Unlike the old EFC, SAI is <strong>not divided</strong> by the number of children in college.</li>
            <li>SAI can go as low as −$1,500; a lower SAI means more demonstrated need, not guaranteed aid.</li>
          </ul>

          <p className="mt-4 text-[11px] text-slate-500">
            Estimate only, using the federal SAI formula for dependent students with rounded 2025-26
            allowance tables (editable above; exact tables at studentaid.gov). Payroll tax is
            estimated at 7.65% of income. Colleges using the CSS Profile apply their own different
            formula. This is not financial advice and not an aid guarantee.
          </p>
        </section>
      </div>
    </div>
  );
}
