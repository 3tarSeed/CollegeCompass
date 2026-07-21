import type { College, Confidence, FitCategory, StudentProfile } from "./types";

export interface FitResult {
  category: FitCategory;
  confidence: Confidence;
  explanations: string[];
  /** Internal composite, exposed for scoring — never shown as a probability. */
  signal: number;
}

/** Convert an SAT total to an approximate ACT composite for comparison. */
export function satToAct(sat: number): number {
  if (sat >= 1570) return 36;
  if (sat >= 1530) return 35;
  if (sat >= 1490) return 34;
  if (sat >= 1450) return 33;
  if (sat >= 1420) return 32;
  if (sat >= 1390) return 31;
  if (sat >= 1360) return 30;
  if (sat >= 1330) return 29;
  if (sat >= 1300) return 28;
  if (sat >= 1260) return 27;
  if (sat >= 1230) return 26;
  if (sat >= 1200) return 25;
  if (sat >= 1160) return 24;
  if (sat >= 1130) return 23;
  if (sat >= 1100) return 22;
  if (sat >= 1060) return 21;
  if (sat >= 1030) return 20;
  if (sat >= 990) return 19;
  if (sat >= 960) return 18;
  if (sat >= 920) return 17;
  if (sat >= 880) return 16;
  return 15;
}

function bestStudentAct(s: StudentProfile): number | null {
  const candidates: number[] = [];
  if (s.actSuperscore) candidates.push(s.actSuperscore);
  if (s.actComposite) candidates.push(s.actComposite);
  if (s.satScore) candidates.push(satToAct(s.satScore));
  return candidates.length ? Math.max(...candidates) : null;
}

function rigorCount(s: StudentProfile): number {
  return s.apCourses + s.ibCourses + s.honorsCourses + s.dualEnrollmentCourses;
}

/** GPA benchmark inferred from selectivity when institutional GPA data is unavailable. */
function gpaBenchmark(acceptanceRate: number | null): number {
  if (acceptanceRate === null) return 3.3;
  if (acceptanceRate < 0.15) return 3.9;
  if (acceptanceRate < 0.3) return 3.75;
  if (acceptanceRate < 0.5) return 3.5;
  if (acceptanceRate < 0.7) return 3.2;
  return 2.8;
}

export function classifyFit(student: StudentProfile, college: College): FitResult {
  const explanations: string[] = [];
  let signal = 0;
  let inputsAvailable = 0;
  let inputsPossible = 0;

  const act = bestStudentAct(student);
  const testBlind = college.testPolicy === "blind";

  // ── Test position vs. reported middle-50% range ──
  inputsPossible += 2;
  const hasRange =
    (college.act25 !== null && college.act75 !== null) ||
    (college.sat25 !== null && college.sat75 !== null);
  if (!testBlind && act !== null && hasRange) {
    inputsAvailable += 2;
    const r25 = college.act25 ?? satToAct(college.sat25 as number);
    const r75 = college.act75 ?? satToAct(college.sat75 as number);
    const mid = (r25 + r75) / 2;
    if (act >= r75) {
      signal += 2;
      explanations.push(
        `Your ${student.actSuperscore || student.actComposite ? "ACT" : "SAT-equivalent"} is at or above the school's reported 75th percentile.`,
      );
    } else if (act >= mid) {
      signal += 1;
      explanations.push("Your test score sits in the upper half of the school's reported middle range.");
    } else if (act >= r25) {
      signal += 0;
      explanations.push("Your test score is within the school's reported middle range, in the lower half.");
    } else {
      signal -= 1.5;
      explanations.push("Your test score is below the school's reported middle range.");
    }
  } else if (testBlind) {
    explanations.push("This school is test-blind, so scores are not considered; GPA and course rigor carry more weight here.");
  } else if (act === null && college.testPolicy === "optional") {
    explanations.push("No test score on file — this school is test-optional, so your GPA and rigor carry the estimate.");
  } else if (act === null || !hasRange) {
    explanations.push("Test comparison unavailable (missing your score or the school's reported range).");
  }

  // ── GPA vs. selectivity-inferred benchmark ──
  inputsPossible += 2;
  const gpa = student.gpaUnweighted;
  if (gpa !== null) {
    inputsAvailable += 1;
    const bench = gpaBenchmark(college.acceptanceRate);
    if (college.acceptanceRate !== null) inputsAvailable += 1;
    if (gpa >= bench + 0.05) {
      signal += 1.5;
      explanations.push("Your unweighted GPA is above the typical profile for a school at this selectivity level.");
    } else if (gpa >= bench - 0.15) {
      signal += 0.5;
      explanations.push("Your unweighted GPA is close to the typical profile for schools at this selectivity level.");
    } else if (gpa >= bench - 0.4) {
      signal -= 0.5;
      explanations.push("Your unweighted GPA is somewhat below the typical profile for schools at this selectivity level.");
    } else {
      signal -= 1.5;
      explanations.push("Your unweighted GPA is below the typical profile for schools at this selectivity level.");
    }
  } else {
    explanations.push("No GPA on file — add it in your profile to sharpen this estimate.");
  }

  // ── Course rigor ──
  inputsPossible += 1;
  const rigor = rigorCount(student);
  if (rigor > 0) inputsAvailable += 1;
  if (rigor >= 8) {
    signal += 0.75;
    explanations.push("Your advanced coursework (AP/IB/honors/dual-enrollment) strengthens your academic profile.");
  } else if (rigor >= 4) {
    signal += 0.35;
  }

  // ── Selectivity baseline ──
  inputsPossible += 1;
  const acc = college.acceptanceRate;
  if (acc !== null) {
    inputsAvailable += 1;
    if (acc < 0.1) signal -= 2.5;
    else if (acc < 0.2) signal -= 1.5;
    else if (acc < 0.35) signal -= 0.75;
    else if (acc >= 0.6) signal += 0.75;
  }

  // ── Category from signal ──
  let category: FitCategory;
  if (signal >= 2.5) category = "Likely";
  else if (signal >= 1) category = "Target";
  else if (signal >= -0.5) category = "Possible";
  else if (signal >= -2) category = "Reach";
  else category = "High Reach";

  // Highly selective schools are always reaches, regardless of stats.
  if (acc !== null && acc < 0.15) {
    category = signal <= -2 ? "High Reach" : "Reach";
    explanations.push(
      `With an acceptance rate near ${Math.round(acc * 100)}%, this school is a reach for every applicant, regardless of academic profile.`,
    );
  } else if (acc !== null && acc < 0.25 && (category === "Likely" || category === "Target")) {
    category = "Target";
  }

  // ── Confidence ──
  const ratio = inputsPossible > 0 ? inputsAvailable / inputsPossible : 0;
  const confidence: Confidence = ratio >= 0.8 ? "High" : ratio >= 0.5 ? "Moderate" : "Limited";
  if (confidence === "Limited") {
    explanations.push("Limited data was available for this estimate — treat it as a rough guide only.");
  }

  return { category, confidence, explanations, signal };
}

export const FIT_ORDER: FitCategory[] = ["Likely", "Target", "Possible", "Reach", "High Reach"];

export function fitTone(category: FitCategory): "green" | "amber" | "red" {
  if (category === "Likely" || category === "Target") return "green";
  if (category === "Possible") return "amber";
  return "red";
}
