import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireCapability, requireViewer } from "./access";
import {
  assertBranchUnchanged,
  mayUseBranch,
  requireBranchAccess,
  resolveBranchScope,
} from "./branchScope";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import { defaultBranchId } from "./branches";
import { DATE_RE, MAX_ROWS, addDays, mulberry32, r2, utcToday } from "./measures";
import {
  DEMO_SLUMP_TARGET_MM,
  DEMO_SLUMP_TOLERANCE_MM,
  cylinderStrengthFromName,
} from "./pricing";
import { qualityKindValidator, specimenTypeValidator } from "./schema";
import type { QualityKind, QualityResult, SpecimenType } from "./schema";

/**
 * Quality control — cube crushing tests at 7/28 days, slump and core tests.
 *
 * HARDENING v1 — what changed and why
 * -----------------------------------
 * The old version derived the test target from the mix *name*: it took the first
 * number of "C30/37" (30 MPa, which is the **cylinder** strength) and compared it
 * with **cube** results, and it accepted a 7-day cube from 70% of the target — a
 * rule that exists nowhere in the Egyptian code.
 *
 * Now:
 *   - the cube target is `targetCubeMpa`, typed explicitly by the engineer, and
 *     a cube test without one is refused with `TARGET_STRENGTH_MISSING`;
 *   - `specimenType` records what was tested; a cylinder is stored and never
 *     compared against a cube target (owner decision D1);
 *   - early-age cubes are informational: their `result` stays `pending` and they
 *     are never marked pass/fail. The 7-day = 70% rule is gone;
 *   - a slump test needs its own specified value and tolerance — neither is
 *     invented. The authoritative tolerance comes from an approved rule; until
 *     one exists the row is stored as `pending` and labelled indicator-only.
 *
 * Full code-based judging (R-PRE/R-FIN/R-SLUMP/R-CORE) lives in
 * `src/lib/quality/ecp203.ts`; this module stores the result and the verdict.
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
  "targetCubeMpa",
  "specimenType",
  "complianceStatus",
  "complianceDetail",
  "complianceRuleKey",
  "ticketNo",
  "testedBy",
  "notes",
] as const;

type TestRow = Doc<"qualityTests">;

function clean(text?: string) {
  return text?.trim() || undefined;
}

/** Error code mirrored in `src/lib/errors.ts` → BUSINESS_ERRORS.TARGET_STRENGTH_MISSING. */
export const TARGET_STRENGTH_MISSING_CODE = "TARGET_STRENGTH_MISSING";

/**
 * Interim acceptance flag for the legacy `result` field.
 *
 * Cubes are judged only against the explicit `targetCubeMpa`. Early-age cubes
 * and cylinders never get a verdict (always `pending`). A slump is `pending`
 * unless an explicit tolerance is supplied — the app invents no tolerance, and
 * the authoritative value is an approved R-SLUMP parameter.
 */
export function evaluateQuality(
  kind: QualityKind,
  targetValue: number,
  tolerance: number | undefined,
  actualValue: number,
  specimenType: SpecimenType = "cube",
): QualityResult {
  if (!Number.isFinite(actualValue) || actualValue <= 0) return "pending";
  if (kind === "cube7" || kind === "cube3" as QualityKind) return "pending";
  if (kind !== "slump" && specimenType === "cylinder") return "pending";
  if (kind === "slump") {
    if (tolerance === undefined || tolerance <= 0) return "pending";
    return Math.abs(actualValue - targetValue) <= tolerance ? "pass" : "fail";
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
  /** Explicit cube target in MPa, typed by the engineer. */
  targetCubeMpa: v.optional(v.number()),
  specimenType: v.optional(specimenTypeValidator),
  tolerance: v.optional(v.number()),
  ticketNo: v.optional(v.string()),
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
  targetCubeMpa?: number;
  specimenType?: SpecimenType;
  tolerance?: number;
  ticketNo?: string;
  actualValue: number;
  testedBy?: string;
  notes?: string;
};

/**
 * The target a test is compared against, or a hard error.
 *
 * Nothing is derived from the mix name and no default is substituted: an
 * explicit target is required for cubes (and an explicit specified slump for a
 * slump), because a silently invented target is how the old code compared
 * cylinder strengths with cube results.
 */
function resolveTarget(input: TestInput): number {
  const explicit = input.targetValue && input.targetValue > 0 ? input.targetValue : undefined;
  if (input.kind === "slump") {
    if (explicit) return explicit;
    throw new ConvexError({
      code: "VALIDATION_FAILED",
      title: "الركود المحدد مطلوب",
      message:
        "أدخل قيمة الركود المحددة للمشروع (مم) — النظام لا يفترض قيمة من عنده لأن السماحية تُقاس بالنسبة إليها.",
      retryable: false,
    });
  }
  const cubeTarget = input.targetCubeMpa && input.targetCubeMpa > 0 ? input.targetCubeMpa : undefined;
  if (cubeTarget) return cubeTarget;
  if (explicit) return explicit;
  throw new ConvexError({
    code: TARGET_STRENGTH_MISSING_CODE,
    title: "مقاومة المكعب المطلوبة غير محددة",
    message:
      "لا يمكن تقييم نتيجة مقاومة بدون مقاومة مكعب مطلوبة مكتوبة صراحةً. أدخل «مقاومة المكعب المطلوبة» (targetCubeMpa) — لا يُقرأ الهدف من اسم الخلطة لأن الرقم الأول فيه مقاومة أسطوانة.",
    retryable: false,
  });
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
  // Owner decision D1: cubes are the compliance basis. Legacy rows have no
  // specimenType and are treated as cubes, matching what the plant always tested.
  const specimenType: SpecimenType = input.specimenType ?? "cube";
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
    // Stored explicitly so the target shown beside a result is the target the
    // result was judged against, and so a later change to a mix design cannot
    // silently rewrite the history of an old test.
    targetCubeMpa: input.kind === "slump" ? undefined : r2(targetValue),
    specimenType,
    tolerance:
      input.kind === "slump" && input.tolerance && input.tolerance > 0
        ? r2(input.tolerance)
        : undefined,
    actualValue: r2(input.actualValue),
    result: evaluateQuality(input.kind, targetValue, input.tolerance, input.actualValue, specimenType),
    // The verdict is computed by the rule engine (`src/lib/quality/ecp203.ts`)
    // and defaults to indicator-only: no rule is approved out of the box, and
    // the system never guesses a verdict it cannot point at a clause for.
    complianceStatus: "indicator_only",
    complianceRuleKey: undefined,
    ticketNo: clean(input.ticketNo),
    testedBy: clean(input.testedBy),
    notes: clean(input.notes),
  };
}

export const create = mutation({
  args: { branchId: v.optional(v.id("branches")), ...testFields },
  handler: async (ctx, { branchId, ...input }) => {
    const viewer = await requireCapability(ctx, "manageQuality");
    const resolvedBranch = branchId ?? (await defaultBranchId(ctx));
    // Phase 1.4: only a branch assigned to the viewer may be written to.
    await requireBranchAccess(ctx, viewer, resolvedBranch, input.date);
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
    await requireBranchAccess(ctx, viewer, resolvedBranch ?? existing.branchId, input.date ?? existing.date);
    // Only an explicit branch change is refused.
    assertBranchUnchanged(existing.branchId, branchId);
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
    await requireBranchAccess(ctx, viewer, existing.branchId, existing.date);
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
    const viewer = await requireViewer(ctx);
    const days = Math.min(Math.max(Math.round(requestedDays || 90), 7), 365);
    const today =
      requestedToday && DATE_RE.test(requestedToday) ? requestedToday : utcToday();
    const start = addDays(today, -(days - 1));

    const all = await ctx.db
      .query("qualityTests")
      .withIndex("by_date", (q) => q.gte("date", start).lte("date", today))
      .order("desc")
      .take(MAX_ROWS);

    // Phase 1.4: the viewer's assigned branches bound the read as well as the
    // requested filter, using the same pure policy as the write gate.
    const scope = await resolveBranchScope(ctx, viewer);
    const visible = all.filter((row) => mayUseBranch(scope, row.branchId));
    const rows = branchId ? visible.filter((row) => row.branchId === branchId) : visible;

    const cubes28 = rows.filter((row) => row.kind === "cube28");
    const cubes7 = rows.filter((row) => row.kind === "cube7");
    const slumps = rows.filter((row) => row.kind === "slump");

    const cubeTally = tally([...cubes7, ...cubes28]);
    const slumpTally = tally(slumps);

    // "In band" is only counted when the row actually carries a tolerance.
    // The old code substituted an invented 25 mm default here, which reported a
    // pass for rows that had never been compared with anything.
    const inBand = slumps.filter(
      (row) =>
        row.result === "pass" ||
        (typeof row.tolerance === "number" &&
          row.tolerance > 0 &&
          Math.abs(row.actualValue - row.targetValue) <= row.tolerance),
    ).length;
    const slumpsWithoutTolerance = slumps.filter(
      (row) => typeof row.tolerance !== "number" || row.tolerance <= 0,
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
        /**
         * Slump rows with no tolerance on the record. They were counted as "in
         * band" by the old code because it substituted an invented 25 mm value;
         * they are now excluded and reported so the gap is visible.
         */
        slumpsWithoutTolerance,
        slumpsInBand: inBand,
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

      // DEMO SEED ONLY — the rows written here are flagged isTestData and are
      // generated from demo constants, never from the plant's live rules.
      if (step.kind === "slump") {
        targetValue = DEMO_SLUMP_TARGET_MM;
        tolerance = DEMO_SLUMP_TOLERANCE_MM;
        actualValue = Math.round(targetValue + (roll - 0.5) * 52);
      } else {
        targetValue =
          cylinderStrengthFromName(source.mixDesign) ?? DEMO_SLUMP_TARGET_MM;
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
