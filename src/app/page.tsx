import { getArtifacts } from "@/lib/model/predict";
import { Estimator, EstimatorMeta } from "@/components/estimator";
import { Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const a = getArtifacts();
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

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/60 via-background to-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">DZ Phone Value</h1>
              <p className="text-xs text-muted-foreground">Used &amp; new smartphone price estimator · Algeria</p>
            </div>
          </div>
          <Badge variant="outline" className="hidden border-emerald-600 text-emerald-700 sm:inline-flex">
            XGBoost · P10–P90 band
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Estimator meta={meta} />
      </main>

      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          Trained on {new Intl.NumberFormat("fr-FR").format(meta.n_rows)} Ouedkniss smartphone
          listings (2020-11 → 2026-08) · hedonic pricing model · monthly retrain recommended
        </div>
      </footer>
    </div>
  );
}
