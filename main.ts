// polymarket-nvidia-ceo-forecast-01 entry (Node 22, standard library only).
//
// What it does: for each market, forecast the Yes price at every minute of the
// 240 minutes after the checkpoint as five quantiles (5/25/50/75/95%).
//
// Method (chosen on the kit's six practice cases; see NOTES.md):
//   - The median is the last price (prices are a martingale: the best point
//     forecast of the next price is the current one).
//   - The spread around it is the market's own recent history: for each
//     horizon h, take the empirical quantiles of the h-minute price changes
//     over the last 8 hours (480 minutes), centered on their median. Prices
//     move in steps with rare jumps, so a fixed normal spread (the house
//     baseline's 0.0025/sqrt-min) is far too wide for the mostly-quiet minutes
//     and the empirical distribution captures each market's own jumpiness.
//   - A floor keeps the outer quantiles honest: they sit at least
//     0.0015*sqrt(h) from the median, so a dead-calm recent window never
//     produces a degenerate interval that a single jump would blow up.
//   - Quantiles are clamped to [0,1] and rounded to 6 decimals.
//
// Practice score of this program on the kit's six cases (scored locally
// against Polymarket's public history, same 1-minute grid as the house):
//   loss 0.303236 (house baseline 0.363589), median error 0.7675,
//   90% coverage 0.9493, all cases valid.
//   The scorer was verified exact: it reproduces the baseline's published
//   practice numbers (loss 0.363589, median error 0.767503, coverage 0.949642).
//
// I/O contract (RULES.txt): read every <id>.in in the input directory,
// write <id>.out to the output directory: {"forecasts":[{"id","q"}]}, one row
// per market, 240 rows of five non-decreasing numbers in [0,1], <= 1 MiB.
// Runs offline, no network, deterministic (same bytes on every run).
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The quantile levels the contest scores, in the order each row lists them. */
const QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];
/** The standard normal's quantile at each level (baseline fallback only). */
const Z = [-1.644854, -0.67449, 0, 0.67449, 1.644854];
/** The house baseline's spread, per square-root minute (fallback only). */
const BASE_SIGMA = 0.0025;
/** How much recent history the empirical quantiles use, in minutes. */
const WINDOW_MIN = 480;
/** Minimum half-width of the outer (5%/95%) quantiles, per sqrt(minute). */
const OUTER_FLOOR = 0.0015;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  horizon_minutes: number;
  quantiles: number[];
  markets: CaseMarket[];
}

/** x clamped to [0,1] and rounded to 6 decimals (0, never -0). */
const price6 = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 1e6) / 1e6 + 0;

/** Linear-interpolation quantile of a sorted array at level tau. */
function quantile(sorted: number[], tau: number): number {
  const n = sorted.length;
  const pos = tau * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** The baseline row for horizon h (used only when a market has no usable history). */
function baselineRow(x: number, h: number): number[] {
  const s = BASE_SIGMA * Math.sqrt(h);
  return Z.map((z) => price6(x + z * s));
}

/** The forecast rows of one market: horizon rows of five quantiles around its last price. */
function forecast(m: CaseMarket, horizon: number): number[][] {
  const prices = m.prices;
  const n = prices.length;
  if (n === 0) throw new Error(`market ${m.id} has no prices`);
  const x = prices[n - 1];
  const start = Math.max(1, n - WINDOW_MIN);
  const rows: number[][] = [];
  for (let h = 1; h <= horizon; h++) {
    // Longest change window the history supports at this horizon.
    const maxDelta = n - 1 - start;
    const hEff = Math.max(1, Math.min(h, maxDelta));
    const deltas: number[] = [];
    for (let t = start + hEff; t < n; t++) deltas.push(prices[t] - prices[t - hEff]);
    if (deltas.length === 0) {
      rows.push(baselineRow(x, h));
      continue;
    }
    const scale = Math.sqrt(h / hEff);
    const sqrtH = Math.sqrt(h);
    deltas.sort((a, b) => a - b);
    const qs = QUANTILES.map((t) => quantile(deltas, t) * scale);
    const med = qs[2];
    const off = qs.map((q) => q - med);
    const fl = OUTER_FLOOR * sqrtH;
    off[0] = Math.min(off[0], -fl);
    off[4] = Math.max(off[4], fl);
    const row = off.map((o) => price6(x + o));
    for (let j = 1; j < 5; j++) if (row[j] < row[j - 1]) row[j] = row[j - 1];
    rows.push(row);
  }
  return rows;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (c.quantiles.length !== QUANTILES.length || c.quantiles.some((t, j) => t !== QUANTILES[j])) throw new Error(`${file} asks for quantiles ${JSON.stringify(c.quantiles)}, not ${JSON.stringify(QUANTILES)}`);
  const forecasts = c.markets.map((m) => ({ id: m.id, q: forecast(m, c.horizon_minutes) }));
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts })}\n`);
}
