-- College Compass — Supabase schema
-- Run in the Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ── college_profiles ────────────────────────────────────────────────────────────
create table if not exists public.college_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  graduation_year int,
  home_state text,
  home_zip text,
  gpa_weighted numeric(4, 2),
  gpa_unweighted numeric(4, 2),
  act_composite int check (act_composite between 1 and 36),
  act_superscore int check (act_superscore between 1 and 36),
  sat_score int check (sat_score between 400 and 1600),
  ap_courses int default 0,
  ib_courses int default 0,
  honors_courses int default 0,
  dual_enrollment_courses int default 0,
  intended_majors text[] default '{}',
  household_income_range text,
  family_size int,
  max_annual_budget numeric(10, 2),
  preferred_states text[] default '{}',
  preferred_regions text[] default '{}',
  school_type_preference text,          -- 'public' | 'private' | 'any'
  campus_size_preference text,          -- 'small' | 'medium' | 'large' | 'any'
  setting_preference text,              -- 'urban' | 'suburban' | 'rural' | 'any'
  ncaa_preference text,                 -- 'I' | 'II' | 'III' | 'club' | 'none' | 'any'
  extracurriculars text[] default '{}',
  application_plan_preference text,     -- 'early_decision' | 'early_action' | 'regular' | 'rolling' | 'any'
  score_weights jsonb default '{"fit":25,"affordability":25,"academics":20,"outcomes":15,"location":10,"other":5}',
  is_sample boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── colleges (cached Scorecard + curated records) ───────────────────────
create table if not exists public.colleges (
  id text primary key,                  -- Scorecard unit ID or 'sample-*'
  name text not null,
  city text,
  state text,
  zip text,
  latitude numeric,
  longitude numeric,
  website text,
  admissions_url text,
  net_price_calculator_url text,
  ownership text,                       -- 'public' | 'private_nonprofit' | 'private_forprofit'
  level text,                           -- 'four_year' | 'two_year'
  enrollment int,
  campus_setting text,                  -- 'urban' | 'suburban' | 'rural'
  ncaa_division text,
  acceptance_rate numeric(5, 4),
  act_25 int, act_75 int,
  sat_25 int, sat_75 int,
  test_policy text,                     -- 'required' | 'optional' | 'blind' | 'unknown'
  graduation_rate numeric(5, 4),
  retention_rate numeric(5, 4),
  tuition_in_state numeric(10, 2),
  tuition_out_state numeric(10, 2),
  fees numeric(10, 2),
  housing_meals numeric(10, 2),
  books numeric(10, 2),
  transportation numeric(10, 2),
  personal_expenses numeric(10, 2),
  avg_net_price numeric(10, 2),
  net_price_by_income jsonb,            -- {"0_30000":n,"30001_48000":n,...}
  avg_grant_aid numeric(10, 2),
  median_federal_debt numeric(10, 2),
  median_earnings_10yr numeric(10, 2),
  majors text[] default '{}',
  major_shares jsonb,
  demographics jsonb,
  pell_grant_rate numeric(5, 4),
  application_fee numeric(6, 2),
  is_sample boolean default false,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── college_saved ──────────────────────────────────────────────────────
create table if not exists public.college_saved (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.college_profiles (id) on delete cascade,
  college_id text not null references public.colleges (id) on delete cascade,
  application_plan text,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, college_id)
);

-- ── college_comparison_lists ────────────────────────────────────────────────────
create table if not exists public.college_comparison_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.college_profiles (id) on delete cascade,
  name text not null default 'My comparison',
  college_ids text[] not null default '{}',
  constraint max_compare check (coalesce(array_length(college_ids, 1), 0) <= 8),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── college_deadlines ───────────────────────────────────────────────────
create table if not exists public.college_deadlines (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references public.colleges (id) on delete cascade,
  plan text not null,                   -- 'early_decision' | 'early_action' | 'regular' | 'rolling' | 'priority' | 'fafsa' | 'css' | 'scholarship'
  label text not null,
  due_date date,
  source_url text,
  data_year text,
  last_verified date,
  may_have_changed boolean default true,
  is_sample boolean default false
);

-- ── college_application_requirements ────────────────────────────────────────────
create table if not exists public.college_application_requirements (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references public.colleges (id) on delete cascade,
  requirement text not null,            -- 'essay' | 'supplemental_essays' | 'transcript' | ...
  detail text,
  required boolean default true,
  source_url text,
  data_year text,
  last_verified date,
  is_sample boolean default false
);

-- ── college_application_tasks (per-user checklist) ──────────────────────────────
create table if not exists public.college_application_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.college_profiles (id) on delete cascade,
  college_id text not null references public.colleges (id) on delete cascade,
  task_key text not null,               -- 'application' | 'fee' | 'essay' | ...
  title text not null,
  status text not null default 'not_started',  -- 'not_started' | 'in_progress' | 'done' | 'waived' | 'n_a'
  due_date date,
  note text,
  source_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── college_scholarships ────────────────────────────────────────────────────────
create table if not exists public.college_scholarships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.college_profiles (id) on delete cascade,
  college_id text references public.colleges (id) on delete cascade,
  name text not null,
  amount numeric(10, 2),
  renewable boolean default false,
  deadline date,
  status text default 'planned',        -- 'planned' | 'applied' | 'awarded' | 'declined'
  source_url text,
  is_sample boolean default false,
  created_at timestamptz default now()
);

-- ── college_financial_aid_details ───────────────────────────────────────────────
create table if not exists public.college_financial_aid_details (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references public.colleges (id) on delete cascade,
  requires_fafsa boolean default true,
  requires_css_profile boolean default false,
  css_fee_waiver_info text,
  priority_aid_deadline date,
  meets_full_need boolean,
  need_blind boolean,
  merit_aid_available boolean,
  scholarship_displacement_policy text,
  notes text,
  source_url text,
  data_year text,
  last_verified date,
  is_sample boolean default false
);

-- ── college_data_sources ────────────────────────────────────────────────────────
create table if not exists public.college_data_sources (
  id uuid primary key default gen_random_uuid(),
  college_id text references public.colleges (id) on delete cascade,
  section text not null,                -- 'admissions' | 'cost' | 'outcomes' | ...
  source_name text not null,
  source_url text,
  data_year text,
  retrieved_at timestamptz default now()
);

-- ── college_verification_history ────────────────────────────────────────────────
create table if not exists public.college_verification_history (
  id uuid primary key default gen_random_uuid(),
  college_id text references public.colleges (id) on delete cascade,
  section text not null,
  verified_by text,                     -- 'system' | user id
  verified_at timestamptz default now(),
  result text                           -- 'confirmed' | 'updated' | 'flagged'
);

-- ── Row-level security ──────────────────────────────────────────────────
alter table public.college_profiles enable row level security;
alter table public.college_saved enable row level security;
alter table public.college_comparison_lists enable row level security;
alter table public.college_application_tasks enable row level security;
alter table public.college_scholarships enable row level security;
alter table public.colleges enable row level security;
alter table public.college_deadlines enable row level security;
alter table public.college_application_requirements enable row level security;
alter table public.college_financial_aid_details enable row level security;
alter table public.college_data_sources enable row level security;
alter table public.college_verification_history enable row level security;

create policy "own profile" on public.college_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own saved" on public.college_saved
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own lists" on public.college_comparison_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.college_application_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own college_scholarships" on public.college_scholarships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reference data is readable by any signed-in user; writes via service role only.
create policy "read colleges" on public.colleges for select using (true);
create policy "read deadlines" on public.college_deadlines for select using (true);
create policy "read requirements" on public.college_application_requirements for select using (true);
create policy "read aid details" on public.college_financial_aid_details for select using (true);
create policy "read sources" on public.college_data_sources for select using (true);
create policy "read verification" on public.college_verification_history for select using (true);

create index if not exists idx_college_saved_user on public.college_saved (user_id);
create index if not exists idx_college_tasks_user on public.college_application_tasks (user_id);
create index if not exists idx_college_deadlines_college on public.college_deadlines (college_id);
create index if not exists idx_college_requirements_college on public.college_application_requirements (college_id);
