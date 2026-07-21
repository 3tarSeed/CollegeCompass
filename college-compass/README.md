# College Compass

A responsive web app that helps U.S. high-school students and families **search, save and compare colleges**, with a personalized admissions-fit estimate, true-cost estimate, financial-aid picture, application checklists and deadline tracking.

Built with **Next.js (App Router) · TypeScript · Tailwind CSS · Supabase · Recharts · Lucide**.

---

## Quick start (demo mode — zero configuration)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set, the app runs in **demo mode**:

- A demo student profile ("Sophia") and **seven clearly-labeled sample colleges** are loaded from `src/data/`.
- Everything you change (profile, saved colleges, tasks, scholarships) persists to browser `localStorage`.
- Sample records are flagged `isSample: true` everywhere and shown with an amber **Sample data** badge. Live and sample values are never mixed in one record.

## Full setup

### 1. College Scorecard API (live college data)

1. Get a free key at https://api.data.gov/signup/
2. Copy `.env.example` → `.env.local` and set:
   ```
   COLLEGE_SCORECARD_API_KEY=your_key
   ```
3. Restart `npm run dev`. The **Find Colleges** page now queries live U.S. Department of Education data through the server-side route `src/app/api/scorecard/route.ts`. The key never reaches the browser.

### 2. Supabase (accounts + cloud persistence)

1. Create a project at https://supabase.com
2. In the SQL editor, run **`supabase/schema.sql`** (creates all 11 tables + row-level security).
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # server-only, used by the seed script
   ```
4. (Optional) Seed the reference tables with the labeled sample dataset:
   ```bash
   npm run seed
   ```
5. Enable the **Email (magic link)** auth provider in Supabase → Authentication.

Signed-in users get their profile, saved colleges, tasks, comparison list and scholarships synced to Supabase (RLS restricts every row to its owner). Signed-out users keep working in local demo mode.

### 3. Tests

```bash
npm test
```

Runs the unit tests for the **true-cost calculator** (`tests/cost.test.ts`) and the **admissions-fit classifier** (`tests/fit.test.ts`) via the Node test runner.

### 4. Production build

```bash
npm run build && npm start
```

---

## How the estimates work (and their limits)

**Admissions fit** (`src/lib/fit.ts`) classifies each college as *Likely / Target / Possible / Reach / High Reach* using your GPA, best test score (ACT, superscore, or SAT converted), course rigor, the school's reported middle-50% test ranges and its acceptance rate. Rules of note:

- Schools with acceptance rates under ~15% are always at best a **Reach**, for every applicant.
- Test-blind schools ignore scores; test-optional schools without a score on file lean on GPA + rigor.
- Every estimate carries a **data-confidence rating** (High / Moderate / Limited) based on how much input data was available, plus plain-language explanations. The app **never states a probability of acceptance and never promises admission** — holistic factors aren't modeled.

**True cost** (`src/lib/cost.ts`):

- Cost of attendance = tuition (in-state vs. out-of-state chosen from your home state) + fees + housing & meals + books + transportation + personal expenses. Missing components are treated as *unreported*, not zero, and flagged.
- **Grants and scholarships reduce net price. Loans and work-study never do** — they're shown separately.
- When the college reports net price for your household-income band, band-specific grant estimates are used; otherwise the school-average grant applies.
- Estimated borrowing = the gap between net cost and your stated annual budget, ×4 years; the monthly payment uses standard 10-year amortization at the 6.53% federal undergraduate rate.

**College Value & Fit Score** (`src/lib/score.ts`) is a **personalized score, not a national ranking**, defaulting to: fit 25% · affordability 25% · academic/major match 20% · outcomes 15% · location/campus match 10% · other preferences 5%. Weights are adjustable on the Profile page and normalized to 100%.

## Data integrity

- Every data section shows its **data year, source link and last-verified date**, and reported facts are kept visually separate from app-generated estimates.
- Unavailable values render as **"Not reported"** — nothing is fabricated.
- Deadline sections carry a standing warning that dates may have changed, plus a **"Verify on college website"** button.
- No proprietary ranking sites are scraped.
- Scorecard limitations surfaced honestly: it has no deadlines, application requirements, NCAA divisions or itemized fees — those fields show "Not reported" for live records until you verify and add them.

## Project structure

```
supabase/schema.sql        Database schema (11 tables + RLS)
scripts/seed.ts            Seeds Supabase with the labeled sample dataset
src/data/                  ← ALL sample data lives here, isolated & replaceable
src/lib/                   fit, cost, score, geo, format, scorecard mapping, storage
src/store/AppProvider.tsx  App state + persistence (localStorage or Supabase)
src/app/                   Pages: dashboard, find, college/[id], compare,
                           applications, deadlines, financial-aid, profile, login
src/app/api/scorecard/     Server-side Scorecard proxy (key stays server-side)
tests/                     Unit tests for cost + fit
```

## Accessibility & responsiveness

Semantic landmarks and labels throughout, visible keyboard focus, `aria-pressed`/`aria-expanded` on toggles, live regions for result counts, reduced-motion support, and layouts that work from a phone up to desktop (sidebar collapses to a top bar with a menu).
