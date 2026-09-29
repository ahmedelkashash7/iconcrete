import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCapability, requireViewer } from "./access";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import { MAX_ROWS } from "./measures";

/**
 * Multi-branch support: one row per station (فرع).
 *
 * Every operational record (production, quality, materials, equipment) carries
 * an optional `branchId`, so the whole system can be reported for a single
 * station or consolidated for the group.
 */

const BRANCH_FIELDS = [
  "code",
  "name",
  "city",
  "address",
  "managerName",
  "phone",
  "capacityM3Day",
  "isActive",
  "notes",
] as const;

const MAX_BRANCHES = 200;
const DEFAULT_CAPACITY_M3_DAY = 1_200;

type AnyCtx = QueryCtx | MutationCtx;

/** The branch the system falls back to when a record does not name one. */
export async function defaultBranchId(ctx: AnyCtx) {
  const branches = await ctx.db.query("branches").take(MAX_BRANCHES);
  const active = branches.filter((branch) => branch.isActive);
  return (active[0] ?? branches[0])?._id;
}

function clean(text?: string) {
  return text?.trim() || undefined;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const branches = await ctx.db.query("branches").take(MAX_BRANCHES);
    return branches
      .map((branch) => ({
        _id: branch._id,
        code: branch.code,
        name: branch.name,
        city: branch.city ?? null,
        address: branch.address ?? null,
        managerName: branch.managerName ?? null,
        phone: branch.phone ?? null,
        capacityM3Day: branch.capacityM3Day ?? DEFAULT_CAPACITY_M3_DAY,
        isActive: branch.isActive,
        notes: branch.notes ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },
});

/**
 * Creates the first station and attaches the rows that predate the branch layer
 * to it — so the branch filter never hides existing data. Idempotent, so it can
 * also be called from the demo seeder.
 */
export async function ensureDefaultBranch(
  ctx: MutationCtx,
  actorId: Id<"users">,
): Promise<Id<"branches">> {
  const existing = await ctx.db.query("branches").take(MAX_BRANCHES);
  const first = existing[0];
  if (first) return first._id;

  const id = await ctx.db.insert("branches", {
    code: "MAIN",
    name: "المحطة الرئيسية",
    city: undefined,
    capacityM3Day: DEFAULT_CAPACITY_M3_DAY,
    isActive: true,
    notes: "أُنشئت تلقائيًا عند تفعيل إدارة الفروع.",
    createdBy: actorId,
  });

  const unassigned = async (
    table:
      | "productionLogs"
      | "qualityTests"
      | "materialMovements"
      | "materials"
      | "equipment",
  ) => {
    const rows = await ctx.db.query(table).take(MAX_ROWS);
    for (const row of rows) {
      if (row.branchId) continue;
      await ctx.db.patch(row._id, { branchId: id });
    }
  };

  await unassigned("productionLogs");
  await unassigned("qualityTests");
  await unassigned("materialMovements");
  await unassigned("materials");
  await unassigned("equipment");

  await recordAudit(ctx, {
    actorId,
    action: "create",
    entity: "branches",
    entityId: id,
    label: "المحطة الرئيسية",
    changes: [{ field: "name", after: "المحطة الرئيسية" }],
  });
  return id;
}

export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    return await ensureDefaultBranch(ctx, viewer.userId);
  },
});

const branchFields = {
  code: v.string(),
  name: v.string(),
  city: v.optional(v.string()),
  address: v.optional(v.string()),
  managerName: v.optional(v.string()),
  phone: v.optional(v.string()),
  capacityM3Day: v.number(),
  isActive: v.boolean(),
  notes: v.optional(v.string()),
};

export const create = mutation({
  args: branchFields,
  handler: async (ctx, fields) => {
    const viewer = await requireCapability(ctx, "manageBranches");
    if (!fields.code.trim()) throw new ConvexError("كود الفرع مطلوب");
    if (!fields.name.trim()) throw new ConvexError("اسم الفرع مطلوب");
    if (fields.capacityM3Day <= 0) {
      throw new ConvexError("الطاقة الإنتاجية اليومية يجب أن تكون أكبر من صفر");
    }

    const branches = await ctx.db.query("branches").take(MAX_BRANCHES);
    const code = fields.code.trim().toUpperCase();
    if (branches.some((branch) => branch.code.toUpperCase() === code)) {
      throw new ConvexError(`كود الفرع «${code}» مستخدم بالفعل`);
    }

    const record = {
      code,
      name: fields.name.trim(),
      city: clean(fields.city),
      address: clean(fields.address),
      managerName: clean(fields.managerName),
      phone: clean(fields.phone),
      capacityM3Day: Math.round(fields.capacityM3Day),
      isActive: fields.isActive,
      notes: clean(fields.notes),
      createdBy: viewer.userId,
    };
    const id = await ctx.db.insert("branches", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "branches",
      entityId: id,
      label: record.name,
      changes: snapshotRecord(record, "after", BRANCH_FIELDS),
    });
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("branches"), ...branchFields },
  handler: async (ctx, { id, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageBranches");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("الفرع لم يعد موجودًا");
    if (!fields.name.trim()) throw new ConvexError("اسم الفرع مطلوب");
    if (fields.capacityM3Day <= 0) {
      throw new ConvexError("الطاقة الإنتاجية اليومية يجب أن تكون أكبر من صفر");
    }

    const next = {
      code: fields.code.trim().toUpperCase() || existing.code,
      name: fields.name.trim(),
      city: clean(fields.city),
      address: clean(fields.address),
      managerName: clean(fields.managerName),
      phone: clean(fields.phone),
      capacityM3Day: Math.round(fields.capacityM3Day),
      isActive: fields.isActive,
      notes: clean(fields.notes),
    };
    await ctx.db.patch(id, next);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "branches",
      entityId: id,
      label: next.name,
      changes: diffRecords(existing, { ...existing, ...next }, BRANCH_FIELDS),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("branches") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "manageBranches");
    const existing = await ctx.db.get(id);
    if (!existing) return null;

    const used = [
      await ctx.db.query("productionLogs").withIndex("by_branch", (q) => q.eq("branchId", id)).take(1),
      await ctx.db.query("qualityTests").withIndex("by_branch", (q) => q.eq("branchId", id)).take(1),
      await ctx.db.query("materialMovements").withIndex("by_branch", (q) => q.eq("branchId", id)).take(1),
      await ctx.db.query("materials").withIndex("by_branch", (q) => q.eq("branchId", id)).take(1),
      await ctx.db.query("equipment").withIndex("by_branch", (q) => q.eq("branchId", id)).take(1),
    ].some((rows) => rows.length > 0);

    if (used) {
      throw new ConvexError(
        "لا يمكن حذف فرع مرتبط ببيانات — أوقف تشغيله بدل حذفه للحفاظ على السجل",
      );
    }

    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "branches",
      entityId: id,
      label: existing.name,
      changes: snapshotRecord(existing, "before", BRANCH_FIELDS),
    });
    return id;
  },
});
