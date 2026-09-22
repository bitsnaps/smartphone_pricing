import { NextRequest, NextResponse } from "next/server";
import { predictPrice, PriceInput, getArtifacts } from "@/lib/model/predict";

const CONDITIONS = ["new", "like_new", "good", "used", "refurb"];
const TIERS = ["none", "base", "compact", "plus", "pro", "promax", "ultra"];
const PRICE_TYPES = ["FIXED", "NEGOTIABLE", "NONE"];

function validate(body: Record<string, unknown>): { ok: true; value: PriceInput } | { ok: false; error: string } {
  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" ? null : Number(v);
  const brand = String(body.brand ?? "other");
  const tier = String(body.tier ?? "none");
  const condition = String(body.condition ?? "good");
  const region = String(body.region ?? "other");
  const priceType = String(body.priceType ?? "NONE");

  if (!CONDITIONS.includes(condition)) return { ok: false, error: `unknown condition: ${condition}` };
  if (!TIERS.includes(tier)) return { ok: false, error: `unknown tier: ${tier}` };
  if (!PRICE_TYPES.includes(priceType)) return { ok: false, error: `unknown priceType: ${priceType}` };

  const a = getArtifacts();
  const bNorm = brand.toLowerCase();
  if (bNorm !== "other" && !a.brands_top.includes(bNorm))
    return { ok: false, error: `unknown brand: ${brand}` };
  const rNorm = region.toLowerCase();
  if (rNorm !== "other" && !a.regions_top.includes(rNorm))
    return { ok: false, error: `unknown region: ${region}` };

  const storageGb = num(body.storageGb);
  if (storageGb !== null && (storageGb < 4 || storageGb > 2048))
    return { ok: false, error: "storage out of range (4-2048 GB)" };
  const ramGb = num(body.ramGb);
  if (ramGb !== null && (ramGb < 0.5 || ramGb > 32)) return { ok: false, error: "ram out of range" };
  const batteryHealth = num(body.batteryHealth);
  if (batteryHealth !== null && (batteryHealth < 1 || batteryHealth > 100))
    return { ok: false, error: "battery health must be 1-100" };
  const releaseYear = num(body.releaseYear);
  if (releaseYear !== null && (releaseYear < 2008 || releaseYear > 2027))
    return { ok: false, error: "release year out of range" };

  const acc = (body.accessories ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    value: {
      brand: bNorm,
      tier,
      storageGb,
      ramGb,
      releaseYear: releaseYear !== null ? Math.round(releaseYear) : null,
      condition,
      batteryHealth,
      damage: Boolean(body.damage),
      originalParts: Boolean(body.originalParts),
      is5g: Boolean(body.is5g),
      dualSim: Boolean(body.dualSim),
      accessories: {
        box: Boolean(acc.box),
        charger: Boolean(acc.charger),
        case: Boolean(acc.case),
      },
      region: rNorm,
      priceType,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const v = validate(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const a = getArtifacts();
    const result = predictPrice(v.value);
    return NextResponse.json({
      price: result.price,
      lo: result.lo,
      hi: result.hi,
      currency: "DZD",
      coverage: a.card_metrics_time_split.interval_reference.coverage_pct,
      modelVersion: result.modelVersion,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "prediction failed" },
      { status: 500 },
    );
  }
}
