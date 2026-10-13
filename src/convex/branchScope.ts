import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { ServerViewer } from "./access";
import { MAX_ROWS } from "./measures";

/**
 * IConcrete System — branch scope enforcement (phase 1.4).
 *
 * Branch used to be nothing but a UI filter: `list`-style queries took an
 * optional `branchId` argument and the interface passed whatever the operator
 * had selected. Anyone could read or write another station's records by changing
 * the filter, or by calling the API directly.
 *
 * This module answers one question for the server: *which branches may this
 * viewer touch?* It reads `userBranches` (assignment + effective dates) and is
 * used by the write paths and by `scopedBranchIds` for filtering reads.
 *
 * ## Migration safety
 *
 * Deny-by-default on a deployment where nobody has been assigned a branch yet
 * would lock the whole plant out of its own data on the first deploy. So the
 * resolver distinguishes three states:
 *
 *   - `all`            — owner, or the plant has not started assigning branches.
 *                        Enforcement is **off** and `enforcementActive` is false,
 *                        which the Sync Center surfaces as a warning.
 *   - `assigned`       — at least one assignment exists, so enforcement is on and
 *                        the viewer is limited to their effective branches.
 *   - `none`           — enforcement is on and this viewer has no effective
 *                        assignment: they can read nothing and write nothing.
 *
 * The owner is never limited. Once the owner assigns the team (Phase 1.4 step 2
 * in `docs/OWNER_GUIDE_AR.md`), enforcement turns itself on for everyone else.
 *
 * ## The enforcement decision is pure
 *
 * `decideBranchAccess` and `mayUseBranch` take plain data and return plain data,
 * so the policy — including the "exactly on the effective date" boundary — is
 * unit-tested in `branchScope.test.ts` without a database.
 */

export type BranchScope =
  /** Every branch (owner, or branch assignment has not started). */
  | { kind: "all"; enforcementActive: boolean; reason: "owner" | "not_configured" }
  /** Enforcement is on: only these branches. */
  | { kind: "assigned"; enforcementActive: true; branchIds: Id<"branches">[] }
  /** Enforcement is on and this viewer has nothing. */
  | { kind: "none"; enforcementActive: true };

export type Assignment = {
  branchId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

/**
 * Pure policy: the branch ids an assignment list grants on `date`.
 *
 * A boundary is inclusive on **both** ends: an assignment that starts on the test
 * date is in force, and one that ends on the test date is still in force. ISO
 * `YYYY-MM-DD` strings compare correctly as strings, which keeps this exact
 * without constructing Date objects.
 */
export function effectiveBranchIds(assignments: Assignment[], date: string): string[] {
  const granted = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.effectiveFrom > date) continue;
    if (assignment.effectiveTo !== null && date > assignment.effectiveTo) continue;
    granted.add(assignment.branchId);
  }
  return [...granted];
}

/** Pure policy: builds the scope from an already-loaded state. */
export function decideBranchAccess(input: {
  isOwner: boolean;
  assignments: Assignment[];
  /** How many assignment rows exist in the whole deployment. */
  assignmentCount: number;
  date: string;
}): BranchScope {
  if (input.isOwner) {
    return { kind: "all", enforcementActive: false, reason: "owner" };
  }
  if (input.assignmentCount === 0) {
    // Nobody has been assigned yet — the plant is still on the old behaviour.
    return { kind: "all", enforcementActive: false, reason: "not_configured" };
  }
  const branchIds = effectiveBranchIds(input.assignments, input.date);
  if (branchIds.length === 0) return { kind: "none", enforcementActive: true };
  return {
    kind: "assigned",
    enforcementActive: true,
    branchIds: branchIds as Id<"branches">[],
  };
}

/**
 * Pure policy: may this scope use this branch?
 *
 * `undefined` (a legacy record with no branch, or a record being created without
 * one) is allowed: the unassigned bucket predates the branch layer and refusing
 * it would hide existing data. Every *explicit* branch id is checked.
 */
export function mayUseBranch(scope: BranchScope, branchId: string | null | undefined): boolean {
  if (!scope.enforcementActive) return true;
  if (scope.kind === "all") return true;
  if (!branchId) return true;
  if (scope.kind === "none") return false;
  return scope.branchIds.includes(branchId as Id<"branches">);
}

/** Every branch the scope may read, or null for "no restriction". */
export function scopedBranchIds(scope: BranchScope): Id<"branches">[] | null {
  if (!scope.enforcementActive) return null;
  if (scope.kind === "assigned") return scope.branchIds;
  if (scope.kind === "none") return [];
  return null;
}

/* ------------------------------------------------------- database wrappers */

async function loadAssignments(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{ assignments: Assignment[]; assignmentCount: number }> {
  const all = await ctx.db.query("userBranches").take(MAX_ROWS);
  const mine = all.filter((row) => row.userId === userId);
  return {
    assignmentCount: all.length,
    assignments: mine.map((row) => ({
      branchId: row.branchId as string,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo ?? null,
    })),
  };
}

/** Resolves the viewer's branch scope for `date` (defaults to today, UTC). */
export async function resolveBranchScope(
  ctx: QueryCtx | MutationCtx,
  viewer: ServerViewer,
  date: string = new Date().toISOString().slice(0, 10),
): Promise<BranchScope> {
  const { assignments, assignmentCount } = await loadAssignments(ctx, viewer.userId);
  return decideBranchAccess({
    isOwner: viewer.role === "owner",
    assignments,
    assignmentCount,
    date,
  });
}

/**
 * Throws `BRANCH_DENIED` when the viewer may not touch `branchId`.
 * Call this at the top of every write, before any other validation, and in every
 * read that takes a branch argument.
 */
export async function requireBranchAccess(
  ctx: QueryCtx | MutationCtx,
  viewer: ServerViewer,
  branchId: string | null | undefined,
  date?: string,
): Promise<BranchScope> {
  const scope = await resolveBranchScope(ctx, viewer, date);
  if (!mayUseBranch(scope, branchId)) {
    throw new ConvexError({
      code: "BRANCH_DENIED",
      title: "فرع غير مصرّح",
      message:
        "هذا الفرع غير مُسند إليك. اطلب من المالك إسناد الفرع إليك بتاريخ سريان من شاشة الفريق والصلاحيات، ثم أعد المحاولة.",
      retryable: false,
    });
  }
  return scope;
}

/**
 * Rejects any attempt to *move* a record between branches. A record's branch is
 * fixed at creation: moving it would silently rewrite which station's books the
 * row belongs to.
 */
export function assertBranchUnchanged(
  existingBranchId: string | null | undefined,
  nextBranchId: string | null | undefined,
): void {
  const before = existingBranchId ?? null;
  const after = nextBranchId ?? null;
  if (before !== after) {
    throw new ConvexError({
      code: "BRANCH_IMMUTABLE",
      title: "فرع السجل غير قابل للتغيير",
      message:
        "لا يمكن نقل سجل من فرع إلى آخر بعد حفظه. أنشئ سجلًا جديدًا على الفرع الصحيح، وألغِ القديم مع ذكر السبب.",
      retryable: false,
    });
  }
}
