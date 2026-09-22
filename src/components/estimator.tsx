"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Smartphone, Loader2, ShieldCheck, Info, Sparkles, AlertCircle, Boxes,
} from "lucide-react";

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

interface PredResp { price: number; lo: number; hi: number; currency: string; coverage: number; }

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

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export function Estimator({ meta }: { meta: EstimatorMeta }) {
  const [brand, setBrand] = useState("apple");
  const [tier, setTier] = useState("none");
  const [storageGb, setStorageGb] = useState<string>("128");
  const [ramGb, setRamGb] = useState<string>("6");
  const [releaseYear, setReleaseYear] = useState<string>("2022");
  const [condition, setCondition] = useState("good");
  const [batteryHealth, setBatteryHealth] = useState(87);
  const [batteryUnknown, setBatteryUnknown] = useState(false);
  const [damage, setDamage] = useState(false);
  const [originalParts, setOriginalParts] = useState(false);
  const [is5g, setIs5g] = useState(true);
  const [dualSim, setDualSim] = useState(true);
  const [accBox, setAccBox] = useState(true);
  const [accCharger, setAccCharger] = useState(true);
  const [accCase, setAccCase] = useState(false);
  const [region, setRegion] = useState("alger");
  const [priceType, setPriceType] = useState("FIXED");

  const [result, setResult] = useState<PredResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const years = Array.from({ length: 13 }, (_, i) => 2026 - i);
  const storages = [32, 64, 128, 256, 512, 1024];
  const rams = [2, 3, 4, 6, 8, 12, 16];

  async function predict() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          tier,
          storageGb: storageGb === "unknown" ? null : Number(storageGb),
          ramGb: ramGb === "unknown" ? null : Number(ramGb),
          releaseYear: releaseYear === "unknown" ? null : Number(releaseYear),
          condition,
          batteryHealth: batteryUnknown ? null : batteryHealth,
          damage,
          originalParts,
          is5g,
          dualSim,
          accessories: { box: accBox, charger: accCharger, case: accCase },
          region,
          priceType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prediction failed");
      setResult(data as PredResp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const markerPct = result
    ? Math.max(0, Math.min(100, ((result.price - result.lo) / Math.max(1, result.hi - result.lo)) * 100))
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* ---------------- form ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-emerald-600" /> Describe the phone
          </CardTitle>
          <CardDescription>
            The same 48 features the model was trained on — filled from your answers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* the phone */}
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger aria-label="Brand"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meta.brands_top.map((b) => (
                      <SelectItem key={b} value={b}>{cap(b)}</SelectItem>
                    ))}
                    <SelectItem value="other">Other / smaller brand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Variant tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger aria-label="Variant tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIER_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Storage</Label>
                <Select value={storageGb} onValueChange={setStorageGb}>
                  <SelectTrigger aria-label="Storage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {storages.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s} GB</SelectItem>
                    ))}
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>RAM</Label>
                <Select value={ramGb} onValueChange={setRamGb}>
                  <SelectTrigger aria-label="RAM"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rams.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r} GB</SelectItem>
                    ))}
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Model release year</Label>
                <Select value={releaseYear} onValueChange={setReleaseYear}>
                  <SelectTrigger aria-label="Release year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* state */}
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger aria-label="Condition"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Battery health</Label>
                  <span className="text-sm text-muted-foreground">
                    {batteryUnknown ? "unknown" : `${batteryHealth}%`}
                  </span>
                </div>
                <Slider
                  value={[batteryHealth]}
                  onValueChange={(v) => setBatteryHealth(v[0])}
                  min={50} max={100} step={1}
                  disabled={batteryUnknown}
                  aria-label="Battery health"
                />
                <div className="flex items-center gap-2 pt-1">
                  <Switch id="batt-unk" checked={batteryUnknown} onCheckedChange={setBatteryUnknown} />
                  <Label htmlFor="batt-unk" className="text-sm font-normal">Don&apos;t know</Label>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="dmg" className="text-sm">Has damage</Label>
                  <p className="text-xs text-muted-foreground">cracked screen / body, water damage</p>
                </div>
                <Switch id="dmg" checked={damage} onCheckedChange={setDamage} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="orig" className="text-sm">Original parts</Label>
                  <p className="text-xs text-muted-foreground">never repaired, all-original</p>
                </div>
                <Switch id="orig" checked={originalParts} onCheckedChange={setOriginalParts} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="5g" className="text-sm">5G capable</Label>
                <Switch id="5g" checked={is5g} onCheckedChange={setIs5g} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="sim" className="text-sm">Dual SIM</Label>
                <Switch id="sim" checked={dualSim} onCheckedChange={setDualSim} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Boxes className="h-4 w-4" /> Accessories included
              </Label>
              <div className="flex flex-wrap gap-4">
                {([["accBox", accBox, setAccBox, "Original box"],
                   ["accChg", accCharger, setAccCharger, "Charger"],
                   ["accCase", accCase, setAccCase, "Case"]] as const).map(([id, val, set, label]) => (
                  <div key={id} className="flex items-center gap-2">
                    <Checkbox id={id} checked={val} onCheckedChange={(v) => set(Boolean(v))} />
                    <Label htmlFor={id} className="text-sm font-normal">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Separator />

          {/* listing */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Region (wilaya)</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger aria-label="Region"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meta.regions_top.map((r) => (
                    <SelectItem key={r} value={r}>{cap(r)}</SelectItem>
                  ))}
                  <SelectItem value="other">Other wilaya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Listing price type</Label>
              <Select value={priceType} onValueChange={setPriceType}>
                <SelectTrigger aria-label="Price type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRICE_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <Button onClick={predict} disabled={loading} size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto sm:min-w-56">
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estimating…</>
            ) : (
              "Estimate price"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ---------------- result ---------------- */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estimated market value</CardTitle>
            <CardDescription>XGBoost point estimate + 80% conformal band</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-5">
                <div>
                  <div className="text-4xl font-bold tracking-tight text-emerald-700">
                    {fmt(result.price)} <span className="text-xl font-semibold">DA</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    P10–P90: {fmt(result.lo)} – {fmt(result.hi)} DA
                  </p>
                </div>

                {/* band bar */}
                <div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-emerald-100">
                    <div className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-emerald-200 via-emerald-400 to-emerald-200" />
                    <div
                      className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-800"
                      style={{ left: `${markerPct}%` }}
                      aria-hidden
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(result.lo)}</span>
                    <span>{fmt(result.hi)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p>
                    This 80% interval covered the actual sale price in {result.coverage}% of
                    honest holdout listings. Wide band = genuinely heterogeneous market
                    (median error on new listings is {meta.card.med_ape_pct}%).
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <Sparkles className="h-8 w-8 text-emerald-600/60" />
                <p className="max-w-56 text-sm text-muted-foreground">
                  Fill in the phone details and hit <span className="font-medium">Estimate price</span>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-emerald-600" /> Model card
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Model</span><span>XGBoost · 48 features</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Trained on</span><span>{fmt(meta.n_rows)} listings (Ouedkniss)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Holdout MAE</span><span>≈ {fmt(meta.card.mae)} DA</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Median error</span><span>{meta.card.med_ape_pct}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Median bias</span><span>{meta.card.bias_pct > 0 ? "+" : ""}{meta.card.bias_pct}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data up to</span><span>Aug 2026</span></div>
            {meta.refined_labels && (
              <Badge variant="outline" className="border-emerald-600 text-emerald-700">
                condition labels LLM-audited
              </Badge>
            )}
            <p className="pt-2 text-xs text-muted-foreground">
              Statistical estimate from marketplace listings — not an appraisal. Prices in
              Algerian dinars (DZD).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
