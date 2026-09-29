import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { addDays, utcToday } from "./measures";

/**
 * IConcrete System — unified export layer.
 *
 * Every reporting surface (Excel, Power Query, Power BI, Azure SQL copy jobs)
 * reads the plant from one place: this module shapes the ledger into flat,
 * typed rows that match the published data model (`stg_*` / `fact_*` sheets in
 * the Excel pack). Nothing here writes, and no money column leaves the
 * deployment unless the caller asked for it with `money=1`.
 */

export type ExportRow = Record<string, string | number | boolean | null>;

export type EntitySpec = {
  /** URL segment: /api/v1/iconcrete/{key}.csv */
  key: string;
  /** Arabic label shown in the manifest and the download screen. */
  label: string;
  /** Sheet / table name inside the Excel data model. */
  sheet: string;
  layer: string;
  description: string;
  /** Columns stripped when the caller passes money=0. */
  money?: string[];
  /** Whether from/to filters apply. */
  ranged: boolean;
  /** Source tables read by this entity. */
  sources: string[];
};

export const EXPORT_ENTITIES: EntitySpec[] = [
  {
    key: "orders",
    label: "الطلبيات والإنتاج التفصيلي",
    sheet: "fact_Orders",
    layer: "التشغيل",
    description:
      "قيد واحد لكل طلبية/صبّة: الكميات، الأسعار، التكلفة، الإيراد، الربح، الالتزام بالموعد.",
    money: ["price_per_m3", "cost_per_m3", "revenue", "total_cost", "gross_profit"],
    ranged: true,
    sources: ["productionLogs", "branches"],
  },
  {
    key: "production_daily",
    label: "الإنتاج اليومي المجمّع",
    sheet: "fact_ProductionDaily",
    layer: "التشغيل",
    description: "مجمّع يومي لكل فرع ووردية: كميات مسلّمة، مرتجعات، إيراد وتكلفة وربح.",
    money: ["revenue", "total_cost", "gross_profit"],
    ranged: true,
    sources: ["productionLogs", "branches"],
  },
  {
    key: "production_mix",
    label: "الإنتاج حسب الخلطة",
    sheet: "fact_ProductionMix",
    layer: "التشغيل",
    description: "أداء كل خلطة معتمدة: الكمية، متوسط السعر، التكلفة، الهامش ونسبة التأخير.",
    money: ["revenue", "total_cost", "gross_profit", "avg_price", "avg_cost"],
    ranged: true,
    sources: ["productionLogs", "branches"],
  },
  {
    key: "quality",
    label: "اختبارات الجودة",
    sheet: "fact_QualityTests",
    layer: "الجودة",
    description: "مكعبات 7 و28 يومًا والركود: القيمة المستهدفة والمسموح والنتيجة ونسبتها.",
    ranged: true,
    sources: ["qualityTests", "branches"],
  },
  {
    key: "materials",
    label: "أرصدة المواد",
    sheet: "dim_Materials",
    layer: "المخازن",
    description: "أرصدة الأسمنت والركام والإضافات مع حد إعادة الطلب والأيام المغطاة.",
    money: ["standard_cost", "stock_value"],
    ranged: false,
    sources: ["materials", "materialMovements"],
  },
  {
    key: "material_movements",
    label: "حركة المخزون",
    sheet: "fact_MaterialMovements",
    layer: "المخازن",
    description: "كل استلام وصرف وتسوية جرد بحركتها وتكلفتها ومصدرها.",
    money: ["unit_cost", "line_value"],
    ranged: true,
    sources: ["materialMovements", "materials", "branches"],
  },
  {
    key: "fleet",
    label: "الأسطول والمعدات",
    sheet: "dim_Equipment",
    layer: "الصيانة",
    description:
      "عداد كل معدة وحالة الصيانة القادمة: المتبقي بالعداد وبالأيام وتاريخ الاستحقاق.",
    ranged: false,
    sources: ["equipment", "branches"],
  },
  {
    key: "alerts",
    label: "سجل التنبيهات",
    sheet: "fact_Alerts",
    layer: "التحكم",
    description: "كل تنبيه انطلق بقيمته والحد الذي تجاوزه ومستلميه وحالة إرساله.",
    ranged: true,
    sources: ["alertEvents"],
  },
  {
    key: "alert_rules",
    label: "قواعد التنبيه",
    sheet: "cfg_AlertRules",
    layer: "التحكم",
    description: "الحدود المعتمدة لكل مؤشر ونافذة القياس وقناة الإرسال.",
    ranged: false,
    sources: ["alertRules", "branches"],
  },
  {
    key: "branches",
    label: "الفروع",
    sheet: "dim_Branches",
    layer: "التأسيس",
    description: "فروع المحطة بطاقتها اليومية وبيانات مسؤولها.",
    ranged: false,
    sources: ["branches"],
  },
  {
    key: "mixes",
    label: "أسعار الخلطات",
    sheet: "dim_MixDesigns",
    layer: "التأسيس",
    description: "الخلطات المعتمدة بمقاومتها وأسمنتها وسعرها وتكلفتها وهامشها.",
    money: ["price", "cost", "margin", "margin_pct"],
    ranged: false,
    sources: ["mixPrices"],
  },
  {
    key: "plant",
    label: "بيانات المحطة",
    sheet: "dim_Plant",
    layer: "التأسيس",
    description: "هوية المحطة والعملة والطاقة اليومية ومستلمو التنبيهات.",
    ranged: false,
    sources: ["plantSettings"],
  },
  {
    key: "people",
    label: "المستخدمون والأدوار",
    sheet: "dim_Users",
    layer: "الحماية",
    description: "من يعمل على النظام وبأي دور — بدون أي كلمة مرور أو بيانات دخول.",
    ranged: false,
    sources: ["users"],
  },
  {
    key: "audit",
    label: "سجل التتبع",
    sheet: "fact_AuditLog",
    layer: "الحماية",
    description:
      "كل عملية: من، وماذا، ومتى، والقيمة القديمة والجديدة لكل حقل تغيّر.",
    ranged: true,
    sources: ["auditLogs"],
  },
];

export const EXPORT_ENTITY_KEYS = EXPORT_ENTITIES.map((entity) => entity.key);

export function findEntity(key: string): EntitySpec | undefined {
  return EXPORT_ENTITIES.find((entity) => entity.key === key);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const MAX_ROWS = 20_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

function inRange(date: string, from: string | undefined, to: string | undefined): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

async function branchNames(ctx: QueryCtx): Promise<Map<string, string>> {
  const branches = await ctx.db.query("branches").take(MAX_ROWS);
  return new Map(branches.map((branch) => [branch._id as string, branch.name]));
}

async function logsInRange(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
) {
  const rows = await ctx.db.query("productionLogs").withIndex("by_date").take(limit);
  return rows.filter((row) => inRange(row.date, from, to));
}

/* ------------------------------------------------------------------ */
/* Entity readers                                                     */
/* ------------------------------------------------------------------ */

async function readOrders(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
): Promise<ExportRow[]> {
  const names = await branchNames(ctx);
  const logs = await logsInRange(ctx, from, to, limit);
  return logs.map((log) => {
    const revenue = log.deliveredM3 * log.pricePerM3;
    const totalCost = log.deliveredM3 * log.costPerM3;
    return {
      order_id: String(log._id),
      order_ref: log.orderRef ?? null,
      order_date: log.date,
      shift: log.shift,
      branch: log.branchId ? (names.get(log.branchId as string) ?? null) : null,
      customer: log.customer,
      site: log.site ?? null,
      mix_design: log.mixDesign,
      quantity_m3: r2(log.quantityM3),
      delivered_m3: r2(log.deliveredM3),
      returned_m3: r2(log.returnedM3),
      truck_count: log.truckCount,
      price_per_m3: r2(log.pricePerM3),
      cost_per_m3: r2(log.costPerM3),
      revenue: r2(revenue),
      total_cost: r2(totalCost),
      gross_profit: r2(revenue - totalCost),
      margin_pct: revenue > 0 ? r2(((revenue - totalCost) / revenue) * 100) : 0,
      on_time: log.onTime,
      status: log.status,
      notes: log.notes ?? null,
      test_data_flag: log.isTestData,
      source_system: "IConcrete",
    };
  });
}

async function readProductionDaily(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
): Promise<ExportRow[]> {
  const names = await branchNames(ctx);
  const logs = await logsInRange(ctx, from, to, limit);
  const map = new Map<string, ExportRow>();
  for (const log of logs) {
    if (log.status === "cancelled") continue;
    const branch = log.branchId ? (names.get(log.branchId as string) ?? "غير محدد") : "غير محدد";
    const key = `${log.date}|${branch}|${log.shift}`;
    const row =
      map.get(key) ??
      ({
        date: log.date,
        branch,
        shift: log.shift,
        delivered_m3: 0,
        returned_m3: 0,
        revenue: 0,
        total_cost: 0,
        truck_count: 0,
        orders: 0,
        on_time_orders: 0,
      } as ExportRow);
    row.delivered_m3 = r2((row.delivered_m3 as number) + log.deliveredM3);
    row.returned_m3 = r2((row.returned_m3 as number) + log.returnedM3);
    row.revenue = r2((row.revenue as number) + log.deliveredM3 * log.pricePerM3);
    row.total_cost = r2((row.total_cost as number) + log.deliveredM3 * log.costPerM3);
    row.truck_count = (row.truck_count as number) + log.truckCount;
    row.orders = (row.orders as number) + 1;
    row.on_time_orders = (row.on_time_orders as number) + (log.onTime ? 1 : 0);
    map.set(key, row);
  }
  return [...map.values()]
    .map((row): ExportRow => ({
      ...row,
      gross_profit: r2((row.revenue as number) - (row.total_cost as number)),
      margin_pct:
        (row.revenue as number) > 0
          ? r2(
              (((row.revenue as number) - (row.total_cost as number)) /
                (row.revenue as number)) *
                100,
            )
          : 0,
      on_time_pct:
        (row.orders as number) > 0
          ? r2(((row.on_time_orders as number) / (row.orders as number)) * 100)
          : 0,
      test_data_flag: true,
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function readProductionMix(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
): Promise<ExportRow[]> {
  const logs = await logsInRange(ctx, from, to, limit);
  const map = new Map<string, ExportRow>();
  for (const log of logs) {
    if (log.status === "cancelled") continue;
    const row =
      map.get(log.mixDesign) ??
      ({
        mix_design: log.mixDesign,
        delivered_m3: 0,
        revenue: 0,
        total_cost: 0,
        orders: 0,
        on_time_orders: 0,
        price_sum: 0,
        cost_sum: 0,
      } as ExportRow);
    row.delivered_m3 = r2((row.delivered_m3 as number) + log.deliveredM3);
    row.revenue = r2((row.revenue as number) + log.deliveredM3 * log.pricePerM3);
    row.total_cost = r2((row.total_cost as number) + log.deliveredM3 * log.costPerM3);
    row.price_sum = r2((row.price_sum as number) + log.pricePerM3);
    row.cost_sum = r2((row.cost_sum as number) + log.costPerM3);
    row.orders = (row.orders as number) + 1;
    row.on_time_orders = (row.on_time_orders as number) + (log.onTime ? 1 : 0);
    map.set(log.mixDesign, row);
  }
  return [...map.values()].map((row) => {
    const orders = row.orders as number;
    const revenue = row.revenue as number;
    const totalCost = row.total_cost as number;
    return {
      mix_design: row.mix_design,
      delivered_m3: row.delivered_m3,
      orders,
      avg_price: orders > 0 ? r2((row.price_sum as number) / orders) : 0,
      avg_cost: orders > 0 ? r2((row.cost_sum as number) / orders) : 0,
      revenue,
      total_cost: totalCost,
      gross_profit: r2(revenue - totalCost),
      margin_pct: revenue > 0 ? r2(((revenue - totalCost) / revenue) * 100) : 0,
      on_time_pct: orders > 0 ? r2(((row.on_time_orders as number) / orders) * 100) : 0,
      test_data_flag: true,
    };
  });
}

async function readQuality(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
): Promise<ExportRow[]> {
  const names = await branchNames(ctx);
  const rows = await ctx.db.query("qualityTests").withIndex("by_date").take(limit);
  return rows
    .filter((row) => inRange(row.date, from, to))
    .map((row) => ({
      test_id: String(row._id),
      test_date: row.date,
      branch: row.branchId ? (names.get(row.branchId as string) ?? null) : null,
      kind: row.kind,
      mix_design: row.mixDesign,
      customer: row.customer,
      site: row.site ?? null,
      order_ref: row.orderRef ?? null,
      sample_ref: row.sampleRef ?? null,
      lab_name: row.labName ?? null,
      target_value: row.targetValue,
      tolerance: row.tolerance ?? null,
      actual_value: row.actualValue,
      result: row.result,
      passed: row.result === "pass",
      strength_ratio_pct:
        row.kind === "cube28" && row.targetValue > 0
          ? r2((row.actualValue / row.targetValue) * 100)
          : null,
      tested_by: row.testedBy ?? null,
      test_data_flag: row.isTestData,
      source_system: "IConcrete",
    }));
}

async function readMaterials(ctx: QueryCtx): Promise<ExportRow[]> {
  const names = await branchNames(ctx);
  const materials = await ctx.db.query("materials").take(MAX_ROWS);
  const movements = await ctx.db.query("materialMovements").take(MAX_ROWS);
  const byMaterial = new Map<string, { receipts: number; issues: number; adjust: number }>();
  for (const movement of movements) {
    const key = movement.materialId as string;
    const bucket = byMaterial.get(key) ?? { receipts: 0, issues: 0, adjust: 0 };
    if (movement.kind === "receipt") bucket.receipts += movement.quantity;
    else if (movement.kind === "issue") bucket.issues += Math.abs(movement.quantity);
    else bucket.adjust += movement.quantity;
    byMaterial.set(key, bucket);
  }
  return materials.map((material) => {
    const bucket = byMaterial.get(material._id as string) ?? {
      receipts: 0,
      issues: 0,
      adjust: 0,
    };
    const balance = material.openingQty + bucket.receipts - bucket.issues + bucket.adjust;
    return {
      material_id: String(material._id),
      material_name: material.name,
      category: material.category,
      unit: material.unit,
      branch: material.branchId ? (names.get(material.branchId as string) ?? null) : null,
      opening_qty: r2(material.openingQty),
      received_qty: r2(bucket.receipts),
      issued_qty: r2(bucket.issues),
      adjustment_qty: r2(bucket.adjust),
      balance_qty: r2(balance),
      reorder_level: r2(material.reorderLevel),
      below_reorder: balance < material.reorderLevel,
      standard_cost: r2(material.standardCost),
      stock_value: r2(balance * material.standardCost),
      supplier: material.supplier ?? null,
      is_active: material.isActive,
      updated_at: material.updatedAt,
    };
  });
}

async function readMaterialMovements(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
): Promise<ExportRow[]> {
  const names = await branchNames(ctx);
  const materials = await ctx.db.query("materials").take(MAX_ROWS);
  const index = new Map(
    materials.map((material) => [
      material._id as string,
      { name: material.name, unit: material.unit },
    ]),
  );
  const rows = await ctx.db.query("materialMovements").withIndex("by_date").take(limit);
  return rows
    .filter((row) => inRange(row.date, from, to))
    .map((row) => {
      const material = index.get(row.materialId as string);
      return {
        movement_id: String(row._id),
        movement_date: row.date,
        branch: row.branchId ? (names.get(row.branchId as string) ?? null) : null,
        material_name: material?.name ?? null,
        unit: material?.unit ?? null,
        kind: row.kind,
        quantity: r2(row.quantity),
        unit_cost: row.unitCost === undefined ? null : r2(row.unitCost),
        line_value: row.unitCost === undefined ? null : r2(row.quantity * row.unitCost),
        supplier: row.supplier ?? null,
        reference: row.reference ?? null,
        note: row.note ?? null,
        test_data_flag: row.isTestData,
        source_system: "IConcrete",
      };
    });
}

async function readFleet(ctx: QueryCtx, today: string): Promise<ExportRow[]> {
  const names = await branchNames(ctx);
  const rows = await ctx.db.query("equipment").take(MAX_ROWS);
  return rows.map((asset) => {
    const used = Math.max(0, asset.meterReading - asset.lastServiceMeter);
    const remainingMeter = asset.serviceInterval - used;
    const metersPerDay = asset.avgDailyUsage > 0 ? asset.avgDailyUsage : null;
    const daysByMeter = metersPerDay ? remainingMeter / metersPerDay : null;
    const daysByDate =
      asset.serviceIntervalDays && asset.lastServiceDate
        ? asset.serviceIntervalDays -
          Math.round(
            (Date.parse(`${today}T00:00:00Z`) -
              Date.parse(`${asset.lastServiceDate}T00:00:00Z`)) /
              86_400_000,
          )
        : null;
    const candidates = [daysByMeter, daysByDate].filter(
      (value): value is number => value !== null,
    );
    const remainingDays = candidates.length > 0 ? Math.floor(Math.min(...candidates)) : null;
    const status =
      remainingDays === null
        ? "no_schedule"
        : remainingDays < 0
          ? "overdue"
          : remainingDays <= 7
            ? "due_soon"
            : remainingDays <= 30
              ? "scheduled"
              : "ok";
    return {
      equipment_id: String(asset._id),
      code: asset.code,
      name: asset.name,
      kind: asset.kind,
      branch: asset.branchId ? (names.get(asset.branchId as string) ?? null) : null,
      meter_unit: asset.meterUnit,
      meter_reading: r2(asset.meterReading),
      last_service_meter: r2(asset.lastServiceMeter),
      service_interval: r2(asset.serviceInterval),
      service_interval_days: asset.serviceIntervalDays ?? null,
      last_service_date: asset.lastServiceDate ?? null,
      avg_daily_usage: r2(asset.avgDailyUsage),
      used_since_service: r2(used),
      remaining_meter: r2(remainingMeter),
      remaining_days: remainingDays,
      maintenance_status: status,
      is_active: asset.isActive,
      test_data_flag: false,
      source_system: "IConcrete",
    };
  });
}

async function readAlerts(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
): Promise<ExportRow[]> {
  const rows = await ctx.db.query("alertEvents").withIndex("by_fired").take(limit);
  return rows
    .filter((row) => inRange(row.date, from, to))
    .map((row) => ({
      event_id: String(row._id),
      fired_at: new Date(row.firedAt).toISOString(),
      alert_date: row.date,
      rule_name: row.ruleName,
      metric: row.metric,
      comparator: row.comparator,
      value: r2(row.value),
      threshold: r2(row.threshold),
      channel: row.channel,
      recipients: row.recipients.join("; "),
      recipient_count: row.recipients.length,
      message: row.message,
      status: row.status,
      error: row.error ?? null,
      escalated: row.status === "failed",
      source_system: "IConcrete",
    }));
}

async function readAlertRules(ctx: QueryCtx): Promise<ExportRow[]> {
  const names = await branchNames(ctx);
  const rows = await ctx.db.query("alertRules").take(MAX_ROWS);
  return rows.map((rule) => ({
    rule_id: String(rule._id),
    rule_name: rule.name,
    metric: rule.metric,
    comparator: rule.comparator,
    threshold: rule.threshold,
    window_days: rule.windowDays,
    channel: rule.channel,
    recipients: rule.recipients.join("; "),
    branch: rule.branchId ? (names.get(rule.branchId as string) ?? null) : null,
    is_active: rule.isActive,
    last_value: rule.lastValue ?? null,
    last_checked_at: rule.lastCheckedAt ? new Date(rule.lastCheckedAt).toISOString() : null,
    last_triggered_at: rule.lastTriggeredAt
      ? new Date(rule.lastTriggeredAt).toISOString()
      : null,
    test_data_flag: false,
  }));
}

async function readBranches(ctx: QueryCtx): Promise<ExportRow[]> {
  const rows = await ctx.db.query("branches").take(MAX_ROWS);
  return rows.map((branch) => ({
    branch_id: String(branch._id),
    branch_code: branch.code,
    branch_name: branch.name,
    city: branch.city ?? null,
    address: branch.address ?? null,
    manager_name: branch.managerName ?? null,
    phone: branch.phone ?? null,
    capacity_m3_day: branch.capacityM3Day ?? null,
    is_active: branch.isActive,
    timezone: "Africa/Cairo",
    currency: "EGP",
    test_data_flag: false,
  }));
}

async function readMixes(ctx: QueryCtx): Promise<ExportRow[]> {
  const rows = await ctx.db.query("mixPrices").take(MAX_ROWS);
  return rows.map((mix) => ({
    mix_id: String(mix._id),
    mix_design: mix.name,
    strength_mpa: mix.strengthMpa,
    cement_kg_per_m3: mix.cementKgPerM3 ?? null,
    price: r2(mix.price),
    cost: r2(mix.cost),
    margin: r2(mix.price - mix.cost),
    margin_pct: mix.price > 0 ? r2(((mix.price - mix.cost) / mix.price) * 100) : 0,
    is_active: mix.isActive,
    notes: mix.notes ?? null,
    updated_at: mix.updatedAt,
    test_data_flag: false,
  }));
}

async function readPlant(ctx: QueryCtx): Promise<ExportRow[]> {
  const rows = await ctx.db.query("plantSettings").take(1);
  return rows.map((plant) => ({
    plant_id: String(plant._id),
    plant_name: plant.plantName,
    legal_name: plant.legalName ?? null,
    tax_id: plant.taxId ?? null,
    phone: plant.phone ?? null,
    email: plant.email ?? null,
    address: plant.address ?? null,
    currency: plant.currency,
    capacity_m3_day: plant.capacityM3Day,
    alert_email: plant.alertEmail ?? null,
    alert_phone: plant.alertPhone ?? null,
    updated_at: plant.updatedAt,
    test_data_flag: false,
  }));
}

async function readPeople(ctx: QueryCtx): Promise<ExportRow[]> {
  const rows = await ctx.db.query("users").take(MAX_ROWS);
  return rows
    .filter((user) => !user.isAnonymous)
    .map((user) => ({
      user_id: String(user._id),
      display_name: user.name ?? null,
      email: user.email ?? null,
      role: user.role ?? "operator",
      identity_provider: "Convex Auth",
      password_hash_exported: false,
      test_data_flag: false,
    }));
}

async function readAudit(
  ctx: QueryCtx,
  from: string | undefined,
  to: string | undefined,
  limit: number,
): Promise<ExportRow[]> {
  const rows = await ctx.db.query("auditLogs").withIndex("by_at", (q) => q).take(limit);
  return rows
    .filter((row) => inRange(row.date, from, to))
    .map((row) => ({
      log_id: String(row._id),
      occurred_at: new Date(row.at).toISOString(),
      log_date: row.date,
      actor_name: row.actorName,
      actor_email: row.actorEmail ?? null,
      actor_role: row.actorRole ?? null,
      is_anonymous: row.isAnonymous,
      action: row.action,
      entity: row.entity,
      entity_id: row.entityId ?? null,
      record_label: row.label ?? null,
      changed_fields: row.changes.length,
      changes_json: JSON.stringify(row.changes),
      approval_state: "auto",
      test_data_flag: false,
    }));
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                 */
/* ------------------------------------------------------------------ */

export const fetchEntity = internalQuery({
  args: {
    entity: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    limit: v.optional(v.number()),
    today: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExportRow[]> => {
    const from = args.from && DATE_RE.test(args.from) ? args.from : undefined;
    const to = args.to && DATE_RE.test(args.to) ? args.to : undefined;
    const limit = Math.min(Math.max(args.limit ?? MAX_ROWS, 1), MAX_ROWS);
    const today =
      args.today && DATE_RE.test(args.today) ? args.today : utcToday();

    switch (args.entity) {
      case "orders":
        return readOrders(ctx, from, to, limit);
      case "production_daily":
        return readProductionDaily(ctx, from, to, limit);
      case "production_mix":
        return readProductionMix(ctx, from, to, limit);
      case "quality":
        return readQuality(ctx, from, to, limit);
      case "materials":
        return readMaterials(ctx);
      case "material_movements":
        return readMaterialMovements(ctx, from, to, limit);
      case "fleet":
        return readFleet(ctx, today);
      case "alerts":
        return readAlerts(ctx, from, to, limit);
      case "alert_rules":
        return readAlertRules(ctx);
      case "branches":
        return readBranches(ctx);
      case "mixes":
        return readMixes(ctx);
      case "plant":
        return readPlant(ctx);
      case "people":
        return readPeople(ctx);
      case "audit":
        return readAudit(ctx, from, to, limit);
      default:
        return [];
    }
  },
});

/** Row counts + window used by the manifest so Excel can show freshness. */
export const manifestStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = utcToday();
    const monthStart = addDays(today, -29);
    const logs = await ctx.db.query("productionLogs").withIndex("by_date").take(MAX_ROWS);
    const inWindow = logs.filter((log) => log.date >= monthStart);
    const latest = latestDate(logs.map((log) => log.date));
    return {
      generatedAt: new Date().toISOString(),
      today,
      monthStart,
      orders: logs.length,
      recentOrders: inWindow.length,
      latestOrderDate: latest,
      testDataFlag: true,
      currency: "EGP",
      unit: "m3",
    };
  },
});

function latestDate(dates: string[]): string | null {
  if (dates.length === 0) return null;
  return dates.reduce((max, value) => (value > max ? value : max), dates[0]);
}
