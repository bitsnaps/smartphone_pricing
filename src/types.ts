export interface EstimatorMeta {
  brands_top: string[];
  regions_top: string[];
  n_rows: number;
  trained_at: string;
  model_version: string;
  refined_labels: boolean;
  smear: number;
  card: {
    mae: number; med_ape_pct: number; bias_pct: number; r2_log: number;
    protocol: string;
    interval: { coverage_pct: number; median_width_pct: number };
  };
}
