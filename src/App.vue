<script setup lang="ts">
import { onMounted } from "vue";
import { Smartphone } from "lucide-vue-next";
import Estimator from "./components/Estimator.vue";
import type { EstimatorMeta } from "./types";
import { usePredictor } from "./composables/usePredictor";
import artifactsJson from "./lib/model/artifacts.json";
import type { Artifacts } from "./lib/model/predict";

// artifacts.json is tiny (~4 KB) — loaded eagerly for the form options and
// model card; the heavy tree JSONs stay in the lazy engine chunk.
const a = artifactsJson as unknown as Artifacts;

const meta: EstimatorMeta = {
  brands_top: a.brands_top,
  regions_top: a.regions_top,
  n_rows: a.n_rows,
  trained_at: a.trained_at,
  model_version: a.model_version,
  refined_labels: a.refined_labels,
  smear: a.smear,
  card: {
    mae: a.card_metrics_time_split.mae,
    med_ape_pct: a.card_metrics_time_split.med_ape_pct,
    bias_pct: a.card_metrics_time_split.bias_pct,
    r2_log: a.card_metrics_time_split.r2_log,
    protocol: a.card_metrics_time_split.protocol,
    interval: {
      coverage_pct: a.card_metrics_time_split.interval_reference.coverage_pct,
      median_width_pct: a.card_metrics_time_split.interval_reference.median_width_pct,
    },
  },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const { prefetch } = usePredictor();
onMounted(prefetch);
</script>

<template>
  <div class="flex min-h-screen flex-col bg-linear-to-b from-emerald-50/60 via-base-100 to-base-100">
    <header class="border-b border-base-300 bg-base-100/80 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-content">
            <Smartphone class="h-5 w-5" />
          </div>
          <div>
            <h1 class="text-lg font-bold leading-tight">DZ Phone Value</h1>
            <p class="text-xs text-base-content/60">Used &amp; new smartphone price estimator · Algeria</p>
          </div>
        </div>
        <span class="badge badge-outline hidden border-emerald-600 text-emerald-700 sm:inline-flex">
          XGBoost · P10–P90 band
        </span>
      </div>
    </header>

    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <Estimator :meta="meta" />
    </main>

    <footer class="mt-auto border-t border-base-300 bg-base-100">
      <div class="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-base-content/60 sm:px-6">
        Trained on {{ fmt(meta.n_rows) }} marketplace smartphone
        listings (2020-11 → 2026-08), validated against multi-source retail data ·
        hedonic pricing model · monthly retrain recommended
      </div>
    </footer>
  </div>
</template>
