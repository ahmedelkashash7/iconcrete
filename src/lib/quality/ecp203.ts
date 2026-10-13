/**
 * IConcrete System — quality rule engine (ECP 203-2007).
 *
 * A result is compared against a limit **only** when there is a rule that is
 * all of: approved, verified by the engineer, effective on the test date, and
 * completely filled in — every parameter present *and* individually verified.
 * Otherwise nothing is judged and the badge reads «بدون كود معتمد – مؤشر فقط».
 * That is the point of the whole module: the system never invents a limit, and
 * it never claims conformity it cannot point at a clause for.
 *
 * All boundary comparisons go through `@/lib/exact` (bigint micro-units), never
 * IEEE-754: "a result is acceptable when it is at least 22.5 MPa" has to accept
 * exactly 22.5.
 *
 * Seeded rules (R-CS, R-PRE, R-FIN, R-SLUMP, R-CORE, R-EARLY, R-SAMP) are
 * transcribed from the owner's OCR text of ECP 203-2007 and ship as **draft,
 * unverified**. `verifiedByEngineer` is `false` for every one of them, and the
 * two parameters whose digits are garbled in the source (R-PRE condition (b) and
 * R-SLUMP above 80 mm) are additionally marked `confidence: "low"` /
 * `"unreadable"` with their own `verified: false`. An engineer must confirm them
 * against the printed code before any pass/fail can appear.
 */

import {
  absoluteDifference,
  atLeast,
  atMost,
  compare,
  compareMean,
  formatUnits,
  percentOf,
  shareExceeds,
  sum,
  toUnits,
} from "@/lib/exact";

/* ------------------------------------------------------------------ types */

export type ApprovalStatus = "draft" | "approved" | "retired";
export type OcrConfidence = "high" | "medium" | "low" | "unreadable";
export type SpecimenType = "cube" | "cylinder";

/** Rule test types. `cube3`/`cube7` are early-age, informational only. */
export type RuleTestType = "cube28" | "cube7" | "cube3" | "slump" | "core";

export type EvaluationStatus =
  | "meets"
  | "does_not_meet"
  | "refer_to_consultant"
  | "indicator_only"
  | "insufficient_data";

export type CriteriaKind =
  | "informational"
  | "threshold"
  | "mean_of_n"
  | "group_mean"
  | "share_below"
  | "sampling_plan";

/**
 * One numeric parameter of a rule. `value === null` means "not readable in the
 * source" — such a rule can never be approved. `verified` is per parameter, so
 * a single dubious digit blocks the rule instead of the whole table.
 */
export type RuleParam = {
  value: number | null;
  unit: string;
  confidence: OcrConfidence;
  verified: boolean;
  notes?: string;
};

export type QualityRule = {
  id: string;
  /** Stable id used as the Convex `qualityRules.ruleKey`. */
  ruleKey: string;
  testType: RuleTestType;
  ageDays: number | null;
  unit: string;
  criteriaKind: CriteriaKind;
  params: Record<string, RuleParam>;
  standardReference: string;
  ocrConfidence: OcrConfidence;
  verifiedByEngineer: boolean;
  approvalStatus: ApprovalStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  notes: string;
};

export const INDICATOR_ONLY_LABEL = "بدون كود معتمد – مؤشر فقط";

/** Shown on every quality screen and every printed report, permanently. */
export const NON_CERTIFICATION_NOTE =
  "هذه النتائج تدعم ضبط الجودة وليست شهادة مطابقة معتمدة من مختبر.";

export const STATUS_LABELS: Record<EvaluationStatus, string> = {
  meets: "مطابق",
  does_not_meet: "غير مطابق",
  refer_to_consultant: "يُحال إلى استشاري المشروع",
  indicator_only: INDICATOR_ONLY_LABEL,
  insufficient_data: "بيانات غير كافية",
};

/** Statuses that assert a judgement; `indicator_only` never appears here. */
export const JUDGING_STATUSES: EvaluationStatus[] = [
  "meets",
  "does_not_meet",
  "refer_to_consultant",
];

/* ------------------------------------------------------- rule usability */

/**
 * Reasons a rule cannot judge anything right now (all shown to the operator).
 *
 * `requiredParams` narrows the check to the parameters a *specific evaluation
 * path* needs. R-SLUMP is the reason it exists: its tolerance for a specified
 * slump below 80 mm is known while the value for 80 mm and above is unreadable
 * in the source, so the <80 mm band can be judged while the ≥80 mm band stays
 * indicator-only. With no `requiredParams`, every parameter is required — the
 * strict mode used for approval and for the other rules.
 */
export function ruleBlockers(
  rule: QualityRule,
  testDate: string,
  requiredParams?: string[],
): string[] {
  const blockers: string[] = [];
  if (rule.approvalStatus !== "approved") {
    blockers.push(
      rule.approvalStatus === "draft"
        ? "القاعدة مسودة ولم تُعتمد بعد"
        : "القاعدة مسحوبة من الاستخدام",
    );
  }
  if (!rule.verifiedByEngineer) {
    blockers.push("القاعدة لم يتحقق منها مهندس بعد");
  }
  if (rule.effectiveFrom > testDate) {
    blockers.push(`القاعدة سارية من ${rule.effectiveFrom}`);
  }
  if (rule.effectiveTo && testDate > rule.effectiveTo) {
    blockers.push(`انتهت سريان القاعدة في ${rule.effectiveTo}`);
  }
  const names = requiredParams ?? Object.keys(rule.params);
  for (const name of names) {
    const param = rule.params[name];
    if (!param) {
      blockers.push(`المعامل «${paramLabel(name)}» غير موجود في القاعدة`);
      continue;
    }
    if (param.value === null) {
      blockers.push(`المعامل «${paramLabel(name)}» غير مقروء في المصدر`);
    } else if (!param.verified) {
      blockers.push(`المعامل «${paramLabel(name)}» لم يُتحقق منه بعد`);
    }
  }
  if (Object.keys(rule.params).length === 0 && rule.criteriaKind !== "informational") {
    blockers.push("القاعدة لا تحتوي على أي معامل");
  }
  return blockers;
}

/** True only when the rule may actually produce a pass/fail. */
export function isRuleUsable(
  rule: QualityRule,
  testDate: string,
  requiredParams?: string[],
): boolean {
  return ruleBlockers(rule, testDate, requiredParams).length === 0;
}

/**
 * Approving a rule is stricter than evaluating with it: a rule whose parameters
 * are not all filled in and verified can never be approved, because a later
 * test could then hit the empty parameter and there would be no safe answer.
 */
export function approvalBlockers(rule: QualityRule): string[] {
  const blockers: string[] = [];
  for (const [name, param] of Object.entries(rule.params)) {
    if (param.value === null) {
      blockers.push(`المعامل «${paramLabel(name)}» غير مقروء في المصدر — لا يمكن اعتماد القاعدة`);
    }
  }
  if (rule.criteriaKind !== "informational" && Object.keys(rule.params).length === 0) {
    blockers.push("القاعدة بلا معاملات — لا يمكن اعتمادها");
  }
  return blockers;
}

export function canApproveRule(rule: QualityRule): boolean {
  return approvalBlockers(rule).length === 0;
}

export const PARAM_LABELS: Record<string, string> = {
  belowAllowancePct: "نسبة السماح تحت المقاومة المميزة",
  groupMeanMarginPct: "هامش متوسط المجموعة فوق المقاومة المميزة",
  minResults: "أقل عدد نتائج للتقييم النهائي",
  maxBelowPct: "أقصى نسبة نتائج أقل من المقاومة المميزة",
  toleranceBelow80Mm: "سماحية الركود عند ركود أقل من ٨٠ مم",
  toleranceAbove80Mm: "سماحية الركود عند ركود ٨٠ مم أو أكثر",
  meanPctOfRequired: "نسبة متوسط المكعبات من المقاومة المطلوبة",
  singleMinPctOfRequired: "أقل نسبة لمكعب منفرد من المقاومة المطلوبة",
  firstBatchVolumeM3: "حجم أول دفعة (٦ مكعبات)",
  perBatchVolumeM3: "حجم كل دفعة إضافية (٦ مكعبات)",
  cubesPerBatch: "عدد المكعبات لكل دفعة",
  percentSampledAt7Days: "نسبة المكعبات المختبرة عند ٧ أيام",
  dischargeBeforeSamplingPct: "نسبة الصرف قبل أخذ العينة",
  expectedMpa: "المقاومة المتوقعة عند العمر المبكر",
};

function paramLabel(name: string): string {
  return PARAM_LABELS[name] ?? name;
}

/* ------------------------------------------------------------- results */

export type EvaluationResult = {
  status: EvaluationStatus;
  /** Arabic one-liner for the UI; always states the exact limit used. */
  detail: string;
  /** Limit actually applied, formatted, or null when nothing was applied. */
  limitUsed: string | null;
  /** The rule that produced the judgement, or null for indicator-only. */
  ruleKey: string | null;
};

function indicatorOnly(detail: string, ruleKey: string | null = null): EvaluationResult {
  return { status: "indicator_only", detail, limitUsed: null, ruleKey };
}

/* ------------------------------------------- R-PRE: preliminary 28-day */

export type PreliminaryInput = {
  /** Explicit cube target typed by the engineer — never parsed from the name. */
  targetCubeMpa: number;
  /** 28-day cube results of the same mix, oldest first, one per sample. */
  resultsInOrder: number[];
  /** Rule R-PRE, already confirmed usable by the caller. */
  rule: QualityRule;
  testDate: string;
};

/**
 * Clause 2-6-5-2 (a). The result under evaluation is the **last** one in
 * `resultsInOrder`; the group is that result plus the three before it.
 *
 *   (a) result >= fcu × (1 − belowAllowancePct/100)
 *   (b) mean(result, 3 preceding) > fcu × (1 + groupMeanMarginPct/100)
 *
 * Either condition failing sends the sample to the project consultant. With
 * fewer than three preceding results condition (b) cannot be evaluated at all,
 * so the outcome is `insufficient_data` — never "meets".
 */
export function evaluateCube28Preliminary(input: PreliminaryInput): EvaluationResult {
  const { resultsInOrder, rule, testDate } = input;
  if (!isRuleUsable(rule, testDate)) {
    return indicatorOnly("لا توجد قاعدة معتمدة وموثقة للتقويم الأولي", rule.ruleKey);
  }
  const allowance = rule.params.belowAllowancePct;
  const margin = rule.params.groupMeanMarginPct;
  if (!allowance || !margin || allowance.value === null || margin.value === null) {
    return indicatorOnly("معاملات قاعدة التقويم الأولي غير مكتملة", rule.ruleKey);
  }
  if (resultsInOrder.length === 0) {
    return { status: "insufficient_data", detail: "لا توجد نتيجة للتقييم", limitUsed: null, ruleKey: rule.ruleKey };
  }

  const target = toUnits(input.targetCubeMpa);
  const floor = target - percentOf(target, allowance.value);
  const meanThreshold = target + percentOf(target, margin.value);

  const latest = toUnits(resultsInOrder[resultsInOrder.length - 1]);
  const preceding = resultsInOrder.slice(-4, -1);

  if (!atLeast(latest, floor)) {
    return {
      status: "refer_to_consultant",
      detail: `النتيجة ${formatUnits(latest, 1)} MPa أقل من الحد الأدنى ${formatUnits(floor, 1)} MPa (${allowance.value}% تحت المقاومة المميزة ${input.targetCubeMpa} MPa) — يُحال إلى الاستشاري.`,
      limitUsed: `${formatUnits(floor, 1)} MPa`,
      ruleKey: rule.ruleKey,
    };
  }

  if (preceding.length < 3) {
    return {
      status: "insufficient_data",
      detail: `لا يمكن تقييم الشرط (ب): يلزم ٣ نتائج سابقة على الأقل، والمتاح ${preceding.length}.`,
      limitUsed: `${formatUnits(meanThreshold, 1)} MPa`,
      ruleKey: rule.ruleKey,
    };
  }

  const total = sum(preceding.map((value) => toUnits(value))) + latest;
  if (compareMean(total, 4, meanThreshold) < 0) {
    return {
      status: "refer_to_consultant",
      detail: `الشرط (أ) مستوفى، لكن متوسط آخر ٤ نتائج ${formatUnits(total / 4n, 1)} MPa لا يزيد عن المقاومة المميزة بمقدار ${margin.value}% (المطلوب أكثر من ${formatUnits(meanThreshold, 1)} MPa) — يُحال إلى الاستشاري.`,
      limitUsed: `${formatUnits(meanThreshold, 1)} MPa`,
      ruleKey: rule.ruleKey,
    };
  }

  return {
    status: "meets",
    detail: `الشرط (أ): ${formatUnits(latest, 1)} MPa ≥ ${formatUnits(floor, 1)} MPa. الشرط (ب): متوسط آخر ٤ نتائج ${formatUnits(total / 4n, 1)} MPa > ${formatUnits(meanThreshold, 1)} MPa.`,
    limitUsed: `${formatUnits(floor, 1)} / ${formatUnits(meanThreshold, 1)} MPa`,
    ruleKey: rule.ruleKey,
  };
}

/* ------------------------------------------------ R-FIN: final 28-day */

export type FinalInput = {
  targetCubeMpa: number;
  /** Every 28-day cube result included in the evaluation. */
  results: number[];
  rule: QualityRule;
  testDate: string;
};

/**
 * Clause 2-6-5-2 (b): at least `minResults` results; the concrete is considered
 * to achieve fcu when the share of results strictly below fcu is at most
 * `maxBelowPct`. Fewer results than required → `insufficient_data`.
 */
export function evaluateCube28Final(input: FinalInput): EvaluationResult {
  const { results, rule, testDate } = input;
  if (!isRuleUsable(rule, testDate)) {
    return indicatorOnly("لا توجد قاعدة معتمدة وموثقة للتقويم النهائي", rule.ruleKey);
  }
  const minResults = rule.params.minResults;
  const maxBelow = rule.params.maxBelowPct;
  if (!minResults || !maxBelow || minResults.value === null || maxBelow.value === null) {
    return indicatorOnly("معاملات قاعدة التقويم النهائي غير مكتملة", rule.ruleKey);
  }

  const required = Math.round(minResults.value);
  if (results.length < required) {
    return {
      status: "insufficient_data",
      detail: `يلزم ${required} نتيجة على الأقل للتقويم النهائي، والمتاح ${results.length}.`,
      limitUsed: null,
      ruleKey: rule.ruleKey,
    };
  }

  const target = toUnits(input.targetCubeMpa);
  const below = results.filter((value) => compare(toUnits(value), target) < 0).length;
  // Exact share comparison — see `shareExceeds` in @/lib/exact.
  const shareText = `${((below / results.length) * 100).toFixed(1)}%`;

  if (!shareExceeds(below, results.length, maxBelow.value)) {
    return {
      status: "meets",
      detail: `${below} من ${results.length} نتيجة أقل من ${input.targetCubeMpa} MPa (${shareText}) ≤ الحد المسموح ${maxBelow.value}%.`,
      limitUsed: `${maxBelow.value}% من النتائج`,
      ruleKey: rule.ruleKey,
    };
  }
  return {
    status: "does_not_meet",
    detail: `${below} من ${results.length} نتيجة أقل من ${input.targetCubeMpa} MPa (${shareText}) > الحد المسموح ${maxBelow.value}%.`,
    limitUsed: `${maxBelow.value}% من النتائج`,
    ruleKey: rule.ruleKey,
  };
}

/* --------------------------------------------------- R-SLUMP: fresh concrete */

export type SlumpInput = {
  /** Slump specified for the project (the mix's `specifiedSlumpMm`). */
  specifiedMm: number;
  measuredMm: number;
  rule: QualityRule;
  testDate: string;
};

/**
 * Clause 2-6-5-1: the deviation from the specified slump must not exceed the
 * tolerance. The tolerance for a specified slump **below 80 mm** is in the
 * source; the value for 80 mm and above is unreadable, so that band is
 * indicator-only until the engineer types it in.
 */
export function evaluateSlump(input: SlumpInput): EvaluationResult {
  const { rule, testDate } = input;
  // Only the tolerance for the band being evaluated is required — see ruleBlockers.
  const needed = input.specifiedMm < 80 ? ["toleranceBelow80Mm"] : ["toleranceAbove80Mm"];
  if (!isRuleUsable(rule, testDate, needed)) {
    return indicatorOnly("لا توجد قاعدة معتمدة وموثقة لهذا النطاق من الركود", rule.ruleKey);
  }
  const below = rule.params.toleranceBelow80Mm;
  const above = rule.params.toleranceAbove80Mm;
  const specified = toUnits(input.specifiedMm);

  if (input.specifiedMm < 80) {
    if (!below || below.value === null) {
      return indicatorOnly("سماحية الركود غير محددة في القاعدة", rule.ruleKey);
    }
    const tolerance = toUnits(below.value);
    const deviation = absoluteDifference(toUnits(input.measuredMm), specified);
    const limitText = `${formatUnits(tolerance, 0)} مم`;
    if (atMost(deviation, tolerance)) {
      return {
        status: "meets",
        detail: `الانحراف ${formatUnits(deviation, 0)} مم ≤ السماحية ${limitText} للركود المحدد ${input.specifiedMm} مم.`,
        limitUsed: limitText,
        ruleKey: rule.ruleKey,
      };
    }
    return {
      status: "does_not_meet",
      detail: `الانحراف ${formatUnits(deviation, 0)} مم > السماحية ${limitText} للركود المحدد ${input.specifiedMm} مم.`,
      limitUsed: limitText,
      ruleKey: rule.ruleKey,
    };
  }

  // 80 mm and above: the source digit is unreadable, so no judgement at all.
  if (!above || above.value === null) {
    return indicatorOnly(
      "سماحية الركود للركود ٨٠ مم أو أكثر غير مقروءة في المصدر — أدخلها من الكود المطبوع لتفعيل التقييم",
      rule.ruleKey,
    );
  }
  const tolerance = toUnits(above.value);
  const deviation = absoluteDifference(toUnits(input.measuredMm), specified);
  const limitText = `${formatUnits(tolerance, 0)} مم`;
  return atMost(deviation, tolerance)
    ? {
        status: "meets",
        detail: `الانحراف ${formatUnits(deviation, 0)} مم ≤ السماحية ${limitText}.`,
        limitUsed: limitText,
        ruleKey: rule.ruleKey,
      }
    : {
        status: "does_not_meet",
        detail: `الانحراف ${formatUnits(deviation, 0)} مم > السماحية ${limitText}.`,
        limitUsed: limitText,
        ruleKey: rule.ruleKey,
      };
}

/* ---------------------------------------------------- R-CORE: core tests */

export type CoreInput = {
  requiredMpa: number;
  coreResults: number[];
  rule: QualityRule;
  testDate: string;
};

/**
 * Clause 8-9-5: accepted when the mean of the three cores is at least
 * `meanPctOfRequired`% of the required strength **and** no single core is below
 * `singleMinPctOfRequired`% of it.
 */
export function evaluateCore(input: CoreInput): EvaluationResult {
  const { rule, testDate } = input;
  if (!isRuleUsable(rule, testDate)) {
    return indicatorOnly("لا توجد قاعدة معتمدة وموثقة لمكعبات القلب", rule.ruleKey);
  }
  const meanParam = rule.params.meanPctOfRequired;
  const singleParam = rule.params.singleMinPctOfRequired;
  if (!meanParam || !singleParam || meanParam.value === null || singleParam.value === null) {
    return indicatorOnly("معاملات قبول مكعبات القلب غير مكتملة", rule.ruleKey);
  }
  if (input.coreResults.length === 0) {
    return { status: "insufficient_data", detail: "لا توجد نتائج مكعبات", limitUsed: null, ruleKey: rule.ruleKey };
  }

  const required = toUnits(input.requiredMpa);
  const meanLimit = percentOf(required, meanParam.value);
  const singleLimit = percentOf(required, singleParam.value);
  const total = sum(input.coreResults.map((value) => toUnits(value)));
  const meanHolds = compareMean(total, input.coreResults.length, meanLimit) >= 0;
  const weakest = input.coreResults.reduce((low, value) => (value < low ? value : low));
  const singleHolds = atLeast(toUnits(weakest), singleLimit);
  const meanText = formatUnits(total / BigInt(input.coreResults.length), 1);
  const limitText = `المتوسط ≥ ${formatUnits(meanLimit, 1)} MPa، وأضعف مكعب ≥ ${formatUnits(singleLimit, 1)} MPa`;

  if (meanHolds && singleHolds) {
    return {
      status: "meets",
      detail: `المتوسط ${meanText} MPa ≥ ${formatUnits(meanLimit, 1)} MPa، وأضعف مكعب ${weakest} MPa ≥ ${formatUnits(singleLimit, 1)} MPa.`,
      limitUsed: limitText,
      ruleKey: rule.ruleKey,
    };
  }
  const failed: string[] = [];
  if (!meanHolds) failed.push(`المتوسط ${meanText} MPa < ${formatUnits(meanLimit, 1)} MPa`);
  if (!singleHolds) failed.push(`أضعف مكعب ${weakest} MPa < ${formatUnits(singleLimit, 1)} MPa`);
  return {
    status: "does_not_meet",
    detail: `${failed.join("، و")}.`,
    limitUsed: limitText,
    ruleKey: rule.ruleKey,
  };
}

/* ------------------------------------------- R-EARLY: 3/7-day cubes */

export type EarlyInput = {
  targetCubeMpa: number;
  actualMpa: number;
  rule: QualityRule;
  testDate: string;
};

/**
 * Early-age results carry no fixed percentage in the code: the relation between
 * early-age and characteristic strength is established by trial cubes before
 * execution. They are stored and shown as information and are **never** judged
 * unless the engineer entered a project-specific expected value (and even then
 * the outcome is a project expectation, not a code limit).
 */
export function evaluateEarly(input: EarlyInput): EvaluationResult {
  const expected = input.rule.params.expectedMpa;
  if (!isRuleUsable(input.rule, input.testDate) || !expected || expected.value === null) {
    return indicatorOnly(
      "نتيجة عمر مبكر: تُسجَّل للاسترشاد فقط — الكود لا يحدد نسبة ثابتة للمقاومة عند الأعمار المبكرة",
      input.rule.ruleKey,
    );
  }
  const actual = toUnits(input.actualMpa);
  const limit = toUnits(expected.value);
  return atLeast(actual, limit)
    ? {
        status: "meets",
        detail: `مطابق لتوقع المشروع عند العمر المبكر (${formatUnits(limit, 1)} MPa) — وليس حدًا من الكود.`,
        limitUsed: `${formatUnits(limit, 1)} MPa (توقع مشروع)`,
        ruleKey: input.rule.ruleKey,
      }
    : {
        status: "does_not_meet",
        detail: `أقل من توقع المشروع عند العمر المبكر (${formatUnits(limit, 1)} MPa) — وليس حدًا من الكود.`,
        limitUsed: `${formatUnits(limit, 1)} MPa (توقع مشروع)`,
        ruleKey: input.rule.ruleKey,
      };
}

/* ------------------------------------------------------- the dispatcher */

export type EvaluateRequest =
  | { testType: "cube28"; specimenType: SpecimenType; rule: QualityRule; testDate: string; targetCubeMpa: number; mode: "preliminary"; resultsInOrder: number[] }
  | { testType: "cube28"; specimenType: SpecimenType; rule: QualityRule; testDate: string; targetCubeMpa: number; mode: "final"; results: number[] }
  | { testType: "cube7" | "cube3"; specimenType: SpecimenType; rule: QualityRule; testDate: string; targetCubeMpa: number; actualMpa: number }
  | { testType: "slump"; rule: QualityRule; testDate: string; specifiedMm: number; measuredMm: number }
  | { testType: "core"; rule: QualityRule; testDate: string; requiredMpa: number; coreResults: number[] };

/**
 * Single entry point used by the quality screen, the Excel import and the
 * offline replay, so all three can never disagree.
 *
 * A cylinder entry is stored but **never compared**: the owner's decision D1 is
 * that compliance is on cubes, so a cylinder can only ever be indicator-only.
 */
export function evaluateTest(request: EvaluateRequest): EvaluationResult {
  if ("specimenType" in request && request.specimenType === "cylinder") {
    return indicatorOnly(
      "عينة أسطوانية: تُحفظ للمرجعية فقط ولا تُقارن — أساس المطابقة هو المكعبات (قرار المالك D1)",
      request.rule.ruleKey,
    );
  }
  switch (request.testType) {
    case "cube28":
      return request.mode === "preliminary"
        ? evaluateCube28Preliminary(request)
        : evaluateCube28Final(request);
    case "cube7":
    case "cube3":
      return evaluateEarly(request);
    case "slump":
      return evaluateSlump(request);
    case "core":
      return evaluateCore(request);
    default: {
      const exhaustive: never = request;
      throw new Error(`evaluateTest: نوع اختبار غير مدعوم: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/* --------------------------------------------------- target suggestion */

/**
 * The mix name is free text and is **never** parsed to decide compliance. This
 * helper exists only to pre-fill the explicit `targetCubeMpa` field, and its
 * output is labelled as a suggestion the engineer must confirm.
 *
 * Note it reads the **first** number, which in "C30/37" is the *cylinder*
 * strength (30), not the cube strength the plant tests. That is exactly why the
 * value is a suggestion and not the target.
 */
export function suggestCubeTargetFromName(
  mixDesign: string,
): { value: number; label: string; warning: string } | null {
  const match = mixDesign.trim().toUpperCase().match(/(?:^|[^0-9])C\s*(\d{1,3})/);
  if (!match) return null;
  const cylinder = Number(match[1]);
  if (!Number.isFinite(cylinder) || cylinder <= 0) return null;
  return {
    value: cylinder,
    label: "مقترح — يحتاج تأكيدًا",
    warning:
      "الرقم الأول في اسم الخلطة (C30/37) هو مقاومة الأسطوانة، وليس مقاومة المكعب التي تُختبر. أكّد مقاومة المكعب المطلوبة يدويًا.",
  };
}

/* ------------------------------------------------------ seeded rules */

const draft = {
  verifiedByEngineer: false,
  approvalStatus: "draft" as ApprovalStatus,
  effectiveFrom: "2007-01-01",
  effectiveTo: null,
  version: 1,
};

/**
 * Transcribed from the owner's OCR text of ECP 203-2007. Every parameter starts
 * `verified: false`, so none of these rules can judge a result until an engineer
 * confirms them one by one against the printed code.
 */
export const SEED_RULES: QualityRule[] = [
  {
    id: "R-CS",
    ruleKey: "R-CS",
    testType: "cube28",
    ageDays: 28,
    unit: "MPa",
    criteriaKind: "informational",
    params: {},
    standardReference: "ECP 203-2007 — تعريف المقاومة المميزة fcu (نص تعريفي)",
    ocrConfidence: "high",
    notes:
      "المقاومة المميزة (fcu) = مقاومة الضغط للمكعب عند ٢٨ يومًا التي يحددها المصمم، ويُتوقع ألا تقل عنها أكثر من ٥٪ من النتائج. تعريف فقط — لا يُقارن به نتيجة منفردة.",
    ...draft,
  },
  {
    id: "R-PRE",
    ruleKey: "R-PRE",
    testType: "cube28",
    ageDays: 28,
    unit: "MPa",
    criteriaKind: "group_mean",
    params: {
      belowAllowancePct: {
        value: 10,
        unit: "%",
        confidence: "high",
        verified: false,
        notes: "نتيجة ١٠٪ تحت المقاومة المميزة بالضبط مقبولة (المقارنة ≥).",
      },
      groupMeanMarginPct: {
        value: 10,
        unit: "%",
        confidence: "low",
        verified: false,
        notes:
          "الرقم وترتيب الجملة غير واضحين في النص المستخرج — يجب تأكيده من الكود المطبوع قبل اعتماد القاعدة.",
      },
    },
    standardReference: "ECP 203-2007 — البند 2-6-5-2 (أ)",
    ocrConfidence: "medium",
    notes:
      "التقويم الأولي: يتحقق الشرط (أ) لو كانت النتيجة ≥ fcu × (1 − 10٪)، والشرط (ب) لو زاد متوسط النتيجة مع الثلاث نتائج السابقة على fcu بنسبة ١٠٪ على الأقل. فشل أي شرط ← إحالة إلى استشاري المشروع. أقل من ٣ نتائج سابقة ← بيانات غير كافية.",
    ...draft,
  },
  {
    id: "R-FIN",
    ruleKey: "R-FIN",
    testType: "cube28",
    ageDays: 28,
    unit: "MPa",
    criteriaKind: "share_below",
    params: {
      minResults: { value: 40, unit: "نتيجة", confidence: "high", verified: false },
      maxBelowPct: {
        value: 5,
        unit: "%",
        confidence: "high",
        verified: false,
        notes: "النتائج «غير المحققة» = النتائج الأقل من fcu بصرامة (وليس تساويها).",
      },
    },
    standardReference: "ECP 203-2007 — البند 2-6-5-2 (ب)",
    ocrConfidence: "high",
    notes:
      "التقويم النهائي: يلزم ٤٠ نتيجة على الأقل، ويُعتبر الخرسانة محققة للمقاومة المميزة إذا كانت نسبة النتائج الأقل من fcu لا تزيد عن ٥٪ من كل النتائج.",
    ...draft,
  },
  {
    id: "R-SLUMP",
    ruleKey: "R-SLUMP",
    testType: "slump",
    ageDays: null,
    unit: "مم",
    criteriaKind: "threshold",
    params: {
      toleranceBelow80Mm: { value: 20, unit: "مم", confidence: "medium", verified: false },
      toleranceAbove80Mm: {
        value: null,
        unit: "مم",
        confidence: "unreadable",
        verified: false,
        notes:
          "غير مقروء في المصدر. عند الركود ≥ ٨٠ مم لا يُصدر النظام أي حكم حتى يُدخل المهندس القيمة من الكود المطبوع. الركود ٨٠ مم بالضبط غير محدد بالنص المستخرج.",
      },
    },
    standardReference: "ECP 203-2007 — البند 2-6-5-1",
    ocrConfidence: "medium",
    notes:
      "الانحراف عن الركود المحدد للمشروع لا يزيد عن ٢٠ مم عند ركود أقل من ٨٠ مم (ثقة متوسطة). قيمة السماحية لركود ٨٠ مم أو أكثر غير مقروءة.",
    ...draft,
  },
  {
    id: "R-CORE",
    ruleKey: "R-CORE",
    testType: "core",
    ageDays: 28,
    unit: "MPa",
    criteriaKind: "mean_of_n",
    params: {
      meanPctOfRequired: { value: 70, unit: "%", confidence: "high", verified: false },
      singleMinPctOfRequired: { value: 65, unit: "%", confidence: "high", verified: false },
    },
    standardReference: "ECP 203-2007 — البند 8-9-5",
    ocrConfidence: "high",
    notes:
      "قبول مكعبات القلب: يُقبل إذا كان متوسط الثلاث مكعبات ≥ ٧٠٪ من المقاومة المطلوبة ولا يقل أي مكعب منفرد عن ٦٥٪ منها.",
    ...draft,
  },
  {
    id: "R-EARLY",
    ruleKey: "R-EARLY",
    testType: "cube7",
    ageDays: 7,
    unit: "MPa",
    criteriaKind: "informational",
    params: {
      expectedMpa: {
        value: null,
        unit: "MPa",
        confidence: "unreadable",
        verified: false,
        notes:
          "اختياري: توقع المشروع عند العمر المبكر. لا يوجد حد في الكود — العلاقة تُحدد بمكعبات تجريبية قبل التنفيذ. أُلغيت قاعدة «٧ أيام = ٧٠٪» القديمة.",
      },
    },
    standardReference: "ECP 203-2007 — العلاقة بين مقاومة الأعمار المبكرة والمقاومة المميزة",
    ocrConfidence: "high",
    notes:
      "نتائج ٣ و٧ أيام معلوماتية فقط: تُحفظ وتُعرض بلا مطابق/غير مطابق. يمكن للمهندس إدخال توقع خاص بالمشروع.",
    ...draft,
  },
];

/* ---------------------------------------------------- sampling plan (R-SAMP) */

export const SAMPLING_RULE: QualityRule = {
  id: "R-SAMP",
  ruleKey: "R-SAMP",
  testType: "cube28",
  ageDays: 28,
  unit: "مكعب",
  criteriaKind: "sampling_plan",
  params: {
    firstBatchVolumeM3: { value: 50, unit: "m³", confidence: "medium", verified: false },
    perBatchVolumeM3: { value: 100, unit: "m³", confidence: "medium", verified: false },
    cubesPerBatch: { value: 6, unit: "مكعب", confidence: "medium", verified: false },
    percentSampledAt7Days: { value: 50, unit: "%", confidence: "medium", verified: false },
    dischargeBeforeSamplingPct: {
      value: 15,
      unit: "%",
      confidence: "medium",
      verified: false,
      notes: "للخرسانة الجاهزة: تُؤخذ العينة من منتصف العربة أو بعد صرف ١٥٪ من الحمولة.",
    },
  },
  standardReference: "ECP 203-2007 — البند 8-9-3 (جدول مجزّأ، ثقة متوسطة)",
  ocrConfidence: "medium",
  notes:
    "خطة أخذ العينات لكل درجة خرسانة ولكل نوع عنصر إنشائي: ٦ مكعبات لأول ٥٠ m³ ثم ٦ مكعبات لكل ١٠٠ m³ إضافية تُصب في نفس اليوم؛ نصفها يُختبر عند ٧ أيام والنصف عند ٢٨ يومًا؛ اختبارات ٥٦/٩٠ يومًا فقط لو طلبها الاستشاري. غير مُتحقق منها حتى يؤكدها المهندس.",
  verifiedByEngineer: false,
  approvalStatus: "draft",
  effectiveFrom: "2007-01-01",
  effectiveTo: null,
  version: 1,
};

/** Every seeded rule, including the sampling plan, as one list for the UI. */
export const SEED_RULES_WITH_SAMPLING: QualityRule[] = [...SEED_RULES, SAMPLING_RULE];
