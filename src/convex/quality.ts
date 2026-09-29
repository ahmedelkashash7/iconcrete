import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireCapability, requireViewer } from "./access";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import { defaultBranchId } from "./branches";
import { DATE_RE, MAX_ROWS, addDays, mulberry32, r2, utcToday } from "./measures";
import { cubeTargetValue } from "./pricing";
import { qualityKindValidator } from "./schema";
import type { QualityKind, QualityResult } from "./schema";

/**
 * Quality control — cube crushing tests and slump tests (ECP 203 / ASTM C94).
 *
 * The acceptance verdict is computed on the server from the approved strength of
 * the mix, so a test cannot be marked «ناجح» from the interface when its reading
 * is below the characteristic strength.
 */

const QUALITY_FIELDS = [
  "date",
  "kind",
  "mixDesign",
  "customer",
  "site",
  "orderRef",
  "sampleRef",
  "labName",
  "targetValue",
  "tolerance",
  "actualValue",
  "result",
  "testedBy",
  "notes",
] as const;

export const DEFAULT_SLUMP_TARGET_MM = 120;
export const DEFAULT_SLUMP_TOLERANCE_MM = 25;

type TestRow = Doc<"qualityTests">;

function clean(text?: string) {
  return text?.trim() || undefined;
}

/** Acceptance rule: a cube must reach its target, a slump must stay in band. */
export function evaluateQuality(
  kind: QualityKind,
  targetValue: number,
  tolerance: number | undefined,
  actualValue: number,
): QualityResult {
  if (!Number.isFinite(actualValue) || actualValue <= 0) return "pending";
  if (kind === "slump") {
    const band = tolerance && tolerance > 0 ? tolerance : DEFAULT_SLUMP_TOLERANCE_MM;
    return Math.abs(actualValue - targetValue) <= band ? "pass" : "fail";
  }
  return actualValue >= targetValue ? "pass" : "fail";
}

const testFields = {
  date: v.string(),
  kind: qualityKindValidator,
  mixDesign: v.string(),
  customer: v.string(),
  site: v.optional(v.string()),
  orderRef: v.optional(v.string()),
  sampleRef: v.optional(v.string()),
  labName: v.optional(v.string()),
  targetValue: v.optional(v.number()),
  tolerance: v.optional(v.number()),
  actualValue: v.number(),
  testedBy: v.optional(v.string()),
  notes: v.optional(v.string()),
};

type TestInput = {
  date: string;
  kind: QualityKind;
  mixDesign: string;
  customer: string;
  site?: string;
  orderRef?: string;
  sampleRef?: string;
  labName?: string;
  targetValue?: number;
  tolerance?: number;
  actualValue: number;
  testedBy?: string;
  notes?: string;
};

/** Fills the target from the approved mix list when the form leaves it blank. */
function resolveTarget(input: TestInput) {
  if (input.targetValue && input.targetValue > 0) return input.targetValue;
  if (input.kind === "slump") return DEFAULT_SLUMP_TARGET_MM;
  return cubeTargetValue(input.mixDesign, input.kind === "cube7" ? "cube7" : "cube28");
}

function buildRecord(input: TestInput, branchId: Id<"branches"> | undefined) {
  if (!DATE_RE.test(input.date)) {
    throw new ConvexError("تاريخ الاختبار غير صالح (المطلوب YYYY-MM-DD)");
  }
  if (!input.mixDesign.trim()) throw new ConvexError("نوع الخلطة مطلوب");
  if (!input.customer.trim()) throw new ConvexError("العميل أو المشروع مطلوب");
  if (!Number.isFinite(input.actualValue) || input.actualValue < 0) {
    throw new ConvexError("قيمة القراءة لا يمكن أن تكون سالبة");
  }

  const targetValue = resolveTarget(input);
  return {
    branchId,
    date: input.date,
    kind: input.kind,
    mixDesign: input.mixDesign.trim(),
    customer: input.customer.trim(),
    site: clean(input.site),
    orderRef: clean(input.orderRef),
    sampleRef: clean(input.sampleRef),
    labName: clean(input.labName),
    targetValue: r2(targetValue),
    tolerance:
      input.kind === "slump"
        ? r2(
            input.tolerance && input.tolerance > 0
              ? input.tolerance
              : DEFAULT_SLUMP_TOLERANCE_MM,
          )
        : undefined,
    actualValue: r2(input.actualValue),
    result: evaluateQuality(input.kind, targetValue, input.tolerance, input.actualValue),
    testedBy: clean(input.testedBy),
    notes: clean(input.notes),
  };
}

export const create = mutation({
  args: { branchId: v.optional(v.id("branches")), ...testFields },
  handler: async (ctx, { branchId, ...input }) => {
    const viewer = await requireCapability(ctx, "manageQuality");
    const resolvedBranch = branchId ?? (await defaultBranchId(ctx));
    const record = {
      ...buildRecord(input, resolvedBranch),
      isTestData: false,
      createdBy: viewer.userId,
    };
    const id = await ctx.db.insert("qualityTests", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "qualityTests",
      entityId: id,
      label: `${record.mixDesign} · ${record.customer}`,
      changes: snapshotRecord(record, "after", QUALITY_FIELDS),
    });
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("qualityTests"), branchId: v.optional(v.id("branches")), ...testFields },
  handler: async (ctx, { id, branchId, ...input }) => {
    const viewer = await requireCapability(ctx, "manageQuality");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("الاختبار لم يعد موجودًا");

    const resolvedBranch = branchId ?? existing.branchId;
    const next = buildRecord(input, resolvedBranch);
    await ctx.db.patch(id, next);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "qualityTests",
      entityId: id,
      label: `${next.mixDesign} · ${next.customer}`,
      changes: diffRecords(existing, { ...existing, ...next }, QUALITY_FIELDS),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("qualityTests") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "manageQuality");
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "qualityTests",
      entityId: id,
      label: `${existing.mixDesign} · ${existing.customer}`,
      changes: snapshotRecord(existing, "before", QUALITY_FIELDS),
    });
    return id;
  },
});

type MixAccumulator = {
  key: string;
  tests: number;
  passed: number;
  failed: number;
  pending: number;
  actualSum: number;
  targetSum: number;
};

function summarizeByMix(rows: TestRow[]) {
  const groups = new Map<string, MixAccumulator>();
  for (const row of rows) {
    if (row.kind === "slump") continue;
    const group =
      groups.get(row.mixDesign) ??
      {
        key: row.mixDesign,
        tests: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        actualSum: 0,
        targetSum: 0,
      };
    group.tests += 1;
    if (row.result === "pass") group.passed += 1;
    else if (row.result === "fail") group.failed += 1;
    else group.pending += 1;
    group.actualSum += row.actualValue;
    group.targetSum += row.targetValue;
    groups.set(row.mixDesign, group);
  }
  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      tests: group.tests,
      passed: group.passed,
      failed: group.failed,
      pending: group.pending,
      avgActual: group.tests > 0 ? r2(group.actualSum / group.tests) : 0,
      avgTarget: group.tests > 0 ? r2(group.targetSum / group.tests) : 0,
      ratio: group.targetSum > 0 ? r2((group.actualSum / group.targetSum) * 100) : 0,
    }))
    .sort((a, b) => b.tests - a.tests);
}

function tally(rows: TestRow[]) {
  return {
    tests: rows.length,
    passed: rows.filter((row) => row.result === "pass").length,
    failed: rows.filter((row) => row.result === "fail").length,
    pending: rows.filter((row) => row.result === "pending").length,
  };
}

function averageOf(rows: TestRow[], pick: (row: TestRow) => number) {
  return rows.length > 0
    ? r2(rows.reduce((sum, row) => sum + pick(row), 0) / rows.length)
    : 0;
}

/**
 * Quality feed for the compliance screen: pass rates, strength against target
 * and the failing samples that need an action.
 */
export const overview = query({
  args: {
    days: v.number(),
    today: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, { days: requestedDays, today: requestedToday, branchId }) => {
    await requireViewer(ctx);
    const days = Math.min(Math.max(Math.round(requestedDays || 90), 7), 365);
    const today =
      requestedToday && DATE_RE.test(requestedToday) ? requestedToday : utcToday();
    const start = addDays(today, -(days - 1));

    const all = await ctx.db
      .query("qualityTests")
      .withIndex("by_date", (q) => q.gte("date", start).lte("date", today))
      .order("desc")
      .take(MAX_ROWS);

    const rows = branchId ? all.filter((row) => row.branchId === branchId) : all;

    const cubes28 = rows.filter((row) => row.kind === "cube28");
    const cubes7 = rows.filter((row) => row.kind === "cube7");
    const slumps = rows.filter((row) => row.kind === "slump");

    const cubeTally = tally([...cubes7, ...cubes28]);
    const slumpTally = tally(slumps);

    const inBand = slumps.filter(
      (row) =>
        row.result === "pass" ||
        Math.abs(row.actualValue - row.targetValue) <=
          (row.tolerance ?? DEFAULT_SLUMP_TOLERANCE_MM),
    ).length;

    const trendMap = new Map<string, { actual: number; target: number; count: number }>();
    for (const row of cubes28) {
      const bucket = trendMap.get(row.date) ?? { actual: 0, target: 0, count: 0 };
      bucket.actual += row.actualValue;
      bucket.target += row.targetValue;
      bucket.count += 1;
      trendMap.set(row.date, bucket);
    }
    const trend = [...trendMap.entries()]
      .map(([date, bucket]) => ({
        date,
        avgActual: r2(bucket.actual / bucket.count),
        avgTarget: r2(bucket.target / bucket.count),
        ratio: bucket.target > 0 ? r2((bucket.actual / bucket.target) * 100) : 0,
        tests: bucket.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const avg28Actual = averageOf(cubes28, (row) => row.actualValue);
    const avg28Target = averageOf(cubes28, (row) => row.targetValue);

    return {
      range: { days, start, end: today },
      branchId: branchId ?? null,
      totals: {
        tests: rows.length,
        cubes7: cubes7.length,
        cubes28: cubes28.length,
        slumps: slumps.length,
        passed: cubeTally.passed + slumpTally.passed,
        failed: cubeTally.failed + slumpTally.failed,
        pending: cubeTally.pending + slumpTally.pending,
        passRate:
          cubeTally.passed + cubeTally.failed > 0
            ? r2((cubeTally.passed / (cubeTally.passed + cubeTally.failed)) * 100)
            : 0,
        slumpPassRate:
          slumpTally.passed + slumpTally.failed > 0
            ? r2((slumpTally.passed / (slumpTally.passed + slumpTally.failed)) * 100)
            : 0,
      },
      cubes: {
        ...cubeTally,
        avg28Actual,
        avg28Target,
        strengthRatio:
          avg28Target > 0 ? r2((avg28Actual / avg28Target) * 100) : 0,
        min28:
          cubes28.length > 0
            ? r2(Math.min(...cubes28.map((row) => row.actualValue)))
            : 0,
        avg7: averageOf(cubes7, (row) => row.actualValue),
      },
      slumps: {
        ...slumpTally,
        avgActual: averageOf(slumps, (row) => row.actualValue),
        avgTarget: averageOf(slumps, (row) => row.targetValue),
        inBandPct: slumps.length > 0 ? r2((inBand / slumps.length) * 100) : 0,
      },
      byMix: summarizeByMix(rows),
      trend,
      failures: rows.filter((row) => row.result === "fail").slice(0, 12),
      recent: rows.slice(0, 40),
      hasData: rows.length > 0,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Demo samples (Test_Data_Flag = true)                               */
/* ------------------------------------------------------------------ */

export type SampleSource = {
  date: string;
  mixDesign: string;
  customer: string;
  site?: string;
  orderRef?: string;
};

/**
 * Samples quality tests out of the demo pours: 28-day cubes land on the pour
 * date + 28 days, 7-day cubes on +7 days, slumps on the day of the pour.
 * Samples whose result would still be in the future are skipped, exactly like
 * the real laboratory queue.
 */
export async function seedQualityTests(
  ctx: MutationCtx,
  branchId: Id<"branches"> | undefined,
  sources: SampleSource[],
  today: string,
  seed: number,
): Promise<number> {
  const random = mulberry32(seed);
  let inserted = 0;

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const plan: Array<{ kind: QualityKind; ageDays: number }> = [];
    if (index % 3 === 0) plan.push({ kind: "cube28", ageDays: 28 });
    if (index % 5 === 0) plan.push({ kind: "cube7", ageDays: 7 });
    if (index % 4 === 1) plan.push({ kind: "slump", ageDays: 0 });

    for (const step of plan) {
      const testDate = addDays(source.date, step.ageDays);
      if (testDate > today) continue;
      const roll = random();

      let targetValue: number;
      let tolerance: number | undefined;
      let actualValue: number;
      let labName = "معمل المحطة";
      let notes: string | undefined;

      if (step.kind === "slump") {
        targetValue = DEFAULT_SLUMP_TARGET_MM;
        tolerance = DEFAULT_SLUMP_TOLERANCE_MM;
        actualValue = Math.round(targetValue + (roll - 0.5) * 52);
      } else {
        targetValue = cubeTargetValue(
          source.mixDesign,
          step.kind === "cube7" ? "cube7" : "cube28",
        );
        const factor =
          step.kind === "cube7" ? 1.1 + (roll - 0.5) * 0.26 : 1.07 + (roll - 0.5) * 0.18;
        actualValue = Math.round(targetValue * factor * 2) / 2;
        if (step.kind === "cube28" && actualValue < targetValue) {
          notes = "نتيجة أقل من المقاومة المميزة — يلزم فحص الجذع أو إعادة التصميم";
          labName = "المعمل المركزي المعتمد";
        }
      }

      await ctx.db.insert("qualityTests", {
        branchId,
        date: testDate,
        kind: step.kind,
        mixDesign: source.mixDesign,
        customer: source.customer,
        site: source.site,
        orderRef: source.orderRef,
        sampleRef: `QT-${testDate.replace(/-/g, "").slice(2)}-${(index + 1)
          .toString()
          .padStart(3, "0")}`,
        labName,
        targetValue: r2(targetValue),
        tolerance,
        actualValue: r2(actualValue),
        result: evaluateQuality(step.kind, targetValue, tolerance, actualValue),
        testedBy: "فني الجودة",
        notes,
        isTestData: true,
      });
      inserted += 1;
    }
  }
  return inserted;
}
