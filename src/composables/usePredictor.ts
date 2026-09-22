import { ref } from "vue";
import type { PriceInput } from "../lib/model/predict";

export interface PredResp {
  price: number;
  lo: number;
  hi: number;
  currency: string;
  coverage: number;
  modelVersion: string;
}

type EngineModule = typeof import("../lib/model/predict");

// The engine (+ ~3.3 MB of tree JSON) lives in an async chunk so the page
// renders instantly; the model streams in on idle and the first estimate
// awaits it only if the prefetch hasn't finished yet.
let mod: EngineModule | null = null;

export function usePredictor() {
  const engineReady = ref(false);

  function prefetch() {
    if (mod) return;
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    idle(() => {
      import("../lib/model/predict").then((m) => {
        mod = m;
        engineReady.value = true;
      });
    });
  }

  async function predict(inp: PriceInput): Promise<PredResp> {
    mod ??= await import("../lib/model/predict");
    engineReady.value = true;
    const a = mod.getArtifacts();
    const r = mod.predictPrice(inp);
    return {
      price: r.price,
      lo: r.lo,
      hi: r.hi,
      currency: "DZD",
      coverage: a.card_metrics_time_split.interval_reference.coverage_pct,
      modelVersion: r.modelVersion,
    };
  }

  return { engineReady, prefetch, predict };
}
