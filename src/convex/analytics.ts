import { v } from "convex/values";
import { requireViewer } from "./access";
import { query } from "./_generated/server";
import { can } from "./permissions";
import {
  DATE_RE,
  MAX_ROWS,
  SHIFT_ORDER,
  accumulate,
  addDays,
  emptyBucket,
  enrichLog,
  pctChange,
  r2,
  summarize,
  utcToday,
} from "./measures";
import type { Bucket, EnrichedLog, Measures, ProductionLog } from "./measures";
import type { Shift } from "./schema";

/** One aggregated row for a mix design / customer / shift breakdown. */
type GroupMeasures = {
  key: string;
  m3: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  logs: number;
};

function addToGroup(
  groups: Map<string, GroupMeasures>,
  key: string,
  log: ProductionLog,
): void {
  const current = groups.get(key) ?? {
    key,
    m3: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    marginPct: 0,
    logs: 0,
  };
  current.m3 += log.deliveredM3;
  current.revenue += log.deliveredM3 * log.pricePerM3;
  current.cost += log.deliveredM3 * log.costPerM3;
  current.logs += 1;
  groups.set(key, current);
}

function finalizeGroup(group: GroupMeasures): GroupMeasures {
  const profit = group.revenue - group.cost;
  return {
    key: group.key,
    m3: r2(group.m3),
    revenue: r2(group.revenue),
    cost: r2(group.cost),
    profit: r2(profit),
    marginPct: group.revenue > 0 ? r2((profit / group.revenue) * 100) : 0,
    logs: group.logs,
  };
}

function finalizeGroups(groups: Map<string, GroupMeasures>) {
  return [...groups.values()].map(finalizeGroup);
}

/* Roles without financial visibility receive the operational picture only. */

function redactMeasures(measures: Measures): Measures {
  return {
    ...measures,
    revenue: 0,
    cost: 0,
    profit: 0,
    marginPct: 0,
    costPerM3: 0,
    pricePerM3: 0,
  };
}

function redactGroup(group: GroupMeasures): GroupMeasures {
  return { ...group, revenue: 0, cost: 0, profit: 0, marginPct: 0 };
}

function redactLog(log: EnrichedLog): EnrichedLog {
  return {
    ...log,
    pricePerM3: 0,
    costPerM3: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    marginPct: 0,
  };
}

/**
 * Dashboard feed: every KPI the executive summary shows, computed from the raw
 * ledger over `days`, plus the equivalent previous window for trend deltas.
 */
export const overview = query({
  args: {
    days: v.number(),
    today: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (
    ctx,
    { days: requestedDays, today: requestedToday, branchId },
  ) => {
    const viewer = await requireViewer(ctx);
    const financialsVisible = can(viewer, "viewFinancials");
    const days = Math.min(Math.max(Math.round(requestedDays || 30), 1), 180);
    const today =
      requestedToday && DATE_RE.test(requestedToday)
        ? requestedToday
        : utcToday();
    const start = addDays(today, -(days - 1));
    const prevStart = addDays(start, -days);
    const prevEnd = addDays(start, -1);

    const fetched = await ctx.db
      .query("productionLogs")
      .withIndex("by_date", (q) => q.gte("date", prevStart).lte("date", today))
      .take(MAX_ROWS);
    const logs = branchId
      ? fetched.filter((log) => log.branchId === branchId)
      : fetched;

    const current = new Map<string, Bucket>();
    const previous = new Map<string, Bucket>();
    const byMix = new Map<string, GroupMeasures>();
    const byCustomer = new Map<string, GroupMeasures>();
    const byShift = new Map<string, GroupMeasures>();
    for (const shift of SHIFT_ORDER) {
      byShift.set(shift, {
        key: shift,
        m3: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPct: 0,
        logs: 0,
      });
    }
    let testDataCount = 0;

    for (const log of logs) {
      const inWindow = log.date >= start;
      const target = inWindow ? current : previous;
      const bucket = target.get(log.date) ?? emptyBucket(log.date);
      target.set(log.date, accumulate(bucket, log));
      if (!inWindow) continue;
      if (log.isTestData) testDataCount += 1;
      if (log.status === "cancelled") continue;
      addToGroup(byMix, log.mixDesign, log);
      addToGroup(byCustomer, log.customer, log);
      addToGroup(byShift, log.shift, log);
    }

    const trend = [];
    for (let cursor = start; cursor <= today; cursor = addDays(cursor, 1)) {
      const bucket = current.get(cursor) ?? emptyBucket(cursor);
      trend.push({ date: cursor, ...summarize([bucket]) });
    }

    const totals = summarize([...current.values()]);
    const previousTotals = summarize([...previous.values()]);
    const hasPrevious = previousTotals.logs > 0 || previousTotals.cancelled > 0;

    const todayBucket = current.get(today) ?? emptyBucket(today);

    const recent: EnrichedLog[] = logs
      .filter((log) => log.date >= start)
      .slice(-10)
      .reverse()
      .map(enrichLog);

    const deltas = {
      revenue: hasPrevious ? pctChange(totals.revenue, previousTotals.revenue) : null,
      cost: hasPrevious ? pctChange(totals.cost, previousTotals.cost) : null,
      profit: hasPrevious ? pctChange(totals.profit, previousTotals.profit) : null,
      productionM3: hasPrevious
        ? pctChange(totals.productionM3, previousTotals.productionM3)
        : null,
      deliveredM3: hasPrevious
        ? pctChange(totals.deliveredM3, previousTotals.deliveredM3)
        : null,
      costPerM3: hasPrevious
        ? pctChange(totals.costPerM3, previousTotals.costPerM3)
        : null,
      // percentage metrics compare in points, not percent
      marginPct: hasPrevious ? r2(totals.marginPct - previousTotals.marginPct) : null,
      onTimePct: hasPrevious ? r2(totals.onTimePct - previousTotals.onTimePct) : null,
      hasPrevious,
    };

    const shifts = finalizeGroups(byShift).sort(
      (a, b) => SHIFT_ORDER.indexOf(a.key as Shift) - SHIFT_ORDER.indexOf(b.key as Shift),
    );

    const plant = (await ctx.db.query("plantSettings").take(1))[0];
    const capacityM3Day = plant?.capacityM3Day ?? 0;

    const response = {
      range: { days, start, end: today, prevStart, prevEnd },
      branchId: branchId ?? null,
      capacity: {
        capacityM3Day,
        utilisationPct:
          capacityM3Day > 0
            ? r2(((totals.deliveredM3 / days) / capacityM3Day) * 100)
            : 0,
      },
      financialsVisible,
      totals,
      previous: previousTotals,
      deltas,
      trend: trend as Array<Measures & { date: string }>,
      byMix: finalizeGroups(byMix).sort((a, b) => b.m3 - a.m3),
      byCustomer: finalizeGroups(byCustomer)
        .sort((a, b) => (financialsVisible ? b.revenue - a.revenue : b.m3 - a.m3))
        .slice(0, 6),
      byShift: shifts,
      today: { date: today, ...summarize([todayBucket]) },
      recent,
      testDataCount,
      hasData: totals.logs > 0 || totals.cancelled > 0,
    };

    if (financialsVisible) return response;

    return {
      ...response,
      totals: redactMeasures(response.totals),
      previous: redactMeasures(response.previous),
      deltas: {
        ...response.deltas,
        revenue: null,
        cost: null,
        profit: null,
        costPerM3: null,
      },
      trend: response.trend.map((day) => ({ ...day, ...redactMeasures(day) })),
      byMix: response.byMix.map(redactGroup),
      byCustomer: response.byCustomer.map(redactGroup),
      byShift: response.byShift.map(redactGroup),
      today: { ...response.today, ...redactMeasures(response.today) },
      recent: response.recent.map(redactLog),
    };
  },
});
