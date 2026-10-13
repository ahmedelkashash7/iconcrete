import { describe, expect, it } from "vitest";

import {
  INDICATOR_ONLY_LABEL,
  SEED_RULES,
  SAMPLING_RULE,
  evaluateCore,
  evaluateCube28Final,
  evaluateCube28Preliminary,
  evaluateSlump,
  evaluateTest,
  approvalBlockers,
  canApproveRule,
  isRuleUsable,
  ruleBlockers,
  suggestCubeTargetFromName,
  type QualityRule,
} from "@/lib/quality/ecp203";
import { scheduleSpecimens, planSampling } from "@/lib/quality/sampling";
import { compare, percentOf, shareExceeds, toUnits, formatUnits } from "@/lib/exact";

/**
 * The engineer has confirmed every parameter: the rule may now judge.
 * `value` is left untouched on purpose — a parameter that is unreadable in the
 * source (`null`) must stay unreadable even after approval, so it keeps
 * blocking the rule (that is V7's third case and V8's second case).
 */
function approved(rule: QualityRule): QualityRule {
  return {
    ...rule,
    approvalStatus: "approved",
    verifiedByEngineer: true,
    params: Object.fromEntries(
      Object.entries(rule.params).map(([key, param]) => [key, { ...param, verified: true }]),
    ),
  };
}

function rule(id: string): QualityRule {
  const found = [...SEED_RULES, SAMPLING_RULE].find((entry) => entry.id === id);
  if (!found) throw new Error(`no seed rule ${id}`);
  return found;
}

const TEST_DAY = "2026-05-01";
const PRE = approved(rule("R-PRE"));
const FIN = approved(rule("R-FIN"));
const CORE = approved(rule("R-CORE"));
const SLUMP = approved(rule("R-SLUMP"));
const EARLY = approved(rule("R-EARLY"));

/** The thresholds the fixtures actually carry, so the tests never hard-code them. */
const preAllowance = PRE.params.belowAllowancePct.value!;
const preMargin = PRE.params.groupMeanMarginPct.value!;

describe("exact arithmetic (OP-8: never floating point at a boundary)", () => {
  it("parses decimal text exactly", () => {
    expect(toUnits("22.5")).toBe(22_500_000n);
    expect(toUnits(0.1) + toUnits(0.2)).toBe(toUnits("0.3"));
    expect(formatUnits(toUnits("22.5"), 1)).toBe("22.5");
    expect(formatUnits(toUnits(-1.25), 2)).toBe("-1.25");
  });

  it("takes 10% of 25 as exactly 2.5 (a float gives 2.5000000000000004)", () => {
    expect(percentOf(toUnits(25), 10)).toBe(toUnits("2.5"));
  });

  it("compares a group mean exactly, so a mean of exactly the threshold passes", () => {
    // mean(22.4, 22.4, 22.4, 22.4) === 22.4 exactly
    const total = toUnits("22.4") * 4n;
    expect(compare(total, toUnits("22.4") * 4n)).toBe(0);
    // A float route would round here; the exact route does not.
    expect(formatUnits(total / 4n, 1)).toBe("22.4");
    // The float route really does break: 0.1 + 0.2 !== 0.3 in IEEE-754.
    expect(0.1 + 0.2 === 0.3).toBe(false);
    expect(toUnits(0.1) + toUnits(0.2)).toBe(toUnits(0.3));
  });

  it("compares a share exactly, so exactly 5% passes and 7.5% fails", () => {
    expect(shareExceeds(2, 40, 5)).toBe(false); // 5.0% <= 5%
    expect(shareExceeds(3, 40, 5)).toBe(true); // 7.5% > 5%
    expect(shareExceeds(1, 3, 33.333333)).toBe(true);
    expect(shareExceeds(1, 4, 25)).toBe(false); // exactly 25%
  });
});

describe("rule gating", () => {
  it("V8a: none of the seeded rules may judge anything (draft + unverified)", () => {
    for (const seed of [...SEED_RULES, SAMPLING_RULE]) {
      expect(isRuleUsable(seed, TEST_DAY)).toBe(false);
      expect(ruleBlockers(seed, TEST_DAY).length).toBeGreaterThan(0);
    }
  });

  it("V8a: an unapproved rule yields indicator_only for every input", () => {
    // Deliberately absurd values: even 40 MPa cubes must not be judged while the
    // rule is still a draft.
    const result = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [40, 40, 40, 40],
      rule: rule("R-PRE"),
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("indicator_only");
    expect(result.limitUsed).toBeNull();
  });

  it("V8a: the same absurd values do get judged once the rule is approved", () => {
    expect(
      evaluateCube28Preliminary({
        targetCubeMpa: 25,
        resultsInOrder: [40, 40, 40, 40],
        rule: PRE,
        testDate: TEST_DAY,
      }).status,
    ).toBe("meets");
  });

  it("a rule with an unreadable parameter can never be approved", () => {
    expect(canApproveRule(rule("R-SLUMP"))).toBe(false);
    expect(approvalBlockers(rule("R-SLUMP")).join(" ")).toContain("٨٠ مم");
    expect(canApproveRule(PRE)).toBe(true);
  });

  it("V8b: a rule with an empty/unverified parameter yields indicator_only", () => {
    const partial: QualityRule = {
      ...PRE,
      params: {
        ...PRE.params,
        groupMeanMarginPct: { ...PRE.params.groupMeanMarginPct, verified: false },
      },
    };
    const result = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [28, 27, 29, 30],
      rule: partial,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("indicator_only");
  });

  it("V8b: a rule outside its effective window yields indicator_only", () => {
    const expired: QualityRule = { ...PRE, effectiveTo: "2025-12-31" };
    const result = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [28, 27, 29, 30],
      rule: expired,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("indicator_only");
  });

  it("names the low-confidence parameter as a blocker", () => {
    const blockers = ruleBlockers(rule("R-PRE"), TEST_DAY).join(" | ");
    expect(blockers).toContain("هامش متوسط المجموعة");
  });

  it("keeps the permanent non-certification badge text stable", () => {
    expect(INDICATOR_ONLY_LABEL).toBe("بدون كود معتمد – مؤشر فقط");
  });
});

describe("V1-V4: R-PRE preliminary evaluation of 28-day cubes", () => {
  it("V1: fcu 25, results [28,27,29,30] evaluate the 4th -> meets", () => {
    // Thresholds come from the fixture, so changing the parameter changes the test.
    const floor = 25 - (25 * preAllowance) / 100;
    const meanLimit = 25 + (25 * preMargin) / 100;
    expect(floor).toBe(22.5);
    expect(meanLimit).toBe(27.5);

    const result = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [28, 27, 29, 30],
      rule: PRE,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("meets");
    expect(result.limitUsed).toContain("22.5");
    expect(result.detail).toContain("28.5");
  });

  it("V2: [26,26,26,26] -> condition (b) fails -> refer_to_consultant", () => {
    const result = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [26, 26, 26, 26],
      rule: PRE,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("refer_to_consultant");
  });

  it("V3: 22.4 fails condition (a); exactly 22.5 passes it", () => {
    const below = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [30, 30, 30, 22.4],
      rule: PRE,
      testDate: TEST_DAY,
    });
    expect(below.status).toBe("refer_to_consultant");
    expect(below.detail).toContain("22.4");

    const exactly = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [30, 30, 30, 22.5],
      rule: PRE,
      testDate: TEST_DAY,
    });
    // (a) passed the exact boundary, so the outcome is driven by (b).
    expect(exactly.detail).not.toContain("أقل من الحد الأدنى");
    expect(exactly.status).toBe("meets");
  });

  it("V4: only two preceding results -> insufficient_data, never meets", () => {
    const result = evaluateCube28Preliminary({
      targetCubeMpa: 25,
      resultsInOrder: [28, 29, 30],
      rule: PRE,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("insufficient_data");
  });
});

describe("V5: R-FIN final evaluation", () => {
  const minResults = FIN.params.minResults.value!;
  const maxBelowPct = FIN.params.maxBelowPct.value!;
  const results = (below: number, total: number) => [
    ...Array.from({ length: below }, () => 24),
    ...Array.from({ length: total - below }, () => 30),
  ];

  it("uses 40 results and 5% from the fixture", () => {
    expect(minResults).toBe(40);
    expect(maxBelowPct).toBe(5);
  });

  it("40 results with 2 below fcu = 5.0% -> meets", () => {
    const result = evaluateCube28Final({
      targetCubeMpa: 25,
      results: results(2, minResults),
      rule: FIN,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("meets");
  });

  it("40 results with 3 below fcu = 7.5% -> does_not_meet", () => {
    const result = evaluateCube28Final({
      targetCubeMpa: 25,
      results: results(3, minResults),
      rule: FIN,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("does_not_meet");
  });

  it("39 results -> insufficient_data", () => {
    const result = evaluateCube28Final({
      targetCubeMpa: 25,
      results: results(0, minResults - 1),
      rule: FIN,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("insufficient_data");
  });
});

describe("V6: R-CORE core acceptance", () => {
  it("mean 70.4% with every core >= 65% -> meets", () => {
    const result = evaluateCore({
      requiredMpa: 25,
      coreResults: [17.6, 17.6, 17.6],
      rule: CORE,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("meets");
    expect(result.limitUsed).toContain("17.5");
  });

  it("mean exactly 70.0% -> meets (exact boundary)", () => {
    const result = evaluateCore({
      requiredMpa: 25,
      coreResults: [17.5, 17.5, 17.5],
      rule: CORE,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("meets");
  });

  it("[18,18,16] mean 69.3% -> does_not_meet", () => {
    const result = evaluateCore({
      requiredMpa: 25,
      coreResults: [18, 18, 16],
      rule: CORE,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("does_not_meet");
  });

  it("a single weak core fails even when the mean passes", () => {
    // mean of [20,20,16] = 18.67 >= 17.5, but 16 < 16.25
    const result = evaluateCore({
      requiredMpa: 25,
      coreResults: [20, 20, 16],
      rule: CORE,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("does_not_meet");
    expect(result.detail).toContain("أضعف مكعب");
  });
});

describe("V7: R-SLUMP fresh concrete", () => {
  it("specified 70, measured 90 -> deviation 20 -> meets", () => {
    const result = evaluateSlump({ specifiedMm: 70, measuredMm: 90, rule: SLUMP, testDate: TEST_DAY });
    expect(result.status).toBe("meets");
  });

  it("specified 70, measured 91 -> does_not_meet", () => {
    const result = evaluateSlump({ specifiedMm: 70, measuredMm: 91, rule: SLUMP, testDate: TEST_DAY });
    expect(result.status).toBe("does_not_meet");
  });

  it("specified 100 with an unreadable tolerance -> indicator_only", () => {
    expect(SLUMP.params.toleranceAbove80Mm.value).toBeNull();
    const result = evaluateSlump({ specifiedMm: 100, measuredMm: 130, rule: SLUMP, testDate: TEST_DAY });
    expect(result.status).toBe("indicator_only");
    expect(result.limitUsed).toBeNull();
  });

  it("specified exactly 80 mm is undefined by the extracted text -> indicator_only", () => {
    const result = evaluateSlump({ specifiedMm: 80, measuredMm: 95, rule: SLUMP, testDate: TEST_DAY });
    expect(result.status).toBe("indicator_only");
  });
});

describe("V9 + specimen basis", () => {
  it("V9: a 7-day result is stored but never judged", () => {
    const result = evaluateTest({
      testType: "cube7",
      specimenType: "cube",
      targetCubeMpa: 30,
      actualMpa: 40,
      rule: EARLY,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("indicator_only");
  });

  it("V9: the old hard-coded 7-day = 70% rule is gone", () => {
    // 21 MPa is 70% of a 30 MPa target; it must NOT be reported as compliant.
    const result = evaluateTest({
      testType: "cube7",
      specimenType: "cube",
      targetCubeMpa: 30,
      actualMpa: 21,
      rule: EARLY,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("indicator_only");
    expect(result.limitUsed).toBeNull();
  });

  it("a cylinder is never compared with a cube target (D1)", () => {
    const result = evaluateTest({
      testType: "cube28",
      specimenType: "cylinder",
      mode: "final",
      targetCubeMpa: 25,
      results: Array.from({ length: 40 }, () => 5),
      rule: FIN,
      testDate: TEST_DAY,
    });
    expect(result.status).toBe("indicator_only");
  });

  it("the dispatcher drives cube28 preliminary and final", () => {
    expect(
      evaluateTest({
        testType: "cube28",
        specimenType: "cube",
        mode: "preliminary",
        targetCubeMpa: 25,
        resultsInOrder: [28, 27, 29, 30],
        rule: PRE,
        testDate: TEST_DAY,
      }).status,
    ).toBe("meets");
    expect(
      evaluateTest({
        testType: "cube28",
        specimenType: "cube",
        mode: "final",
        targetCubeMpa: 25,
        results: Array.from({ length: 40 }, () => 24),
        rule: FIN,
        testDate: TEST_DAY,
      }).status,
    ).toBe("does_not_meet");
  });
});

describe("target suggestion never decides compliance", () => {
  it("labels C30/37's first number as a suggestion and says it is the cylinder value", () => {
    const suggestion = suggestCubeTargetFromName("C30/37");
    expect(suggestion).not.toBeNull();
    expect(suggestion!.value).toBe(30);
    expect(suggestion!.label).toContain("مقترح");
    expect(suggestion!.warning).toContain("الأسطوانة");
  });

  it("returns nothing for a free-text mix name", () => {
    expect(suggestCubeTargetFromName("خلطة المشروع الخاصة")).toBeNull();
  });
});

describe("sampling plan (R-SAMP)", () => {
  const approvedSampling = approved(SAMPLING_RULE);

  it("6 cubes for the first 50 m³", () => {
    const plan = planSampling(50, approvedSampling);
    expect(plan.batches).toBe(1);
    expect(plan.totalCubes).toBe(6);
    expect(plan.cubesAt7Days + plan.cubesAt28Days).toBe(6);
  });

  it("adds 6 cubes per additional 100 m³", () => {
    expect(planSampling(51, approvedSampling).totalCubes).toBe(12);
    expect(planSampling(150, approvedSampling).totalCubes).toBe(12);
    expect(planSampling(151, approvedSampling).totalCubes).toBe(18);
    expect(planSampling(250, approvedSampling).totalCubes).toBe(18);
  });

  it("flags an incomplete plan instead of guessing", () => {
    const incomplete = planSampling(100, rule("R-SAMP"));
    // Draft rules are still readable, so the plan computes; only a null parameter blocks it.
    expect(incomplete.incomplete).toBe(false);
    const broken: QualityRule = {
      ...approvedSampling,
      params: { ...approvedSampling.params, perBatchVolumeM3: { ...approvedSampling.params.perBatchVolumeM3, value: null } },
    };
    expect(planSampling(100, broken).incomplete).toBe(true);
  });

  it("schedules 7-day and 28-day due dates and marks overdue ones", () => {
    const plan = planSampling(50, approvedSampling);
    const due = scheduleSpecimens({ castDate: "2026-05-01", plan, today: "2026-06-15" });
    expect(due.map((entry) => entry.dueDate)).toEqual(["2026-05-08", "2026-05-29"]);
    expect(due.every((entry) => entry.overdue)).toBe(true);
  });

  it("adds 56/90-day dates only when the consultant asks", () => {
    const plan = planSampling(50, approvedSampling);
    const without = scheduleSpecimens({ castDate: "2026-05-01", plan, today: "2026-05-01" });
    const withLong = scheduleSpecimens({
      castDate: "2026-05-01",
      plan,
      today: "2026-05-01",
      includeLongTerm: true,
    });
    expect(without).toHaveLength(2);
    expect(withLong.map((entry) => entry.ageDays)).toEqual([7, 28, 56, 90]);
  });
});
