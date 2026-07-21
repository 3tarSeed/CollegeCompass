/**
 * Mapping between the College Scorecard API and the app's College type.
 * Used server-side (route handler) and to normalize responses client-side.
 * Docs: https://collegescorecard.ed.gov/data/api-documentation/
 */
import type { College, Ownership, Provenance, TestPolicy } from "./types";

export const SCORECARD_FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.zip",
  "location.lat",
  "location.lon",
  "school.school_url",
  "school.price_calculator_url",
  "school.ownership",
  "school.locale",
  "school.institutional_characteristics.level",
  "latest.student.size",
  "latest.admissions.admission_rate.overall",
  "latest.admissions.act_scores.25th_percentile.cumulative",
  "latest.admissions.act_scores.75th_percentile.cumulative",
  "latest.admissions.sat_scores.25th_percentile.combined",
  "latest.admissions.sat_scores.75th_percentile.combined",
  "latest.admissions.test_requirements",
  "latest.completion.rate_suppressed.overall",
  "latest.student.retention_rate.four_year.full_time_pooled",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.cost.roomboard.oncampus",
  "latest.cost.booksupply",
  "latest.cost.otherexpense.oncampus",
  "latest.cost.avg_net_price.overall",
  "latest.cost.net_price.public.by_income_level.0-30000",
  "latest.cost.net_price.public.by_income_level.30001-48000",
  "latest.cost.net_price.public.by_income_level.48001-75000",
  "latest.cost.net_price.public.by_income_level.75001-110000",
  "latest.cost.net_price.public.by_income_level.110001-plus",
  "latest.cost.net_price.private.by_income_level.0-30000",
  "latest.cost.net_price.private.by_income_level.30001-48000",
  "latest.cost.net_price.private.by_income_level.48001-75000",
  "latest.cost.net_price.private.by_income_level.75001-110000",
  "latest.cost.net_price.private.by_income_level.110001-plus",
  "latest.aid.median_debt_suppressed.overall",
  "latest.aid.pell_grant_rate",
  "latest.student.demographics.race_ethnicity.white",
  "latest.student.demographics.race_ethnicity.black",
  "latest.student.demographics.race_ethnicity.hispanic",
  "latest.student.demographics.race_ethnicity.asian",
  "latest.student.demographics.race_ethnicity.aian",
  "latest.student.demographics.race_ethnicity.nhpi",
  "latest.student.demographics.race_ethnicity.two_or_more",
  "latest.student.demographics.race_ethnicity.non_resident_alien",
  "latest.student.demographics.race_ethnicity.unknown",
  "latest.earnings.10_yrs_after_entry.median",
  "latest.academics.program_available.assoc_or_bachelors",
  "latest.academics.program_percentage",
].join(",");

type Raw = Record<string, unknown>;
const num = (r: Raw, k: string): number | null => {
  const v = r[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const str = (r: Raw, k: string): string | null => (typeof r[k] === "string" ? (r[k] as string) : null);

function ownership(r: Raw): Ownership | null {
  const v = r["school.ownership"];
  if (v === 1) return "public";
  if (v === 2) return "private_nonprofit";
  if (v === 3) return "private_forprofit";
  return null;
}

function setting(r: Raw): College["campusSetting"] {
  const locale = r["school.locale"];
  if (typeof locale !== "number") return null;
  if (locale >= 11 && locale <= 13) return "urban";
  if (locale >= 21 && locale <= 23) return "suburban";
  if (locale >= 31) return "rural";
  return null;
}

function testPolicy(r: Raw): TestPolicy {
  const v = r["latest.admissions.test_requirements"];
  if (v === 1) return "required";
  if (v === 5) return "optional"; // "considered but not required"
  if (v === 3) return "blind"; // "neither required nor recommended"
  if (v === 2) return "optional"; // "recommended"
  return "unknown";
}

const PROGRAM_LABELS: Record<string, string> = {
  "latest.academics.program_percentage.computer": "Computer Science",
  "latest.academics.program_percentage.engineering": "Engineering",
  "latest.academics.program_percentage.biological": "Biology",
  "latest.academics.program_percentage.business_marketing": "Business",
  "latest.academics.program_percentage.social_science": "Social Science",
  "latest.academics.program_percentage.psychology": "Psychology",
  "latest.academics.program_percentage.health": "Health Professions",
  "latest.academics.program_percentage.education": "Education",
  "latest.academics.program_percentage.visual_performing": "Visual & Performing Arts",
  "latest.academics.program_percentage.english": "English",
  "latest.academics.program_percentage.mathematics": "Mathematics",
  "latest.academics.program_percentage.physical_science": "Physical Science",
  "latest.academics.program_percentage.communication": "Communications",
  "latest.academics.program_percentage.history": "History",
  "latest.academics.program_percentage.agriculture": "Agriculture",
};

function majors(r: Raw): string[] {
  const out: string[] = [];
  for (const [key, label] of Object.entries(PROGRAM_LABELS)) {
    const v = r[key];
    if (typeof v === "number" && v > 0) out.push(label);
  }
  return out;
}

function incomeBands(r: Raw): College["netPriceByIncome"] {
  const own = ownership(r);
  const prefix =
    own === "public"
      ? "latest.cost.net_price.public.by_income_level."
      : "latest.cost.net_price.private.by_income_level.";
  const map: Record<string, string> = {
    "0_30000": "0-30000",
    "30001_48000": "30001-48000",
    "48001_75000": "48001-75000",
    "75001_110000": "75001-110000",
    "110001_plus": "110001-plus",
  };
  const out: Record<string, number> = {};
  for (const [band, apiKey] of Object.entries(map)) {
    const v = num(r, prefix + apiKey);
    if (v !== null) out[band] = v;
  }
  return Object.keys(out).length ? (out as College["netPriceByIncome"]) : null;
}

export function scorecardToCollege(r: Raw, dataYear: string): College {
  const id = String(r["id"]);
  const provenance: Provenance = {
    sourceName: "U.S. Dept. of Education College Scorecard",
    sourceUrl: `https://collegescorecard.ed.gov/school/?${id}`,
    dataYear,
    lastVerified: new Date().toISOString().slice(0, 10),
    isSample: false,
  };
  const roomBoard = num(r, "latest.cost.roomboard.oncampus");
  const other = num(r, "latest.cost.otherexpense.oncampus");
  const rawUrl = str(r, "school.school_url");
  const website = rawUrl ? (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`) : null;
  return {
    id,
    name: str(r, "school.name") ?? "Unknown institution",
    city: str(r, "school.city"),
    state: str(r, "school.state"),
    zip: str(r, "school.zip"),
    latitude: num(r, "location.lat"),
    longitude: num(r, "location.lon"),
    website,
    admissionsUrl: website, // Scorecard has no admissions-specific URL
    netPriceCalculatorUrl: str(r, "school.price_calculator_url"),
    ownership: ownership(r),
    level: r["school.institutional_characteristics.level"] === 2 ? "two_year" : "four_year",
    enrollment: num(r, "latest.student.size"),
    campusSetting: setting(r),
    ncaaDivision: null, // not in Scorecard — shown as "Not reported"
    acceptanceRate: num(r, "latest.admissions.admission_rate.overall"),
    act25: num(r, "latest.admissions.act_scores.25th_percentile.cumulative"),
    act75: num(r, "latest.admissions.act_scores.75th_percentile.cumulative"),
    sat25: num(r, "latest.admissions.sat_scores.25th_percentile.combined"),
    sat75: num(r, "latest.admissions.sat_scores.75th_percentile.combined"),
    testPolicy: testPolicy(r),
    graduationRate: num(r, "latest.completion.rate_suppressed.overall"),
    retentionRate: num(r, "latest.student.retention_rate.four_year.full_time_pooled"),
    tuitionInState: num(r, "latest.cost.tuition.in_state"),
    tuitionOutState: num(r, "latest.cost.tuition.out_of_state"),
    fees: null, // folded into tuition figures in Scorecard
    housingMeals: roomBoard,
    books: num(r, "latest.cost.booksupply"),
    transportation: null,
    personalExpenses: other,
    avgNetPrice: num(r, "latest.cost.avg_net_price.overall"),
    netPriceByIncome: incomeBands(r),
    avgGrantAid: null, // not directly reported; derived from net price where possible
    medianFederalDebt: num(r, "latest.aid.median_debt_suppressed.overall"),
    medianEarnings10yr: num(r, "latest.earnings.10_yrs_after_entry.median"),
    majors: majors(r),
    demographics: (() => {
      const get = (k: string) => num(r, `latest.student.demographics.race_ethnicity.${k}`);
      const d: Record<string, number | null> = {
        white: get("white"), black: get("black"), hispanic: get("hispanic"), asian: get("asian"),
        aian: get("aian"), nhpi: get("nhpi"), two_or_more: get("two_or_more"),
        non_resident: get("non_resident_alien"), unknown: get("unknown"),
      };
      const entries = Object.entries(d).filter(([, v]) => v !== null) as [string, number][];
      return entries.length ? (Object.fromEntries(entries) as Record<string, number>) : null;
    })(),
    pellGrantRate: num(r, "latest.aid.pell_grant_rate"),
    applicationFee: null,
    deadlines: [], // Scorecard has no deadline data — user adds/verifies these
    requirements: [],
    financialAid: null,
    provenance,
    isSample: false,
  };
}
