"use client";
/**
 * Persistence layer with two backends:
 *  - Local guest mode (browser localStorage) when Supabase isn't configured
 *    or the user isn't signed in.
 *  - Supabase (per-user rows, RLS-protected) when signed in.
 * The AppProvider is the only consumer.
 */
import { getSupabase } from "./supabase/client";
import type {
  ApplicationTask,
  College,
  SavedCollege,
  Scholarship,
  StudentProfile,
} from "./types";

export interface PersistedState {
  profile: StudentProfile | null;
  saved: SavedCollege[];
  tasks: ApplicationTask[];
  compareIds: string[];
  scholarships: Scholarship[];
  /** Live-fetched college records the user saved or is comparing. Without this
   *  cache, their ids couldn't be resolved after a page reload. */
  pinnedColleges?: College[];
}

const KEY = "college-compass-v1";

export function loadLocal(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

export function saveLocal(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full/blocked — guest mode degrades gracefully */
  }
}

export function clearLocal(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

// ── Supabase backend ─────────────────────────────────────────────────────

export async function loadRemote(userId: string): Promise<Partial<PersistedState> | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const [profileRes, savedRes, tasksRes, listRes, schRes] = await Promise.all([
    sb.from("college_profiles").select("*").eq("id", userId).maybeSingle(),
    sb.from("college_saved").select("*").eq("user_id", userId),
    sb.from("college_application_tasks").select("*").eq("user_id", userId),
    sb.from("college_comparison_lists").select("*").eq("user_id", userId).limit(1).maybeSingle(),
    sb.from("college_scholarships").select("*").eq("user_id", userId),
  ]);

  const p = profileRes.data;
  const profile: StudentProfile | null = p
    ? {
        firstName: p.first_name ?? "",
        graduationYear: p.graduation_year,
        homeState: p.home_state ?? "",
        homeZip: p.home_zip ?? "",
        gpaWeighted: p.gpa_weighted !== null ? Number(p.gpa_weighted) : null,
        gpaUnweighted: p.gpa_unweighted !== null ? Number(p.gpa_unweighted) : null,
        actComposite: p.act_composite,
        actSuperscore: p.act_superscore,
        satScore: p.sat_score,
        apCourses: p.ap_courses ?? 0,
        ibCourses: p.ib_courses ?? 0,
        honorsCourses: p.honors_courses ?? 0,
        dualEnrollmentCourses: p.dual_enrollment_courses ?? 0,
        intendedMajors: p.intended_majors ?? [],
        householdIncomeRange: p.household_income_range ?? "",
        familySize: p.family_size,
        maxAnnualBudget: p.max_annual_budget !== null ? Number(p.max_annual_budget) : null,
        preferredStates: p.preferred_states ?? [],
        preferredRegions: p.preferred_regions ?? [],
        schoolTypePreference: p.school_type_preference ?? "any",
        campusSizePreference: p.campus_size_preference ?? "any",
        settingPreference: p.setting_preference ?? "any",
        ncaaPreference: p.ncaa_preference ?? "any",
        extracurriculars: p.extracurriculars ?? [],
        applicationPlanPreference: p.application_plan_preference ?? "any",
        scoreWeights: p.score_weights ?? { fit: 25, affordability: 25, academics: 20, outcomes: 15, location: 10, other: 5 },
        isSample: false,
      }
    : null;

  return {
    profile,
    saved: (savedRes.data ?? []).map((r) => ({
      collegeId: r.college_id,
      applicationPlan: r.application_plan,
      notes: r.notes ?? "",
      savedAt: r.created_at,
    })),
    tasks: (tasksRes.data ?? []).map((r) => ({
      id: r.id,
      collegeId: r.college_id,
      taskKey: r.task_key,
      title: r.title,
      status: r.status,
      dueDate: r.due_date,
      note: r.note ?? "",
      sourceUrl: r.source_url,
    })),
    compareIds: listRes.data?.college_ids ?? [],
    scholarships: (schRes.data ?? []).map((r) => ({
      id: r.id,
      collegeId: r.college_id,
      name: r.name,
      amount: r.amount !== null ? Number(r.amount) : null,
      renewable: r.renewable ?? false,
      deadline: r.deadline,
      status: r.status,
      sourceUrl: r.source_url,
      isSample: r.is_sample ?? false,
    })),
  };
}

export async function saveRemoteProfile(userId: string, profile: StudentProfile): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("college_profiles").upsert({
    id: userId,
    first_name: profile.firstName,
    graduation_year: profile.graduationYear,
    home_state: profile.homeState || null,
    home_zip: profile.homeZip || null,
    gpa_weighted: profile.gpaWeighted,
    gpa_unweighted: profile.gpaUnweighted,
    act_composite: profile.actComposite,
    act_superscore: profile.actSuperscore,
    sat_score: profile.satScore,
    ap_courses: profile.apCourses,
    ib_courses: profile.ibCourses,
    honors_courses: profile.honorsCourses,
    dual_enrollment_courses: profile.dualEnrollmentCourses,
    intended_majors: profile.intendedMajors,
    household_income_range: profile.householdIncomeRange || null,
    family_size: profile.familySize,
    max_annual_budget: profile.maxAnnualBudget,
    preferred_states: profile.preferredStates,
    preferred_regions: profile.preferredRegions,
    school_type_preference: profile.schoolTypePreference,
    campus_size_preference: profile.campusSizePreference,
    setting_preference: profile.settingPreference,
    ncaa_preference: profile.ncaaPreference,
    extracurriculars: profile.extracurriculars,
    application_plan_preference: profile.applicationPlanPreference,
    score_weights: profile.scoreWeights,
    is_sample: false,
    updated_at: new Date().toISOString(),
  });
}

function collegeToRow(c: College) {
  return {
    id: c.id,
    name: c.name,
    city: c.city,
    state: c.state,
    zip: c.zip,
    latitude: c.latitude,
    longitude: c.longitude,
    website: c.website,
    admissions_url: c.admissionsUrl,
    net_price_calculator_url: c.netPriceCalculatorUrl,
    ownership: c.ownership,
    level: c.level,
    enrollment: c.enrollment,
    campus_setting: c.campusSetting,
    ncaa_division: c.ncaaDivision,
    acceptance_rate: c.acceptanceRate,
    act_25: c.act25, act_75: c.act75,
    sat_25: c.sat25, sat_75: c.sat75,
    test_policy: c.testPolicy,
    graduation_rate: c.graduationRate,
    retention_rate: c.retentionRate,
    tuition_in_state: c.tuitionInState,
    tuition_out_state: c.tuitionOutState,
    fees: c.fees,
    housing_meals: c.housingMeals,
    books: c.books,
    transportation: c.transportation,
    personal_expenses: c.personalExpenses,
    avg_net_price: c.avgNetPrice,
    net_price_by_income: c.netPriceByIncome,
    avg_grant_aid: c.avgGrantAid,
    median_federal_debt: c.medianFederalDebt,
    median_earnings_10yr: c.medianEarnings10yr,
    majors: c.majors,
    demographics: c.demographics,
    pell_grant_rate: c.pellGrantRate,
    application_fee: c.applicationFee,
    is_sample: c.isSample ?? false,
    updated_at: new Date().toISOString(),
  };
}

export async function syncRemoteCollections(
  userId: string,
  state: Pick<PersistedState, "saved" | "tasks" | "compareIds" | "scholarships" | "pinnedColleges">,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  // Simple replace-style sync keeps the adapter predictable.
  // Cache any live college records first so FK references resolve.
  if (state.pinnedColleges?.length) {
    await sb.from("colleges").upsert(state.pinnedColleges.map(collegeToRow));
  }
  await Promise.all([
    sb.from("college_saved").delete().eq("user_id", userId),
    sb.from("college_application_tasks").delete().eq("user_id", userId),
    sb.from("college_scholarships").delete().eq("user_id", userId).eq("is_sample", false),
  ]);
  if (state.saved.length) {
    await sb.from("college_saved").insert(
      state.saved.map((s) => ({
        user_id: userId,
        college_id: s.collegeId,
        application_plan: s.applicationPlan,
        notes: s.notes,
      })),
    );
  }
  if (state.tasks.length) {
    await sb.from("college_application_tasks").insert(
      state.tasks.map((t) => ({
        user_id: userId,
        college_id: t.collegeId,
        task_key: t.taskKey,
        title: t.title,
        status: t.status,
        due_date: t.dueDate,
        note: t.note,
        source_url: t.sourceUrl,
      })),
    );
  }
  const nonSample = state.scholarships.filter((s) => !s.isSample);
  if (nonSample.length) {
    await sb.from("college_scholarships").insert(
      nonSample.map((s) => ({
        user_id: userId,
        college_id: s.collegeId,
        name: s.name,
        amount: s.amount,
        renewable: s.renewable,
        deadline: s.deadline,
        status: s.status,
        source_url: s.sourceUrl,
        is_sample: false,
      })),
    );
  }
  const { data: existing } = await sb
    .from("college_comparison_lists")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await sb
      .from("college_comparison_lists")
      .update({ college_ids: state.compareIds, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await sb.from("college_comparison_lists").insert({ user_id: userId, college_ids: state.compareIds });
  }
}
