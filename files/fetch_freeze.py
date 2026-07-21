#!/usr/bin/env python3
"""
fetch_freeze.py — Registration step 1–2 for contract spx_rv5_v1.

Downloads FRED series SP500 by ALFRED vintage, freezes BOTH the untouched
response bytes AND the canonical observation stream under restricted/ (the
canonical file still reproduces S&P-licensed values). Only hashes, metadata,
and scripts are publishable. Writes
retrieval metadata with BOTH hashes:

  raw_response_sha256           exact restricted download bytes
  canonical_observations_sha256 normalized "YYYY-MM-DD,value\n" records,
                                sorted ascending by date, fixed formatting

Auditors retrieve the recorded vintage from ALFRED, rebuild the canonical
stream with the rules below, and verify the second hash — robust to future
changes in API headers or JSON serialization.

Canonicalization rules (frozen, version canon-v1):
  * one record per non-missing observation: "<date>,<value>\n"  (LF only)
  * date: YYYY-MM-DD as returned by FRED
  * value: Decimal plain notation, no exponent; trailing zeros after the
    decimal point stripped; trailing '.' stripped ("4450.00" -> "4450",
    "4450.380" -> "4450.38"); no sign for positives
  * missing observations (value ".") excluded, counted in metadata
  * records sorted strictly ascending by date; duplicates are a fatal error
  * file is UTF-8, ends with a final newline iff there is >= 1 record

Usage:
  FRED_API_KEY=... python3 fetch_freeze.py \
      --start 2023-06-01 --end 2026-06-30 \
      [--vintage YYYY-MM-DD] [--outdir ./artifacts]

  --start defaults to 2023-06-01: a deliberate buffer BEFORE the 2023-07-01
  sample boundary, because the first eligible window-ending dates need
  earlier closes for their five returns.
  --vintage defaults to today (UTC); it is recorded and becomes the frozen
  ALFRED vintage for all future reproduction.
"""
import argparse, datetime, hashlib, json, os, sys, urllib.parse, urllib.request
from decimal import Decimal, InvalidOperation

SCRIPT_VERSION = "fetch-freeze-v1"
CANON_VERSION = "canon-v1"
FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
SERIES = "SP500"


def canonical_value(raw: str) -> str:
    d = Decimal(raw)  # raises InvalidOperation on garbage
    s = format(d, "f")  # plain notation, never exponent
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2023-06-01")
    ap.add_argument("--end", default="2026-06-30")
    ap.add_argument("--vintage", default=datetime.datetime.now(datetime.timezone.utc).date().isoformat())
    ap.add_argument("--outdir", default="./artifacts")
    a = ap.parse_args()

    api_key = os.environ.get("FRED_API_KEY")
    if not api_key:
        print("FRED_API_KEY not set", file=sys.stderr)
        return 2

    params = {
        "series_id": SERIES,
        "observation_start": a.start,
        "observation_end": a.end,
        "realtime_start": a.vintage,   # ALFRED vintage: observations as they
        "realtime_end": a.vintage,     # existed on this date
        "file_type": "json",
        "api_key": api_key,
    }
    url = FRED_URL + "?" + urllib.parse.urlencode(params)
    redacted_url = FRED_URL + "?" + urllib.parse.urlencode({**params, "api_key": "REDACTED"})

    retrieved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    req = urllib.request.Request(url, headers={"User-Agent": "premlab-fetch-freeze/1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
        mime = resp.headers.get("Content-Type", "")
        status = resp.status

    if status != 200:
        print(f"HTTP {status}", file=sys.stderr)
        return 3

    raw_sha = hashlib.sha256(raw).hexdigest()

    payload = json.loads(raw.decode("utf-8"))
    obs = payload.get("observations")
    if not isinstance(obs, list) or not obs:
        print("no observations in response", file=sys.stderr)
        return 4

    records, missing, seen = [], 0, set()
    for o in obs:
        date, val = o["date"], o["value"]
        if date in seen:
            print(f"duplicate date in FRED response: {date}", file=sys.stderr)
            return 5
        seen.add(date)
        if val == ".":
            missing += 1
            continue
        try:
            records.append((date, canonical_value(val)))
        except InvalidOperation:
            print(f"unparseable value {val!r} on {date}", file=sys.stderr)
            return 6
    records.sort(key=lambda r: r[0])

    canonical = "".join(f"{d},{v}\n" for d, v in records).encode("utf-8")
    canon_sha = hashlib.sha256(canonical).hexdigest()

    restricted = os.path.join(a.outdir, "restricted")
    public = os.path.join(a.outdir, "public")
    os.makedirs(restricted, exist_ok=True)
    os.makedirs(public, exist_ok=True)

    raw_path = os.path.join(restricted, f"fred_{SERIES}_raw_{a.vintage}.json")
    canon_path = os.path.join(restricted, f"fred_{SERIES}_canonical_{a.vintage}.csv")
    meta_path = os.path.join(public, f"fred_{SERIES}_retrieval_metadata_{a.vintage}.json")
    with open(raw_path, "wb") as f:
        f.write(raw)
    with open(canon_path, "wb") as f:
        f.write(canonical)

    meta = {
        "script_version": SCRIPT_VERSION,
        "canonicalization_version": CANON_VERSION,
        "series_id": SERIES,
        "source": "FRED / ALFRED (values sourced from S&P Dow Jones Indices)",
        "request_url_redacted": redacted_url,
        "request_params": {k: v for k, v in params.items() if k != "api_key"},
        "alfred_vintage_date": a.vintage,
        "retrieved_at_utc": retrieved_at,
        "http_status": status,
        "mime_type": mime,
        "raw_response_sha256": raw_sha,
        "raw_response_byte_count": len(raw),
        "raw_access": "restricted",        # S&P licensing: hashes public, bytes access-controlled
        "canonical_access": "restricted",  # canonical file reproduces licensed values
        "canonical_observations_sha256": canon_sha,
        "canonical_byte_count": len(canonical),
        "observation_count": len(records),
        "missing_value_count": missing,
        "first_date": records[0][0],
        "last_date": records[-1][0],
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write("\n")

    print(json.dumps(meta, indent=2, sort_keys=True))
    print(f"\nfrozen:\n  raw        -> {raw_path}\n  canonical  -> {canon_path}\n  metadata   -> {meta_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
