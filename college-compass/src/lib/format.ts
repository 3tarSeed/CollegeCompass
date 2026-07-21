export const NOT_REPORTED = "Not reported";

export function fmtMoney(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NOT_REPORTED;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.cents ? 2 : 0,
    minimumFractionDigits: opts.cents ? 2 : 0,
  });
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NOT_REPORTED;
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NOT_REPORTED;
  return n.toLocaleString("en-US");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return NOT_REPORTED;
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return NOT_REPORTED;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T23:59:59");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function fmtRange(a: number | null, b: number | null): string {
  if (a === null || b === null) return NOT_REPORTED;
  return `${a}–${b}`;
}

export const OWNERSHIP_LABELS: Record<string, string> = {
  public: "Public",
  private_nonprofit: "Private nonprofit",
  private_forprofit: "Private for-profit",
};

export const PLAN_LABELS: Record<string, string> = {
  early_decision: "Early Decision",
  early_action: "Early Action",
  regular: "Regular Decision",
  rolling: "Rolling",
  priority: "Priority",
  fafsa: "FAFSA",
  css: "CSS Profile",
  scholarship: "Scholarship",
};

export const TEST_POLICY_LABELS: Record<string, string> = {
  required: "Tests required",
  optional: "Test-optional",
  blind: "Test-blind",
  unknown: "Test policy not reported",
};
