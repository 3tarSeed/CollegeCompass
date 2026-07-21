#!/usr/bin/env python3
"""
compare_manifests.py — Registration gate.

Compares the "comparable" blocks of the Python and R manifests. Any
disagreement — N, six-decimal T, exceedance count, base rate, hashes,
vintage, sample bounds, or method identifiers — is a hard failure and
registration must not proceed.

Usage: python3 compare_manifests.py manifest_python.json manifest_r.json
Exit:  0 = PASS (identical), 1 = FAIL
"""
import json, re, sys

HEX64 = re.compile(r"^[0-9a-f]{64}$")
ISODATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SIXDP = re.compile(r"^\d+\.\d{6}$")
REQUIRED = ["contract", "canonical_observations_sha256", "raw_response_sha256",
            "alfred_vintage_date", "sample_start", "sample_end",
            "first_window_end", "last_window_end", "N", "exceedance_count",
            "T", "base_rate", "quantile_method", "rounding", "annualization",
            "outcome_rule", "canonicalization_version"]


def validate(name, m):
    errs = []
    for k in REQUIRED:
        if k not in m:
            errs.append(f"missing key {k}")
    if errs:
        return errs
    for k in ("canonical_observations_sha256", "raw_response_sha256"):
        if not HEX64.match(str(m[k])):
            errs.append(f"{k}: not a 64-char lowercase hex hash")
    for k in ("alfred_vintage_date", "sample_start", "sample_end",
              "first_window_end", "last_window_end"):
        if not ISODATE.match(str(m[k])):
            errs.append(f"{k}: not YYYY-MM-DD")
    if not (isinstance(m["N"], int) and m["N"] > 0):
        errs.append("N: not a positive integer")
    if not (isinstance(m["exceedance_count"], int)
            and 0 <= m["exceedance_count"] <= (m["N"] if isinstance(m["N"], int) else 0)):
        errs.append("exceedance_count: not an integer in [0, N]")
    for k in ("T", "base_rate"):
        if not SIXDP.match(str(m[k])):
            errs.append(f"{k}: not a fixed six-decimal string")
    return errs


def norm(v):
    # ints vs. JSON numerics normalized; strings compared exactly
    return str(v) if isinstance(v, (int, float)) else v


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    a = json.load(open(sys.argv[1], encoding="utf-8"))["comparable"]
    b = json.load(open(sys.argv[2], encoding="utf-8"))["comparable"]

    bad = [(sys.argv[1], e) for e in validate("python", a)] + \
          [(sys.argv[2], e) for e in validate("r", b)]
    if bad:
        print("REGISTRATION GATE: FAIL — manifest structure invalid:\n")
        for src, e in bad:
            print(f"  {src}: {e}")
        return 1

    keys = sorted(set(a) | set(b))
    diffs = [(k, a.get(k, "<MISSING>"), b.get(k, "<MISSING>"))
             for k in keys if norm(a.get(k)) != norm(b.get(k))]

    if diffs:
        print("REGISTRATION GATE: FAIL — manifests disagree:\n")
        for k, va, vb in diffs:
            print(f"  {k}:\n    python: {va}\n    r:      {vb}")
        return 1

    print("REGISTRATION GATE: PASS — implementations agree exactly.")
    for k in ("alfred_vintage_date", "N", "exceedance_count", "T", "base_rate",
              "canonical_observations_sha256"):
        print(f"  {k} = {a[k]}")
    print("\nSafe to proceed: synthetic artifacts -> contract file -> "
          "definition_artifact_hash -> external anchor.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
