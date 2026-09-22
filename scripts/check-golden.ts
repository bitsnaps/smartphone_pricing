/**
 * Byte-exact regression gate for the client-side inference engine.
 *
 * The two golden cases reproduce the API responses measured on the original
 * fs-based engine (SP11 verification, 2026-09-19):
 *   {apple, promax, 256, like_new, ...}    -> 201,100 [181,500-216,500]
 *   {samsung, base, 128, used, damage,...} -> 27,500 [17,600-62,100]
 *
 * The engine derives phone age from Date.now(), so the clock is frozen inside
 * the measurement window (recovered by exhaustive grid search over inputs x
 * instants; both goldens are exact for any instant in
 * 2026-09-18T20:00Z .. 2026-09-19T08:00Z) and the TZ is pinned to the one used
 * when they were measured. The check therefore stays deterministic forever.
 *
 * Run: pnpm check:golden   (POSIX; sets process.env.TZ itself)
 */
process.env.TZ = "Asia/Shanghai";

import { predictPrice, type PriceInput } from "../src/lib/model/predict";

const FROZEN_NOW = Date.parse("2026-09-19T02:00:00Z");
Date.now = () => FROZEN_NOW;

const CASES: Array<{
  name: string;
  input: PriceInput;
  expected: { price: number; lo: number; hi: number };
}> = [
  {
    name: "apple promax 256 like_new",
    input: {
      brand: "apple", tier: "promax", storageGb: 256, condition: "like_new",
      ramGb: 8, releaseYear: 2023, batteryHealth: 95,
      damage: false, originalParts: true, is5g: true, dualSim: true,
      accessories: { box: true, charger: true, case: false },
      region: "other", priceType: "NONE",
    },
    expected: { price: 201100, lo: 181500, hi: 216500 },
  },
  {
    name: "samsung base 128 used + damage",
    input: {
      brand: "samsung", tier: "base", storageGb: 128, condition: "used",
      ramGb: null, releaseYear: null, batteryHealth: 80,
      damage: true, originalParts: false, is5g: false, dualSim: false,
      accessories: { box: false, charger: false, case: false },
      region: "other", priceType: "NEGOTIABLE",
    },
    expected: { price: 27500, lo: 17600, hi: 62100 },
  },
];

let bad = 0;
for (const c of CASES) {
  const r = predictPrice(c.input);
  const ok =
    r.price === c.expected.price && r.lo === c.expected.lo && r.hi === c.expected.hi;
  if (!ok) bad++;
  console.log(
    `${ok ? "OK      " : "MISMATCH"} ${c.name}: ` +
      `${r.price} [${r.lo}–${r.hi}] expected ${c.expected.price} [${c.expected.lo}–${c.expected.hi}]`,
  );
  if (r.modelVersion !== "sp10-a2-refined") {
    bad++;
    console.log(`MISMATCH modelVersion: ${r.modelVersion} (expected sp10-a2-refined)`);
  }
}
console.log(bad === 0 ? "GOLDEN OK — engine matches the verified API outputs" : `GOLDEN FAILED on ${bad} check(s)`);
process.exit(bad === 0 ? 0 : 1);
