/**
 * Standard selling price and cost per m³ for the plant's approved mixes (EGP).
 * Operators never type prices: the server prices their entries from this list.
 */
export const STANDARD_MIX_PRICES = [
  { name: "C20/25", price: 1290, cost: 1045 },
  { name: "C25/30", price: 1405, cost: 1118 },
  { name: "C30/37", price: 1530, cost: 1205 },
  { name: "C35/45", price: 1665, cost: 1312 },
  { name: "C40/50", price: 1820, cost: 1438 },
];

/** Fallback used when a mix grade is not on the approved list (C30/37 rates). */
export const DEFAULT_MIX_PRICING = STANDARD_MIX_PRICES[2];

export function standardPricing(mixDesign: string) {
  const key = mixDesign.trim().toUpperCase().replace(/\s+/g, "");
  return (
    STANDARD_MIX_PRICES.find((mix) => mix.name.toUpperCase() === key) ??
    DEFAULT_MIX_PRICING
  );
}
