<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Smartphone, LoaderCircle, ShieldCheck, Info, Sparkles, CircleAlert, Boxes,
} from "lucide-vue-next";
import type { EstimatorMeta } from "../types";
import { usePredictor, type PredResp } from "../composables/usePredictor";

const props = defineProps<{ meta: EstimatorMeta }>();

const CONDITION_LABELS: Record<string, string> = {
  new: "New / sealed",
  like_new: "Like new",
  good: "Good — light wear",
  used: "Used — visible wear",
  refurb: "Refurbished",
};
const TIER_LABELS: Record<string, string> = {
  none: "Not specified",
  base: "Base (SE, C-series …)",
  compact: "Compact (mini / lite / FE)",
  plus: "Plus",
  pro: "Pro",
  promax: "Pro Max / Max",
  ultra: "Ultra",
};
const PRICE_TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixed price",
  NEGOTIABLE: "Negotiable",
  NONE: "Not specified",
};

const brand = ref("apple");
const tier = ref("none");
const storageGb = ref("128");
const ramGb = ref("6");
const releaseYear = ref("2022");
const condition = ref("good");
const batteryHealth = ref(87);
const batteryUnknown = ref(false);
const damage = ref(false);
const originalParts = ref(false);
const is5g = ref(true);
const dualSim = ref(true);
const accBox = ref(true);
const accCharger = ref(true);
const accCase = ref(false);
const region = ref("alger");
const priceType = ref("FIXED");

const result = ref<PredResp | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const { predict } = usePredictor();

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const years = Array.from({ length: 13 }, (_, i) => 2026 - i);
const storages = [32, 64, 128, 256, 512, 1024];
const rams = [2, 3, 4, 6, 8, 12, 16];

async function estimate() {
  loading.value = true;
  error.value = null;
  try {
    result.value = await predict({
      brand: brand.value,
      tier: tier.value,
      storageGb: storageGb.value === "unknown" ? null : Number(storageGb.value),
      ramGb: ramGb.value === "unknown" ? null : Number(ramGb.value),
      releaseYear: releaseYear.value === "unknown" ? null : Number(releaseYear.value),
      condition: condition.value,
      batteryHealth: batteryUnknown.value ? null : batteryHealth.value,
      damage: damage.value,
      originalParts: originalParts.value,
      is5g: is5g.value,
      dualSim: dualSim.value,
      accessories: { box: accBox.value, charger: accCharger.value, case: accCase.value },
      region: region.value,
      priceType: priceType.value,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Prediction failed";
    result.value = null;
  } finally {
    loading.value = false;
  }
}

const markerPct = computed(() => {
  const r = result.value;
  if (!r) return 0;
  return Math.max(0, Math.min(100, ((r.price - r.lo) / Math.max(1, r.hi - r.lo)) * 100));
});
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_380px]">
    <!-- ---------------- form ---------------- -->
    <div class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body gap-6">
        <div>
          <h2 class="card-title flex items-center gap-2 text-lg">
            <Smartphone class="h-5 w-5 text-emerald-600" /> Describe the phone
          </h2>
          <p class="text-sm text-base-content/60">
            The same 48 features the model was trained on — filled from your answers.
          </p>
        </div>

        <!-- the phone -->
        <section class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="label">Brand</label>
              <select v-model="brand" class="select w-full" aria-label="Brand">
                <option v-for="b in props.meta.brands_top" :key="b" :value="b">{{ cap(b) }}</option>
                <option value="other">Other / smaller brand</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="label">Variant tier</label>
              <select v-model="tier" class="select w-full" aria-label="Variant tier">
                <option v-for="(l, v) in TIER_LABELS" :key="v" :value="v">{{ l }}</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="label">Storage</label>
              <select v-model="storageGb" class="select w-full" aria-label="Storage">
                <option v-for="s in storages" :key="s" :value="String(s)">{{ s }} GB</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="label">RAM</label>
              <select v-model="ramGb" class="select w-full" aria-label="RAM">
                <option v-for="r in rams" :key="r" :value="String(r)">{{ r }} GB</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div class="space-y-2 sm:col-span-2">
              <label class="label">Model release year</label>
              <select v-model="releaseYear" class="select w-full" aria-label="Release year">
                <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
              </select>
            </div>
          </div>
        </section>

        <div class="divider my-0"></div>

        <!-- state -->
        <section class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="label">Condition</label>
              <select v-model="condition" class="select w-full" aria-label="Condition">
                <option v-for="(l, v) in CONDITION_LABELS" :key="v" :value="v">{{ l }}</option>
              </select>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="label">Battery health</label>
                <span class="text-sm text-base-content/60">
                  {{ batteryUnknown ? "unknown" : `${batteryHealth}%` }}
                </span>
              </div>
              <input
                v-model.number="batteryHealth"
                type="range" min="50" max="100" step="1"
                class="range range-primary"
                :disabled="batteryUnknown"
                aria-label="Battery health"
              />
              <label class="flex cursor-pointer items-center gap-2 pt-1">
                <input v-model="batteryUnknown" type="checkbox" class="toggle toggle-primary toggle-sm" />
                <span class="text-sm">Don't know</span>
              </label>
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex items-center justify-between rounded-lg border border-base-300 p-3">
              <div class="space-y-0.5">
                <label for="dmg" class="text-sm font-medium">Has damage</label>
                <p class="text-xs text-base-content/60">cracked screen / body, water damage</p>
              </div>
              <input id="dmg" v-model="damage" type="checkbox" class="toggle toggle-primary" />
            </div>
            <div class="flex items-center justify-between rounded-lg border border-base-300 p-3">
              <div class="space-y-0.5">
                <label for="orig" class="text-sm font-medium">Original parts</label>
                <p class="text-xs text-base-content/60">never repaired, all-original</p>
              </div>
              <input id="orig" v-model="originalParts" type="checkbox" class="toggle toggle-primary" />
            </div>
            <div class="flex items-center justify-between rounded-lg border border-base-300 p-3">
              <label for="fivg" class="text-sm font-medium">5G capable</label>
              <input id="fivg" v-model="is5g" type="checkbox" class="toggle toggle-primary" />
            </div>
            <div class="flex items-center justify-between rounded-lg border border-base-300 p-3">
              <label for="sim" class="text-sm font-medium">Dual SIM</label>
              <input id="sim" v-model="dualSim" type="checkbox" class="toggle toggle-primary" />
            </div>
          </div>
          <div class="space-y-2">
            <label class="label flex items-center gap-1.5">
              <Boxes class="h-4 w-4" /> Accessories included
            </label>
            <div class="flex flex-wrap gap-4">
              <label class="flex cursor-pointer items-center gap-2">
                <input v-model="accBox" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                <span class="text-sm">Original box</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <input v-model="accCharger" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                <span class="text-sm">Charger</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <input v-model="accCase" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                <span class="text-sm">Case</span>
              </label>
            </div>
          </div>
        </section>

        <div class="divider my-0"></div>

        <!-- listing -->
        <section class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label class="label">Region (wilaya)</label>
            <select v-model="region" class="select w-full" aria-label="Region">
              <option v-for="r in props.meta.regions_top" :key="r" :value="r">{{ cap(r) }}</option>
              <option value="other">Other wilaya</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="label">Listing price type</label>
            <select v-model="priceType" class="select w-full" aria-label="Price type">
              <option v-for="(l, v) in PRICE_TYPE_LABELS" :key="v" :value="v">{{ l }}</option>
            </select>
          </div>
        </section>

        <div v-if="error" role="alert" class="alert alert-error alert-soft text-sm">
          <CircleAlert class="h-4 w-4 shrink-0" />
          <span>{{ error }}</span>
        </div>

        <button
          class="btn btn-primary btn-lg w-full sm:w-auto sm:min-w-56"
          :disabled="loading"
          @click="estimate"
        >
          <LoaderCircle v-if="loading" class="mr-1 h-4 w-4 animate-spin" />
          {{ loading ? "Estimating…" : "Estimate price" }}
        </button>
      </div>
    </div>

    <!-- ---------------- result ---------------- -->
    <div class="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <div class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body">
          <div>
            <h2 class="card-title text-lg">Estimated market value</h2>
            <p class="text-sm text-base-content/60">XGBoost point estimate + 80% conformal band</p>
          </div>
          <div v-if="result" class="space-y-5">
            <div>
              <div class="text-4xl font-bold tracking-tight text-emerald-700">
                {{ fmt(result.price) }} <span class="text-xl font-semibold">DA</span>
              </div>
              <p class="mt-1 text-sm text-base-content/60">
                P10–P90: {{ fmt(result.lo) }} – {{ fmt(result.hi) }} DA
              </p>
            </div>

            <!-- band bar -->
            <div>
              <div class="relative h-3 w-full overflow-hidden rounded-full bg-emerald-100">
                <div class="absolute inset-y-0 left-0 w-full rounded-full bg-linear-to-r from-emerald-200 via-emerald-400 to-emerald-200"></div>
                <div
                  class="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-800"
                  :style="{ left: `${markerPct}%` }"
                  aria-hidden
                ></div>
              </div>
              <div class="mt-1.5 flex justify-between text-xs text-base-content/60">
                <span>{{ fmt(result.lo) }}</span>
                <span>{{ fmt(result.hi) }}</span>
              </div>
            </div>

            <div class="flex items-start gap-2 rounded-lg bg-base-200 p-3 text-xs text-base-content/60">
              <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                This 80% interval covered the actual sale price in {{ result.coverage }}% of
                honest holdout listings. Wide band = genuinely heterogeneous market
                (median error on new listings is {{ props.meta.card.med_ape_pct }}%).
              </p>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-base-300 py-10 text-center">
            <Sparkles class="h-8 w-8 text-emerald-600/60" />
            <p class="max-w-56 text-sm text-base-content/60">
              Fill in the phone details and hit <span class="font-medium">Estimate price</span>.
            </p>
          </div>
        </div>
      </div>

      <div class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body gap-2 text-sm">
          <h2 class="card-title flex items-center gap-2 text-base">
            <Info class="h-4 w-4 text-emerald-600" /> Model card
          </h2>
          <div class="flex justify-between">
            <span class="text-base-content/60">Model</span><span>XGBoost · 48 features</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/60">Trained on</span><span>{{ fmt(props.meta.n_rows) }} listings (Ouedkniss)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/60">Holdout MAE</span><span>≈ {{ fmt(props.meta.card.mae) }} DA</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/60">Median error</span><span>{{ props.meta.card.med_ape_pct }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/60">Median bias</span>
            <span>{{ props.meta.card.bias_pct > 0 ? "+" : "" }}{{ props.meta.card.bias_pct }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/60">Data up to</span><span>Aug 2026</span>
          </div>
          <span
            v-if="props.meta.refined_labels"
            class="badge badge-outline border-emerald-600 text-emerald-700"
          >
            condition labels LLM-audited
          </span>
          <p class="pt-2 text-xs text-base-content/60">
            Statistical estimate from marketplace listings — not an appraisal. Prices in
            Algerian dinars (DZD).
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
