/**
 * SP10 inference engine — pure-TS XGBoost tree walk + feature build.
 * Mirrors scripts/sp_reg_baseline.py build_matrix() + SP6 cfg + SP9 CQR bands.
 * Artifacts produced by scripts/sp_export_web.py.
 *
 * Vue/Vite port note: the artifacts are bundled via static JSON imports instead
 * of fs reads so the engine runs fully client-side (GitHub Pages). The math
 * below is unchanged from the fs-based original and is pinned by two checks:
 *   • model_export/sp_parity_check.mjs  — 12 Python-exported fixtures (0.1%)
 *   • scripts/check-golden.ts           — byte-exact API goldens (frozen clock)
 */
import artifactsJson from "./artifacts.json";
import treesPointJson from "./trees_point.json";
import treesQ10Json from "./trees_q10.json";
import treesQ90Json from "./trees_q90.json";

export interface Artifacts {
  model_version: string;
  trained_at: string;
  n_rows: number;
  refined_labels: boolean;
  b_cols: string[];
  medians: Record<string, number>;
  tier_map: Record<string, string>;
  brands_top: string[];
  regions_top: string[];
  conditions: string[];
  price_types: string[];
  smear: number;
  cqr_Q_log: number;
  cqr_alpha: number;
  n_estimators: Record<string, number>;
  base_scores: Record<string, number>;
  card_metrics_time_split: {
    mae: number; rmse: number; r2: number; r2_log: number;
    mape_pct: number; med_ape_pct: number; bias_pct: number;
    n_estimators: number; protocol: string;
    interval_reference: { coverage_pct: number; median_width_pct: number };
  };
}

interface TreeNode {
  nodeid: number;
  leaf?: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: TreeNode[];
}

interface Tree {
  root: TreeNode;
  idx: Map<number, TreeNode>;
}

function indexTree(root: TreeNode): Tree {
  const idx = new Map<number, TreeNode>();
  const stack: TreeNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    idx.set(n.nodeid, n);
    if (n.children) for (const c of n.children) stack.push(c);
  }
  return { root, idx };
}

const _artifacts = artifactsJson as unknown as Artifacts;
const readTrees = (raw: unknown): Tree[] => {
  // each dumped tree = {root at nodeid 0, children by nodeid}; index every tree
  return (raw as { trees: TreeNode[] }).trees.map(indexTree);
};
const _trees: { point: Tree[]; q10: Tree[]; q90: Tree[] } = {
  point: readTrees(treesPointJson),
  q10: readTrees(treesQ10Json),
  q90: readTrees(treesQ90Json),
};

export function getArtifacts(): Artifacts {
  return _artifacts;
}

export interface PriceInput {
  brand: string;            // top-12 brand or "other"
  tier: string;             // none|base|compact|plus|pro|promax|ultra
  storageGb: number | null; // null = unknown
  ramGb: number | null;     // null = unknown
  releaseYear: number | null;
  condition: string;        // new|like_new|good|used|refurb
  batteryHealth: number | null; // null = unknown
  damage: boolean;
  originalParts: boolean;
  is5g: boolean;
  dualSim: boolean;
  accessories: { box: boolean; charger: boolean; case: boolean };
  region: string;           // top-10 region or "other"
  priceType: string;        // FIXED|NEGOTIABLE|NONE
}

export function modelAgeYears(releaseYear: number): number {
  const launch = new Date(releaseYear, 5, 30).getTime(); // ~mid-year launch assumption
  const age = (Date.now() - launch) / (365.25 * 24 * 3600 * 1000);
  return Math.max(0, Math.min(14, age));
}

/** Mirror build_matrix(): returns feature map keyed by column name. */
export function buildFeatures(inp: PriceInput): Record<string, number> {
  const a = getArtifacts();
  const m = a.medians;
  const f: Record<string, number> = {};
  const dummy = (name: string, on: boolean | number) => { f[name] = on ? 1 : 0; };

  // numeric block
  f.log2_storage = inp.storageGb ? Math.log2(inp.storageGb) : m.log2_storage;
  f.storage_missing = inp.storageGb ? 0 : 1;
  f.ram_gb = inp.ramGb ?? m.ram_gb;
  f.ram_missing = inp.ramGb ? 0 : 1;
  f.model_age_years = inp.releaseYear ? modelAgeYears(inp.releaseYear) : m.model_age_years;
  f.age_missing = inp.releaseYear ? 0 : 1;
  f.battery_health = inp.batteryHealth ?? m.battery_health;
  f.battery_missing = inp.batteryHealth ? 0 : 1;
  f.desc_damage = inp.damage ? 1 : 0;
  f.desc_original_parts = inp.originalParts ? 1 : 0;
  f.is_5g = inp.is5g ? 1 : 0;
  f.dual_sim = inp.dualSim ? 1 : 0;
  f.acc_count = (inp.accessories.box ? 1 : 0) + (inp.accessories.charger ? 1 : 0) + (inp.accessories.case ? 1 : 0);
  f.log_repost = Math.log1p(1); // fresh listing

  // tier dummies (reference: tier_none)
  for (const t of ["base", "compact", "plus", "pro", "promax", "ultra"]) {
    dummy(`tier_${t}`, inp.tier === t);
  }
  // brand dummies (reference: other)
  for (const b of a.brands_top) dummy(`brand_${b}`, inp.brand === b);
  // region dummies (reference: other)
  for (const r of a.regions_top) dummy(`region_${r}`, inp.region === r);
  // priceType dummies (reference: NEGOTIABLE)
  for (const p of ["FIXED", "NONE", "OFFERED"]) dummy(`priceType_${p}`, inp.priceType === p);
  // condition dummies (reference: like_new)
  for (const c of ["good", "new", "refurb", "used"]) dummy(`condition_${c}`, inp.condition === c);
  return f;
}

function walkTree(tree: Tree, f: Record<string, number>): number {
  let node = tree.root;
  while (node.leaf === undefined) {
    // python predict compares in float32 — mirror it or borderline rows flip branches
    const v = Math.fround(f[node.split as string]);
    const t = Math.fround(node.split_condition as number);
    const nextId =
      v === undefined || Number.isNaN(v)
        ? (node.missing as number)
        : v < t
          ? (node.yes as number)
          : (node.no as number);
    node = tree.idx.get(nextId)!;
  }
  return node.leaf;
}

function sumTrees(trees: Tree[], f: Record<string, number>): number {
  let s = 0;
  for (const t of trees) s += walkTree(t, f);
  return s;
}

export interface PredictionResult {
  price: number;      // rounded point estimate, DZD
  lo: number;         // P10
  hi: number;         // P90
  priceRaw: number;
  features: Record<string, number>;
  modelVersion: string;
}

const round100 = (x: number) => Math.round(x / 100) * 100;

export function predictPrice(inp: PriceInput): PredictionResult {
  const a = getArtifacts();
  const f = buildFeatures(inp);
  const pLog = a.base_scores.point + sumTrees(_trees.point, f);
  const loLog = a.base_scores.q10 + sumTrees(_trees.q10, f) - a.cqr_Q_log;
  const hiLog = a.base_scores.q90 + sumTrees(_trees.q90, f) + a.cqr_Q_log;
  const price = Math.exp(pLog) * a.smear;
  // display consistency: independently trained quantile models can cross the point
  // estimate on atypical inputs — widen the band to contain it (never narrows)
  let lo = Math.exp(loLog) * a.smear;
  let hi = Math.exp(hiLog) * a.smear;
  lo = Math.min(lo, price);
  hi = Math.max(hi, price);
  return {
    price: round100(price),
    lo: round100(lo),
    hi: round100(hi),
    priceRaw: price,
    features: f,
    modelVersion: a.model_version,
  };
}

/** Parity bridge: raw 48-feature vector (b_cols order) -> unrounded price/lo/hi. */
export function predictPriceRawFromFeatures(vec: number[]): { price: number; lo: number; hi: number } {
  const a = getArtifacts();
  const f: Record<string, number> = {};
  a.b_cols.forEach((c, i) => { f[c] = vec[i]; });
  // xgboost 2.x: prediction = base_score (data-estimated intercept) + sum of tree leaves
  const pLog = a.base_scores.point + sumTrees(_trees.point, f);
  const loLog = a.base_scores.q10 + sumTrees(_trees.q10, f) - a.cqr_Q_log;
  const hiLog = a.base_scores.q90 + sumTrees(_trees.q90, f) + a.cqr_Q_log;
  return {
    price: Math.exp(pLog) * a.smear,
    lo: Math.exp(loLog) * a.smear,
    hi: Math.exp(hiLog) * a.smear,
  };
}
