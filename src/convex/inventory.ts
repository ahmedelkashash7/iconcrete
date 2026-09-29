import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireCapability, requireViewer } from "./access";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import { defaultBranchId } from "./branches";
import { DATE_RE, MAX_ROWS, addDays, mulberry32, r2, utcToday } from "./measures";
import { can } from "./permissions";
import {
  materialCategoryValidator,
  materialUnitValidator,
  movementKindValidator,
} from "./schema";
import type { MaterialCategory, MaterialUnit, MovementKind } from "./schema";

/**
 * Stores & materials — cement, aggregates, sand and admixtures, together with
 * every receipt, issue to the mixer and stock-count adjustment.
 *
 * Balances are always derived from the movement ledger (opening balance +
 * receipts − issues ± adjustments), so a printed stock report can never
 * disagree with the movements that produced it.
 */

const MATERIAL_FIELDS = [
  "name",
  "category",
  "unit",
  "openingQty",
  "reorderLevel",
  "standardCost",
  "supplier",
  "isActive",
] as const;

const MOVEMENT_FIELDS = [
  "date",
  "kind",
  "materialId",
  "quantity",
  "unitCost",
  "supplier",
  "reference",
  "note",
] as const;

const MATERIALS_MAX = 400;

function clean(text?: string) {
  return text?.trim() || undefined;
}

function assertMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ConvexError(`${label} لا يمكن أن تكون سالبة`);
  }
}

/* ----------------------------- materials ---------------------------- */

const materialFields = {
  name: v.string(),
  category: materialCategoryValidator,
  unit: materialUnitValidator,
  openingQty: v.number(),
  reorderLevel: v.number(),
  standardCost: v.number(),
  supplier: v.optional(v.string()),
  isActive: v.boolean(),
};

export const createMaterial = mutation({
  args: { branchId: v.optional(v.id("branches")), ...materialFields },
  handler: async (ctx, { branchId, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    if (!fields.name.trim()) throw new ConvexError("اسم المادة مطلوب");
    assertMoney(fields.openingQty, "الرصيد الافتتاحي");
    assertMoney(fields.reorderLevel, "حد إعادة الطلب");
    assertMoney(fields.standardCost, "التكلفة المعيارية");

    const existing = await ctx.db.query("materials").take(MATERIALS_MAX);
    if (
      existing.some(
        (row) =>
          row.name.trim().toUpperCase() === fields.name.trim().toUpperCase() &&
          row.isActive,
      )
    ) {
      throw new ConvexError(`المادة «${fields.name.trim()}» مسجّلة بالفعل`);
    }

    const record = {
      branchId: branchId ?? (await defaultBranchId(ctx)),
      name: fields.name.trim(),
      category: fields.category as MaterialCategory,
      unit: fields.unit as MaterialUnit,
      openingQty: fields.openingQty,
      reorderLevel: fields.reorderLevel,
      standardCost: fields.standardCost,
      supplier: clean(fields.supplier),
      isActive: fields.isActive,
      updatedAt: Date.now(),
    };
    const id = await ctx.db.insert("materials", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "materials",
      entityId: id,
      label: record.name,
      changes: snapshotRecord(record, "after", MATERIAL_FIELDS),
    });
    return id;
  },
});

export const updateMaterial = mutation({
  args: { id: v.id("materials"), ...materialFields },
  handler: async (ctx, { id, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("المادة لم تعد موجودة");
    if (!fields.name.trim()) throw new ConvexError("اسم المادة مطلوب");
    assertMoney(fields.openingQty, "الرصيد الافتتاحي");
    assertMoney(fields.reorderLevel, "حد إعادة الطلب");
    assertMoney(fields.standardCost, "التكلفة المعيارية");

    const next = {
      name: fields.name.trim(),
      category: fields.category as MaterialCategory,
      unit: fields.unit as MaterialUnit,
      openingQty: fields.openingQty,
      reorderLevel: fields.reorderLevel,
      standardCost: fields.standardCost,
      supplier: clean(fields.supplier),
      isActive: fields.isActive,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(id, next);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "materials",
      entityId: id,
      label: next.name,
      changes: diffRecords(existing, { ...existing, ...next }, MATERIAL_FIELDS),
    });
    return id;
  },
});

export const removeMaterial = mutation({
  args: { id: v.id("materials") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    const existing = await ctx.db.get(id);
    if (!existing) return null;

    const used = await ctx.db
      .query("materialMovements")
      .withIndex("by_material", (q) => q.eq("materialId", id))
      .take(1);
    if (used.length > 0) {
      throw new ConvexError(
        "لا يمكن حذف مادة لها حركات مسجّلة — أوقف تفعيلها بدل حذفها للحفاظ على السجل",
      );
    }

    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "materials",
      entityId: id,
      label: existing.name,
      changes: snapshotRecord(existing, "before", MATERIAL_FIELDS),
    });
    return id;
  },
});

/* ----------------------------- movements ---------------------------- */

const movementFields = {
  date: v.string(),
  kind: movementKindValidator,
  materialId: v.id("materials"),
  quantity: v.number(),
  unitCost: v.optional(v.number()),
  supplier: v.optional(v.string()),
  reference: v.optional(v.string()),
  note: v.optional(v.string()),
};

/** Signed effect of a movement on the material balance. */
export function movementDelta(kind: MovementKind, quantity: number) {
  if (kind === "receipt") return Math.abs(quantity);
  if (kind === "issue") return -Math.abs(quantity);
  return quantity; // adjustments may be negative (stock count shortfall)
}

export const recordMovement = mutation({
  args: { branchId: v.optional(v.id("branches")), ...movementFields },
  handler: async (ctx, { branchId, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    if (!DATE_RE.test(fields.date)) {
      throw new ConvexError("تاريخ الحركة غير صالح (المطلوب YYYY-MM-DD)");
    }
    const material = await ctx.db.get(fields.materialId);
    if (!material) throw new ConvexError("المادة غير موجودة");
    if (!Number.isFinite(fields.quantity) || fields.quantity === 0) {
      throw new ConvexError("الكمية يجب أن تكون رقمًا مختلفًا عن صفر");
    }
    if (fields.kind !== "adjustment" && fields.quantity < 0) {
      throw new ConvexError("الكمية لا يمكن أن تكون سالبة — اختر نوع الحركة المناسب");
    }
    if (fields.unitCost !== undefined) {
      assertMoney(fields.unitCost, "تكلفة الوحدة");
    }

    const record = {
      branchId: branchId ?? material.branchId ?? (await defaultBranchId(ctx)),
      materialId: fields.materialId,
      date: fields.date,
      kind: fields.kind as MovementKind,
      quantity: r2(fields.quantity),
      unitCost: fields.unitCost !== undefined ? r2(fields.unitCost) : undefined,
      supplier: clean(fields.supplier),
      reference: clean(fields.reference),
      note: clean(fields.note),
      isTestData: false,
      createdBy: viewer.userId,
    };
    const id = await ctx.db.insert("materialMovements", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "materialMovements",
      entityId: id,
      label: `${material.name} · ${fields.kind}`,
      changes: snapshotRecord(record, "after", MOVEMENT_FIELDS),
    });
    return id;
  },
});

export const removeMovement = mutation({
  args: { id: v.id("materialMovements") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "manageInventory");
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "materialMovements",
      entityId: id,
      label: `${existing.kind} · ${existing.quantity}`,
      changes: snapshotRecord(existing, "before", MOVEMENT_FIELDS),
    });
    return id;
  },
});

/* ----------------------------- overview ----------------------------- */

type Balance = {
  material: Doc<"materials">;
  received: number;
  issued: number;
  adjusted: number;
  balance: number;
  value: number;
  coveredDays: number;
  dailyUsage: number;
  status: "ok" | "low" | "negative" | "idle";
  lastMovement: string | null;
};

export const overview = query({
  args: {
    days: v.optional(v.number()),
    today: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, { days: requestedDays, today: requestedToday, branchId }) => {
    const viewer = await requireViewer(ctx);
    const financialsVisible = can(viewer, "viewFinancials");
    const days = Math.min(Math.max(Math.round(requestedDays || 30), 7), 365);
    const today =
      requestedToday && DATE_RE.test(requestedToday) ? requestedToday : utcToday();
    const start = addDays(today, -(days - 1));

    const allMaterials = await ctx.db.query("materials").take(MATERIALS_MAX);
    const materials = allMaterials.filter(
      (row) => !branchId || !row.branchId || row.branchId === branchId,
    );

    const allMovements = (await ctx.db.query("materialMovements").take(MAX_ROWS)).filter(
      (row) => !branchId || !row.branchId || row.branchId === branchId,
    );

    const balances: Balance[] = materials.map((material) => {
      const rows = allMovements.filter((row) => row.materialId === material._id);
      let received = 0;
      let issued = 0;
      let adjusted = 0;
      let windowIssued = 0;
      let lastMovement: string | null = null;
      for (const row of rows) {
        if (row.kind === "receipt") received += row.quantity;
        else if (row.kind === "issue") issued += Math.abs(row.quantity);
        else adjusted += row.quantity;
        if (row.kind === "issue" && row.date >= start) windowIssued += Math.abs(row.quantity);
        if (!lastMovement || row.date > lastMovement) lastMovement = row.date;
      }
      const balance = r2(material.openingQty + received - issued + adjusted);
      const dailyUsage = r2(windowIssued / days);
      const coveredDays =
        dailyUsage > 0 ? Math.round((balance / dailyUsage) * 10) / 10 : 0;
      const status: Balance["status"] =
        balance < 0
          ? "negative"
          : dailyUsage > 0 && balance <= material.reorderLevel
            ? "low"
            : dailyUsage === 0
              ? "idle"
              : "ok";
      return {
        material,
        received: r2(received),
        issued: r2(issued),
        adjusted: r2(adjusted),
        balance,
        value: financialsVisible ? r2(balance * material.standardCost) : 0,
        coveredDays,
        dailyUsage,
        status,
        lastMovement,
      };
    });

    const ledger = allMovements
      .filter((row) => row.date >= start)
      .sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime)
      .slice(0, 120)
      .map((row) => ({
        _id: row._id,
        date: row.date,
        kind: row.kind,
        quantity: row.quantity,
        unitCost: financialsVisible ? (row.unitCost ?? 0) : 0,
        total:
          financialsVisible && row.unitCost
            ? r2(Math.abs(row.quantity) * row.unitCost)
            : 0,
        supplier: row.supplier ?? null,
        reference: row.reference ?? null,
        note: row.note ?? null,
        materialId: row.materialId,
        materialName:
          materials.find((material) => material._id === row.materialId)?.name ??
          "مادة محذوفة",
        unit:
          materials.find((material) => material._id === row.materialId)?.unit ?? "ton",
      }));

    const monthStart = addDays(today, -29);
    const monthMovements = allMovements.filter((row) => row.date >= monthStart);
    const purchaseValue = financialsVisible
      ? r2(
          monthMovements
            .filter((row) => row.kind === "receipt")
            .reduce((sum, row) => sum + Math.abs(row.quantity) * (row.unitCost ?? 0), 0),
        )
      : 0;

    const lowStock = balances
      .filter(
        (row) =>
          row.material.isActive &&
          (row.status === "low" || row.status === "negative"),
      )
      .map((row) => ({
        _id: row.material._id,
        name: row.material.name,
        unit: row.material.unit,
        balance: row.balance,
        reorderLevel: row.material.reorderLevel,
        coveredDays: row.coveredDays,
        status: row.status,
      }))
      .sort((a, b) => a.coveredDays - b.coveredDays);

    const quantityByMaterial = balances.map((row) => ({
      key: row.material.name,
      category: row.material.category,
      unit: row.material.unit,
      balance: row.balance,
      issued: row.issued,
      value: row.value,
      coveredDays: row.coveredDays,
    }));

    return {
      range: { days, start, end: today },
      branchId: branchId ?? null,
      financialsVisible,
      materials: balances
        .map((row) => ({
          _id: row.material._id,
          name: row.material.name,
          category: row.material.category,
          unit: row.material.unit,
          supplier: row.material.supplier ?? null,
          openingQty: row.material.openingQty,
          reorderLevel: row.material.reorderLevel,
          isActive: row.material.isActive,
          standardCost: financialsVisible ? row.material.standardCost : 0,
          received: row.received,
          issued: row.issued,
          adjusted: row.adjusted,
          balance: row.balance,
          value: row.value,
          dailyUsage: row.dailyUsage,
          coveredDays: row.coveredDays,
          status: row.status,
          lastMovement: row.lastMovement,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ar")),
      ledger,
      lowStock,
      quantityByMaterial,
      totals: {
        materials: balances.length,
        activeMaterials: balances.filter((row) => row.material.isActive).length,
        lowStock: lowStock.length,
        stockValue: r2(balances.reduce((sum, row) => sum + row.value, 0)),
        monthReceipts: monthMovements.filter((row) => row.kind === "receipt").length,
        monthIssues: monthMovements.filter((row) => row.kind === "issue").length,
        purchaseValue,
      },
      hasData: balances.length > 0,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Demo materials and movements (Test_Data_Flag = true)                */
/* ------------------------------------------------------------------ */

const MATERIAL_SPECS: Array<{
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  opening: number;
  /** Consumption per produced m³ of concrete. */
  ratio: number;
  cost: number;
  supplier: string;
  bufferDays: number;
}> = [
  {
    name: "أسمنت بورتلاندي CEM I 42.5",
    category: "cement",
    unit: "ton",
    opening: 420,
    ratio: 0.38,
    cost: 3450,
    supplier: "أسمنت السويس",
    bufferDays: 8,
  },
  {
    name: "ركام كبير (20 مم)",
    category: "aggregate",
    unit: "m3",
    opening: 1200,
    ratio: 0.62,
    cost: 320,
    supplier: "محاجر عتاقة",
    bufferDays: 7,
  },
  {
    name: "ركام متوسط (10 مم)",
    category: "aggregate",
    unit: "m3",
    opening: 800,
    ratio: 0.34,
    cost: 315,
    supplier: "محاجر عتاقة",
    bufferDays: 7,
  },
  {
    name: "رمل غسيل",
    category: "sand",
    unit: "m3",
    opening: 1400,
    ratio: 0.45,
    cost: 245,
    supplier: "كسارات الفيوم",
    bufferDays: 7,
  },
  {
    name: "إضافات ملدّنة (Superplasticizer)",
    category: "admixture",
    unit: "liter",
    opening: 6000,
    ratio: 3.2,
    cost: 42,
    supplier: "BASF للكيماويات",
    bufferDays: 10,
  },
  {
    name: "ماء الخلط",
    category: "water",
    unit: "m3",
    opening: 400,
    ratio: 0.16,
    cost: 12,
    supplier: "شبكة مياه المحطة",
    bufferDays: 10,
  },
];

/** Rated daily production used to size the demo reorder levels (3 days). */
const RATED_DAILY_M3 = 250;

export async function seedMaterials(
  ctx: MutationCtx,
  branchId: Id<"branches"> | undefined,
): Promise<Map<string, Id<"materials">>> {
  const ids = new Map<string, Id<"materials">>();
  const existing = await ctx.db.query("materials").take(MATERIALS_MAX);
  for (const spec of MATERIAL_SPECS) {
    const found = existing.find((row) => row.name === spec.name);
    if (found) {
      ids.set(spec.name, found._id);
      continue;
    }
    const id = await ctx.db.insert("materials", {
      branchId,
      name: spec.name,
      category: spec.category,
      unit: spec.unit,
      openingQty: spec.opening,
      reorderLevel: Math.round(spec.ratio * RATED_DAILY_M3 * 3),
      standardCost: spec.cost,
      supplier: spec.supplier,
      isActive: true,
      updatedAt: Date.now(),
    });
    ids.set(spec.name, id);
  }
  return ids;
}

/**
 * Replays the demo production day by day: each day consumes materials, and a
 * replenishment is ordered whenever the balance dips below the reorder level.
 */
export async function seedMaterialMovements(
  ctx: MutationCtx,
  branchId: Id<"branches"> | undefined,
  materialIds: Map<string, Id<"materials">>,
  dailyProductionM3: Map<string, number>,
  today: string,
  seed: number,
): Promise<number> {
  const random = mulberry32(seed);
  const start = addDays(today, -119);
  const balances = new Map<string, number>();
  for (const spec of MATERIAL_SPECS) balances.set(spec.name, spec.opening);

  let inserted = 0;

  for (let cursor = start; cursor <= today; cursor = addDays(cursor, 1)) {
    const producedM3 = dailyProductionM3.get(cursor) ?? 0;
    if (producedM3 <= 0) continue;

    for (const spec of MATERIAL_SPECS) {
      const materialId = materialIds.get(spec.name);
      if (!materialId) continue;

      const consumed = Math.round(spec.ratio * producedM3 * 100) / 100;
      const balance = (balances.get(spec.name) ?? 0) - consumed;
      balances.set(spec.name, balance);

      await ctx.db.insert("materialMovements", {
        branchId,
        materialId,
        date: cursor,
        kind: "issue",
        quantity: consumed,
        reference: `صرف تشغيل ${cursor}`,
        note: undefined,
        isTestData: true,
      });
      inserted += 1;

      const reorderLevel = spec.ratio * RATED_DAILY_M3 * 3;
      if (balance <= reorderLevel) {
        const restock =
          Math.round(spec.ratio * RATED_DAILY_M3 * spec.bufferDays * (0.96 + random() * 0.14) * 100) /
          100;
        const unitCost = Math.round(spec.cost * (0.94 + random() * 0.12));
        balances.set(spec.name, balance + restock);
        await ctx.db.insert("materialMovements", {
          branchId,
          materialId,
          date: cursor,
          kind: "receipt",
          quantity: restock,
          unitCost,
          supplier: spec.supplier,
          reference: `توريد ${cursor}`,
          isTestData: true,
        });
        inserted += 1;
      }
    }
  }

  // Every two weeks the storekeeper counts the silos; the shortfall is booked
  // as a documented adjustment instead of being hidden inside a receipt.
  for (let cursor = addDays(today, -112); cursor <= today; cursor = addDays(cursor, 14)) {
    for (const spec of MATERIAL_SPECS) {
      if (spec.category !== "cement") continue;
      const materialId = materialIds.get(spec.name);
      if (!materialId) continue;
      const variance = -Math.round((6 + random() * 14) * 10) / 10;
      await ctx.db.insert("materialMovements", {
        branchId,
        materialId,
        date: cursor,
        kind: "adjustment",
        quantity: variance,
        note: "جرد دوري للصومعة — فرق موثّق",
        isTestData: true,
      });
      inserted += 1;
    }
  }

  return inserted;
}
