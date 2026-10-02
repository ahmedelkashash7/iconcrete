import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireCapability, requireViewer } from "./access";
import { seedAlertRules } from "./alerts";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import { ensureDefaultBranch } from "./branches";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  DATE_RE,
  MAX_ROWS,
  addDays,
  enrichLog,
  mulberry32,
  r2,
  utcToday,
} from "./measures";
import { seedEquipment } from "./forecast";
import { seedMaterialMovements, seedMaterials } from "./inventory";
import { can, canEditLog } from "./permissions";
import type { Viewer } from "./permissions";
import { standardPricing } from "./pricing";
import { seedQualityTests } from "./quality";
import { loadMixPrices } from "./settings";
import { logStatusValidator, shiftValidator } from "./schema";
import type { LogStatus, Shift } from "./schema";

/** Fields shared by create/update so both are validated identically. */
const logFields = {
  branchId: v.optional(v.id("branches")),
  date: v.string(),
  shift: shiftValidator,
  mixDesign: v.string(),
  customer: v.string(),
  site: v.optional(v.string()),
  orderRef: v.optional(v.string()),
  quantityM3: v.number(),
  deliveredM3: v.number(),
  returnedM3: v.number(),
  pricePerM3: v.number(),
  costPerM3: v.number(),
  truckCount: v.number(),
  onTime: v.boolean(),
  status: logStatusValidator,
  notes: v.optional(v.string()),
};

type LogInput = {
  branchId?: Id<"branches">;
  date: string;
  shift: Shift;
  mixDesign: string;
  customer: string;
  site?: string;
  orderRef?: string;
  quantityM3: number;
  deliveredM3: number;
  returnedM3: number;
  pricePerM3: number;
  costPerM3: number;
  truckCount: number;
  onTime: boolean;
  status: LogStatus;
  notes?: string;
};

/** Error prevention: every entry passes through the same rule set. */
function assertValid(input: LogInput) {
  const numbers = [
    input.quantityM3,
    input.deliveredM3,
    input.returnedM3,
    input.pricePerM3,
    input.costPerM3,
    input.truckCount,
  ];
  if (numbers.some((n) => !Number.isFinite(n))) {
    throw new ConvexError("كل الحقول الرقمية يجب أن تكون أرقامًا صحيحة");
  }
  if (!DATE_RE.test(input.date)) {
    throw new ConvexError("تاريخ غير صالح (المطلوب YYYY-MM-DD)");
  }
  if (!input.customer.trim()) {
    throw new ConvexError("اسم العميل مطلوب");
  }
  if (!input.mixDesign.trim()) {
    throw new ConvexError("نوع الخلطة مطلوب");
  }
  if (input.quantityM3 <= 0) {
    throw new ConvexError("الكمية المنتجة يجب أن تكون أكبر من صفر");
  }
  if (input.deliveredM3 < 0 || input.returnedM3 < 0) {
    throw new ConvexError("الكميات لا يمكن أن تكون بالسالب");
  }
  if (input.deliveredM3 + input.returnedM3 > input.quantityM3 + 0.01) {
    throw new ConvexError(
      "الكمية المسلّمة + المرتجعة لا يمكن أن تتجاوز الكمية المنتجة",
    );
  }
  if (input.pricePerM3 <= 0) {
    throw new ConvexError("سعر البيع للمتر يجب أن يكون أكبر من صفر");
  }
  if (input.costPerM3 < 0) {
    throw new ConvexError("تكلفة المتر لا يمكن أن تكون سالبة");
  }
  if (input.truckCount < 0) {
    throw new ConvexError("عدد العربات لا يمكن أن يكون سالبًا");
  }
}

/**
 * Prices are never typed by roles that cannot see money: the plant's approved
 * price list — now stored in `mixPrices` and edited from «إعدادات المحطة» — is
 * applied on the server before the entry is validated.
 */
async function applyStandardPricing(
  ctx: MutationCtx,
  viewer: Viewer,
  input: LogInput,
): Promise<LogInput> {
  if (can(viewer, "viewFinancials")) return input;
  const prices = await loadMixPrices(ctx);
  const preset = standardPricing(input.mixDesign, prices);
  return { ...input, pricePerM3: preset.price, costPerM3: preset.cost };
}

/** Rejects an entry that names a branch which no longer exists. */
async function resolveBranch(
  ctx: MutationCtx,
  branchId: Id<"branches"> | undefined,
): Promise<Id<"branches"> | undefined> {
  if (!branchId) return undefined;
  const branch = await ctx.db.get(branchId);
  if (!branch) throw new ConvexError("الفرع المختار لم يعد موجودًا");
  return branchId;
}

/** Strips every money field from a row before it reaches a restricted role. */
function redactFinancials<
  T extends {
    pricePerM3: number;
    costPerM3: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
  },
>(row: T): T {
  return {
    ...row,
    pricePerM3: 0,
    costPerM3: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    marginPct: 0,
  };
}

export const list = query({
  args: {
    from: v.string(),
    to: v.string(),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, { from, to, branchId }) => {
    const viewer = await requireViewer(ctx);
    const logs = await ctx.db
      .query("productionLogs")
      .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
      .order("desc")
      .take(MAX_ROWS);

    const scoped = branchId ? logs.filter((log) => log.branchId === branchId) : logs;
    const rows = scoped.map(enrichLog);
    const financialsVisible = can(viewer, "viewFinancials");

    return {
      financialsVisible,
      rows: financialsVisible ? rows : rows.map(redactFinancials),
    };
  },
});

export const create = mutation({
  args: logFields,
  handler: async (ctx, fields) => {
    const viewer = await requireCapability(ctx, "createLog");
    const priced = await applyStandardPricing(ctx, viewer, fields);
    assertValid(priced);
    const branchId = await resolveBranch(ctx, priced.branchId);
    const record = {
      ...priced,
      branchId,
      customer: priced.customer.trim(),
      mixDesign: priced.mixDesign.trim(),
      site: priced.site?.trim() || undefined,
      orderRef: priced.orderRef?.trim() || undefined,
      notes: priced.notes?.trim() || undefined,
      quantityM3: r2(priced.quantityM3),
      deliveredM3: r2(priced.deliveredM3),
      returnedM3: r2(priced.returnedM3),
      pricePerM3: r2(priced.pricePerM3),
      costPerM3: r2(priced.costPerM3),
      isTestData: false,
      createdBy: viewer.userId,
    };
    const id = await ctx.db.insert("productionLogs", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "productionLogs",
      entityId: id,
      label: record.customer,
      changes: snapshotRecord(record, "after"),
    });
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("productionLogs"), ...logFields },
  handler: async (ctx, { id, ...fields }) => {
    const viewer = await requireViewer(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new ConvexError("القيد لم يعد موجودًا");
    }
    if (!canEditLog(viewer, existing, utcToday())) {
      throw new ConvexError(
        "لا يمكنك تعديل هذا القيد بدورك الحالي — المشغّل يعدّل قيود يومه فقط",
      );
    }

    const priced = await applyStandardPricing(ctx, viewer, fields);
    assertValid(priced);
    const branchId = await resolveBranch(ctx, priced.branchId ?? existing.branchId);
    const next = {
      ...priced,
      branchId,
      customer: priced.customer.trim(),
      mixDesign: priced.mixDesign.trim(),
      site: priced.site?.trim() || undefined,
      orderRef: priced.orderRef?.trim() || undefined,
      notes: priced.notes?.trim() || undefined,
      quantityM3: r2(priced.quantityM3),
      deliveredM3: r2(priced.deliveredM3),
      returnedM3: r2(priced.returnedM3),
      pricePerM3: r2(priced.pricePerM3),
      costPerM3: r2(priced.costPerM3),
    };
    await ctx.db.patch(id, next);
    const changes = diffRecords(existing, { ...existing, ...next });
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "update",
      entity: "productionLogs",
      entityId: id,
      label: next.customer,
      changes,
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("productionLogs") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "deleteLog");
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "productionLogs",
      entityId: id,
      label: existing.customer,
      changes: snapshotRecord(existing, "before"),
    });
    return id;
  },
});

/**
 * Purges only rows carrying Test_Data_Flag — real entries are never touched.
 * Master data (the material list, the fleet, the approved prices and the alert
 * rules) is configuration, so it survives the purge.
 */
export const clearTestData = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireCapability(ctx, "manageTestData");

    const logs = await ctx.db.query("productionLogs").withIndex("by_date").take(MAX_ROWS);
    const testLogs = logs.filter((row) => row.isTestData);
    for (const row of testLogs) {
      await ctx.db.delete(row._id);
    }

    const tests = await ctx.db.query("qualityTests").withIndex("by_date").take(MAX_ROWS);
    const testTests = tests.filter((row) => row.isTestData);
    for (const row of testTests) {
      await ctx.db.delete(row._id);
    }

    const movements = (await ctx.db.query("materialMovements").take(MAX_ROWS)).filter(
      (row) => row.isTestData,
    );
    for (const row of movements) {
      await ctx.db.delete(row._id);
    }

    const total = testLogs.length + testTests.length + movements.length;
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "purge",
      entity: "productionLogs",
      label: `${testLogs.length} قيد · ${testTests.length} اختبار جودة · ${movements.length} حركة مخزون`,
      changes: [],
    });
    return total;
  },
});

/* ------------------------------------------------------------------ */
/* Demo data (Test_Data_Flag = true)                                   */
/* ------------------------------------------------------------------ */

const MIXES = [
  { name: "C20/25", price: 1290, cost: 1045 },
  { name: "C25/30", price: 1405, cost: 1118 },
  { name: "C30/37", price: 1530, cost: 1205 },
  { name: "C35/45", price: 1665, cost: 1312 },
  { name: "C40/50", price: 1820, cost: 1438 },
];

const CUSTOMERS = [
  "المقاولون العرب",
  "أوراسكوم للإنشاء والصناعة",
  "حسن علام للإنشاءات",
  "وادي النيل للمقاولات",
  "طلعت مصطفى جروب",
  "السويدي للمقاولات",
  "المصرية للتعمير",
  "بتروجت",
];

const SITES = [
  "العاصمة الإدارية - حي R7",
  "التجمع الخامس - امتداد الحي الأول",
  "مدينة العلمين الجديدة - المرحلة 2",
  "محور روض الفرج",
  "توسعات مترو الأنفاق - المرحلة 4",
  "منطقة لوجستية - العين السخنة",
];

const SHIFTS: Shift[] = ["morning", "evening", "night"];

/**
 * Lightweight status used by the client to fill the demo estate exactly once,
 * so every screen has something to show on a fresh deployment.
 */
export const demoStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const [logs, quality, materials, equipment, branches] = await Promise.all([
      ctx.db.query("productionLogs").take(1),
      ctx.db.query("qualityTests").take(1),
      ctx.db.query("materials").take(1),
      ctx.db.query("equipment").take(1),
      ctx.db.query("branches").take(1),
    ]);
    return {
      hasLogs: logs.length > 0,
      hasQuality: quality.length > 0,
      hasMaterials: materials.length > 0,
      hasEquipment: equipment.length > 0,
      hasBranches: branches.length > 0,
      isEmpty:
        logs.length === 0 &&
        quality.length === 0 &&
        materials.length === 0 &&
        equipment.length === 0,
    };
  },
});

/**
 * Seeds the demo estate one layer at a time, so the button also repairs a
 * deployment that already holds an older demo ledger: the ledger is only
 * generated when the plant is empty, and the quality samples, stores, fleet and
 * alert rules are filled in whenever their own table is still empty.
 */
export const seedDemoData = mutation({
  args: { today: v.optional(v.string()) },
  handler: async (ctx, { today }) => {
    const viewer = await requireCapability(ctx, "manageTestData");
    const anchor = today && DATE_RE.test(today) ? today : utcToday();
    const branchId = await ensureDefaultBranch(ctx, viewer.userId);
    const random = mulberry32(20260929);
    const rows: Array<LogInput & { isTestData: boolean }> = [];
    const existingLogs = await ctx.db
      .query("productionLogs")
      .withIndex("by_date")
      .take(MAX_ROWS);

    for (let offset = existingLogs.length === 0 ? 89 : -1; offset >= 0; offset -= 1) {
      const date = addDays(anchor, -offset);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 5 = Friday (weekend)
      const monthFactor = 1 + 0.06 * Math.sin((offset / 30) * Math.PI);
      // Roughly every two weeks a disrupted day lands in the ledger (rain, site
      // shutdown, waiting time). Those days genuinely run at a loss.
      const disruptedDay = offset % 14 === 3;

      let entries = random() < 0.35 ? 2 : 3;
      if (weekday === 5) entries = random() < 0.55 ? 0 : 1;
      else if (weekday === 6) entries = Math.max(1, entries - 1);

      for (let i = 0; i < entries; i += 1) {
        const mix = MIXES[Math.floor(random() * MIXES.length)];
        const shift: Shift =
          random() < 0.42 ? SHIFTS[0] : random() < 0.62 ? SHIFTS[1] : SHIFTS[2];
        // Skewed pick: the first customers stay the biggest accounts.
        const customer = CUSTOMERS[Math.floor(random() ** 1.7 * CUSTOMERS.length)];
        const site = SITES[Math.floor(random() * SITES.length)];

        const quantity = Math.round((34 + random() * 108) * monthFactor);
        const returned =
          random() < 0.34 ? Math.round(quantity * (0.01 + random() * 0.07)) : 0;
        const delivered = Math.max(1, quantity - returned);
        const price = mix.price * (disruptedDay ? 0.9 : 0.94 + random() * 0.11);
        // A hard pour (long haul, pump waiting, night shift) carries extra cost,
        // which is what pushes some rows below the break-even line.
        const hardPour = disruptedDay || random() < 0.09;
        const cost =
          mix.cost *
          (0.96 + random() * 0.2) *
          (disruptedDay ? 1.32 : hardPour ? 1.22 : 1);
        const truckCount = Math.max(1, Math.round(quantity / 9));
        const roll = random();
        const status: LogStatus =
          offset === 0 && roll > 0.86
            ? "in_progress"
            : roll > 0.975
              ? "cancelled"
              : "delivered";

        rows.push({
          branchId,
          date,
          shift,
          mixDesign: mix.name,
          customer,
          site,
          orderRef: `IC-${date.replace(/-/g, "").slice(2)}-${(i + 1)
            .toString()
            .padStart(2, "0")}`,
          quantityM3: r2(quantity),
          deliveredM3: r2(delivered),
          returnedM3: r2(returned),
          pricePerM3: r2(price),
          costPerM3: r2(cost),
          truckCount,
          onTime: random() < (status === "delivered" ? 0.91 : 0.72),
          status,
          notes: disruptedDay
            ? "يوم متعثر: تأخير في الموقع وتوقف عربات — تكلفة تشغيل إضافية"
            : hardPour
              ? "صب بطلمبة مع تأخير — تكلفة تشغيل إضافية"
              : undefined,
          isTestData: true,
        });
      }
    }

    for (const row of rows) {
      await ctx.db.insert("productionLogs", row);
    }

    const logs =
      rows.length > 0
        ? await ctx.db.query("productionLogs").withIndex("by_date").take(MAX_ROWS)
        : existingLogs;

    const dailyProductionM3 = new Map<string, number>();
    for (const log of logs) {
      if (log.status === "cancelled") continue;
      dailyProductionM3.set(
        log.date,
        (dailyProductionM3.get(log.date) ?? 0) + log.deliveredM3,
      );
    }

    // Everything else is derived from the same pours, so quality samples,
    // material consumption and the maintenance clock all line up.
    let quality = 0;
    if ((await ctx.db.query("qualityTests").take(1)).length === 0) {
      quality = await seedQualityTests(
        ctx,
        branchId,
        logs.map((log) => ({
          date: log.date,
          mixDesign: log.mixDesign,
          customer: log.customer,
          site: log.site ?? undefined,
          orderRef: log.orderRef ?? undefined,
        })),
        anchor,
        20260930,
      );
    }

    const materialIds = await seedMaterials(ctx, branchId);
    let movements = 0;
    if ((await ctx.db.query("materialMovements").take(1)).length === 0) {
      movements = await seedMaterialMovements(
        ctx,
        branchId,
        materialIds,
        dailyProductionM3,
        anchor,
        20260931,
      );
    }

    let equipment = 0;
    if ((await ctx.db.query("equipment").take(1)).length === 0) {
      equipment = await seedEquipment(ctx, branchId, anchor, 20260932);
    }

    let rules = 0;
    if ((await ctx.db.query("alertRules").take(1)).length === 0) {
      const plant = (await ctx.db.query("plantSettings").take(1))[0];
      const owner = await ctx.db.get(viewer.userId);
      const recipients = plant?.alertEmail
        ? [plant.alertEmail]
        : owner?.email
          ? [owner.email]
          : [];
      rules = await seedAlertRules(ctx, viewer.userId, recipients);
    }

    if (rows.length > 0 || quality > 0 || movements > 0) {
      await recordAudit(ctx, {
        actorId: viewer.userId,
        action: "seed",
        entity: "productionLogs",
        label: `${rows.length} قيد · ${quality} اختبار جودة · ${movements} حركة مخزون · ${equipment} معدة`,
        changes: [],
      });
    }

    return {
      inserted: rows.length,
      skipped: rows.length === 0,
      quality,
      movements,
      equipment,
      rules,
      materials: materialIds.size,
    };
  },
});
