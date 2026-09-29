import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCapability, requireViewer } from "./access";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import {
  DATE_RE,
  MAX_ROWS,
  accumulate,
  addDays,
  emptyBucket,
  r2,
  summarize,
  utcToday,
} from "./measures";
import {
  alertChannelValidator,
  alertComparatorValidator,
  alertMetricValidator,
} from "./schema";
import type { AlertMetric } from "./schema";

/**
 * Smart threshold alerts.
 *
 * 1. Rules are stored in `alertRules` (metric, comparator, threshold, channel).
 * 2. `evaluateAll` scores every active rule against the live ledger and writes a
 *    row per breach into `alertEvents`.
 * 3. `dispatchPending` sends them — through Knock when `KNOCK_API_KEY` is
 *    configured, and otherwise records them as «تجريبي» so the whole chain
 *    stays observable before credentials are added.
 */

const RULES_MAX = 200;
const EVENTS_MAX = 200;
const RULE_FIELDS = [
  "name",
  "metric",
  "comparator",
  "threshold",
  "channel",
  "recipients",
  "windowDays",
  "isActive",
] as const;

export const METRIC_DEFAULTS: Record<
  AlertMetric,
  { comparator: "lt" | "gt"; threshold: number; windowDays: number }
> = {
  marginPct: { comparator: "lt", threshold: 8, windowDays: 30 },
  onTimePct: { comparator: "lt", threshold: 85, windowDays: 7 },
  dailyProfit: { comparator: "lt", threshold: 0, windowDays: 3 },
  qualityFailCount: { comparator: "gt", threshold: 2, windowDays: 30 },
  lowStockCount: { comparator: "gt", threshold: 0, windowDays: 7 },
  equipmentOverdueCount: { comparator: "gt", threshold: 0, windowDays: 7 },
};

/* ------------------------------------------------------------------ */
/* Metric evaluation                                                   */
/* ------------------------------------------------------------------ */

type AnyCtx = QueryCtx | MutationCtx;

/** Scores every alert metric over the requested window, branch-aware. */
export async function evaluateMetrics(
  ctx: AnyCtx,
  options: { branchId?: Id<"branches">; windowDays: number; today: string },
): Promise<Record<AlertMetric, number>> {
  const { branchId, today } = options;
  const windowDays = Math.min(Math.max(Math.round(options.windowDays || 30), 1), 180);
  const start = addDays(today, -(windowDays - 1));

  const logs = (
    await ctx.db
      .query("productionLogs")
      .withIndex("by_date", (q) => q.gte("date", start).lte("date", today))
      .take(MAX_ROWS)
  ).filter((log) => !branchId || !log.branchId || log.branchId === branchId);

  const byDate = new Map<string, ReturnType<typeof emptyBucket>>();
  const overall: ReturnType<typeof emptyBucket>[] = [];
  for (const log of logs) {
    const bucket = byDate.get(log.date) ?? emptyBucket(log.date);
    byDate.set(log.date, accumulate(bucket, log));
  }
  for (const bucket of byDate.values()) overall.push(bucket);

  const totals = summarize(overall);
  const orderedDates = [...byDate.keys()].sort();
  const latestDate = orderedDates[orderedDates.length - 1] ?? null;
  const latestBucket = latestDate ? byDate.get(latestDate) : undefined;
  const dailyProfit = r2(
    latestBucket ? latestBucket.revenue - latestBucket.cost : 0,
  );

  const failures = (
    await ctx.db
      .query("qualityTests")
      .withIndex("by_date", (q) => q.gte("date", start).lte("date", today))
      .take(MAX_ROWS)
  ).filter(
    (row) => (!branchId || !row.branchId || row.branchId === branchId) && row.result === "fail",
  );

  const materials = (
    await ctx.db.query("materials").take(400)
  ).filter((row) => row.isActive && (!branchId || !row.branchId || row.branchId === branchId));
  const movements = (
    await ctx.db.query("materialMovements").take(MAX_ROWS)
  ).filter((row) => !branchId || !row.branchId || row.branchId === branchId);

  const lowStockItems: Array<{ name: string; balance: number; unit: string }> = [];
  for (const material of materials) {
    let balance = material.openingQty;
    for (const movement of movements) {
      if (movement.materialId !== material._id) continue;
      if (movement.kind === "receipt") balance += movement.quantity;
      else if (movement.kind === "issue") balance -= Math.abs(movement.quantity);
      else balance += movement.quantity;
    }
    if (balance <= material.reorderLevel) {
      lowStockItems.push({
        name: material.name,
        balance: r2(balance),
        unit: material.unit,
      });
    }
  }

  const equipment = (await ctx.db.query("equipment").take(300)).filter(
    (row) => row.isActive && (!branchId || !row.branchId || row.branchId === branchId),
  );
  const overdue: string[] = [];
  for (const item of equipment) {
    const remainingMeter = item.serviceInterval - (item.meterReading - item.lastServiceMeter);
    const daysByMeter =
      item.avgDailyUsage > 0 ? remainingMeter / item.avgDailyUsage : null;
    const dateDue =
      item.serviceIntervalDays && item.lastServiceDate
        ? addDays(item.lastServiceDate, item.serviceIntervalDays)
        : null;
    const daysByDate = dateDue
      ? Math.round(
          (Date.parse(`${dateDue}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
            86_400_000,
        )
      : null;
    const candidates = [daysByMeter, daysByDate].filter(
      (value): value is number => value !== null,
    );
    if (candidates.length > 0 && Math.min(...candidates) < 0) {
      overdue.push(`${item.code} · ${item.name}`);
    }
  }

  return {
    dailyProfit,
    marginPct: totals.marginPct,
    onTimePct: totals.onTimePct,
    qualityFailCount: failures.length,
    lowStockCount: lowStockItems.length,
    equipmentOverdueCount: overdue.length,
  };
}

function breaches(
  value: number,
  comparator: "lt" | "gt",
  threshold: number,
): boolean {
  if (!Number.isFinite(value)) return false;
  return comparator === "lt" ? value < threshold : value > threshold;
}

const METRIC_TEXT: Record<AlertMetric, string> = {
  dailyProfit: "ربح آخر يوم مسجّل",
  marginPct: "هامش الربح",
  onTimePct: "نسبة التسليم في الموعد",
  qualityFailCount: "نتائج جودة راسبة",
  lowStockCount: "مواد تحت حد إعادة الطلب",
  equipmentOverdueCount: "معدات متأخرة الصيانة",
};

const METRIC_UNIT: Record<AlertMetric, string> = {
  dailyProfit: "ج.م",
  marginPct: "٪",
  onTimePct: "٪",
  qualityFailCount: "اختبار",
  lowStockCount: "مادة",
  equipmentOverdueCount: "معدة",
};

function describe(
  metric: AlertMetric,
  value: number,
  comparator: "lt" | "gt",
  threshold: number,
) {
  const direction = comparator === "lt" ? "أقل من" : "أعلى من";
  const format = (input: number) => {
    if (metric === "dailyProfit") {
      return `${Math.round(input).toLocaleString("en-US")} ج.م`;
    }
    if (metric === "marginPct" || metric === "onTimePct") {
      return `${Math.round(input * 100) / 100} ٪`;
    }
    return `${Math.round(input * 100) / 100} ${METRIC_UNIT[metric]}`;
  };
  return `${METRIC_TEXT[metric]} = ${format(value)} — ${direction} الحد المسموح ${format(
    threshold,
  )}`;
}

/* ------------------------------------------------------------------ */
/* Public reads                                                        */
/* ------------------------------------------------------------------ */

export const list = query({
  args: { branchId: v.optional(v.id("branches")), today: v.optional(v.string()) },
  handler: async (ctx, { branchId, today: requestedToday }) => {
    const viewer = await requireViewer(ctx);
    const today =
      requestedToday && DATE_RE.test(requestedToday) ? requestedToday : utcToday();

    const rules = await ctx.db.query("alertRules").take(RULES_MAX);
    const events = await ctx.db
      .query("alertEvents")
      .withIndex("by_fired")
      .order("desc")
      .take(EVENTS_MAX);

    const scope = rules.filter(
      (rule) => !branchId || !rule.branchId || rule.branchId === branchId,
    );

    const snapshots = new Map<AlertMetric, number>();
    for (const rule of scope) {
      if (snapshots.has(rule.metric)) continue;
      const values = await evaluateMetrics(ctx, {
        branchId: rule.branchId ?? branchId,
        windowDays: rule.windowDays,
        today,
      });
      snapshots.set(rule.metric, values[rule.metric]);
    }

    return {
      today,
      rules: scope
        .map((rule) => ({
          _id: rule._id,
          name: rule.name,
          metric: rule.metric,
          comparator: rule.comparator,
          threshold: rule.threshold,
          channel: rule.channel,
          recipients: rule.recipients,
          windowDays: rule.windowDays,
          branchId: rule.branchId ?? null,
          isActive: rule.isActive,
          lastCheckedAt: rule.lastCheckedAt ?? null,
          lastTriggeredAt: rule.lastTriggeredAt ?? null,
          lastValue: rule.lastValue ?? null,
          currentValue: snapshots.get(rule.metric) ?? null,
          breaching: breaches(
            snapshots.get(rule.metric) ?? Number.NaN,
            rule.comparator,
            rule.threshold,
          ),
        }))
        .sort((a, b) => Number(b.breaching) - Number(a.breaching) || a.name.localeCompare(b.name, "ar")),
      events: events.map((event) => ({
        _id: event._id,
        ruleName: event.ruleName,
        metric: event.metric,
        comparator: event.comparator,
        value: event.value,
        threshold: event.threshold,
        channel: event.channel,
        recipients: event.recipients,
        message: event.message,
        firedAt: event.firedAt,
        date: event.date,
        status: event.status,
        error: event.error ?? null,
      })),
      grants: {
        manage: viewer.role === "owner" || viewer.role === "manager",
      },
      totals: {
        rules: scope.length,
        active: scope.filter((rule) => rule.isActive).length,
        breaching: scope.filter((rule) =>
          breaches(
            snapshots.get(rule.metric) ?? Number.NaN,
            rule.comparator,
            rule.threshold,
          ),
        ).length,
        sent: events.filter((event) => event.status === "sent").length,
        simulated: events.filter((event) => event.status === "simulated").length,
        failed: events.filter((event) => event.status === "failed").length,
      },
      deliveryConfigured: Boolean(process.env.KNOCK_API_KEY),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Rule management                                                     */
/* ------------------------------------------------------------------ */

const ruleFields = {
  name: v.string(),
  metric: alertMetricValidator,
  comparator: alertComparatorValidator,
  threshold: v.number(),
  channel: alertChannelValidator,
  recipients: v.array(v.string()),
  windowDays: v.number(),
  branchId: v.optional(v.id("branches")),
  isActive: v.boolean(),
};

function validateRule(fields: {
  name: string;
  threshold: number;
  windowDays: number;
  recipients: string[];
}) {
  if (!fields.name.trim()) throw new ConvexError("اسم قاعدة التنبيه مطلوب");
  if (!Number.isFinite(fields.threshold)) {
    throw new ConvexError("قيمة الحد يجب أن تكون رقمًا");
  }
  if (!Number.isFinite(fields.windowDays) || fields.windowDays < 1) {
    throw new ConvexError("مدة القياس يجب أن تكون يومًا واحدًا على الأقل");
  }
}

export const createRule = mutation({
  args: ruleFields,
  handler: async (ctx, fields) => {
    const viewer = await requireCapability(ctx, "manageAlerts");
    validateRule(fields);
    const record = {
      name: fields.name.trim(),
      metric: fields.metric,
      comparator: fields.comparator,
      threshold: fields.threshold,
      channel: fields.channel,
      recipients: fields.recipients.map((recipient) => recipient.trim()).filter(Boolean),
      windowDays: Math.round(fields.windowDays),
      branchId: fields.branchId,
      isActive: fields.isActive,
      createdBy: viewer.userId,
    };
    const id = await ctx.db.insert("alertRules", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "alertRules",
      entityId: id,
      label: record.name,
      changes: snapshotRecord(record, "after", RULE_FIELDS),
    });
    return id;
  },
});

export const updateRule = mutation({
  args: { id: v.id("alertRules"), ...ruleFields },
  handler: async (ctx, { id, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageAlerts");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("قاعدة التنبيه لم تعد موجودة");
    validateRule(fields);

    const next = {
      name: fields.name.trim(),
      metric: fields.metric,
      comparator: fields.comparator,
      threshold: fields.threshold,
      channel: fields.channel,
      recipients: fields.recipients.map((recipient) => recipient.trim()).filter(Boolean),
      windowDays: Math.round(fields.windowDays),
      branchId: fields.branchId,
      isActive: fields.isActive,
    };
    await ctx.db.patch(id, next);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "alertRules",
      entityId: id,
      label: next.name,
      changes: diffRecords(existing, { ...existing, ...next }, RULE_FIELDS),
    });
    return id;
  },
});

export const toggleRule = mutation({
  args: { id: v.id("alertRules"), isActive: v.boolean() },
  handler: async (ctx, { id, isActive }) => {
    const viewer = await requireCapability(ctx, "manageAlerts");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("قاعدة التنبيه لم تعد موجودة");
    await ctx.db.patch(id, { isActive });
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "alertRules",
      entityId: id,
      label: existing.name,
      changes: [{ field: "isActive", before: String(existing.isActive), after: String(isActive) }],
    });
    return id;
  },
});

export const removeRule = mutation({
  args: { id: v.id("alertRules") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "manageAlerts");
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "alertRules",
      entityId: id,
      label: existing.name,
      changes: snapshotRecord(existing, "before", RULE_FIELDS),
    });
    return id;
  },
});

/* ------------------------------------------------------------------ */
/* Evaluation & dispatch                                               */
/* ------------------------------------------------------------------ */

type PendingEvent = {
  _id: Id<"alertEvents">;
  ruleName: string;
  metric: AlertMetric;
  channel: "email" | "sms";
  recipients: string[];
  message: string;
  value: number;
  threshold: number;
};

/** Scores every active rule and records the breaches. Cron-safe (no auth). */
export const evaluateAll = internalMutation({
  args: { today: v.optional(v.string()) },
  handler: async (ctx, { today: requestedToday }) => {
    const today =
      requestedToday && DATE_RE.test(requestedToday) ? requestedToday : utcToday();
    const rules = await ctx.db.query("alertRules").take(RULES_MAX);
    const active = rules.filter((rule) => rule.isActive);
    const now = Date.now();
    let fired = 0;

    for (const rule of active) {
      const values = await evaluateMetrics(ctx, {
        branchId: rule.branchId,
        windowDays: rule.windowDays,
        today,
      });
      const value = values[rule.metric];
      const isBreaching = breaches(value, rule.comparator, rule.threshold);

      await ctx.db.patch(rule._id, {
        lastCheckedAt: now,
        lastValue: r2(value),
        ...(isBreaching ? { lastTriggeredAt: now } : {}),
      });

      if (!isBreaching) continue;

      const recent = await ctx.db
        .query("alertEvents")
        .withIndex("by_fired")
        .order("desc")
        .take(40);
      const duplicate = recent.some(
        (event) => event.ruleId === rule._id && event.date === today,
      );
      if (duplicate) continue;

      await ctx.db.insert("alertEvents", {
        ruleId: rule._id,
        ruleName: rule.name,
        metric: rule.metric,
        comparator: rule.comparator,
        value: r2(value),
        threshold: rule.threshold,
        channel: rule.channel,
        recipients: rule.recipients,
        message: describe(rule.metric, value, rule.comparator, rule.threshold),
        firedAt: now,
        date: today,
        status: "pending",
      });
      fired += 1;
    }

    return { checked: active.length, fired };
  },
});

export const pendingEvents = internalQuery({
  args: {},
  handler: async (ctx): Promise<PendingEvent[]> => {
    const events = await ctx.db
      .query("alertEvents")
      .withIndex("by_fired")
      .order("desc")
      .take(EVENTS_MAX);
    return events
      .filter((event) => event.status === "pending")
      .map((event) => ({
        _id: event._id,
        ruleName: event.ruleName,
        metric: event.metric,
        channel: event.channel,
        recipients: event.recipients,
        message: event.message,
        value: event.value,
        threshold: event.threshold,
      }));
  },
});

export const markEvents = internalMutation({
  args: {
    results: v.array(
      v.object({
        id: v.id("alertEvents"),
        status: v.union(
          v.literal("sent"),
          v.literal("simulated"),
          v.literal("failed"),
        ),
        error: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { results }) => {
    for (const result of results) {
      await ctx.db.patch(result.id, { status: result.status, error: result.error });
    }
    return results.length;
  },
});

/** Knock workflow that renders the email/SMS template (overridable via env). */
const DEFAULT_ALERT_WORKFLOW = "plant-threshold-alert";

async function sendThroughKnock(event: PendingEvent, apiKey: string) {
  const base = process.env.KNOCK_API_BASE ?? "https://api.knock.app";
  const workflow = process.env.KNOCK_ALERT_WORKFLOW ?? DEFAULT_ALERT_WORKFLOW;
  const response = await fetch(`${base}/v1/workflows/${workflow}/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      recipients: event.recipients.map((recipient) =>
        recipient.includes("@") ? { email: recipient } : { phone_number: recipient },
      ),
      actor: { id: "iconcrete-system", name: "IConcrete System" },
      data: {
        ruleName: event.ruleName,
        message: event.message,
        value: event.value,
        threshold: event.threshold,
        channel: event.channel,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${body.slice(0, 200)}`);
  }
}

/** Sends every pending alert, or marks it «تجريبي» when no key is configured. */
export const dispatchPending = internalAction({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.runQuery(internal.alerts.pendingEvents, {});
    const apiKey = process.env.KNOCK_API_KEY;
    const results: Array<{
      id: Id<"alertEvents">;
      status: "sent" | "simulated" | "failed";
      error?: string;
    }> = [];

    for (const event of events) {
      if (event.recipients.length === 0) {
        results.push({ id: event._id, status: "simulated", error: "لا يوجد مستلمون" });
        continue;
      }
      if (!apiKey) {
        results.push({ id: event._id, status: "simulated", error: "لم يُضبط مفتاح الإرسال" });
        continue;
      }
      try {
        await sendThroughKnock(event, apiKey);
        results.push({ id: event._id, status: "sent" });
      } catch (error) {
        results.push({
          id: event._id,
          status: "failed",
          error: error instanceof Error ? error.message : "فشل غير معروف",
        });
      }
    }

    if (results.length > 0) {
      await ctx.runMutation(internal.alerts.markEvents, { results });
    }
    return { dispatched: results.length };
  },
});

/** Daily entry point used by the cron job. */
export const runScheduled = internalAction({
  args: { today: v.optional(v.string()) },
  handler: async (
    ctx,
    { today },
  ): Promise<{ checked: number; fired: number; dispatched: number }> => {
    const evaluated = await ctx.runMutation(internal.alerts.evaluateAll, { today });
    const dispatched = await ctx.runAction(internal.alerts.dispatchPending, {});
    return { ...evaluated, ...dispatched };
  },
});

/** Same chain, triggered by the owner from the alerts screen. */
export const runCheck = action({
  args: { today: v.optional(v.string()) },
  handler: async (
    ctx,
    { today },
  ): Promise<{ checked: number; fired: number; dispatched: number }> => {
    await ctx.runQuery(internal.access.assertCapability, { capability: "manageAlerts" });
    const evaluated = await ctx.runMutation(internal.alerts.evaluateAll, { today });
    const dispatched = await ctx.runAction(internal.alerts.dispatchPending, {});
    return { ...evaluated, ...dispatched };
  },
});

/* ------------------------------------------------------------------ */
/* Demo rules                                                          */
/* ------------------------------------------------------------------ */

export async function seedAlertRules(
  ctx: MutationCtx,
  createdBy: Id<"users">,
  recipients: string[],
): Promise<number> {
  const definitions: Array<{
    name: string;
    metric: AlertMetric;
    channel: "email" | "sms";
  }> = [
    { name: "هامش ربح منخفض", metric: "marginPct", channel: "email" },
    { name: "تأخير في التسليم", metric: "onTimePct", channel: "email" },
    { name: "خسارة يوم إنتاج", metric: "dailyProfit", channel: "sms" },
    { name: "نتائج جودة راسبة", metric: "qualityFailCount", channel: "email" },
    { name: "نقص في المخزون", metric: "lowStockCount", channel: "email" },
    { name: "صيانة متأخرة", metric: "equipmentOverdueCount", channel: "email" },
  ];

  const existing = await ctx.db.query("alertRules").take(RULES_MAX);
  let inserted = 0;
  for (const definition of definitions) {
    if (existing.some((rule) => rule.name === definition.name)) continue;
    const defaults = METRIC_DEFAULTS[definition.metric];
    await ctx.db.insert("alertRules", {
      name: definition.name,
      metric: definition.metric,
      comparator: defaults.comparator,
      threshold: defaults.threshold,
      channel: definition.channel,
      recipients,
      windowDays: defaults.windowDays,
      isActive: true,
      createdBy,
    });
    inserted += 1;
  }
  return inserted;
}
