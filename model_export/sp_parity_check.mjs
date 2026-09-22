/**
 * SP10 parity check — TS inference must reproduce Python predictions exactly.
 * Fixtures: scripts/sp_export_parity.json (12 rows: full 48-feature vectors + python price/lo/hi).
 * Run: bun scripts/sp_parity_check.mjs
 */
import { readFileSync } from "fs";
import { predictPriceRawFromFeatures } from "../src/lib/model/predict.ts";

const fixtures = JSON.parse(readFileSync("/home/z/my-project/scripts/sp_export_parity.json", "utf-8"));

let bad = 0;
for (const [i, fx] of fixtures.entries()) {
  const r = predictPriceRawFromFeatures(fx.features);
  const errP = Math.abs(r.price - fx.price) / fx.price;
  const errLo = Math.abs(r.lo - fx.lo) / fx.lo;
  const errHi = Math.abs(r.hi - fx.hi) / fx.hi;
  const ok = errP < 1e-3 && errLo < 1e-3 && errHi < 1e-3;   // 0.1% = below display rounding
  if (!ok) bad++;
  console.log(`row ${String(i).padStart(2)}: price ${r.price.toFixed(1)} vs ${fx.price}  lo ${r.lo.toFixed(1)} vs ${fx.lo}  hi ${r.hi.toFixed(1)} vs ${fx.hi}  ${ok ? "OK" : "MISMATCH"}`);
}
console.log(bad === 0 ? "PARITY OK — TS engine matches Python" : `PARITY FAILED on ${bad} rows`);
process.exit(bad === 0 ? 0 : 1);
