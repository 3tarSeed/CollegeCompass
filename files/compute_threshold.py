#!/usr/bin/env python3
"""
compute_threshold.py — Registration step 3, implementation A (Python/Decimal).

Offline only: reads the frozen canonical observation file (never the network),
computes the spx_rv5_v1 threshold sample, and emits a machine-readable
manifest. Registration hard-fails unless this manifest's "comparable" block is
byte-identical (as sorted JSON) to compute_threshold.R's.

Frozen algorithm:
  returns   r_i = ln(close_i / close_{i-1})          (consecutive canonical closes)
  RV(j)     sqrt( 252/5 * sum_{i=j-4..j} r_i^2 )     (annualized, 5 sessions)
  sample    all windows whose ENDING date is within [sample_start, sample_end]
  T_unrounded  Hyndman–Fan type-7 quantile, p = 3/4:
               h = (N-1)*3/4; l = floor(h); T = x[l] + (h-l)*(x[l+1]-x[l])
               over ascending-sorted RVs (0-based)
  T         T_unrounded rounded HALF-EVEN to 6 decimals   (the literal governs)
  outcome   RV > T (strict); exceedance_count over the sample
  base_rate exceedance_count / N rounded HALF-EVEN to 6 decimals

Validation (fatal): duplicate dates, unsorted records, missing/empty values,
nonpositive closes, malformed lines, insufficient buffer history before the
first eligible window, N == 0, or any |RV - T| below the guard margin
(1e-12) — the last flags results that could differ between arithmetic systems.

Usage:
  python3 compute_threshold.py canonical.csv \
      --metadata retrieval_metadata.json \
      --sample-start 2023-07-01 --sample-end 2026-06-30 \
      --out manifest_python.json
"""
import argparse, datetime, hashlib, json, platform, sys
from decimal import Decimal, ROUND_HALF_EVEN, getcontext

SCRIPT_VERSION = "compute-threshold-py-v1"
getcontext().prec = 60  # working precision, far beyond the 6-decimal target

SIX = Decimal("0.000001")
GUARD = Decimal("1e-12")


def fail(msg: str) -> None:
    print(f"FATAL: {msg}", file=sys.stderr)
    sys.exit(1)


def load_canonical(path: str):
    with open(path, "rb") as f:
        data = f.read()
    sha = hashlib.sha256(data).hexdigest()
    dates, closes, prev = [], [], None
    for ln, line in enumerate(data.decode("utf-8").splitlines(), 1):
        parts = line.split(",")
        if len(parts) != 2:
            fail(f"line {ln}: malformed record {line!r}")
        d, v = parts
        try:
            datetime.date.fromisoformat(d)
        except ValueError:
            fail(f"line {ln}: bad date {d!r}")
        if prev is not None and d <= prev:
            fail(f"line {ln}: dates not strictly ascending ({prev!r} -> {d!r}; duplicates included)")
        prev = d
        if v == "" or v == ".":
            fail(f"line {ln}: missing value")
        try:
            c = Decimal(v)
        except Exception:
            fail(f"line {ln}: unparseable value {v!r}")
        if c <= 0:
            fail(f"line {ln}: nonpositive close {v}")
        dates.append(d)
        closes.append(c)
    if len(closes) < 7:
        fail("fewer than 7 observations")
    return dates, closes, sha


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("canonical")
    ap.add_argument("--metadata", required=True, help="retrieval metadata json from fetch_freeze.py")
    ap.add_argument("--sample-start", default="2023-07-01")
    ap.add_argument("--sample-end", default="2026-06-30")
    ap.add_argument("--out", default="manifest_python.json")
    a = ap.parse_args()

    dates, closes, canon_sha = load_canonical(a.canonical)
    meta = json.load(open(a.metadata, encoding="utf-8"))
    if meta.get("canonical_observations_sha256") != canon_sha:
        fail("canonical file sha256 does not match retrieval metadata")

    # log returns; index i return spans dates[i-1] -> dates[i]
    returns = [(closes[i] / closes[i - 1]).ln() for i in range(1, len(closes))]

    # buffer sufficiency: the first date on/after sample_start must have >= 5
    # returns (6 closes) of history behind it
    first_elig = next((i for i, d in enumerate(dates) if d >= a.sample_start), None)
    if first_elig is None:
        fail("no observations on/after sample start")
    if first_elig < 5:
        fail(f"insufficient buffer history: first eligible date {dates[first_elig]} "
             f"has only {first_elig} prior closes; need >= 5")

    ann = Decimal(252) / Decimal(5)
    rvs, window_ends = [], []
    for j in range(5, len(closes)):            # window = returns[j-5 .. j-1] ending at close j
        if a.sample_start <= dates[j] <= a.sample_end:
            s = sum((r * r for r in returns[j - 5:j]), Decimal(0))
            rvs.append((ann * s).sqrt())
            window_ends.append(dates[j])
    n = len(rvs)
    if n == 0:
        fail("empty threshold sample")

    xs = sorted(rvs)
    h = (Decimal(n) - 1) * Decimal(3) / Decimal(4)
    l = int(h.to_integral_value(rounding="ROUND_FLOOR"))
    frac = h - Decimal(l)
    t_un = xs[l] if l + 1 >= n else xs[l] + frac * (xs[l + 1] - xs[l])
    t = t_un.quantize(SIX, rounding=ROUND_HALF_EVEN)

    exceed = sum(1 for rv in rvs if rv > t)
    base_rate = (Decimal(exceed) / Decimal(n)).quantize(SIX, rounding=ROUND_HALF_EVEN)
    min_margin = min(abs(rv - t) for rv in rvs)
    if min_margin < GUARD:
        fail(f"an RV lies within {GUARD} of T ({min_margin}); "
             "cross-implementation agreement not guaranteed — manual review required")

    manifest = {
        "comparable": {
            "contract": "spx_rv5_v1",
            "canonical_observations_sha256": canon_sha,
            "raw_response_sha256": meta.get("raw_response_sha256"),
            "alfred_vintage_date": meta.get("alfred_vintage_date"),
            "sample_start": a.sample_start,
            "sample_end": a.sample_end,
            "first_window_end": window_ends[0],
            "last_window_end": window_ends[-1],
            "N": n,
            "exceedance_count": exceed,
            "T": str(t),
            "base_rate": str(base_rate),
            "quantile_method": "hyndman-fan-type-7",
            "rounding": "half-even-6dp",
            "annualization": "252/5",
            "outcome_rule": "RV>T strict",
            "canonicalization_version": meta.get("canonicalization_version"),
        },
        "diagnostics": {
            "T_unrounded_30dp": str(t_un.quantize(Decimal("1e-30"))),
            "min_abs_margin_to_T": str(min_margin.quantize(Decimal("1e-30"))),
            "observation_count": len(closes),
            "return_count": len(returns),
        },
        "environment": {
            "implementation": "python-decimal",
            "script_version": SCRIPT_VERSION,
            "python_version": platform.python_version(),
            "decimal_context_prec": getcontext().prec,
            "run_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write("\n")
    print(json.dumps(manifest["comparable"], indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
