import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { recordAudit } from "./auditLog";
import { demoModeEnabled } from "./demoMode";
import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  GUEST_ROLE,
  can,
  normalizeRole,
  roleLabel,
} from "./permissions";
import type { Capability, PlantRole, Viewer } from "./permissions";
import { plantRoleValidator } from "./schema";

type AnyCtx = QueryCtx | MutationCtx;

/** A viewer resolved on the server, where the user id is always a real doc id. */
export type ServerViewer = Viewer & { userId: Id<"users"> };

/**
 * Resolves the signed-in viewer together with their plant role.
 *
 * Anonymous viewers are rejected outright unless the deployment has DEMO_MODE
 * on (see ./demoMode). This is the single gate every query and mutation passes
 * through, so "the guest button is hidden" is not the control — this is.
 */
export async function requireViewer(ctx: AnyCtx): Promise<ServerViewer> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("سجّل الدخول للمتابعة");
  }
  const user = await ctx.db.get(userId);
  const isAnonymous = user?.isAnonymous === true;
  const demoMode = demoModeEnabled();
  if (isAnonymous && !demoMode) {
    throw new ConvexError(
      "الوصول كزائر معطّل على هذه النسخة. سجّل الدخول بحسابك للمتابعة.",
    );
  }
  return {
    userId,
    role: normalizeRole(user?.role),
    isAnonymous,
    demoMode,
  };
}

/** Same as `requireViewer` but rejects the call when the role lacks a right. */
export async function requireCapability(
  ctx: AnyCtx,
  capability: Capability,
): Promise<ServerViewer> {
  const viewer = await requireViewer(ctx);
  if (!can(viewer, capability)) {
    throw new ConvexError(
      `دورك الحالي (${roleLabel(viewer)}) لا يسمح بهذا الإجراء`,
    );
  }
  return viewer;
}

const MAX_USERS = 300;

/**
 * Capability gate for actions and cron jobs, which cannot call `requireCapability`
 * directly: they run outside the query/mutation context, so they hop through
 * this internal query instead.
 */
export const assertCapability = internalQuery({
  args: { capability: v.string() },
  handler: async (ctx, { capability }) => {
    await requireCapability(ctx, capability as Capability);
    return true;
  },
});

/**
 * Assigns a role to a member the first time they open the system.
 *
 * The first real account owns the plant setup; every later account starts as an
 * operator (daily data entry) until the owner promotes it. Anonymous sandbox
 * visitors run with manager-level access but can never delete records.
 */
export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;
    if (user.role) return normalizeRole(user.role);

    let role: PlantRole = "operator";
    if (user.isAnonymous === true) {
      // Only reachable while DEMO_MODE is on; requireViewer rejects guests
      // otherwise. Least-privileged role, and `can()` keeps guests read-only.
      if (!demoModeEnabled()) {
        throw new ConvexError(
          "الوصول كزائر معطّل على هذه النسخة. سجّل الدخول بحسابك للمتابعة.",
        );
      }
      role = GUEST_ROLE;
    } else {
      const users = await ctx.db.query("users").take(MAX_USERS);
      const alreadyOwned = users.some(
        (member) => normalizeRole(member.role) === "owner",
      );
      role = alreadyOwned ? "operator" : "owner";
    }

    await ctx.db.patch(userId, { role });
    return role;
  },
});

/**
 * Public flag telling the sign-in screen whether to offer the guest button.
 * It exposes no data — only whether this deployment is a demo — so it is safe
 * to answer for signed-out visitors.
 */
export const demoConfig = query({
  args: {},
  handler: async () => ({ demoMode: demoModeEnabled() }),
});

export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    if (!can(viewer, "viewTeam")) {
      throw new ConvexError("عرض بيانات الفريق متاح للمالك والمدير");
    }

    const users = await ctx.db.query("users").take(MAX_USERS);
    return users
      .filter((member) => member.isAnonymous !== true)
      .map((member) => ({
        _id: member._id,
        name: member.name ?? null,
        email: member.email ?? null,
        role: normalizeRole(member.role),
        joinedAt: member._creationTime,
      }))
      .sort((a, b) => a.joinedAt - b.joinedAt);
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: plantRoleValidator },
  handler: async (ctx, { userId, role }) => {
    const viewer = await requireCapability(ctx, "manageRoles");

    if (userId === viewer.userId) {
      throw new ConvexError(
        "لا يمكنك تغيير دورك الحالي بنفسك — اطلب من مالك آخر تعديله",
      );
    }

    const target = await ctx.db.get(userId);
    if (!target) {
      throw new ConvexError("العضو غير موجود");
    }

    if (normalizeRole(target.role) === "owner") {
      const users = await ctx.db.query("users").take(MAX_USERS);
      const owners = users.filter(
        (member) => normalizeRole(member.role) === "owner",
      ).length;
      if (owners <= 1) {
        throw new ConvexError("يجب أن يبقى مالك واحد على الأقل للنظام");
      }
    }

    const previousRole = normalizeRole(target.role);
    await ctx.db.patch(userId, { role });
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "role_change",
      entity: "users",
      entityId: userId,
      label: target.name?.trim() || target.email || "عضو الفريق",
      changes: [{ field: "role", before: previousRole ?? "", after: role }],
    });
    return role;
  },
});
