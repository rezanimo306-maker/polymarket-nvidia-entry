# Entry notes — polymarket-nvidia-ceo-forecast-01

Account: brisk-koala-38 (make.fun). Payout wallet: 1485ixpCCggW1BFVPkPJALama8qQKHDv3E2f3fyiKfYT.
Built 2026-11-13 ~22:50 WITA; entries close 2026-11-13T21:00:00Z (2026-11-14 05:00 WITA).

## Method (`main.ts`, Node 22, stdlib only)

For each market and each horizon h = 1..240 minutes after the checkpoint:

- Median = the last price (martingale: the best point forecast is the current price).
- Spread = the market's own recent history: empirical quantiles of the h-minute
  price changes over the last 8 hours (480 minutes), centered on their median.
  Prices move in steps with rare jumps, so a fixed normal spread (the house
  baseline's 0.0025/sqrt-min) is far too wide for the mostly-quiet minutes.
- Outer-quantile floor: the 5%/95% quantiles sit at least 0.0015*sqrt(h) from
  the median, so a dead-calm recent window never yields a degenerate interval
  that one jump would blow up.
- Quantiles clamped to [0,1], rounded to 6 decimals, non-decreasing.

Parameters were chosen on the kit's six practice cases (not tuned per case):
window 480 min, outer floor 0.0015, median-centered, no shrink toward baseline.

## Local validation (no grade-local exists for this competition — server-only)

- Scorer (`../score.mjs`) replicates RULES.txt exactly: it reproduces the house
  baseline's published practice numbers to the digit (loss 0.363589, median
  error 0.767503, 90% coverage 0.949642), using answers fetched from
  Polymarket's public price history on the same 1-minute grid.
- This entry on the six practice cases: **loss 0.303236** (baseline 0.363589,
  i.e. 16.6% better), median error 0.767503, 90% coverage 0.9493, all cases valid.
  It beats the baseline on every single practice case.
- Deterministic: two runs produce byte-identical outputs.
- Runtime: ~0.25 s per case (cap is 8 s). Output files ~140–200 KB (cap 1 MiB).

## What the parent still has to do (NOT done by this build)

- Create the public GitHub repo (after the 2026-11-13 09:00 UTC opening — it is),
  push this repo, set its About from requirements.json `how_to_submit.repo_about`.
- Bundle the transcripts of the sessions that built this entry
  (`node cli/makefun.mjs bundle --repo <repo> --out transcripts.tar.gz`,
  with --redact for the user's personal details) and run
  `node cli/makefun.mjs check --kit <kit> --repo <repo> --transcripts transcripts.tar.gz`.
- Submit before 2026-11-13T21:00:00Z:
  `node cli/makefun.mjs submit --competition polymarket-nvidia-ceo-forecast-01
  --repo-url https://github.com/<owner>/<repo> --commit <sha>
  --title "<name>" --bundle transcripts.tar.gz --keypair <keypair>`
  (or the source-bundle route if no GitHub account is available).
- Quota at build time: can_submit true, 10 entries left (day cap 10, total 10).

## Caveats

- Practice is no guide to the final: the final grades on 12 fresh cases over
  48 hours of unseen prices (2026-11-13 21:00Z → 2026-11-15 21:00Z). A prize
  needs a loss strictly below the best house entry (baseline or house model
  forecast, whichever is lower) with all cases valid.
- The house model forecast (superbot, one recorded call) is the unknown bar;
  this entry was built to beat the baseline by a clear margin, not to a known
  number.
