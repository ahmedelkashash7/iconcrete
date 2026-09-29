import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCapability, requireViewer } from "./access";
import { diffRecords, recordAudit, snapshotRecord } from "./auditLog";
import { MAX_ROWS } from "./measures";
import { can } from "./permissions";
import { STANDARD_MIX_PRICES, strengthFromName } from "./pricing";
import type { MixPrice } from "./pricing";

/**
 * Station settings — the plant's approved price list and its identity.
 *
 * `production.ts` prices every operator entry from this table, so the same
 * approved numbers drive the ledger, the dashboard and the printed reports.
 */

const MIX_FIELDS = [
  "name",
  "price",
  "cost",
  "strengthMpa",
  "cementKgPerM3",
  "isActive",
  "notes",
] as const;

const PLANT_FIELDS = [
  "plantName",
  "legalName",
  "taxId",
  "phone",
  "email",
  "address",
  "currency",
  "capacityM3Day",
  "alertEmail",
  "alertPhone",
] as const;

type AnyCtx = QueryCtx | MutationCtx;

const DEFAULT_PLANT = {
  plantName: "محطة الخرسانة الجاهزة",
  currency: "EGP",
  capacityM3Day: 1_200,
};

function clean(text?: string) {
  return text?.trim() || undefined;
}

/** Approved mixes (active first) as plain price records, for the server maths. */
export async function loadMixPrices(ctx: AnyCtx): Promise<MixPrice[]> {
  const rows = await ctx.db.query("mixPrices").take(MAX_ROWS);
  const active = rows.filter((row) => row.isActive);
  const list = active.length > 0 ? active : rows;
  if (list.length === 0) return STANDARD_MIX_PRICES;
  return list.map((row) => ({
    name: row.name,
    price: row.price,
    cost: row.cost,
    strengthMpa: row.strengthMpa,
    cementKgPerM3: row.cementKgPerM3 ?? 0,
  }));
}

/** Seeds the approved list and the station identity the first time they open. */
export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);

    const mixes = await ctx.db.query("mixPrices").take(1);
    if (mixes.length === 0) {
      for (const mix of STANDARD_MIX_PRICES) {
        await ctx.db.insert("mixPrices", {
          name: mix.name,
          price: mix.price,
          cost: mix.cost,
          strengthMpa: mix.strengthMpa,
          cementKgPerM3: mix.cementKgPerM3,
          isActive: true,
          updatedAt: Date.now(),
        });
      }
      await recordAudit(ctx, {
        actorId: viewer.userId,
        action: "create",
        entity: "mixPrices",
        label: `قائمة الأسعار الافتراضية (${STANDARD_MIX_PRICES.length} خلطة)`,
        changes: [],
      });
    }

    const plant = await ctx.db.query("plantSettings").take(1);
    if (plant.length === 0) {
      await ctx.db.insert("plantSettings", {
        ...DEFAULT_PLANT,
        updatedAt: Date.now(),
        updatedBy: viewer.userId,
      });
    }
    return true;
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const financialsVisible = can(viewer, "viewFinancials");
    const canManage = can(viewer, "manageSettings");

    const mixes = await ctx.db.query("mixPrices").take(MAX_ROWS);
    const plant = await ctx.db.query("plantSettings").take(1);

    const list = (mixes.length > 0 ? mixes : []).map((mix) => ({
      _id: mix._id,
      name: mix.name,
      strengthMpa: mix.strengthMpa,
      cementKgPerM3: mix.cementKgPerM3 ?? null,
      notes: mix.notes ?? null,
      isActive: mix.isActive,
      price: financialsVisible ? mix.price : 0,
      cost: financialsVisible ? mix.cost : 0,
      margin: financialsVisible
        ? Math.round((mix.price - mix.cost) * 100) / 100
        : 0,
      marginPct:
        financialsVisible && mix.price > 0
          ? Math.round(((mix.price - mix.cost) / mix.price) * 10_000) / 100
          : 0,
    }));

    const settings = plant[0];
    return {
      financialsVisible,
      canManage,
      mixes: list
        .slice()
        .sort((a, b) => a.strengthMpa - b.strengthMpa || a.name.localeCompare(b.name)),
      plant: {
        plantName: settings?.plantName ?? DEFAULT_PLANT.plantName,
        legalName: settings?.legalName ?? null,
        taxId: settings?.taxId ?? null,
        phone: settings?.phone ?? null,
        email: settings?.email ?? null,
        address: settings?.address ?? null,
        currency: settings?.currency ?? DEFAULT_PLANT.currency,
        capacityM3Day: settings?.capacityM3Day ?? DEFAULT_PLANT.capacityM3Day,
        alertEmail: settings?.alertEmail ?? null,
        alertPhone: settings?.alertPhone ?? null,
        updatedAt: settings?.updatedAt ?? null,
      },
    };
  },
});

const mixFields = {
  name: v.string(),
  price: v.number(),
  cost: v.number(),
  strengthMpa: v.optional(v.number()),
  cementKgPerM3: v.optional(v.number()),
  notes: v.optional(v.string()),
  isActive: v.boolean(),
};

export const upsertMix = mutation({
  args: { id: v.optional(v.id("mixPrices")), ...mixFields },
  handler: async (ctx, { id, ...fields }) => {
    const viewer = await requireCapability(ctx, "manageSettings");
    const name = fields.name.trim();
    if (!name) throw new ConvexError("اسم الخلطة مطلوب");
    if (!Number.isFinite(fields.price) || fields.price <= 0) {
      throw new ConvexError("سعر البيع للمتر يجب أن يكون أكبر من صفر");
    }
    if (!Number.isFinite(fields.cost) || fields.cost < 0) {
      throw new ConvexError("تكلفة المتر لا يمكن أن تكون سالبة");
    }
    if (fields.cost > fields.price) {
      throw new ConvexError("تكلفة المتر لا يمكن أن تتجاوز سعر البيع");
    }

    const strength = fields.strengthMpa ?? strengthFromName(name);
    if (strength <= 0) {
      throw new ConvexError("مقاومة الخلطة (MPa) يجب أن تكون أكبر من صفر");
    }

    const mixes = await ctx.db.query("mixPrices").take(MAX_ROWS);
    const duplicate = mixes.find(
      (mix) => mix.name.trim().toUpperCase() === name.toUpperCase() && mix._id !== id,
    );
    if (duplicate) {
      throw new ConvexError(`الخلطة «${name}» مسجّلة بالفعل في قائمة الأسعار`);
    }

    const record = {
      name,
      price: fields.price,
      cost: fields.cost,
      strengthMpa: strength,
      cementKgPerM3: fields.cementKgPerM3,
      notes: clean(fields.notes),
      isActive: fields.isActive,
      updatedAt: Date.now(),
    };

    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing) throw new ConvexError("الخلطة لم تعد موجودة");
      await ctx.db.patch(id, record);
      await recordAudit(ctx, {
        actorId: viewer.userId,
        action: "update",
        entity: "mixPrices",
        entityId: id,
        label: name,
        changes: diffRecords(existing, { ...existing, ...record }, MIX_FIELDS),
      });
      return id;
    }

    const newId = await ctx.db.insert("mixPrices", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "mixPrices",
      entityId: newId,
      label: name,
      changes: snapshotRecord(record, "after", MIX_FIELDS),
    });
    return newId;
  },
});

export const removeMix = mutation({
  args: { id: v.id("mixPrices") },
  handler: async (ctx, { id }) => {
    const viewer = await requireCapability(ctx, "manageSettings");
    const existing = await ctx.db.get(id);
    if (!existing) return null;

    const mixes = await ctx.db.query("mixPrices").take(MAX_ROWS);
    if (mixes.filter((mix) => mix.isActive).length <= 1 && existing.isActive) {
      throw new ConvexError("يجب أن تبقى خلطة معتمدة واحدة على الأقل في قائمة الأسعار");
    }

    await ctx.db.delete(id);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "delete",
      entity: "mixPrices",
      entityId: id,
      label: existing.name,
      changes: snapshotRecord(existing, "before", MIX_FIELDS),
    });
    return id;
  },
});

export const updatePlant = mutation({
  args: {
    plantName: v.string(),
    legalName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    currency: v.string(),
    capacityM3Day: v.number(),
    alertEmail: v.optional(v.string()),
    alertPhone: v.optional(v.string()),
  },
  handler: async (ctx, fields) => {
    const viewer = await requireCapability(ctx, "manageSettings");
    if (!fields.plantName.trim()) throw new ConvexError("اسم المحطة مطلوب");
    if (fields.capacityM3Day <= 0) {
      throw new ConvexError("الطاقة الإنتاجية اليومية يجب أن تكون أكبر من صفر");
    }

    const record = {
      plantName: fields.plantName.trim(),
      legalName: clean(fields.legalName),
      taxId: clean(fields.taxId),
      phone: clean(fields.phone),
      email: clean(fields.email),
      address: clean(fields.address),
      currency: fields.currency.trim() || "EGP",
      capacityM3Day: Math.round(fields.capacityM3Day),
      alertEmail: clean(fields.alertEmail),
      alertPhone: clean(fields.alertPhone),
      updatedAt: Date.now(),
      updatedBy: viewer.userId,
    };

    const existing = (await ctx.db.query("plantSettings").take(1))[0];
    if (existing) {
      await ctx.db.patch(existing._id, record);
      await recordAudit(ctx, {
        actorId: viewer.userId,
        action: "update",
        entity: "plantSettings",
        entityId: existing._id,
        label: record.plantName,
        changes: diffRecords(existing, { ...existing, ...record }, PLANT_FIELDS),
      });
      return existing._id;
    }

    const id = await ctx.db.insert("plantSettings", record);
    await recordAudit(ctx, {
      actorId: viewer.userId,
      action: "create",
      entity: "plantSettings",
      entityId: id,
      label: record.plantName,
      changes: snapshotRecord(record, "after", PLANT_FIELDS),
    });
    return id;
  },
});
