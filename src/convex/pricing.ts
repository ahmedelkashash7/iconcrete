/**
 * Standard selling price and cost per m³ for the plant's approved mixes (EGP).
 *
 * These values are the *fallback* seed for the `mixPrices` table: once the
 * plant edits its approved list in «إعدادات المحطة», the database is the source
 * of truth and pricing.ts only supplies defaults and pure helpers.
 */

export type MixPrice = {
  name: string;
  price: number;
  cost: number;
  strengthMpa: number;
  cementKgPerM3: number;
};

export const STANDARD_MIX_PRICES: MixPrice[] = [
  { name: "C20/25", price: 1290, cost: 1045, strengthMpa: 20, cementKgPerM3: 300 },
  { name: "C25/30", price: 1405, cost: 1118, strengthMpa: 25, cementKgPerM3: 340 },
  { name: "C30/37", price: 1530, cost: 1205, strengthMpa: 30, cementKgPerM3: 380 },
  { name: "C35/45", price: 1665, cost: 1312, strengthMpa: 35, cementKgPerM3: 420 },
  { name: "C40/50", price: 1820, cost: 1438, strengthMpa: 40, cementKgPerM3: 460 },
];

/** Fallback used when a mix grade is not on the approved list (C30/37 rates). */
export const DEFAULT_MIX_PRICING = STANDARD_MIX_PRICES[2];

export function normalizeMixKey(mixDesign: string) {
  return mixDesign.trim().toUpperCase().replace(/\s+/g, "");
}

/** C35/45 → 35 MPa. Falls back to the default grade's strength. */
export function strengthFromName(mixDesign: string): number {
  const match = mixDesign.trim().toUpperCase().match(/C\s*(\d{1,3})/);
  return match ? Number(match[1]) : DEFAULT_MIX_PRICING.strengthMpa;
}

/** The plant's approved pricing for a grade, from the given list or defaults. */
export function standardPricing(
  mixDesign: string,
  prices: MixPrice[] = STANDARD_MIX_PRICES,
): MixPrice {
  const key = normalizeMixKey(mixDesign);
  const list = prices.length > 0 ? prices : STANDARD_MIX_PRICES;
  return (
    list.find((mix) => normalizeMixKey(mix.name) === key) ?? list[2] ?? DEFAULT_MIX_PRICING
  );
}

/**
 * Cube acceptance rule used on the quality screen (ECP 203 / ASTM C94): a
 * 28-day cube must reach the characteristic strength, a 7-day cube is accepted
 * from 70% of it.
 */
export function cubeTargetValue(mixDesign: string, kind: "cube7" | "cube28"): number {
  const strength = strengthFromName(mixDesign);
  return kind === "cube7" ? Math.round(strength * 0.7 * 10) / 10 : strength;
}
