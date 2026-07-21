#!/usr/bin/env Rscript
# compute_threshold.R — Registration step 3, implementation B (R/Rmpfr).
#
# Independent re-implementation of compute_threshold.py over the identical
# frozen canonical bytes. Uses Rmpfr arbitrary-precision arithmetic
# (200 bits) rather than binary doubles. Emits the same manifest structure;
# the registration gate compares the "comparable" blocks and hard-fails on
# any difference.
#
# Usage:
#   Rscript compute_threshold.R canonical.csv retrieval_metadata.json \
#           2023-07-01 2026-06-30 manifest_r.json

suppressMessages({ library(Rmpfr); library(jsonlite); library(digest) })

PREC <- 200L
SCRIPT_VERSION <- "compute-threshold-r-v1"
fatal <- function(...) { message("FATAL: ", sprintf(...)); quit(status = 1) }

args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 5) fatal("usage: canonical.csv metadata.json sample_start sample_end out.json")
canon_path <- args[1]; meta_path <- args[2]
sample_start <- args[3]; sample_end <- args[4]; out_path <- args[5]

# ---- load & validate canonical file ----------------------------------------
raw_bytes <- readBin(canon_path, "raw", file.info(canon_path)$size)
canon_sha <- digest(raw_bytes, algo = "sha256", serialize = FALSE)

meta <- fromJSON(meta_path)
if (!identical(meta$canonical_observations_sha256, canon_sha))
  fatal("canonical file sha256 does not match retrieval metadata")

lines <- strsplit(rawToChar(raw_bytes), "\n", fixed = TRUE)[[1]]
lines <- lines[nzchar(lines)]
if (length(lines) < 7) fatal("fewer than 7 observations")

dates <- character(length(lines)); vals <- character(length(lines))
for (i in seq_along(lines)) {
  parts <- strsplit(lines[i], ",", fixed = TRUE)[[1]]
  if (length(parts) != 2) fatal("line %d: malformed record %s", i, lines[i])
  if (is.na(as.Date(parts[1], "%Y-%m-%d"))) fatal("line %d: bad date %s", i, parts[1])
  if (i > 1 && parts[1] <= dates[i - 1])
    fatal("line %d: dates not strictly ascending (%s -> %s; duplicates included)",
          i, dates[i - 1], parts[1])
  if (parts[2] == "" || parts[2] == ".") fatal("line %d: missing value", i)
  if (!grepl("^[0-9]+(\\.[0-9]+)?$", parts[2])) fatal("line %d: unparseable value %s", i, parts[2])
  dates[i] <- parts[1]; vals[i] <- parts[2]
}
closes <- mpfr(vals, PREC)
if (any(closes <= 0)) fatal("nonpositive close present")

# ---- returns & buffer check ------------------------------------------------
nobs <- length(closes)
returns <- log(closes[2:nobs] / closes[1:(nobs - 1)])   # returns[i] spans i -> i+1 (1-based)

first_elig <- which(dates >= sample_start)[1]
if (is.na(first_elig)) fatal("no observations on/after sample start")
if (first_elig < 6)
  fatal("insufficient buffer history: first eligible date %s has only %d prior closes; need >= 5",
        dates[first_elig], first_elig - 1)

# ---- rolling 5-session RV, windows ending inside sample --------------------
ann <- mpfr(252, PREC) / mpfr(5, PREC)
rv_list <- list(); ends <- character(0)
for (j in 6:nobs) {                       # window = returns[(j-5)..(j-1)] ending at close j
  if (dates[j] >= sample_start && dates[j] <= sample_end) {
    s <- sum(returns[(j - 5):(j - 1)]^2)
    rv_list[[length(rv_list) + 1]] <- sqrt(ann * s)
    ends <- c(ends, dates[j])
  }
}
n <- length(rv_list)
if (n == 0) fatal("empty threshold sample")
rvs <- do.call(c, rv_list)

# ---- Hyndman–Fan type-7 quantile, p = 3/4 ----------------------------------
xs <- sort(rvs)
h <- (mpfr(n, PREC) - 1) * mpfr(3, PREC) / mpfr(4, PREC)
l <- floor(h)
li <- as.integer(asNumeric(l))            # exact: small integer
frac <- h - l
t_un <- if (li + 2L > n) xs[li + 1L] else xs[li + 1L] + frac * (xs[li + 2L] - xs[li + 1L])

# ---- half-even rounding to 6 decimals --------------------------------------
round_half_even_6 <- function(x) {
  scaled <- x * mpfr(10, PREC)^6
  fl <- floor(scaled)
  fr <- scaled - fl
  half <- mpfr(1, PREC) / 2
  fli <- asNumeric(fl)                     # exact for these magnitudes
  up <- (fr > half) | (fr == half & (fli %% 2 == 1))
  fli + as.integer(up)                     # scaled integer result
}
fmt6 <- function(scaled_int) {
  sprintf("%d.%06d", as.integer(scaled_int %/% 1e6), as.integer(scaled_int %% 1e6))
}
t_scaled <- round_half_even_6(t_un)
t_str <- fmt6(t_scaled)
t_mpfr <- mpfr(t_str, PREC)               # the rounded literal governs

# ---- exceedance, base rate, guard margin -----------------------------------
exceed <- sum(rvs > t_mpfr)
br_scaled <- round_half_even_6(mpfr(exceed, PREC) / mpfr(n, PREC))
base_rate_str <- fmt6(br_scaled)
min_margin <- min(abs(rvs - t_mpfr))
if (min_margin < mpfr("1e-12", PREC))
  fatal("an RV lies within 1e-12 of T (%s); manual review required",
        formatMpfr(min_margin, digits = 20))

# ---- manifest (same structure as Python) -----------------------------------
manifest <- list(
  comparable = list(
    contract = "spx_rv5_v1",
    canonical_observations_sha256 = canon_sha,
    raw_response_sha256 = meta$raw_response_sha256,
    alfred_vintage_date = meta$alfred_vintage_date,
    sample_start = sample_start,
    sample_end = sample_end,
    first_window_end = ends[1],
    last_window_end = ends[length(ends)],
    N = n,
    exceedance_count = as.integer(exceed),
    T = t_str,
    base_rate = base_rate_str,
    quantile_method = "hyndman-fan-type-7",
    rounding = "half-even-6dp",
    annualization = "252/5",
    outcome_rule = "RV>T strict",
    canonicalization_version = meta$canonicalization_version
  ),
  diagnostics = list(
    T_unrounded_30dp = formatMpfr(t_un, digits = 31),
    min_abs_margin_to_T = formatMpfr(min_margin, digits = 31),
    observation_count = nobs,
    return_count = nobs - 1L
  ),
  environment = list(
    implementation = "r-rmpfr",
    script_version = SCRIPT_VERSION,
    r_version = paste(R.version$major, R.version$minor, sep = "."),
    rmpfr_version = as.character(packageVersion("Rmpfr")),
    prec_bits = PREC,
    run_at_utc = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
)
writeLines(toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, digits = NA), out_path)
cat(toJSON(manifest$comparable, auto_unbox = TRUE, pretty = TRUE), "\n")
