/**
 * SAMPLE DATA ONLY — demo student profile used when no account/profile exists.
 * Flagged `isSample: true` and shown with a "Demo profile" badge in the UI.
 */
import type { StudentProfile, Scholarship } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/types";

export const SEED_STUDENT: StudentProfile = {
  firstName: "Jordan",
  graduationYear: 2027,
  homeState: "MD",
  homeZip: "20814",
  gpaWeighted: 4.18,
  gpaUnweighted: 3.72,
  actComposite: 29,
  actSuperscore: 30,
  satScore: 1340,
  apCourses: 5,
  ibCourses: 0,
  honorsCourses: 4,
  dualEnrollmentCourses: 1,
  intendedMajors: ["Computer Science", "Economics"],
  householdIncomeRange: "75001_110000",
  familySize: 4,
  maxAnnualBudget: 28000,
  preferredStates: ["MD", "VA", "PA", "NC"],
  preferredRegions: ["Mid-Atlantic", "Southeast"],
  schoolTypePreference: "any",
  campusSizePreference: "medium",
  settingPreference: "suburban",
  ncaaPreference: "any",
  extracurriculars: ["Robotics club captain", "Varsity soccer", "Part-time job"],
  applicationPlanPreference: "early_action",
  scoreWeights: { ...DEFAULT_WEIGHTS },
  isSample: true,
};

export const SEED_SCHOLARSHIPS: Scholarship[] = [
  {
    id: "sample-sch-1",
    collegeId: null,
    name: "Community Foundation STEM Award (Sample)",
    amount: 2500,
    renewable: false,
    deadline: "2027-03-01",
    status: "planned",
    sourceUrl: "https://example.org/sample-scholarship",
    isSample: true,
  },
  {
    id: "sample-sch-2",
    collegeId: "sample-chesapeake-state",
    name: "Chesapeake Presidential Merit Award (Sample)",
    amount: 8000,
    renewable: true,
    deadline: "2026-11-01",
    status: "planned",
    sourceUrl: "https://example.edu/chesapeake-state/scholarships",
    isSample: true,
  },
];
