# DZ Phone Value

Smartphone price estimator for the Algerian phone market (new & second-hand).
Enter a phone's attributes and get a **point price estimate + an 80% conformal band (P10–P90)** in DZD.

Built with **Vue 3 + Vite + Tailwind v4 + DaisyUI 5**. The XGBoost model runs as a
**pure-TypeScript inference engine, fully client-side** — no server, no API, no Python.
The page shell is ~33 KB gzipped; the model (~3.3 MB of tree JSON, ~315 KB gzipped)
streams in as a lazy chunk on idle.

## Quick start

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Production build + local preview:

```bash
pnpm build          # typecheck + vite build -> dist/
pnpm preview        # serves dist/ at the Pages base path
```

Requires Node 20+ and pnpm 10.

## Verification gates

```bash
pnpm check:golden   # byte-exact vs the originally verified API outputs (frozen clock)
pnpm check:parity   # 12 Python-exported fixtures must match within 0.1%
pnpm typecheck      # vue-tsc strict
```

`check:golden` reproduces the two API responses measured on the original
(fs-based) engine on 2026-09-19 — e.g. `{apple, promax, 256, like_new, ram 8,
year 2023, battery 95, …}` → **201 100 [181 500 – 216 500]** — with `Date.now`
frozen inside the measurement window, so the gate never drifts as real time passes.

## Deployment (GitHub Pages)

CI lives in `.github/workflows/deploy.yml`: on every push to `master` it runs
typecheck → golden + parity gates → build → deploys `dist/` to GitHub Pages
(Node 24 + pnpm 10).

One-time setup: **Settings → Pages → Source: "GitHub Actions"**.
Site URL: `https://bitsnaps.github.io/smartphone_pricing/`
(the Vite `base` in `vite.config.ts` must match the deploy path).

## How it works

```
Browser form (48 features)
        ▼
src/lib/model/predict.ts          pure-TS XGBoost inference (lazy-loaded chunk):
                                  • 184 trees (point, log-price)
                                  • 448 / 437 trees (P10 / P90 quantile band)
                                  • Duan smearing retransformation
                                  • base_score + float32 (Math.fround) branch parity
        ▼
{ price, lo, hi, coverage, modelVersion }   rendered in the result card
```

The band is clamped so `lo <= price <= hi` on the ~9.5% of rows where independently
trained quantile models would cross the point estimate (display clamp only — it can
only widen the band, never shrink it).

## Data

Data are **collected from multiple public sources** covering the Algerian phone
market; individual sites are intentionally not attributed. Two datasets feed the
project:

- **Marketplace listings** (training): cleaned C2C/M2C ad listings with condition,
  battery, damage, accessories and region signals — 8,611 rows make it into the
  model after deduplication, label refinement and filters.
- **Retail store listings** (reference/validation): scraped storefront prices for
  new devices — 1,008 unique listings collected on 2026-09-22, normalized to the
  same brand/tier/storage/price vocabulary. Committed in neutralized form at
  `data/retail_listings_2026-09-22.csv` (single `retail` source label, no URLs).

The app also ships a compact **retail reference table**
(`src/data/retail_reference.json`): median new-device store price per
`brand|tier|storage` combo (66 combos, minimum 3 listings each). When you estimate
a **new** phone whose combo has a reference, the result card shows it next to the
model's estimate.

### External validation (2026-09-22)

The deployed engine was run against all 835 retail listings that map into its
feature space:

| Metric | Value |
|---|---|
| Median APE (retail vs model) | 24.1% (model card holdout: 22.5%) |
| 80% band coverage on retail prices | 79.5% (nominal: 80%) |
| Median retail premium over marketplace | +6.7% (retail higher in 70% of matched configs) |
| Assumption-sensitivity of bias | −16% → −4% depending on 5G/dual-SIM/accessory priors |

Reading: the model generalizes to an independent retail source essentially at its
holdout accuracy, and its uncertainty calibration transfers. The residual gap vs
store prices is the retail channel premium, not model drift.

## Model card (honest numbers)

| Metric (time-split, unseen future month) | Value |
|---|---|
| MAE | ≈ 33,000 DZD |
| Median APE | ≈ 22.5% |
| Median relative bias | +2.0% |
| R² (price space) | ≈ 0.61 |
| Band coverage (target 80%) | 80.2% (time-split reference) |

- Trained on 8,611 cleaned marketplace listings (Aug 2026 snapshot).
- Labels refined: 379 condition-label corrections (LLM adjudicator + unanimous-rule
  extension), see `model_export/sp_label_corrections.csv`.
- Errors are close to the market's irreducible noise: identical devices are listed at
  wildly different *asking* prices on a negotiable C2C marketplace.
- Treat output as **decision support** (price suggestion, overpriced flagging), not a quote.

## Repo layout

```
index.html                 Vite entry (meta, favicon, #app)
src/
  App.vue                  header / footer / page shell
  components/Estimator.vue form + result cards (native selects/toggles/range + daisy classes)
  composables/usePredictor.ts  lazy engine chunk loader + predict()
  data/retailReference.ts  typed loader for the retail reference table
  lib/model/               predict.ts + exported tree artifacts (JSON)
data/                      committed datasets (neutralized, source-agnostic)
  retail_listings_2026-09-22.csv   cleaned retail store listings (see Data)
scripts/check-golden.ts    byte-exact engine regression gate
model_export/              Python export + parity tooling (see below)
public/                    logo, robots.txt
```

## Regenerating the model artifacts

`src/lib/model/*.json` are produced by the offline Python pipeline
(`model_export/sp_export_web.py --arm a2`):

1. That script depends on the full smartphone-pricing pipeline (dataset, feature
   extraction, label-retrain module) — delivered separately in the
   `smartphone_pricing_project.zip` archive.
2. After re-export, verify Python↔JS parity immediately with
   `pnpm check:parity` (12 fixtures must match within 0.1%; the reference
   results are in `model_export/sp_export_parity.json`) and re-run
   `pnpm check:golden`.

## Notes

- Float32 parity matters: the Python model compares features and thresholds in
  float32, so the TS engine applies `Math.fround` to both. Removing it flips
  borderline branches and can shift prices by up to ~15%.
- XGBoost 2.x stores `base_score` in `save_config()`, not in tree dumps — the export
  script bakes it into `artifacts.json`.
- Migrating from the previous Next.js build? The inference math is unchanged —
  only the artifact loader moved from `fs` reads to bundled JSON imports
  (see the header note in `src/lib/model/predict.ts`).
