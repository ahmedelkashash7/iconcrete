import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireCapability, requireViewer } from "./access";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import { defaultBranchId } from "./branches";
import {
  DATE_RE,
  MAX_ROWS,
  addDays,
  mulberry32,
  r2,
  utcToday,
  weekdayIndex,
} from "./measures";
import { equipmentKindValidator, meterUnitValidator } from "./schema";
import type { EquipmentKind, MeterUnit } from "./schema";

/**
 * Planning & forecasting.
 *
 * There is no opaque black box here: the demand model is an explicit,
 * reproducible decomposition of the plant's own ledger
 *
 *    prediction = (trend line of the deseasonalised series) × weekday factor
 *
 * and it reports its own backtested error, so the owner can see how much the
 * number can be trusted before ordering cement against it.
 */

const EQUIPMENT_FIELDS = [
  "code",
  "name",
  "kind",
  "meterUnit",
  "meterReading",
  "lastServiceMeter",
  "serviceInterval",
  "serviceIntervalDays",
  "lastServiceDate",
  "avgDailyUsage",
  "isActive",
  "notes",
] as const;

const EQUIPMENT_MAX = 300;
const HORIZON_MAX = 60;
const HISTORY_MAX = 365;
const HOLDOUT_DAYS = 14;
const WEEKDAYS = 7;

function clean(text?: string) {
  return text?.trim() || undefined;
}

/* ------------------------------------------------------------------ */
/* Demand model                                                        */
/* ------------------------------------------------------------------ */

type LinearFit = { intercept: number; slope: number; residualStd: number };

function linearFit(values: number[]): LinearFit {
  const n = values.length;
  if (n === 0) return { intercept: 0, slope: 0, residualStd: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = (sumY - slope * sumX) / n;
  let errorSum = 0;
  for (let i = 0; i < n; i += 1) {
    const error = values[i] - (intercept + slope * i);
    errorSum += error * error;
  }
  return { intercept, slope, residualStd: Math.sqrt(errorSum / n) };
}

/** Average demand for each weekday divided by the overall average. */
function weekdayFactors(series: number[], startIso: string): number[] {
  const overall = series.reduce((sum, value) => sum + value, 0) / Math.max(1, series.length);
  const totals = Array.from({ length: WEEKDAYS }, () => 0);
  const counts = Array.from({ length: WEEKDAYS }, () => 0);
  series.forEach((value, index) => {
    const day = weekdayIndex(addDays(startIso, index));
    totals[day] += value;
    counts[day] += 1;
  });
  const raw = totals.map((total, day) => {
    if (counts[day] === 0 || overall <= 0) return 1;
    return total / counts[day] / overall;
  });
  const average = raw.reduce((sum, value) => sum + value, 0) / WEEKDAYS;
  if (average <= 0) return Array.from({ length: WEEKDAYS }, () => 1);
  return raw.map((value) => Math.min(1.6, Math.max(0.4, value / average)));
}

type Model = {
  fit: LinearFit;
  factors: number[];
  seriesLength: number;
  startIso: string;
};

function trainModel(series: number[], startIso: string): Model {
  const factors = weekdayFactors(series, startIso);
  const deseasonalised = series.map((value, index) => {
    const factor = factors[weekdayIndex(addDays(startIso, index))];
    return factor > 0 ? value / factor : value;
  });
  return {
    fit: linearFit(deseasonalised),
    factors,
    seriesLength: series.length,
    startIso,
  };
}

function predictAt(model: Model, step: number): number {
  const index = model.seriesLength - 1 + step;
  const base = model.fit.intercept + model.fit.slope * index;
  const factor = model.factors[weekdayIndex(addDays(model.startIso, index))];
  return Math.max(0, base * factor);
}

export const demand = query({
  args: {
    historyDays: v.optional(v.number()),
    horizon: v.optional(v.number()),
    today: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    capacityM3Day: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { historyDays, horizon: requestedHorizon, today: requestedToday, branchId, capacityM3Day },
  ) => {
    await requireViewer(ctx);
    const days = Math.min(Math.max(Math.round(historyDays || 90), 30), HISTORY_MAX);
    const horizon = Math.min(Math.max(Math.round(requestedHorizon || 14), 1), HORIZON_MAX);
    const today =
      requestedToday && DATE_RE.test(requestedToday) ? requestedToday : utcToday();
    const start = addDays(today, -(days - 1));

    const logs = await ctx.db
      .query("productionLogs")
      .withIndex("by_date", (q) => q.gte("date", start).lte("date", today))
      .take(MAX_ROWS);

    const filtered = branchId ? logs.filter((log) => log.branchId === branchId) : logs;

    const deliveredByDate = new Map<string, number>();
    const mixTotals = new Map<string, number>();
    for (const log of filtered) {
      if (log.status === "cancelled") continue;
      deliveredByDate.set(log.date, (deliveredByDate.get(log.date) ?? 0) + log.deliveredM3);
      mixTotals.set(
        log.mixDesign,
        (mixTotals.get(log.mixDesign) ?? 0) + log.deliveredM3,
      );
    }

    const series: number[] = [];
    const history: Array<{ date: string; actual: number }> = [];
    for (let cursor = start; cursor <= today; cursor = addDays(cursor, 1)) {
      const value = r2(deliveredByDate.get(cursor) ?? 0);
      series.push(value);
      history.push({ date: cursor, actual: value });
    }

    const totalM3 = r2(series.reduce((sum, value) => sum + value, 0));
    const activeDays = series.filter((value) => value > 0).length;

    if (activeDays < 5) {
      return {
        range: { days, start, end: today },
        hasData: false,
        history,
        forecast: [],
        byMix: [],
        method: "تُبنى التوقعات بعد تسجيل بيانات كافية (٥ أيام إنتاج على الأقل).",
        accuracy: null,
        totals: null,
        capacity: null,
        insight: "سجّل إنتاج عدة أيام أولًا ليصبح التنبؤ ذا معنى.",
      };
    }

    const model = trainModel(series, start);
    const trainLength = Math.max(14, series.length - HOLDOUT_DAYS);
    const holdout = series.slice(trainLength);
    const backtestModel = trainModel(series.slice(0, trainLength), start);
    let absoluteError = 0;
    let percentError = 0;
    let counted = 0;
    if (holdout.length >= 5) {
      holdout.forEach((actual, index) => {
        const predicted = predictAt(backtestModel, index + 1);
        absoluteError += Math.abs(actual - predicted);
        if (actual > 0) {
          percentError += Math.abs(actual - predicted) / actual;
          counted += 1;
        }
      });
    }
    const accuracy =
      holdout.length >= 5
        ? {
            mae: r2(absoluteError / holdout.length),
            mape: counted > 0 ? r2((percentError / counted) * 100) : null,
            holdoutDays: holdout.length,
            trainDays: trainLength,
          }
        : null;

    const band = 1.28 * model.fit.residualStd;

    const forecast: Array<{
      date: string;
      predicted: number;
      low: number;
      high: number;
    }> = [];
    for (let step = 1; step <= horizon; step += 1) {
      const date = addDays(today, step);
      const predicted = r2(predictAt(model, step));
      const factor = model.factors[weekdayIndex(date)];
      forecast.push({
        date,
        predicted,
        low: r2(Math.max(0, predicted - band * factor)),
        high: r2(predicted + band * factor),
      });
    }

    const forecastTotal = r2(forecast.reduce((sum, day) => sum + day.predicted, 0));
    const peak = forecast.reduce(
      (best, day) => (day.predicted > best.predicted ? day : best),
      forecast[0],
    );
    const capacity = capacityM3Day && capacityM3Day > 0 ? capacityM3Day : null;

    const byMix = [...mixTotals.entries()]
      .map(([key, m3]) => ({
        key,
        sharePct: totalM3 > 0 ? r2((m3 / totalM3) * 100) : 0,
        expectedM3: totalM3 > 0 ? r2((m3 / totalM3) * forecastTotal) : 0,
      }))
      .sort((a, b) => b.expectedM3 - a.expectedM3);

    const trendPerDay = model.fit.slope;
    const insight =
      trendPerDay > 1.5
        ? "الاتجاه العام صاعد: الطلب المتوقع أعلى من الفترة الماضية، راجع أرصدة الأسمنت قبل التنفيذ."
        : trendPerDay < -1.5
          ? "الاتجاه العام هابط: خفّف أوامر التوريد وركّز على العملاء الأعلى ربحية."
          : "الطلب مستقر حول متوسطه المعتاد مع فروق أسبوعية واضحة.";

    return {
      range: { days, start, end: today },
      hasData: true,
      method:
        "فصل الموسمية الأسبوعية عن السلسلة، ثم ملاءمة اتجاه خطي على القيم المنزوعة الموسمية، وضرب الناتج في معامل يوم الأسبوع.",
      history,
      forecast,
      byMix,
      accuracy,
      totals: {
        historyTotalM3: totalM3,
        historyAvgM3: r2(totalM3 / days),
        activeDays,
        forecastTotalM3: forecastTotal,
        forecastAvgM3: r2(forecastTotal / horizon),
        peakDate: peak?.date ?? null,
        peakM3: peak?.predicted ?? 0,
        trendPerDay: r2(trendPerDay),
        trendPer30Days: r2(trendPerDay * 30),
      },
      capacity: capacity
        ? {
            capacityM3Day: capacity,
            utilisationPct: r2(((forecastTotal / horizon) / capacity) * 100),
            daysAbove80Pct: forecast.filter((day) => day.predicted > capacity * 0.8).length,
          }
        : null,
      insight,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Equipment & preventive maintenance                                  */
/* ------------------------------------------------------------------ */

export type MaintenanceStatus = "overdue" | "due_soon" | "scheduled" | "ok";

const DUE_SOON_DAYS = 7;
const SCHEDULED_DAYS = 30;

export const maintenance = query({
  args: {
    today: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, { today: requestedToday, branchId }) => {
    await requireViewer(ctx);
    const today =
      requestedToday && DATE_RE.test(requestedToday) ? requestedToday : utcToday();

    const rows = (await ctx.db.query("equipment").take(EQUIPMENT_MAX)).filter(
      (row) => row.isActive && (!branchId || !row.branchId || row.branchId === branchId),
    );

    const fleet = rows
      .map((row) => {
        const usedSinceService = r2(row.meterReading - row.lastServiceMeter);
        const remainingMeter = r2(row.serviceInterval - usedSinceService);
        const meterPct =
          row.serviceInterval > 0
            ? r2((usedSinceService / row.serviceInterval) * 100)
            : 0;
        const daysByMeter =
          row.avgDailyUsage > 0
            ? r2(remainingMeter / row.avgDailyUsage)
            : null;

        const dateDue =
          row.serviceIntervalDays && row.lastServiceDate
            ? addDays(row.lastServiceDate, row.serviceIntervalDays)
            : null;
        const daysByDate = dateDue
          ? Math.round(
              (Date.parse(`${dateDue}T00:00:00Z`) -
                Date.parse(`${today}T00:00:00Z`)) /
                86_400_000,
            )
          : null;

        const candidates = [daysByMeter, daysByDate].filter(
          (value): value is number => value !== null,
        );
        const remainingDays =
          candidates.length > 0 ? Math.min(...candidates) : null;

        const status: MaintenanceStatus =
          remainingDays === null
            ? "ok"
            : remainingDays < 0
              ? "overdue"
              : remainingDays <= DUE_SOON_DAYS
                ? "due_soon"
                : remainingDays <= SCHEDULED_DAYS
                  ? "scheduled"
                  : "ok";

        return {
          _id: row._id,
          code: row.code,
          name: row.name,
          kind: row.kind,
          meterUnit: row.meterUnit,
          meterReading: row.meterReading,
          lastServiceMeter: row.lastServiceMeter,
          serviceInterval: row.serviceInterval,
          serviceIntervalDays: row.serviceIntervalDays ?? null,
          lastServiceDate: row.lastServiceDate ?? null,
          avgDailyUsage: row.avgDailyUsage,
          notes: row.notes ?? null,
          usedSinceService,
          remainingMeter,
          meterPct,
          remainingDays,
          dateDue,
          status,
        };
      })
      .sort((a, b) => {
        const order: Record<MaintenanceStatus, number> = {
          overdue: 0,
          due_soon: 1,
          scheduled: 2,
          ok: 3,
        };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (a.remainingDays ?? 9_999) - (b.remainingDays ?? 9_999);
      });

    return {
      today,
      fleet,
      totals: {
        equipment: fleet.length,
        overdue: fleet.filter((row) => row.status === "overdue").length,
        dueSoon: fleet.filter((row) => row.status === "due_soon").length,
        scheduled: fleet.filter((row) => row.status === "scheduled").length,
        ok: fleet.filter((row) => row.status === "ok").length,
        avgAvailabilityPct:
          fleet.length > 0
            ? r2(
                (fleet.filter((row) => row.status !== "overdue").length / fleet.length) * 100,
              )
            : 0,
      },
      hasData: fleet.length > 0,
    };
  },
});

const equipmentFields = {
  code: v.string(),
  name: v.string(),
  kind: equipmentKindValidator,
  meterUnit: meterUnitValidator,
  meterReading: v.number(),
  lastServiceMeter: v.number(),
  serviceInterval: v.number(),
  serviceIntervalDays: v.optional(v.number()),
  lastServiceDate: v.optional(v.string()),
  avgDailyUsage: v.number(),
  isActive: v.boolean(),
  notes: v.optional(v.string()),
};

function validateEquipment(fields: {
  code: string;
  name: string;
  meterReading: number;
  lastServiceMeter: number;
  serviceInterval: number;
  avgDailyUsage: number;
  lastServiceDate?: string;
}) {
  if (!fields.code.trim()) throw new ConvexError("كود المعدة مطلوب");
  if (!fields.name.trim()) throw new ConvexError("اسم المعدة مطلوب");
  if (!Number.isFinite(fields.meterReading) || fields.meterReading < 0) {
    throw new ConvexError("قراءة العداد لا يمكن أن تكون سالبة");
  }
  if (fields.lastServiceMeter < 0) {
    throw new ConvexError("قراءة آخر صيانة لا يمكن أن تكون سالبة");
  }
  if (fields.lastServiceMeter > fields.meterReading) {
    throw new ConvexError("قراءة آخر صيانة لا يمكن أن تتجاوز قراءة العداد الحالية");
  }
  if (!Number.isFinite(fields.serviceInterval) || fields.serviceInterval <= 0) {
    throw new ConvexError("الفترة بين الصيانات يجب أن تكون أكبر من صفر");
  }
  if (fields.avgDailyUsage < 0) {
    throw new ConvexError("متوسط الاستهلاك اليومي لا يمكن أن يكون سالبًا");
  }
  if (fields.lastServiceDate && !DATE_RE.test(fields.lastServiceDate)) {
    throw new ConvexError("تاريخ آخر صيانة غير صالح");
  }
}

export const createEquipment = mutation({
  args: { branchId: v.optional(v.id("branches")), ...equipmentFields },
  handler: async (ctx, { branchId, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    validateEquipment(fields);

    const rows = await ctx.db.query("equipment").take(EQUIPMENT_MAX);
    const code = fields.code.trim().toUpperCase();
    if (rows.some((row) => row.code.toUpperCase() === code)) {
      throw new ConvexError(`كود المعدة «${code}» مستخدم بالفعل`);
    }

    const record = {
      branchId: branchId ?? (await defaultBranchId(ctx)),
      code,
      name: fields.name.trim(),
      kind: fields.kind as EquipmentKind,
      meterUnit: fields.meterUnit as MeterUnit,
      meterReading: fields.meterReading,
      lastServiceMeter: fields.lastServiceMeter,
      serviceInterval: fields.serviceInterval,
      serviceIntervalDays: fields.serviceIntervalDays,
      lastServiceDate: clean(fields.lastServiceDate),
      avgDailyUsage: fields.avgDailyUsage,
      isActive: fields.isActive,
      notes: clean(fields.notes),
      updatedAt: Date.now(),
    };
    const id = await ctx.db.insert("equipment", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "equipment",
      entityId: id,
      label: `${record.code} · ${record.name}`,
      changes: snapshotRecord(record, "after", EQUIPMENT_FIELDS),
    });
    return id;
  },
});

export const updateEquipment = mutation({
  args: { id: v.id("equipment"), ...equipmentFields },
  handler: async (ctx, { id, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("المعدة لم تعد موجودة");
    validateEquipment(fields);

    const next = {
      code: fields.code.trim().toUpperCase(),
      name: fields.name.trim(),
      kind: fields.kind as EquipmentKind,
      meterUnit: fields.meterUnit as MeterUnit,
      meterReading: fields.meterReading,
      lastServiceMeter: fields.lastServiceMeter,
      serviceInterval: fields.serviceInterval,
      serviceIntervalDays: fields.serviceIntervalDays,
      lastServiceDate: clean(fields.lastServiceDate),
      avgDailyUsage: fields.avgDailyUsage,
      isActive: fields.isActive,
      notes: clean(fields.notes),
      updatedAt: Date.now(),
    };
    await ctx.db.patch(id, next);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "equipment",
      entityId: id,
      label: `${next.code} · ${next.name}`,
      changes: diffRecords(existing, { ...existing, ...next }, EQUIPMENT_FIELDS),
    });
    return id;
  },
});

/** Records the workshop visit: the meter resets to today's reading. */
export const logService = mutation({
  args: {
    id: v.id("equipment"),
    date: v.string(),
    meterReading: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { id, date, meterReading, note }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("المعدة لم تعد موجودة");
    if (!DATE_RE.test(date)) throw new ConvexError("تاريخ الصيانة غير صالح");

    const reading = meterReading ?? existing.meterReading;
    if (!Number.isFinite(reading) || reading < existing.lastServiceMeter) {
      throw new ConvexError("قراءة العداد عند الصيانة لا يمكن أن تقل عن آخر قراءة مسجّلة");
    }

    const next = {
      meterReading: reading,
      lastServiceMeter: reading,
      lastServiceDate: date,
      notes: clean(note) ?? existing.notes,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(id, next);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "equipment",
      entityId: id,
      label: `${existing.code} · صيانة منفّذة`,
      changes: [
        { field: "lastServiceMeter", before: String(existing.lastServiceMeter), after: String(reading) },
        { field: "lastServiceDate", before: existing.lastServiceDate ?? "", after: date },
      ],
    });
    return id;
  },
});

/** Daily meter reading, which keeps the maintenance forecast honest. */
export const recordMeter = mutation({
  args: { id: v.id("equipment"), reading: v.number(), avgDailyUsage: v.optional(v.number()) },
  handler: async (ctx, { id, reading, avgDailyUsage }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("المعدة لم تعد موجودة");
    if (!Number.isFinite(reading) || reading < existing.meterReading) {
      throw new ConvexError("قراءة العداد لا يمكن أن تقل عن القراءة المسجّلة");
    }
    if (avgDailyUsage !== undefined && avgDailyUsage < 0) {
      throw new ConvexError("متوسط الاستخدام اليومي لا يمكن أن يكون سالبًا");
    }

    const delta = reading - existing.meterReading;
    await ctx.db.patch(id, {
      meterReading: reading,
      avgDailyUsage: avgDailyUsage ?? existing.avgDailyUsage,
      updatedAt: Date.now(),
    });
    if (delta > 0) {
      await recordAudit(ctx, {
        actorId: viewer.userId,
        action: "update",
        entity: "equipment",
        entityId: id,
        label: `${existing.code} · قراءة عداد`,
        changes: [
          {
            field: "meterReading",
            before: String(existing.meterReading),
            after: String(reading),
          },
        ],
      });
    }
    return id;
  },
});

export const removeEquipment = mutation({
  args: { id: v.id("equipment") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "manageSettings");
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "equipment",
      entityId: id,
      label: `${existing.code} · ${existing.name}`,
      changes: snapshotRecord(existing, "before", EQUIPMENT_FIELDS),
    });
    return id;
  },
});

/* ------------------------------------------------------------------ */
/* Demo fleet (Test_Data_Flag style seed)                              */
/* ------------------------------------------------------------------ */

type FleetSpec = {
  code: string;
  name: string;
  kind: EquipmentKind;
  meterUnit: MeterUnit;
  reading: number;
  lastServiceMeter: number;
  interval: number;
  intervalDays?: number;
  lastServiceAgoDays?: number;
  avgDaily: number;
  notes?: string;
};

const FLEET: FleetSpec[] = [
  {
    code: "MX-01",
    name: "خلاطة مركزية ١",
    kind: "mixer",
    meterUnit: "hours",
    reading: 12_480,
    lastServiceMeter: 11_950,
    interval: 500,
    intervalDays: 30,
    lastServiceAgoDays: 22,
    avgDaily: 11,
    notes: "تجاوزت موعد الصيانة — جدولة عاجلة قبل أي ذروة إنتاج.",
  },
  {
    code: "MX-02",
    name: "خلاطة مركزية ٢",
    kind: "mixer",
    meterUnit: "hours",
    reading: 8_700,
    lastServiceMeter: 8_400,
    interval: 600,
    intervalDays: 30,
    lastServiceAgoDays: 26,
    avgDaily: 9,
  },
  {
    code: "TR-01",
    name: "عربة خلاط ١",
    kind: "truck",
    meterUnit: "km",
    reading: 182_400,
    lastServiceMeter: 170_000,
    interval: 15_000,
    intervalDays: 60,
    lastServiceAgoDays: 54,
    avgDaily: 180,
  },
  {
    code: "TR-02",
    name: "عربة خلاط ٢",
    kind: "truck",
    meterUnit: "km",
    reading: 168_900,
    lastServiceMeter: 168_000,
    interval: 15_000,
    intervalDays: 60,
    lastServiceAgoDays: 58,
    avgDaily: 200,
  },
  {
    code: "TR-03",
    name: "عربة خلاط ٣",
    kind: "truck",
    meterUnit: "km",
    reading: 214_320,
    lastServiceMeter: 202_500,
    interval: 15_000,
    intervalDays: 60,
    lastServiceAgoDays: 12,
    avgDaily: 165,
    notes: "استهلاك الوقود أعلى من المتوسط — يُراجع مع ضبط المحرك.",
  },
  {
    code: "TR-04",
    name: "عربة خلاط ٤",
    kind: "truck",
    meterUnit: "km",
    reading: 96_500,
    lastServiceMeter: 84_000,
    interval: 15_000,
    intervalDays: 60,
    lastServiceAgoDays: 20,
    avgDaily: 150,
  },
  {
    code: "TR-05",
    name: "عربة خلاط ٥",
    kind: "truck",
    meterUnit: "km",
    reading: 143_700,
    lastServiceMeter: 141_000,
    interval: 15_000,
    intervalDays: 60,
    lastServiceAgoDays: 45,
    avgDaily: 130,
  },
  {
    code: "TR-06",
    name: "عربة خلاط ٦",
    kind: "truck",
    meterUnit: "km",
    reading: 88_100,
    lastServiceMeter: 74_500,
    interval: 15_000,
    intervalDays: 60,
    lastServiceAgoDays: 8,
    avgDaily: 175,
  },
  {
    code: "PM-01",
    name: "مضخة خرسانة ٣٦ م",
    kind: "pump",
    meterUnit: "hours",
    reading: 6_180,
    lastServiceMeter: 5_940,
    interval: 250,
    intervalDays: 45,
    lastServiceAgoDays: 42,
    avgDaily: 5,
  },
  {
    code: "LD-01",
    name: "لودر ركام",
    kind: "loader",
    meterUnit: "hours",
    reading: 14_260,
    lastServiceMeter: 13_900,
    interval: 500,
    intervalDays: 60,
    lastServiceAgoDays: 30,
    avgDaily: 8,
  },
  {
    code: "GN-01",
    name: "مولد كهربائي احتياطي",
    kind: "generator",
    meterUnit: "hours",
    reading: 3_120,
    lastServiceMeter: 2_940,
    interval: 250,
    intervalDays: 90,
    lastServiceAgoDays: 95,
    avgDaily: 1.5,
    notes: "تجاوزت فترة الصيانة الزمنية (٩٠ يومًا) — فحص الزيت والفلاتر.",
  },
];

export async function seedEquipment(
  ctx: MutationCtx,
  branchId: Id<"branches"> | undefined,
  today: string,
  seed: number,
): Promise<number> {
  const random = mulberry32(seed);
  const existing = await ctx.db.query("equipment").take(EQUIPMENT_MAX);
  let inserted = 0;
  for (const spec of FLEET) {
    if (existing.some((row) => row.code === spec.code)) continue;
    await ctx.db.insert("equipment", {
      branchId,
      code: spec.code,
      name: spec.name,
      kind: spec.kind,
      meterUnit: spec.meterUnit,
      meterReading: spec.reading,
      lastServiceMeter: spec.lastServiceMeter,
      serviceInterval: spec.interval,
      serviceIntervalDays: spec.intervalDays,
      lastServiceDate:
        spec.lastServiceAgoDays !== undefined
          ? addDays(today, -spec.lastServiceAgoDays)
          : undefined,
      avgDailyUsage: spec.avgDaily,
      isActive: true,
      notes: spec.notes,
      updatedAt: Date.now() - Math.round(random() * 86_400_000),
    });
    inserted += 1;
  }
  return inserted;
}
