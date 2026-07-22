export type Ownership = "public" | "private_nonprofit" | "private_forprofit";
export type Level = "four_year" | "two_year";
export type Setting = "urban" | "suburban" | "rural";
export type TestPolicy = "required" | "optional" | "blind" | "unknown";
export type FitCategory = "Likely" | "Target" | "Possible" | "Reach" | "High Reach";
export type Confidence = "High" | "Moderate" | "Limited";
export type ApplicationPlan =
  | "early_decision"
  | "early_action"
  | "regular"
  | "rolling"
  | "priority";

export interface Provenance {
  sourceName: string;
  sourceUrl: string;
  dataYear: string;
  lastVerified: string; // ISO date
  isSample: boolean;
}

export interface CollegeDeadline {
  id: string;
  collegeId: string;
  plan: ApplicationPlan | "fafsa" | "css" | "scholarship";
  label: string;
  dueDate: string | null; // ISO date; null = rolling / not reported
  provenance: Provenance;
  mayHaveChanged: boolean;
}

export interface ApplicationRequirement {
  key: string;
  label: string;
  detail?: string;
  required: boolean;
}

export type RaceKey =
  | "white" | "black" | "hispanic" | "asian" | "aian"
  | "nhpi" | "two_or_more" | "non_resident" | "unknown";

export const RACE_LABELS: Record<RaceKey, string> = {
  white: "White",
  black: "Black or African American",
  hispanic: "Hispanic or Latino",
  asian: "Asian",
  aian: "American Indian / Alaska Native",
  nhpi: "Native Hawaiian / Pacific Islander",
  two_or_more: "Two or more races",
  non_resident: "International students",
  unknown: "Race/ethnicity unknown",
};

export interface FinancialAidDetails {
  /** The school's policy on outside-scholarship displacement, if published. */
  scholarshipDisplacementPolicy: string | null;
  requiresFafsa: boolean | null;
  requiresCssProfile: boolean | null;
  priorityAidDeadline: string | null;
  meetsFullNeed: boolean | null;
  needBlind: boolean | null;
  meritAidAvailable: boolean | null;
  notes?: string;
  provenance: Provenance;
}

export interface College {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  admissionsUrl: string | null;
  netPriceCalculatorUrl: string | null;
  ownership: Ownership | null;
  level: Level | null;
  enrollment: number | null;
  campusSetting: Setting | null;
  ncaaDivision: string | null;
  acceptanceRate: number | null; // 0..1
  act25: number | null;
  act75: number | null;
  sat25: number | null;
  sat75: number | null;
  testPolicy: TestPolicy;
  graduationRate: number | null; // 0..1
  retentionRate: number | null; // 0..1
  tuitionInState: number | null;
  tuitionOutState: number | null;
  fees: number | null;
  housingMeals: number | null;
  books: number | null;
  transportation: number | null;
  personalExpenses: number | null;
  avgNetPrice: number | null;
  netPriceByIncome: Partial<Record<IncomeBand, number>> | null;
  avgGrantAid: number | null;
  medianFederalDebt: number | null;
  medianEarnings10yr: number | null;
  majors: string[];
  /** Majors ranked by share of degrees awarded (0-1), most popular first. */
  majorShares: { name: string; share: number }[] | null;
  /** Share of enrolled students by race/ethnicity (0-1), from federal data. */
  demographics: Partial<Record<RaceKey, number>> | null;
  /** Share of enrolled students by gender (0-1), from federal data. */
  genderShares: { men: number | null; women: number | null } | null;
  /** Share of undergrads receiving federal Pell Grants (0-1). */
  pellGrantRate: number | null;
  applicationFee: number | null;
  deadlines: CollegeDeadline[];
  requirements: ApplicationRequirement[];
  financialAid: FinancialAidDetails | null;
  provenance: Provenance; // core record provenance
  isSample: boolean;
}

export type IncomeBand =
  | "0_30000"
  | "30001_48000"
  | "48001_75000"
  | "75001_110000"
  | "110001_plus";

export const INCOME_BAND_LABELS: Record<IncomeBand, string> = {
  "0_30000": "$0–30k",
  "30001_48000": "$30–48k",
  "48001_75000": "$48–75k",
  "75001_110000": "$75–110k",
  "110001_plus": "$110k+",
};

export interface StudentProfile {
  firstName: string;
  graduationYear: number | null;
  homeState: string;
  homeZip: string;
  gpaWeighted: number | null;
  gpaUnweighted: number | null;
  actComposite: number | null;
  actSuperscore: number | null;
  satScore: number | null;
  apCourses: number;
  ibCourses: number;
  honorsCourses: number;
  dualEnrollmentCourses: number;
  intendedMajors: string[];
  householdIncomeRange: IncomeBand | "";
  familySize: number | null;
  maxAnnualBudget: number | null;
  preferredStates: string[];
  preferredRegions: string[];
  schoolTypePreference: "public" | "private" | "any";
  campusSizePreference: "small" | "medium" | "large" | "any";
  settingPreference: Setting | "any";
  ncaaPreference: "I" | "II" | "III" | "club" | "none" | "any";
  extracurriculars: string[];
  applicationPlanPreference: ApplicationPlan | "any";
  scoreWeights: ScoreWeights;
  isSample: boolean;
}

export interface ScoreWeights {
  fit: number;
  affordability: number;
  academics: number;
  outcomes: number;
  location: number;
  other: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  fit: 25,
  affordability: 25,
  academics: 20,
  outcomes: 15,
  location: 10,
  other: 5,
};

export type TaskStatus = "not_started" | "in_progress" | "done" | "waived" | "n_a";

export interface ApplicationTask {
  id: string;
  collegeId: string;
  taskKey: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  note: string;
  sourceUrl: string | null;
}

export interface SavedCollege {
  collegeId: string;
  applicationPlan: ApplicationPlan | null;
  notes: string;
  savedAt: string;
}

export interface Scholarship {
  id: string;
  collegeId: string | null;
  name: string;
  amount: number | null;
  renewable: boolean;
  deadline: string | null;
  status: "planned" | "applied" | "awarded" | "declined";
  sourceUrl: string | null;
  isSample: boolean;
}

/** Maximum colleges in a side-by-side comparison. */
export const MAX_COMPARE = 8;
