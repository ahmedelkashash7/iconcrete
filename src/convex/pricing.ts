/**
 * IConcrete System — approved pricing for production entries (EGP per m³).
 *
 * HARDENING v1 — what changed and why
 * -----------------------------------
 * The previous version priced an unknown mix grade silently as C30/37. A typo in
 * the mix name ("C35" instead of "C35/45", or an empty field) therefore produced
 * a plausible revenue figure that was simply wrong, and nobody saw an error. The
 * plant's money must never be guessed.
 *
 * Now: the approved list in the `mixPrices` table is the only price source. A
 * mix that is not on it raises `UNKNOWN_MIX` and the entry is refused — in the
 * form, in the Excel import, in the sync replay and in the offline queue, because
 * all four call `standardPricing`.
 *
 * `DEMO_SEED_MIX_PRICES` is a **demo seed only** (`isTestData: true`). It exists
 * so a throwaway demo deployment has something to show. It is never a fallback:
 * nothing in the live path reads it unless the caller passes it in explicitly.
 *
 * The error codes here mirror `src/lib/errors.ts`. The Convex functions bundle
 * runs inside `src/convex/`, so the catalogue is not imported across the
 * boundary; keep the two in sync.
 */

import { ConvexError } from "convex/values";

export type MixPrice = {
  name: string;
  /** Selling price per m³ (EGP). */
  price: number;
  /** Standard cost per m³ (EGP). */
  cost: number;
  /** Characteristic cube strength fcu in MPa. */
  strengthMpa: number;
  cementKgPerM3: number;
  /** Present on seed rows only — marks them as demo data. */
  isTestData?: boolean;
};

/**
 * DEMO ONLY. Seeding a live plant with these prices would price real deliveries
 * from invented numbers, so `isTestData: true` is set on every row and the seed
 * path refuses to run unless the deployment is a demo (see ./demoMode).
 */
export const DEMO_SEED_MIX_PRICES: MixPrice[] = [
  { name: "C20/25", price: 1290, cost: 1045, strengthMpa: 20, cementKgPerM3: 300, isTestData: true },
  { name: "C25/30", price: 1405, cost: 1118, strengthMpa: 25, cementKgPerM3: 340, isTestData: true },
  { name: "C30/37", price: 1530, cost: 1205, strengthMpa: 30, cementKgPerM3: 380, isTestData: true },
  { name: "C35/45", price: 1665, cost: 1312, strengthMpa: 35, cementKgPerM3: 420, isTestData: true },
  { name: "C40/50", price: 1820, cost: 1438, strengthMpa: 40, cementKgPerM3: 460, isTestData: true },
];

/** Demo-only slump values used by the demo seeder. Not limits. */
export const DEMO_SLUMP_TARGET_MM = 120;
export const DEMO_SLUMP_TOLERANCE_MM = 25;

/**
 * DEMO-ONLY alias. It exists so the demo seeder and the price-list form keep
 * compiling; it is **never** consulted when pricing a live entry, because
 * `standardPricing` throws `UNKNOWN_MIX` for anything not in the plant's own
 * `mixPrices` list. Every row carries `isTestData: true`.
 */
export const STANDARD_MIX_PRICES = DEMO_SEED_MIX_PRICES;

export function normalizeMixKey(mixDesign: string) {
  return mixDesign.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Reads the number after "C" in a grade name.
 *
 * DEMO / FORM-PREFILL ONLY. In "C30/37" that number is the **cylinder**
 * strength (30 MPa), while this plant tests cubes, so using it as a compliance
 * target systematically under-states the requirement. Compliance therefore
 * requires an explicit `targetCubeMpa` (see ./quality.ts and
 * src/lib/quality/ecp203.ts). Returning `null` rather than a default is
 * deliberate: there is no "standard" grade to fall back to.
 */
export function cylinderStrengthFromName(mixDesign: string): number | null {
  const match = mixDesign.trim().toUpperCase().match(/C\s*(\d{1,3})/);
  return match ? Number(match[1]) : null;
}

/** The approved row for a grade, or null. Never substitutes another grade. */
export function findApprovedMix(
  mixDesign: string,
  prices: MixPrice[],
): MixPrice | null {
  const key = normalizeMixKey(mixDesign ?? "");
  if (!key) return null;
  return prices.find((mix) => normalizeMixKey(mix.name) === key) ?? null;
}

/** Thrown code shared with `src/lib/errors.ts` → BUSINESS_ERRORS.UNKNOWN_MIX. */
export const UNKNOWN_MIX_CODE = "UNKNOWN_MIX";

/** The approved row, or a hard `UNKNOWN_MIX` error. */
export function requireApprovedMix(mixDesign: string, prices: MixPrice[]): MixPrice {
  const found = findApprovedMix(mixDesign, prices);
  if (found) return found;
  throw new ConvexError({
    code: UNKNOWN_MIX_CODE,
    title: "خلطة غير معتمدة",
    message: `الخلطة «${mixDesign.trim() || "(فارغة)"}» ليست على قائمة الأسعار المعتمدة للمحطة، فلا يمكن تسعير القيد. أضف الخلطة وسعرها من إعدادات المحطة أولًا.`,
    retryable: false,
  });
}

/**
 * Prices one production entry. Kept as the single name every caller already
 * uses, so the form, the importer, the sync replay and the offline queue all
 * inherit the hard error at once.
 */
export function standardPricing(mixDesign: string, prices: MixPrice[]): MixPrice {
  return requireApprovedMix(mixDesign, prices);
}

/**
 * The required cube strength for a **mix design**, or null when the engineer has
 * not typed one.
 *
 * The mix name is free text and is never parsed to decide compliance: "C30/37"'s
 * first number is the *cylinder* strength (30 MPa), while the plant tests cubes,
 * so reading the name would systematically under-state the target. The engine
 * requires an explicit `targetCubeMpa` (see `src/lib/quality/ecp203.ts` and the
 * `mixDesigns` table).
 */
export function requiredCubeTarget(mixDesign: { targetCubeMpa?: number | null }): number | null {
  const value = mixDesign.targetCubeMpa;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * DEMO-ONLY form prefill for the price list.
 *
 * Named `strengthFromName` because the settings screen has used that name since
 * v1. It returns the cylinder strength from the grade text so the field is not
 * empty, and the operator is expected to correct it to the cube strength. It
 * never reaches a compliance decision.
 */
export function strengthFromName(mixDesign: string): number {
  return cylinderStrengthFromName(mixDesign) ?? 0;
}
