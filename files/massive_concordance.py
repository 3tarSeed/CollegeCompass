#!/usr/bin/env python3
"""
massive_concordance.py — Source gate for spx_rv5_v1 registration.

Fetches Massive (Polygon) I:SPX daily aggregates over the same window as the
frozen FRED canonical file and produces a concordance report:

  * endpoint parameters + retrieval timestamp
  * raw-response sha256 (restricted; Massive index values are licensed)
  * session counts per source
  * missing-date comparison in both directions
  * documented close-value discrepancies (reported, not gated)

GATE (exit code): PASS (0) iff the trading-session date sets are IDENTICAL
over the compared range. A session present in one source and absent in the
other is a hard failure — an omitted session silently turns a two-session
return into one "consecutive" return.

Usage:
  MASSIVE_API_KEY=... python3 massive_concordance.py \
      fred_canonical.csv --start 2023-06-01 --end 2026-06-30 \
      [--base-url https://api.massive.com] [--outdir ./artifacts] \
      [--report concordance_report.json]
"""
import argparse, datetime, hashlib, json, os, sys, urllib.parse, urllib.request
from decimal import Decimal
from zoneinfo import ZoneInfo

SCRIPT_VERSION = "massive-concordance-v1"
ET = ZoneInfo("America/New_York")
VALUE_NOTE_ABS = Decimal("0.01")  # discrepancies above this are listed (informational)


def fetch_all(base, start, end, key):
    url = (f"{base}/v2/aggs/ticker/I:SPX/range/1/day/{start}/{end}"
           f"?adjusted=true&sort=asc&limit=50000&apiKey={key}")
    redacted = url.replace(key, "REDACTED")
    raws, results = [], []
    while url:
        req = urllib.request.Request(url, headers={"User-Agent": "premlab-concordance/1"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
        raws.append(raw)
        page = json.loads(raw.decode("utf-8"))
        if page.get("status") not in ("OK", "DELAYED"):
            print(f"FATAL: Massive status {page.get('status')}: {page.get('error')}", file=sys.stderr)
            sys.exit(1)
        results.extend(page.get("results") or [])
        nxt = page.get("next_url")
        url = (nxt + f"&apiKey={key}") if nxt else None
    return raws, results, redacted


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("fred_canonical")
    ap.add_argument("--start", default="2023-06-01")
    ap.add_argument("--end", default="2026-06-30")
    ap.add_argument("--base-url", default="https://api.massive.com")
    ap.add_argument("--outdir", default="./artifacts")
    ap.add_argument("--report", default="concordance_report.json")
    a = ap.parse_args()

    key = os.environ.get("MASSIVE_API_KEY")
    if not key:
        print("MASSIVE_API_KEY not set", file=sys.stderr)
        return 2

    # FRED side (restricted file, read locally)
    fred = {}
    for line in open(a.fred_canonical, encoding="utf-8").read().splitlines():
        d, v = line.split(",")
        if a.start <= d <= a.end:
            fred[d] = Decimal(v)

    retrieved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raws, results, redacted = fetch_all(a.base_url, a.start, a.end, key)
    page_hashes = [hashlib.sha256(r).hexdigest() for r in raws]
    raw_blob = b"".join(raws)
    # overall hash is DEFINED as sha256 of the ordered concatenation of page bytes
    raw_sha = hashlib.sha256(raw_blob).hexdigest()

    massive = {}
    for bar in results:
        d = datetime.datetime.fromtimestamp(bar["t"] / 1000, tz=ET).date().isoformat()
        if a.start <= d <= a.end:
            if d in massive:
                print(f"FATAL: duplicate Massive session {d}", file=sys.stderr)
                return 1
            massive[d] = Decimal(str(bar["c"]))

    restricted = os.path.join(a.outdir, "restricted")
    os.makedirs(restricted, exist_ok=True)
    page_paths = []
    for i, r in enumerate(raws, 1):
        pp = os.path.join(restricted, f"massive_ISPX_raw_{a.start}_{a.end}_p{i:02d}.json")
        with open(pp, "wb") as f:
            f.write(r)
        page_paths.append(pp)
    raw_path = ", ".join(page_paths)

    only_fred = sorted(set(fred) - set(massive))
    only_massive = sorted(set(massive) - set(fred))
    common = sorted(set(fred) & set(massive))
    discrepancies = []
    for d in common:
        diff = abs(fred[d] - massive[d])
        if diff > VALUE_NOTE_ABS:
            discrepancies.append({"date": d, "fred": str(fred[d]),
                                  "massive": str(massive[d]), "abs_diff": str(diff)})

    gate_pass = not only_fred and not only_massive
    report = {
        "script_version": SCRIPT_VERSION,
        "gate": "PASS" if gate_pass else "FAIL",
        "gate_rule": "session date sets must be identical over compared range",
        "endpoint_redacted": redacted,
        "params": {"ticker": "I:SPX", "range": "1/day", "start": a.start,
                   "end": a.end, "adjusted": "true", "sort": "asc",
                   "timezone": "America/New_York", "pages": len(raws)},
        "retrieved_at_utc": retrieved_at,
        "massive_raw_sha256": raw_sha,
        "massive_raw_sha256_rule": "sha256 over ordered concatenation of page bytes",
        "massive_page_count": len(raws),
        "massive_page_sha256": page_hashes,
        "massive_raw_byte_count": len(raw_blob),
        "massive_raw_access": "restricted",
        "session_counts": {"fred": len(fred), "massive": len(massive),
                           "common": len(common)},
        "dates_only_in_fred": only_fred,
        "dates_only_in_massive": only_massive,
        "value_discrepancies_above_0.01": discrepancies,
        "value_discrepancy_count": len(discrepancies),
        "note": "value discrepancies are documented, not gated; investigate before registration",
    }
    with open(a.report, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, sort_keys=True)
        f.write("\n")
    print(json.dumps({k: report[k] for k in
                      ("gate", "session_counts", "dates_only_in_fred",
                       "dates_only_in_massive", "value_discrepancy_count")},
                     indent=2, sort_keys=True))
    print(f"\nraw pages (restricted) -> {raw_path}\nreport (public)        -> {a.report}", file=sys.stderr)
    return 0 if gate_pass else 1


if __name__ == "__main__":
    sys.exit(main())
