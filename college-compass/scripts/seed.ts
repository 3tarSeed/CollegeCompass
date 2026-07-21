/**
 * Seeds the Supabase `colleges`, `college_deadlines`, `application_requirements`,
 * and `financial_aid_details` tables with the labeled SAMPLE dataset so the app
 * has reference data on first run.
 *
 * Usage:  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
 * (Also reads a local .env file if present.)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { SEED_COLLEGES } from "../src/data/seed-colleges";

// Minimal .env loader (no extra dependency).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "The app still works without seeding — it falls back to the in-repo sample data.",
  );
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log(`Seeding ${SEED_COLLEGES.length} sample colleges…`);

  const collegeRows = SEED_COLLEGES.map((c) => ({
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
    act_25: c.act25,
    act_75: c.act75,
    sat_25: c.sat25,
    sat_75: c.sat75,
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
    application_fee: c.applicationFee,
    is_sample: true,
  }));
  let res = await sb.from("colleges").upsert(collegeRows);
  if (res.error) throw res.error;

  const deadlineRows = SEED_COLLEGES.flatMap((c) =>
    c.deadlines.map((d) => ({
      college_id: c.id,
      plan: d.plan,
      label: d.label,
      due_date: d.dueDate,
      source_url: d.provenance.sourceUrl,
      data_year: d.provenance.dataYear,
      last_verified: d.provenance.lastVerified,
      may_have_changed: d.mayHaveChanged,
      is_sample: true,
    })),
  );
  await sb.from("college_deadlines").delete().eq("is_sample", true);
  res = await sb.from("college_deadlines").insert(deadlineRows);
  if (res.error) throw res.error;

  const reqRows = SEED_COLLEGES.flatMap((c) =>
    c.requirements.map((r) => ({
      college_id: c.id,
      requirement: r.key,
      detail: r.detail ?? r.label,
      required: r.required,
      source_url: c.admissionsUrl,
      data_year: c.provenance.dataYear,
      last_verified: c.provenance.lastVerified,
      is_sample: true,
    })),
  );
  await sb.from("application_requirements").delete().eq("is_sample", true);
  res = await sb.from("application_requirements").insert(reqRows);
  if (res.error) throw res.error;

  const aidRows = SEED_COLLEGES.filter((c) => c.financialAid).map((c) => ({
    college_id: c.id,
    requires_fafsa: c.financialAid!.requiresFafsa,
    requires_css_profile: c.financialAid!.requiresCssProfile,
    priority_aid_deadline: c.financialAid!.priorityAidDeadline,
    meets_full_need: c.financialAid!.meetsFullNeed,
    need_blind: c.financialAid!.needBlind,
    merit_aid_available: c.financialAid!.meritAidAvailable,
    notes: c.financialAid!.notes ?? null,
    source_url: c.financialAid!.provenance.sourceUrl,
    data_year: c.financialAid!.provenance.dataYear,
    last_verified: c.financialAid!.provenance.lastVerified,
    is_sample: true,
  }));
  await sb.from("financial_aid_details").delete().eq("is_sample", true);
  res = await sb.from("financial_aid_details").insert(aidRows);
  if (res.error) throw res.error;

  const sourceRows = SEED_COLLEGES.map((c) => ({
    college_id: c.id,
    section: "institution",
    source_name: c.provenance.sourceName,
    source_url: c.provenance.sourceUrl,
    data_year: c.provenance.dataYear,
  }));
  res = await sb.from("data_sources").insert(sourceRows);
  if (res.error) throw res.error;

  console.log("Done. Sample rows are flagged is_sample = true.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
