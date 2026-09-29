import type { Doc } from "./_generated/dataModel";
import type { Shift } from "./schema";

/**
 * IConcrete v1 — pre-computed measures.
 *
 * The Power Pivot / DAX layer of the original spec lives here: every KPI
 * (Total_Revenue, Gross_Profit, Margin_Pct, Cost_per_m3, Production_Efficiency,
 * On_Time_Percent, Turnover-style rates …) is derived from the raw ledger in one
 * place so the dashboard, the ledger page and any future export agree exactly.
 */

export const DAY_MS = 86_400_000;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_ROWS = 5_000;

export const SHIFT_ORDER: Shift[] = ["morning", "evening", "night"];

export type ProductionLog = Doc<"productionLogs">;

/** Money and quantities are rounded to 2 decimals to keep sums stable. */
export const r2 = (value: number) => Math.round(value * 100) / 100;

export function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Per-row measures shown in the ledger table. */
export function enrichLog(log: ProductionLog) {
  const revenue = r2(log.deliveredM3 * log.pricePerM3);
  const cost = r2(log.deliveredM3 * log.costPerM3);
  const profit = r2(revenue - cost);
  return {
    ...log,
    revenue,
    cost,
    profit,
    marginPct: revenue > 0 ? r2((profit / revenue) * 100) : 0,
  };
}

export type EnrichedLog = ReturnType<typeof enrichLog>;

export type Bucket = {
  date: string;
  productionM3: number;
  deliveredM3: number;
  returnedM3: number;
  revenue: number;
  cost: number;
  profit: number;
  trucks: number;
  logs: number;
  deliveredLogs: number;
  onTimeLogs: number;
  cancelled: number;
};

export function emptyBucket(date: string): Bucket {
  return {
    date,
    productionM3: 0,
    deliveredM3: 0,
    returnedM3: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    trucks: 0,
    logs: 0,
    deliveredLogs: 0,
    onTimeLogs: 0,
    cancelled: 0,
  };
}

/** Cancelled pours never carry revenue or cost. */
export function accumulate(bucket: Bucket, log: ProductionLog): Bucket {
  if (log.status === "cancelled") {
    bucket.cancelled += 1;
    return bucket;
  }
  bucket.logs += 1;
  bucket.productionM3 += log.quantityM3;
  bucket.deliveredM3 += log.deliveredM3;
  bucket.returnedM3 += log.returnedM3;
  bucket.revenue += log.deliveredM3 * log.pricePerM3;
  bucket.cost += log.deliveredM3 * log.costPerM3;
  bucket.profit = bucket.revenue - bucket.cost;
  bucket.trucks += log.truckCount;
  if (log.status === "delivered") {
    bucket.deliveredLogs += 1;
    if (log.onTime) bucket.onTimeLogs += 1;
  }
  return bucket;
}

export type Measures = {
  productionM3: number;
  deliveredM3: number;
  returnedM3: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  costPerM3: number;
  pricePerM3: number;
  efficiencyPct: number;
  returnRatePct: number;
  onTimePct: number;
  avgLoadPerTruck: number;
  trucks: number;
  logs: number;
  cancelled: number;
};

export function summarize(buckets: Bucket[]): Measures {
  const tally = buckets.reduce(
    (acc, b) => ({
      productionM3: acc.productionM3 + b.productionM3,
      deliveredM3: acc.deliveredM3 + b.deliveredM3,
      returnedM3: acc.returnedM3 + b.returnedM3,
      revenue: acc.revenue + b.revenue,
      cost: acc.cost + b.cost,
      trucks: acc.trucks + b.trucks,
      logs: acc.logs + b.logs,
      deliveredLogs: acc.deliveredLogs + b.deliveredLogs,
      onTimeLogs: acc.onTimeLogs + b.onTimeLogs,
      cancelled: acc.cancelled + b.cancelled,
    }),
    {
      productionM3: 0,
      deliveredM3: 0,
      returnedM3: 0,
      revenue: 0,
      cost: 0,
      trucks: 0,
      logs: 0,
      deliveredLogs: 0,
      onTimeLogs: 0,
      cancelled: 0,
    },
  );

  const profit = tally.revenue - tally.cost;
  return {
    productionM3: r2(tally.productionM3),
    deliveredM3: r2(tally.deliveredM3),
    returnedM3: r2(tally.returnedM3),
    revenue: r2(tally.revenue),
    cost: r2(tally.cost),
    profit: r2(profit),
    marginPct: tally.revenue > 0 ? r2((profit / tally.revenue) * 100) : 0,
    costPerM3: tally.deliveredM3 > 0 ? r2(tally.cost / tally.deliveredM3) : 0,
    pricePerM3:
      tally.deliveredM3 > 0 ? r2(tally.revenue / tally.deliveredM3) : 0,
    efficiencyPct:
      tally.productionM3 > 0
        ? r2((tally.deliveredM3 / tally.productionM3) * 100)
        : 0,
    returnRatePct:
      tally.productionM3 > 0
        ? r2((tally.returnedM3 / tally.productionM3) * 100)
        : 0,
    onTimePct:
      tally.deliveredLogs > 0
        ? r2((tally.onTimeLogs / tally.deliveredLogs) * 100)
        : 0,
    avgLoadPerTruck:
      tally.trucks > 0 ? r2(tally.deliveredM3 / tally.trucks) : 0,
    trucks: tally.trucks,
    logs: tally.logs,
    cancelled: tally.cancelled,
  };
}

/** Relative change against the previous window, `null` when there is no base. */
export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return r2(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * Deterministic PRNG (mulberry32) used by every demo dataset, so the sample
 * ledger, the quality samples, the material movements and the equipment list
 * always line up with each other.
 */
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monday-first weekday index (0 = Monday … 6 = Sunday), used by forecasting. */
export function weekdayIndex(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (day + 6) % 7;
}
