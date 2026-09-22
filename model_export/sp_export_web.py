#!/usr/bin/env python3
"""stats-SP10 step 4 — train FINAL production model + export web artifacts.

--arm a0 : baseline labels (8,611 rows untouched)
--arm a2 : LLM-refined labels applied everywhere (default if corrections exist)

Final model recipe (matches sp_pred_intervals BASE + SP6 cfg):
  - internal 13% val (seed 2) -> best_iteration per model
  - refit on 100% rows with fixed n_estimators (no early stopping)
  - Duan smearing on full-data point residuals
  - CQR Q via 5-fold cross-fitted quantile models (honest OOF scores), alpha=0.2
Exports to the Next.js app:
  src/lib/model/artifacts.json   (features, maps, smear, Q, metrics, meta)
  src/lib/model/trees_point.json / trees_q10.json / trees_q90.json
Parity fixtures: scripts/sp_export_parity.json
"""
import json
import sys
sys.path.insert(0, "/home/z/my-project/scripts")
import numpy as np
import pandas as pd
import xgboost as xgb
import sp_reg_baseline as S

SEED = 42
BASE_CFG = {"lr": 0.1, "depth": 5, "mcw": 2, "sub": 1.0, "col": 0.6,
            "gamma": 0, "lam": 1, "alpha": 0}
ARM = "a2" if (len(sys.argv) > 1 and sys.argv[1] == "--arm" and sys.argv[2] == "a2") else "a0"
RESULTS = sys.argv[3] if len(sys.argv) > 3 else "/home/z/my-project/scripts/sp_label_llm_results.jsonl"
MODEL_DIR = "/home/z/my-project/src/lib/model"
PARITY = "/home/z/my-project/scripts/sp_export_parity.json"
ALPHA = 0.2

df = S.load_model_set()
untrusted = pd.read_csv("/home/z/my-project/scripts/smartphones_modelset_v2.csv", low_memory=False)
untr_ids = set(untrusted.loc[untrusted["pair_untrusted"] == 1, "id"].astype(str))
df = df[~df["id"].astype(str).isin(untr_ids)].reset_index(drop=True)

refined = False
if ARM == "a2":
    try:
        res_lines = [json.loads(l) for l in open(RESULTS) if l.strip()]
    except FileNotFoundError:
        sys.exit("no corrections file; run sp_label_llm.mjs first")
    cand = {c["id"]: c for c in (json.loads(l) for l in open("/home/z/my-project/scripts/sp_label_candidates.jsonl"))}
    corr = {str(r["id"]): r["new_condition"] for r in res_lines
            if r["verdict"] == "fix" and r.get("new_condition") and r["confidence"] >= 0.75
            and r["new_condition"] != cand.get(str(r["id"]), {}).get("condition")}
    df["condition"] = df["id"].astype(str).map(lambda i: corr.get(i, None)).fillna(df["condition"])
    refined = len(corr) > 0
    print(f"arm=a2 corrections applied: {len(corr)}")
print("rows:", len(df), "arm:", ARM, "refined:", refined)

if refined:
    X, y = S.build_matrix(df)
else:
    X, y = S.build_matrix(df)
B_cols = S.col_sets(X)[1]
MEDS = {c: float(X[c].median()) for c in ["log2_storage", "ram_gb", "battery_health", "model_age_years"]}
for c, v in MEDS.items():
    X[c] = X[c].fillna(v)
X = X.reindex(columns=B_cols, fill_value=0)
y = np.log(df["price"].clip(lower=1))
assert len(B_cols) == 48, len(B_cols)

def fit_es(Xtr, ytr, q=None):
    """fit with early stopping on an internal 13% val; return (model, best_iter)."""
    r = np.random.RandomState(2)
    idx = r.permutation(len(Xtr))
    nv = int(len(Xtr) * 0.13)
    vp = Xtr.index[idx[:nv]]; fp = Xtr.index[idx[nv:]]
    kw = dict(objective="reg:quantileerror", quantile_alpha=q) if q is not None else {}
    m = xgb.XGBRegressor(
        tree_method="hist", random_state=SEED, n_jobs=4, n_estimators=2000,
        learning_rate=BASE_CFG["lr"], max_depth=BASE_CFG["depth"],
        min_child_weight=BASE_CFG["mcw"], subsample=BASE_CFG["sub"],
        colsample_bytree=BASE_CFG["col"], gamma=BASE_CFG["gamma"],
        reg_lambda=BASE_CFG["lam"], reg_alpha=BASE_CFG["alpha"],
        early_stopping_rounds=50, eval_metric="rmse", **kw)
    m.fit(Xtr.loc[fp], ytr.loc[fp], eval_set=[(Xtr.loc[vp], ytr.loc[vp])], verbose=False)
    return m, int(m.best_iteration)

def fit_es_on(fp, vp, q=None):
    """fit with early stopping on EXPLICIT fit/val row arrays."""
    kw = dict(objective="reg:quantileerror", quantile_alpha=q) if q is not None else {}
    m = xgb.XGBRegressor(
        tree_method="hist", random_state=SEED, n_jobs=4, n_estimators=2000,
        learning_rate=BASE_CFG["lr"], max_depth=BASE_CFG["depth"],
        min_child_weight=BASE_CFG["mcw"], subsample=BASE_CFG["sub"],
        colsample_bytree=BASE_CFG["col"], gamma=BASE_CFG["gamma"],
        reg_lambda=BASE_CFG["lam"], reg_alpha=BASE_CFG["alpha"],
        early_stopping_rounds=50, eval_metric="rmse", **kw)
    m.fit(X.loc[fp], y.loc[fp], eval_set=[(X.loc[vp], y.loc[vp])], verbose=False)
    return m, int(m.best_iteration)

print("fitting point model (early stop to find n_estimators)...")
m0, n_point = fit_es(X, y)
print("fitting q10...")
mq10, n_q10 = fit_es(X, y, q=0.1)
print("fitting q90...")
mq90, n_q90 = fit_es(X, y, q=0.9)
print("best iterations:", n_point, n_q10, n_q90)

# refit on 100% with fixed trees
def fit_full(n_est, q=None):
    kw = dict(objective="reg:quantileerror", quantile_alpha=q) if q is not None else {}
    m = xgb.XGBRegressor(
        tree_method="hist", random_state=SEED, n_jobs=4, n_estimators=n_est + 1,
        learning_rate=BASE_CFG["lr"], max_depth=BASE_CFG["depth"],
        min_child_weight=BASE_CFG["mcw"], subsample=BASE_CFG["sub"],
        colsample_bytree=BASE_CFG["col"], gamma=BASE_CFG["gamma"],
        reg_lambda=BASE_CFG["lam"], reg_alpha=BASE_CFG["alpha"], **kw)
    m.fit(X, y, verbose=False)
    return m

mp = fit_full(n_point)
m10 = fit_full(n_q10, q=0.1)
m90 = fit_full(n_q90, q=0.9)

p_full = mp.predict(X)
smear = float(np.exp(y - p_full).mean())
print("smearing:", round(smear, 4))

# ---------- cross-fitted CQR Q (honest OOF quantile scores) ----------
from sklearn.model_selection import KFold
kf = KFold(n_splits=5, shuffle=True, random_state=SEED)
oof_scores = []
for fi, (tri, tei) in enumerate(kf.split(X)):
    a = xgb.XGBRegressor(
        tree_method="hist", random_state=SEED, n_jobs=4, n_estimators=n_q10 + 1,
        learning_rate=BASE_CFG["lr"], max_depth=BASE_CFG["depth"],
        min_child_weight=BASE_CFG["mcw"], subsample=BASE_CFG["sub"],
        colsample_bytree=BASE_CFG["col"], gamma=BASE_CFG["gamma"],
        reg_lambda=BASE_CFG["lam"], reg_alpha=BASE_CFG["alpha"],
        objective="reg:quantileerror", quantile_alpha=0.1)
    b = xgb.XGBRegressor(
        tree_method="hist", random_state=SEED, n_jobs=4, n_estimators=n_q90 + 1,
        learning_rate=BASE_CFG["lr"], max_depth=BASE_CFG["depth"],
        min_child_weight=BASE_CFG["mcw"], subsample=BASE_CFG["sub"],
        colsample_bytree=BASE_CFG["col"], gamma=BASE_CFG["gamma"],
        reg_lambda=BASE_CFG["lam"], reg_alpha=BASE_CFG["alpha"],
        objective="reg:quantileerror", quantile_alpha=0.9)
    a.fit(X.iloc[tri], y.iloc[tri], verbose=False)
    b.fit(X.iloc[tri], y.iloc[tri], verbose=False)
    lo = a.predict(X.iloc[tei]); hi = b.predict(X.iloc[tei])
    yy = y.iloc[tei].values
    oof_scores.append(np.maximum(lo - yy, yy - hi))
    print(f"fold {fi+1}/5 done")
scores = np.concatenate(oof_scores)
n = len(scores)
lvl = min(1.0, np.ceil((n + 1) * (1 - ALPHA)) / n)
Q = float(np.quantile(scores, lvl, method="higher"))
print("CQR Q (cross-fitted):", round(Q, 4))

# ---------- honest time-split metrics of THIS arm for the model card ----------
# headline protocol (identical to SP6/SP7): full 80% train, 15% val (seed 1),
# fit 85%; median signed bias per project convention
frozen = json.load(open("/home/z/my-project/scripts/sp_reg_split.json"))
order = df.sort_values("listing_dt").index.to_numpy()
n80 = int(len(df) * 0.8)
te_t, tr_t = order[n80:], order[:n80]
r = np.random.RandomState(1)
idx = r.permutation(len(tr_t))
nv = int(len(tr_t) * 0.15)
vp, fp = tr_t[idx[:nv]], tr_t[idx[nv:]]
me, bie = fit_es_on(fp, vp)
p_te = me.predict(X.loc[te_t], iteration_range=(0, bie + 1))
sm_e = float(np.exp(y.loc[fp] - me.predict(X.loc[fp], iteration_range=(0, bie + 1))).mean())
card_metrics = S.metrics_dzd(y.loc[te_t], p_te, sm_e)
yt = np.exp(y.loc[te_t])
card_metrics["bias_pct"] = round(float(np.median((np.exp(p_te) * sm_e) / yt - 1) * 100), 1)
card_metrics["n_estimators"] = bie + 1
card_metrics["protocol"] = "time split, train=80% oldest (15% val), test=newest 20%"
card_metrics["interval_reference"] = {  # SP9 (sp_pred_intervals.json), T3 CQR temporal cal
    "coverage_pct": 80.2, "median_width_pct": 94.0,
    "coverage_by_price_tercile": {"low": 79.6, "mid": 92.2, "high": 68.9},
    "source": "stats-SP9 prediction intervals"}

# ---------- export ----------
import os
os.makedirs(MODEL_DIR, exist_ok=True)

def dump_trees(m, n_est, path):
    d = m.get_booster().get_dump(dump_format="json")
    if isinstance(d, str):
        trees = json.loads(d)
    elif isinstance(d, list):
        # some xgboost versions return a list of per-tree JSON STRINGS
        trees = [json.loads(s) if isinstance(s, str) else s for s in d]
    else:
        raise TypeError(f"unexpected dump type {type(d)}")
    assert m.get_booster().feature_names == B_cols, "feature name mismatch"
    trees = trees[:n_est + 1]
    json.dump({"trees": trees}, open(path, "w"), separators=(",", ":"))
    print("trees:", len(trees), "->", path)
    # base margin (xgboost 2.x estimates it from data; NOT included in tree dumps)
    cfg = json.loads(m.get_booster().save_config())
    return float(cfg["learner"]["learner_model_param"]["base_score"])

bs_point = dump_trees(mp, n_point, f"{MODEL_DIR}/trees_point.json")
bs_q10 = dump_trees(m10, n_q10, f"{MODEL_DIR}/trees_q10.json")
bs_q90 = dump_trees(m90, n_q90, f"{MODEL_DIR}/trees_q90.json")
print("base_scores:", bs_point, bs_q10, bs_q90)

tier_map = {"ultra": "ultra", "pro max": "promax", "promax": "promax", "pro+": "promax",
            "pro": "pro", "plus": "plus", "max": "promax", "mini": "compact",
            "lite": "compact", "fe": "compact", "turbo": "pro", "t": "pro", "c": "compact"}
brand_lc = df["brand"].fillna("other").str.strip().str.lower()
top_brand = brand_lc.value_counts().head(12).index.tolist()
region_lc = df["region"].fillna("other").str.strip().str.lower()
top_region = region_lc.value_counts().head(10).index.tolist()
conditions = sorted(df["condition"].unique())

artifacts = {
    "model_version": f"sp10-{ARM}{'-refined' if refined else ''}",
    "trained_at": pd.Timestamp.now().isoformat(),
    "n_rows": len(df),
    "refined_labels": refined,
    "b_cols": B_cols,
    "medians": MEDS,
    "tier_map": tier_map,
    "brands_top": top_brand,
    "regions_top": top_region,
    "conditions": conditions,
    "price_types": ["FIXED", "NEGOTIABLE", "NONE"],
    "smear": round(smear, 5),
    "cqr_Q_log": round(Q, 4),
    "cqr_alpha": ALPHA,
    "n_estimators": {"point": n_point + 1, "q10": n_q10 + 1, "q90": n_q90 + 1},
    "base_scores": {"point": round(bs_point, 6), "q10": round(bs_q10, 6), "q90": round(bs_q90, 6)},
    "card_metrics_time_split": card_metrics,
    "target": "log(price), Duan smearing in price space; band = [exp(qlo-Q), exp(qhi+Q)]*smear",
}
json.dump(artifacts, open(f"{MODEL_DIR}/artifacts.json", "w"), indent=1, ensure_ascii=False)
print("artifacts ->", f"{MODEL_DIR}/artifacts.json")

# ---------- parity fixtures ----------
rng = np.random.RandomState(7)
sample = rng.choice(len(X), 12, replace=False)
rows = []
for i in sample:
    vec = X.iloc[i][B_cols].to_numpy(dtype=float).tolist()
    p_log = float(mp.predict(X.iloc[[i]])[0])
    lo_log = float(m10.predict(X.iloc[[i]])[0]) - Q
    hi_log = float(m90.predict(X.iloc[[i]])[0]) + Q
    rows.append({"features": vec,
                 "price": round(float(np.exp(p_log) * smear), 2),
                 "lo": round(float(np.exp(lo_log) * smear), 2),
                 "hi": round(float(np.exp(hi_log) * smear), 2)})
json.dump(rows, open(PARITY, "w"))
print("parity fixtures:", len(rows), "->", PARITY)
print("sample price/lo/hi:", rows[0]["price"], rows[0]["lo"], rows[0]["hi"])
