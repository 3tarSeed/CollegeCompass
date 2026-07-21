#!/usr/bin/env bash
# run_registration.sh — Executes registration steps 1–3 for spx_rv5_v1 and
# assembles the registration bundle. STOPS before contract creation unless
# BOTH gates pass:
#   Calculation gate: Python manifest == R manifest   (compare_manifests.py)
#   Source gate:      FRED session dates == Massive session dates
#
# Usage:
#   FRED_API_KEY=... MASSIVE_API_KEY=... \
#     ./run_registration.sh --vintage YYYY-MM-DD
#
# --vintage is REQUIRED and explicit by design: it becomes the frozen ALFRED
# vintage for all future reproduction. No date defaults.
set -euo pipefail

VINTAGE=""
START="2023-06-01"; END="2026-06-30"
SAMPLE_START="2023-07-01"; SAMPLE_END="2026-06-30"
while [[ $# -gt 0 ]]; do case "$1" in
  --vintage) VINTAGE="$2"; shift 2;;
  *) echo "unknown arg $1"; exit 2;;
esac; done
[[ -n "$VINTAGE" ]] || { echo "FATAL: --vintage YYYY-MM-DD is required (no default)"; exit 2; }
[[ "$VINTAGE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "FATAL: bad vintage format"; exit 2; }
: "${FRED_API_KEY:?FRED_API_KEY required}"
: "${MASSIVE_API_KEY:?MASSIVE_API_KEY required}"

DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="registration_bundle_${VINTAGE}"
mkdir -p "$BUNDLE/public" "$BUNDLE/restricted"
ART="$BUNDLE/artifacts"

echo "== Step 1–2: FRED fetch & freeze (vintage $VINTAGE) =="
python3 "$DIR/fetch_freeze.py" --start "$START" --end "$END" \
  --vintage "$VINTAGE" --outdir "$ART" > "$BUNDLE/public/fetch_freeze_stdout.json"

CANON="$ART/restricted/fred_SP500_canonical_${VINTAGE}.csv"
META="$ART/public/fred_SP500_retrieval_metadata_${VINTAGE}.json"

echo "== Step 3a: Python/Decimal implementation =="
python3 "$DIR/compute_threshold.py" "$CANON" --metadata "$META" \
  --sample-start "$SAMPLE_START" --sample-end "$SAMPLE_END" \
  --out "$BUNDLE/public/manifest_python.json" > /dev/null

echo "== Step 3b: R/Rmpfr implementation =="
Rscript "$DIR/compute_threshold.R" "$CANON" "$META" \
  "$SAMPLE_START" "$SAMPLE_END" "$BUNDLE/public/manifest_r.json" > /dev/null

echo "== CALCULATION GATE =="
python3 "$DIR/compare_manifests.py" \
  "$BUNDLE/public/manifest_python.json" "$BUNDLE/public/manifest_r.json" \
  | tee "$BUNDLE/public/calculation_gate_output.txt"

echo "== SOURCE GATE: Massive I:SPX concordance =="
python3 "$DIR/massive_concordance.py" "$CANON" --start "$START" --end "$END" \
  --outdir "$ART" --report "$BUNDLE/public/concordance_report.json" \
  | tee "$BUNDLE/public/source_gate_output.txt"

echo "== Assembling bundle =="
cp "$META" "$BUNDLE/public/"
mv "$ART/restricted/"* "$BUNDLE/restricted/"
rmdir "$ART/restricted" "$ART/public" "$ART" 2>/dev/null || true

{ echo "run_at_utc: $(date -u +%FT%TZ)"
  echo "vintage: $VINTAGE"
  echo "git_commit: $(git -C "$DIR" rev-parse HEAD 2>/dev/null || echo not-a-repo)"
  echo "python: $(python3 --version 2>&1)"
  echo "r: $(Rscript -e 'cat(paste(R.version$major,R.version$minor,sep="."))' 2>/dev/null || echo n/a)"
  echo "rmpfr: $(Rscript -e 'cat(as.character(packageVersion("Rmpfr")))' 2>/dev/null || echo n/a)"
  echo "script_sha256:"
  for f in fetch_freeze.py compute_threshold.py compute_threshold.R \
           compare_manifests.py massive_concordance.py run_registration.sh; do
    echo "  $f: $(sha256sum "$DIR/$f" | cut -d' ' -f1)"
  done
} > "$BUNDLE/public/VERSIONS.txt"

echo
echo "BOTH GATES PASSED. Bundle assembled at $BUNDLE/"
echo "  public/     -> publishable: metadata, manifests, gate outputs, concordance, VERSIONS"
echo "  restricted/ -> access-controlled: FRED raw+canonical, Massive raw"
echo
echo "Next: hand $BUNDLE/public/ back for synthetic artifacts, contract"
echo "serialization, definition_artifact_hash, registration, and anchoring."
