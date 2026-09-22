# DZ Phone Value

Smartphone price estimator for the Algerian second-hand market (Ouedkniss-style listings).
Enter a phone's attributes and get a **point price estimate + an 80% conformal band (P10–P90)** in DZD.

Built with Next.js 16 + Tailwind v4 + shadcn/ui. The XGBoost model runs as a **pure-TypeScript inference engine** — no Python, no model server, no native binaries at request time.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Requires Node 20+.

## How it works

```
Browser form (48 features)
        │  POST /api/predict
        ▼
src/app/api/predict/route.ts      validation + defaults
        ▼
src/lib/model/predict.ts          pure-TS XGBoost inference:
                                  • 184 trees (point, log-price)
                                  • 448 / 437 trees (P10 / P90 quantile band)
                                  • Duan smearing retransformation
                                  • base_score + float32 (Math.fround) branch parity
        ▼
{ price, lo, hi, currency: "DZD", modelVersion }
```

The band is clamped so `lo <= price <= hi` on the ~9.5% of rows where independently
trained quantile models would cross the point estimate (display clamp only — it can
only widen the band, never shrink it).

## Model card (honest numbers)

| Metric (time-split, unseen future month) | Value |
|---|---|
| MAE | ≈ 33,000 DZD |
| Median APE | ≈ 22.5% |
| Median relative bias | +2.0% |
| R² (price space) | ≈ 0.61 |
| Band coverage (target 80%) | 90.6% in-sample (conservative) |

- Trained on 8,611 cleaned Ouedkniss listings (Aug 2026 scrape).
- Labels refined: 379 condition-label corrections (LLM adjudicator + unanimous-rule
  extension), see `model_export/sp_label_corrections.csv`.
- Errors are close to the market's irreducible noise: identical devices are listed at
  wildly different *asking* prices on a negotiable C2C marketplace.
- Treat output as **decision support** (price suggestion, overpriced flagging), not a quote.

## Repo layout

```
src/app/                 page, layout, API route
src/components/          estimator.tsx (form + result card), ui/ (shadcn, only what's used)
src/hooks/use-toast.ts   toast state
src/lib/model/           predict.ts + exported tree artifacts (JSON)
public/                  logo, robots.txt
model_export/            Python export + parity tooling (see below)
```

## Regenerating the model artifacts

`src/lib/model/*.json` are produced by the offline Python pipeline
(`model_export/sp_export_web.py --arm a2`):

1. That script depends on the full smartphone-pricing pipeline (dataset, feature
   extraction, label-retrain module) — delivered separately in the
   `smartphone_pricing_project.zip` archive.
2. After re-export, dropped files hot-reload into the running dev server via mtime
   check — no restart needed.
3. Verify Python↔JS parity any time with `model_export/sp_parity_check.mjs`
   (12 fixtures must match within 0.1%; the reference results are in
   `model_export/sp_export_parity.json`).

## Notes

- Float32 parity matters: the Python model compares features and thresholds in
  float32, so the TS engine applies `Math.fround` to both. Removing it flips
  borderline branches and can shift prices by up to ~15%.
- XGBoost 2.x stores `base_score` in `save_config()`, not in tree dumps — the export
  script bakes it into `artifacts.json`.
- `next.config.ts` intentionally dropped `output: "standalone"` for repo simplicity;
  plain `next start` serves the app.
