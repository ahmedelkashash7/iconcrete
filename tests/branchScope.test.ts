import { describe, expect, it } from "vitest";

import {
  assertBranchUnchanged,
  decideBranchAccess,
  effectiveBranchIds,
  mayUseBranch,
  scopedBranchIds,
  type Assignment,
} from "@/convex/branchScope";
import { errorCode } from "@/lib/errors";

/**
 * These live in `tests/` rather than beside the module on purpose: `src/convex/`
 * is the Convex *functions* directory, so every file under it is typechecked by
 * the Convex project (which has no `@/` alias) and bundled on deploy. A `.test.ts`
 * there breaks `convex dev` and ships test code to production.
 */

const A = "branch_a";
const B = "branch_b";

const assign = (
  branchId: string,
  effectiveFrom: string,
  effectiveTo: string | null = null,
): Assignment => ({ branchId, effectiveFrom, effectiveTo });

const TODAY = "2026-05-01";

describe("effective assignment windows", () => {
  it("grants an assignment from its effective date, inclusive", () => {
    expect(effectiveBranchIds([assign(A, TODAY)], TODAY)).toEqual([A]);
  });

  it("grants an assignment on its last day, inclusive", () => {
    expect(effectiveBranchIds([assign(A, "2026-01-01", TODAY)], TODAY)).toEqual([A]);
  });

  it("withholds an assignment before it starts", () => {
    expect(effectiveBranchIds([assign(A, "2026-06-01")], TODAY)).toEqual([]);
  });

  it("withholds an assignment after it ends", () => {
    expect(effectiveBranchIds([assign(A, "2026-01-01", "2026-04-30")], TODAY)).toEqual([]);
  });

  it("deduplicates overlapping assignments for the same branch", () => {
    expect(
      effectiveBranchIds([assign(A, "2026-01-01"), assign(A, "2026-02-01")], TODAY),
    ).toEqual([A]);
  });
});

describe("branch scope resolution", () => {
  it("never limits the owner", () => {
    expect(
      decideBranchAccess({ isOwner: true, assignments: [], assignmentCount: 0, date: TODAY }),
    ).toEqual({ kind: "all", enforcementActive: false, reason: "owner" });
  });

  it("stays open while the plant has not started assigning branches", () => {
    expect(
      decideBranchAccess({ isOwner: false, assignments: [], assignmentCount: 0, date: TODAY }),
    ).toEqual({ kind: "all", enforcementActive: false, reason: "not_configured" });
  });

  it("turns enforcement on as soon as any assignment exists anywhere", () => {
    expect(
      decideBranchAccess({
        isOwner: false,
        assignments: [assign(A, "2026-01-01")],
        assignmentCount: 1,
        date: TODAY,
      }),
    ).toEqual({ kind: "assigned", enforcementActive: true, branchIds: [A] });
  });

  it("gives nothing to an unassigned member once enforcement is on", () => {
    expect(
      decideBranchAccess({ isOwner: false, assignments: [], assignmentCount: 3, date: TODAY }),
    ).toEqual({ kind: "none", enforcementActive: true });
  });

  it("gives nothing to a member whose assignment has expired", () => {
    expect(
      decideBranchAccess({
        isOwner: false,
        assignments: [assign(A, "2026-01-01", "2026-03-01")],
        assignmentCount: 1,
        date: TODAY,
      }),
    ).toEqual({ kind: "none", enforcementActive: true });
  });
});

describe("mayUseBranch — the actual gate", () => {
  const open = decideBranchAccess({
    isOwner: false,
    assignments: [],
    assignmentCount: 0,
    date: TODAY,
  });
  const onlyA = decideBranchAccess({
    isOwner: false,
    assignments: [assign(A, "2026-01-01")],
    assignmentCount: 1,
    date: TODAY,
  });
  const nothing = decideBranchAccess({
    isOwner: false,
    assignments: [],
    assignmentCount: 1,
    date: TODAY,
  });

  it("allows everything while enforcement is off", () => {
    expect(mayUseBranch(open, A)).toBe(true);
    expect(mayUseBranch(open, B)).toBe(true);
  });

  it("allows the assigned branch and denies the other one", () => {
    expect(mayUseBranch(onlyA, A)).toBe(true);
    expect(mayUseBranch(onlyA, B)).toBe(false);
  });

  it("denies every branch when the member has none", () => {
    expect(mayUseBranch(nothing, A)).toBe(false);
    expect(mayUseBranch(nothing, B)).toBe(false);
  });

  it("always allows the unassigned bucket, so legacy rows stay reachable", () => {
    expect(mayUseBranch(nothing, undefined)).toBe(true);
    expect(mayUseBranch(nothing, null)).toBe(true);
    expect(mayUseBranch(onlyA, undefined)).toBe(true);
  });

  it("scopes reads to the assigned branches, or to none", () => {
    expect(scopedBranchIds(open)).toBeNull();
    expect(scopedBranchIds(onlyA)).toEqual([A]);
    expect(scopedBranchIds(nothing)).toEqual([]);
  });
});

describe("a record's branch is immutable", () => {
  it("accepts an unchanged branch", () => {
    expect(() => assertBranchUnchanged(A, A)).not.toThrow();
    expect(() => assertBranchUnchanged(undefined, undefined)).not.toThrow();
  });

  it("refuses a move between branches with a coded error", () => {
    expect(errorCode(catchError(() => assertBranchUnchanged(A, B)))).toBe(
      "BRANCH_IMMUTABLE",
    );
  });

  it("refuses assigning or clearing a branch as well", () => {
    expect(errorCode(catchError(() => assertBranchUnchanged(undefined, A)))).toBe(
      "BRANCH_IMMUTABLE",
    );
    expect(errorCode(catchError(() => assertBranchUnchanged(A, undefined)))).toBe(
      "BRANCH_IMMUTABLE",
    );
  });
});

function catchError(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return null;
}
