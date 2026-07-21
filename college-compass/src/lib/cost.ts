import type { College, IncomeBand, StudentProfile } from "./types";

export interface CostBreakdown {
  tuition: number | null;
  fees: number | null;
  housingMeals: number | null;
  books: number | null;
  transportation: number | null;
  personal: number | null;
  /** Sum of the reported components above (nulls treated as unreported, not zero). */
  coa: number | null;
  /** Whether any COA component was missing from the data. */
  coaIncomplete: boolean;
  grants: number;
  scholarships: number;
  giftAid: number;
  /** COA minus gift aid. Loans and work-study NEVER reduce this figure. */
  netAnnual: number | null;
  net4Year: number | null;
  /** Annual gap between net cost and the family budget (if provided). */
  borrowingAnnual: number | null;
  borrowing4Year: number | null;
  monthlyLoanPayment: number | null;
  residency: "in_state" | "out_of_state";
  usedIncomeBandNetPrice: boolean;
}

export interface CostOptions {
  /** Additional scholarships the student expects, per year. */
  extraScholarships?: number;
  /** Override grants estimate; otherwise the college's average grant aid is used. */
  grantsOverride?: number | null;
  loanApr?: number; // default: 2024–25 federal undergrad rate
  loanTermYears?: number;
}

const DEFAULT_APR = 0.0653;
const DEFAULT_TERM = 10;

function sumReported(values: (number | null)[]): { total: number | null; incomplete: boolean } {
  const reported = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (reported.length === 0) return { total: null, incomplete: true };
  return {
    total: reported.reduce((a, b) => a + b, 0),
    incomplete: reported.length < values.length,
  };
}

/** Standard amortized monthly payment. Returns 0 for zero principal. */
export function monthlyPayment(principal: number, apr = DEFAULT_APR, years = DEFAULT_TERM): number {
  if (principal <= 0) return 0;
  const r = apr / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function isInState(student: StudentProfile, college: College): boolean {
  return !!student.homeState && !!college.state && student.homeState === college.state;
}

/** Grant estimate for the student's income band when the college reports it. */
export function grantsForStudent(student: StudentProfile, college: College): { grants: number; usedBand: boolean } {
  const band = student.householdIncomeRange as IncomeBand | "";
  const coaParts = sumReported([
    isInState(student, college) ? college.tuitionInState : college.tuitionOutState ?? college.tuitionInState,
    college.fees,
    college.housingMeals,
    college.books,
    college.transportation,
    college.personalExpenses,
  ]);
  if (band && college.netPriceByIncome && college.netPriceByIncome[band] != null && coaParts.total !== null) {
    // Implied grant = COA − reported net price for that income band (floored at 0).
    const implied = Math.max(0, coaParts.total - (college.netPriceByIncome[band] as number));
    return { grants: implied, usedBand: true };
  }
  return { grants: Math.max(0, college.avgGrantAid ?? 0), usedBand: false };
}

export function estimateCost(
  student: StudentProfile,
  college: College,
  options: CostOptions = {},
): CostBreakdown {
  const inState = isInState(student, college);
  const tuition = inState ? college.tuitionInState : college.tuitionOutState ?? college.tuitionInState;

  const { total: coa, incomplete } = sumReported([
    tuition,
    college.fees,
    college.housingMeals,
    college.books,
    college.transportation,
    college.personalExpenses,
  ]);

  const grantInfo =
    options.grantsOverride != null
      ? { grants: Math.max(0, options.grantsOverride), usedBand: false }
      : grantsForStudent(student, college);
  const scholarships = Math.max(0, options.extraScholarships ?? 0);

  // Gift aid reduces net price; it can never exceed COA.
  const rawGift = grantInfo.grants + scholarships;
  const giftAid = coa !== null ? Math.min(rawGift, coa) : rawGift;

  const netAnnual = coa !== null ? Math.max(0, coa - giftAid) : null;
  const net4Year = netAnnual !== null ? netAnnual * 4 : null;

  let borrowingAnnual: number | null = null;
  if (netAnnual !== null && student.maxAnnualBudget !== null) {
    borrowingAnnual = Math.max(0, netAnnual - student.maxAnnualBudget);
  }
  const borrowing4Year = borrowingAnnual !== null ? borrowingAnnual * 4 : null;
  const monthlyLoanPayment =
    borrowing4Year !== null
      ? monthlyPayment(borrowing4Year, options.loanApr ?? DEFAULT_APR, options.loanTermYears ?? DEFAULT_TERM)
      : null;

  return {
    tuition: tuition ?? null,
    fees: college.fees,
    housingMeals: college.housingMeals,
    books: college.books,
    transportation: college.transportation,
    personal: college.personalExpenses,
    coa,
    coaIncomplete: incomplete,
    grants: grantInfo.grants,
    scholarships,
    giftAid,
    netAnnual,
    net4Year,
    borrowingAnnual,
    borrowing4Year,
    monthlyLoanPayment,
    residency: inState ? "in_state" : "out_of_state",
    usedIncomeBandNetPrice: grantInfo.usedBand,
  };
}

export type GrantLikelihood = "Higher" | "Moderate" | "Limited" | "Unknown";

/**
 * Indicator of how likely grant/scholarship aid is at this college for this
 * student, from reported data. An estimate only — aid is decided by the
 * college and is NEVER guaranteed. Not a probability.
 */
export function grantLikelihood(
  student: StudentProfile,
  college: College,
): { level: GrantLikelihood; reasons: string[] } {
  const reasons: string[] = [];
  let signals = 0;
  let score = 0;

  const cost = estimateCost(student, college);
  if (cost.usedIncomeBandNetPrice && cost.coa && cost.grants !== null) {
    signals++;
    const share = cost.grants / cost.coa;
    if (share >= 0.4) score += 2;
    else if (share > 0.1) score += 1;
    if (share > 0.1) {
      reasons.push(
        `Students in your income band typically receive grants covering about ${Math.round(share * 100)}% of the cost of attendance here.`,
      );
    } else {
      reasons.push("Students in your income band typically receive little grant aid here.");
    }
  } else if (college.avgGrantAid !== null && cost.coa) {
    signals++;
    const share = college.avgGrantAid / cost.coa;
    if (share >= 0.4) score += 2;
    else if (share > 0.1) score += 1;
    reasons.push(
      `Average grant aid here covers about ${Math.round(share * 100)}% of the cost of attendance (all aided students).`,
    );
  }

  if (college.pellGrantRate !== null) {
    signals++;
    const lowIncome =
      student.householdIncomeRange === "0_30000" || student.householdIncomeRange === "30001_48000";
    if (college.pellGrantRate >= 0.35 && lowIncome) {
      score += 2;
      reasons.push(
        `${Math.round(college.pellGrantRate * 100)}% of students here receive federal Pell Grants; with your reported income range you may qualify — file the FAFSA to find out.`,
      );
    } else {
      reasons.push(`${Math.round(college.pellGrantRate * 100)}% of students here receive federal Pell Grants.`);
    }
  }

  if (college.financialAid?.meetsFullNeed) {
    signals++;
    score += 2;
    reasons.push("This college reports meeting 100% of demonstrated financial need.");
  }
  if (college.financialAid?.meritAidAvailable) {
    signals++;
    score += 1;
    reasons.push("Merit scholarships are offered regardless of financial need.");
  } else if (college.financialAid?.meritAidAvailable === false) {
    signals++;
    reasons.push("This college reports no merit scholarships — aid is need-based only.");
  }

  if (signals === 0) return { level: "Unknown", reasons: ["Not enough reported aid data to estimate."] };
  const level: GrantLikelihood = score >= 3 ? "Higher" : score >= 1 ? "Moderate" : "Limited";
  return { level, reasons };
}
