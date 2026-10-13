/**
 * IConcrete System — sampling plan and specimen scheduler (ECP 203-2007, 8-9-3).
 *
 * The plan in the owner's OCR text is a fragmentary table (confidence: medium),
 * so like every other code-derived rule it ships as a **draft** and the numbers
 * are read from the rule fixture — never hard-coded here. Until the engineer
 * confirms it, the scheduler still produces dates but every screen labels the
 * plan «غير مُتحقق منه».
 *
 * Extracted rule as supplied:
 *   - per concrete grade and per structural element type;
 *   - 6 cubes for the first 50 m³, then 6 cubes for each additional 100 m³
 *     poured on the same day;
 *   - half tested at 7 days, half at 28 days;
 *   - 56/90-day tests only if the consultant requires;
 *   - ready-mix: sample from the middle of the truck or after discharging 15%
 *     of the load.
 */

import type { QualityRule } from "./ecp203";

export type SamplingPlan = {
  /** Number of 6-cube sample groups for the pour. */
  batches: number;
  cubesPerBatch: number;
  totalCubes: number;
  cubesAt7Days: number;
  cubesAt28Days: number;
  /** Arabic explanation listing the volumes actually used. */
  explanation: string;
  /** True when the plan could not be computed from the rule (indicator only). */
  incomplete: boolean;
};

/** Signed ISO-day arithmetic (no Date objects, no timezone surprises). */
export function addDaysISO(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`sampling: تاريخ غير صالح: ${date}`);
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const shifted = new Date(utc + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Computes the number of cubes required for one day's pour of one grade and one
 * element type. `volumeM3` is the volume poured that day.
 */
export function planSampling(volumeM3: number, rule: QualityRule): SamplingPlan {
  const first = rule.params.firstBatchVolumeM3?.value ?? null;
  const per = rule.params.perBatchVolumeM3?.value ?? null;
  const perBatch = rule.params.cubesPerBatch?.value ?? null;
  const at7Pct = rule.params.percentSampledAt7Days?.value ?? null;

  if (first === null || per === null || perBatch === null || at7Pct === null || per <= 0) {
    return {
      batches: 0,
      cubesPerBatch: 0,
      totalCubes: 0,
      cubesAt7Days: 0,
      cubesAt28Days: 0,
      explanation: "خطة أخذ العينات غير مكتملة في القاعدة — لا يمكن جدولة العينات.",
      incomplete: true,
    };
  }

  const volume = Math.max(0, volumeM3);
  const batches = volume <= first ? 1 : 1 + Math.ceil((volume - first) / per);
  const cubesPerBatchCount = Math.round(perBatch);
  const totalCubes = batches * cubesPerBatchCount;
  const cubesAt7Days = Math.round((totalCubes * at7Pct) / 100);
  const cubesAt28Days = totalCubes - cubesAt7Days;
  const extra = batches > 1 ? ` ثم ${batches - 1} دفعة إضافية لكل ${per} m³` : "";

  return {
    batches,
    cubesPerBatch: cubesPerBatchCount,
    totalCubes,
    cubesAt7Days,
    cubesAt28Days,
    explanation: `${totalCubes} مكعب (${batches} × ${cubesPerBatchCount}) لأول ${first} m³${extra}: ${cubesAt7Days} عند ٧ أيام و${cubesAt28Days} عند ٢٨ يومًا.`,
    incomplete: false,
  };
}

export type SpecimenDue = {
  ageDays: number;
  dueDate: string;
  count: number;
  /** `7d`/`28d` are the code's own ages; `long_term` needs a consultant request. */
  purpose: "7d" | "28d" | "long_term";
  /** True when the test date is in the past relative to `today`. */
  overdue: boolean;
};

/**
 * Builds the list of due dates for a pour. `includeLongTerm` must be set only
 * when the project consultant asked for 56/90-day tests — the code does not
 * require them.
 */
export function scheduleSpecimens(options: {
  castDate: string;
  plan: SamplingPlan;
  today: string;
  includeLongTerm?: boolean;
}): SpecimenDue[] {
  const { castDate, plan, today, includeLongTerm = false } = options;
  if (plan.incomplete || plan.totalCubes === 0) return [];

  const entries: SpecimenDue[] = [];
  const push = (ageDays: number, count: number, purpose: SpecimenDue["purpose"]) => {
    if (count <= 0) return;
    const dueDate = addDaysISO(castDate, ageDays);
    entries.push({ ageDays, dueDate, count, purpose, overdue: dueDate < today });
  };

  push(7, plan.cubesAt7Days, "7d");
  push(28, plan.cubesAt28Days, "28d");
  if (includeLongTerm) {
    const extra = Math.max(1, Math.round(plan.cubesPerBatch / 2));
    push(56, extra, "long_term");
    push(90, extra, "long_term");
  }
  return entries.sort((a, b) => a.ageDays - b.ageDays);
}

/** Alerts: the plan was not met, or the day has passed with no result recorded. */
export function planWarnings(options: {
  plan: SamplingPlan;
  scheduledCount: number;
  testedCount: number;
  pourDate: string;
  today: string;
}): string[] {
  const warnings: string[] = [];
  const { plan, scheduledCount, testedCount, pourDate, today } = options;
  if (plan.incomplete) return warnings;
  if (scheduledCount < plan.totalCubes) {
    warnings.push(
      `خطة أخذ العينات لم تُستوفَ: المطلوب ${plan.totalCubes} مكعبًا والمجدول ${scheduledCount}.`,
    );
  }
  if (addDaysISO(pourDate, 28) <= today && testedCount < plan.cubesAt28Days) {
    warnings.push(
      `نتائج ٢٨ يومًا ناقصة: المطلوب ${plan.cubesAt28Days} نتيجة والمسجَّل ${testedCount}.`,
    );
  }
  return warnings;
}
