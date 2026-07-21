import { classifyFit } from "./fit";
import { estimateCost } from "./cost";
import { distanceMiles } from "./geo";
import type { College, ScoreWeights, StudentProfile } from "./types";

export interface ValueScore {
  total: number; // 0–100
  parts: {
    fit: number;
    affordability: number;
    academics: number;
    outcomes: number;
    location: number;
    other: number;
  };
  weights: ScoreWeights;
}

const FIT_POINTS: Record<string, number> = {
  Likely: 95,
  Target: 80,
  Possible: 60,
  Reach: 40,
  "High Reach": 20,
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, n));
}

function affordabilityScore(student: StudentProfile, college: College): number {
  const cost = estimateCost(student, college);
  if (cost.netAnnual === null) return 50; // unknown → neutral
  const budget = student.maxAnnualBudget;
  if (budget && budget > 0) {
    const ratio = cost.netAnnual / budget;
    if (ratio <= 0.7) return 100;
    if (ratio <= 1) return 100 - (ratio - 0.7) * 100; // 100→70
    if (ratio <= 1.5) return 70 - (ratio - 1) * 80; // 70→30
    return clamp(30 - (ratio - 1.5) * 30);
  }
  // No budget set: scale against a $35k/yr reference.
  return clamp(100 - (cost.netAnnual / 35000) * 50);
}

function academicsScore(student: StudentProfile, college: College): number {
  if (student.intendedMajors.length === 0) return 60; // undecided → mild neutral
  if (college.majors.length === 0) return 50;
  const collegeLower = college.majors.map((m) => m.toLowerCase());
  const matches = student.intendedMajors.filter((m) =>
    collegeLower.some((c) => c.includes(m.toLowerCase()) || m.toLowerCase().includes(c)),
  );
  if (matches.length === student.intendedMajors.length) return 100;
  if (matches.length > 0) return 70;
  return 25;
}

function outcomesScore(college: College): number {
  const grad = college.graduationRate;
  const earn = college.medianEarnings10yr;
  const gradPart = grad !== null ? grad * 100 : 50;
  const earnPart = earn !== null ? clamp(((earn - 30000) / 60000) * 100) : 50;
  return clamp(gradPart * 0.6 + earnPart * 0.4);
}

function sizeBucket(enrollment: number | null): "small" | "medium" | "large" | null {
  if (enrollment === null) return null;
  if (enrollment < 5000) return "small";
  if (enrollment < 15000) return "medium";
  return "large";
}

const REGIONS: Record<string, string[]> = {
  Northeast: ["CT", "ME", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
  Southeast: ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "SC", "TN", "VA", "WV"],
  Midwest: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  Southwest: ["AZ", "NM", "OK", "TX"],
  West: ["AK", "CA", "CO", "HI", "ID", "MT", "NV", "OR", "UT", "WA", "WY"],
  "Mid-Atlantic": ["DE", "DC", "MD", "NJ", "NY", "PA", "VA"],
};

export function regionOf(state: string | null): string[] {
  if (!state) return [];
  return Object.entries(REGIONS)
    .filter(([, states]) => states.includes(state))
    .map(([r]) => r);
}

function locationScore(student: StudentProfile, college: College): number {
  const checks: number[] = [];
  if (student.preferredStates.length > 0 && college.state) {
    checks.push(student.preferredStates.includes(college.state) ? 100 : 20);
  }
  if (student.preferredRegions.length > 0 && college.state) {
    const regions = regionOf(college.state);
    checks.push(student.preferredRegions.some((r) => regions.includes(r)) ? 100 : 25);
  }
  if (student.settingPreference !== "any" && college.campusSetting) {
    checks.push(student.settingPreference === college.campusSetting ? 100 : 35);
  }
  if (student.campusSizePreference !== "any") {
    const bucket = sizeBucket(college.enrollment);
    if (bucket) checks.push(student.campusSizePreference === bucket ? 100 : 35);
  }
  if (checks.length === 0) return 60;
  return checks.reduce((a, b) => a + b, 0) / checks.length;
}

function otherScore(student: StudentProfile, college: College): number {
  const checks: number[] = [];
  if (student.schoolTypePreference !== "any" && college.ownership) {
    const isPublic = college.ownership === "public";
    checks.push(
      (student.schoolTypePreference === "public") === isPublic ? 100 : 30,
    );
  }
  if (student.ncaaPreference !== "any" && student.ncaaPreference !== "none") {
    checks.push(college.ncaaDivision === student.ncaaPreference ? 100 : 30);
  }
  if (student.homeState && college.latitude !== null && college.longitude !== null) {
    const d = distanceMiles(student.homeState, college.latitude, college.longitude);
    if (d !== null) checks.push(d < 250 ? 90 : d < 600 ? 70 : 55); // mild closeness bonus
  }
  if (checks.length === 0) return 60;
  return checks.reduce((a, b) => a + b, 0) / checks.length;
}

export function normalizeWeights(w: ScoreWeights): ScoreWeights {
  const total = w.fit + w.affordability + w.academics + w.outcomes + w.location + w.other;
  if (total <= 0) return { fit: 25, affordability: 25, academics: 20, outcomes: 15, location: 10, other: 5 };
  const f = 100 / total;
  return {
    fit: w.fit * f,
    affordability: w.affordability * f,
    academics: w.academics * f,
    outcomes: w.outcomes * f,
    location: w.location * f,
    other: w.other * f,
  };
}

/** Personalized College Value & Fit Score (0–100). NOT a national ranking. */
export function valueScore(student: StudentProfile, college: College): ValueScore {
  const weights = normalizeWeights(student.scoreWeights);
  const fit = classifyFit(student, college);
  const parts = {
    fit: FIT_POINTS[fit.category] ?? 50,
    affordability: affordabilityScore(student, college),
    academics: academicsScore(student, college),
    outcomes: outcomesScore(college),
    location: locationScore(student, college),
    other: otherScore(student, college),
  };
  const total =
    (parts.fit * weights.fit +
      parts.affordability * weights.affordability +
      parts.academics * weights.academics +
      parts.outcomes * weights.outcomes +
      parts.location * weights.location +
      parts.other * weights.other) /
    100;
  return { total: Math.round(clamp(total)), parts, weights };
}
