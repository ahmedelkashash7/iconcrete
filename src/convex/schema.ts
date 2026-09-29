import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

/** IConcrete plant roles (see ./permissions for the capability matrix). */
export const plantRoleValidator = v.union(
  v.literal("owner"),
  v.literal("manager"),
  v.literal("reviewer"),
  v.literal("operator"),
);
export type PlantRoleValue = Infer<typeof plantRoleValidator>;

// Legacy template roles are kept valid so existing rows stay readable.
export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
  plantRoleValidator,
);
export type Role = Infer<typeof roleValidator>;

/** Production shifts at the batching plant. */
export const shiftValidator = v.union(
  v.literal("morning"),
  v.literal("evening"),
  v.literal("night"),
);
export type Shift = Infer<typeof shiftValidator>;

/** Every audited operation type (see ./auditLog for the writer). */
export const auditActionValidator = v.union(
  v.literal("create"),
  v.literal("update"),
  v.literal("delete"),
  v.literal("seed"),
  v.literal("purge"),
  v.literal("role_change"),
);
export type AuditAction = Infer<typeof auditActionValidator>;

/** One field-level entry inside an audit record («الحقل: قبل ← بعد»). */
export const auditChangeValidator = v.object({
  field: v.string(),
  before: v.optional(v.string()),
  after: v.optional(v.string()),
});

/** Lifecycle of a single production/dispatch record. */
export const logStatusValidator = v.union(
  v.literal("delivered"),
  v.literal("in_progress"),
  v.literal("cancelled"),
);
export type LogStatus = Infer<typeof logStatusValidator>;

/* ------------------------------------------------------------------ */
/* Quality control — cube crushing tests and slump tests (ECP 203)     */
/* ------------------------------------------------------------------ */

export const qualityKindValidator = v.union(
  v.literal("cube7"),
  v.literal("cube28"),
  v.literal("slump"),
);
export type QualityKind = Infer<typeof qualityKindValidator>;

export const qualityResultValidator = v.union(
  v.literal("pass"),
  v.literal("fail"),
  v.literal("pending"),
);
export type QualityResult = Infer<typeof qualityResultValidator>;

/* ---------------------------- Inventory --------------------------- */

export const materialCategoryValidator = v.union(
  v.literal("cement"),
  v.literal("aggregate"),
  v.literal("sand"),
  v.literal("admixture"),
  v.literal("water"),
  v.literal("other"),
);
export type MaterialCategory = Infer<typeof materialCategoryValidator>;

export const materialUnitValidator = v.union(
  v.literal("ton"),
  v.literal("m3"),
  v.literal("kg"),
  v.literal("liter"),
);
export type MaterialUnit = Infer<typeof materialUnitValidator>;

export const movementKindValidator = v.union(
  v.literal("receipt"),
  v.literal("issue"),
  v.literal("adjustment"),
);
export type MovementKind = Infer<typeof movementKindValidator>;

/* ------------------------ Fleet & maintenance --------------------- */

export const equipmentKindValidator = v.union(
  v.literal("mixer"),
  v.literal("truck"),
  v.literal("pump"),
  v.literal("loader"),
  v.literal("generator"),
  v.literal("other"),
);
export type EquipmentKind = Infer<typeof equipmentKindValidator>;

export const meterUnitValidator = v.union(
  v.literal("hours"),
  v.literal("km"),
);
export type MeterUnit = Infer<typeof meterUnitValidator>;

/* ---------------------------- Alerts ------------------------------ */

export const alertMetricValidator = v.union(
  v.literal("dailyProfit"),
  v.literal("marginPct"),
  v.literal("onTimePct"),
  v.literal("qualityFailCount"),
  v.literal("lowStockCount"),
  v.literal("equipmentOverdueCount"),
);
export type AlertMetric = Infer<typeof alertMetricValidator>;

export const alertComparatorValidator = v.union(
  v.literal("lt"),
  v.literal("gt"),
);
export type AlertComparator = Infer<typeof alertComparatorValidator>;

export const alertChannelValidator = v.union(
  v.literal("email"),
  v.literal("sms"),
);
export type AlertChannel = Infer<typeof alertChannelValidator>;

export const alertStatusValidator = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("simulated"),
  v.literal("failed"),
);
export type AlertStatus = Infer<typeof alertStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /**
     * Audit trail — who did what, when, on which record, and the previous and
     * new values of every changed field. Written by every mutating function.
     */
    auditLogs: defineTable({
      actorId: v.optional(v.id("users")),
      actorName: v.string(),
      actorEmail: v.optional(v.string()),
      actorRole: v.optional(v.string()),
      isAnonymous: v.boolean(),
      action: auditActionValidator,
      entity: v.string(),
      entityId: v.optional(v.string()),
      /** Human label of the touched record (customer, member, batch count…). */
      label: v.optional(v.string()),
      changes: v.array(auditChangeValidator),
      at: v.number(),
      date: v.string(),
    })
      .index("by_at", ["at"])
      .index("by_date", ["date"]),

    /**
     * Multi-branch: every operational record belongs to one station (فرع).
     * Leaving `branchId` empty means «غير محدد» — used by legacy rows before
     * the branch layer existed.
     */
    branches: defineTable({
      code: v.string(),
      name: v.string(),
      city: v.optional(v.string()),
      address: v.optional(v.string()),
      managerName: v.optional(v.string()),
      phone: v.optional(v.string()),
      /** Rated production capacity, used for capacity utilisation. */
      capacityM3Day: v.optional(v.number()),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
    }),

    /**
     * The plant's approved price list — the single source of truth that prices
     * every production entry on the server.
     */
    mixPrices: defineTable({
      name: v.string(),
      price: v.number(),
      cost: v.number(),
      /** Characteristic cube strength fck in MPa (used as the test target). */
      strengthMpa: v.number(),
      cementKgPerM3: v.optional(v.number()),
      notes: v.optional(v.string()),
      isActive: v.boolean(),
      updatedAt: v.number(),
    }),

    /** Station identity, printed on reports and used for alerts. */
    plantSettings: defineTable({
      plantName: v.string(),
      legalName: v.optional(v.string()),
      taxId: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      address: v.optional(v.string()),
      currency: v.string(),
      /** Design capacity per day, for capacity utilisation on the dashboard. */
      capacityM3Day: v.number(),
      /** Default recipients for threshold alerts. */
      alertEmail: v.optional(v.string()),
      alertPhone: v.optional(v.string()),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }),

    /**
     * One row = one dispatch order produced by the plant on a given day/shift.
     * Quantities are cubic meters (m³), money values are EGP.
     */
    productionLogs: defineTable({
      branchId: v.optional(v.id("branches")),
      /** ISO day the work happened (YYYY-MM-DD) — the Power Query "sort by date" key. */
      date: v.string(),
      shift: shiftValidator,
      /** Concrete grade, e.g. C30/37. */
      mixDesign: v.string(),
      customer: v.string(),
      site: v.optional(v.string()),
      orderRef: v.optional(v.string()),
      /** Batched quantity. */
      quantityM3: v.number(),
      /** Quantity accepted on site. */
      deliveredM3: v.number(),
      /** Quantity returned by the customer / rejected. */
      returnedM3: v.number(),
      pricePerM3: v.number(),
      costPerM3: v.number(),
      truckCount: v.number(),
      /** Delivered inside the agreed pouring window. */
      onTime: v.boolean(),
      status: logStatusValidator,
      notes: v.optional(v.string()),
      /** Test_Data_Flag — demo rows can be purged without touching real records. */
      isTestData: v.boolean(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_date", ["date"])
      .index("by_customer", ["customer"])
      .index("by_branch", ["branchId"]),

    /**
     * Quality control: cube crushing tests at 7/28 days and slump tests.
     * `targetValue` comes from the approved mix list (fck) and `result` is what
     * the compliance report and the ISO 9001 records are built from.
     */
    qualityTests: defineTable({
      branchId: v.optional(v.id("branches")),
      date: v.string(),
      kind: qualityKindValidator,
      mixDesign: v.string(),
      customer: v.string(),
      site: v.optional(v.string()),
      orderRef: v.optional(v.string()),
      productionLogId: v.optional(v.id("productionLogs")),
      sampleRef: v.optional(v.string()),
      labName: v.optional(v.string()),
      /** MPa for cubes, mm for slump. */
      targetValue: v.number(),
      /** Accepted deviation around the target (slump tolerance in mm). */
      tolerance: v.optional(v.number()),
      actualValue: v.number(),
      result: qualityResultValidator,
      testedBy: v.optional(v.string()),
      notes: v.optional(v.string()),
      isTestData: v.boolean(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_date", ["date"])
      .index("by_mix", ["mixDesign"])
      .index("by_branch", ["branchId"]),

    /** Material master data: cement, aggregates, sand, admixtures… */
    materials: defineTable({
      branchId: v.optional(v.id("branches")),
      name: v.string(),
      category: materialCategoryValidator,
      unit: materialUnitValidator,
      /** Stock carried forward when the plant started using the system. */
      openingQty: v.number(),
      /** Below this balance the material shows up in the shortage alerts. */
      reorderLevel: v.number(),
      standardCost: v.number(),
      supplier: v.optional(v.string()),
      isActive: v.boolean(),
      updatedAt: v.number(),
    }).index("by_branch", ["branchId"]),

    /** Every receipt, issue to the mixer and stock-count adjustment. */
    materialMovements: defineTable({
      branchId: v.optional(v.id("branches")),
      materialId: v.id("materials"),
      date: v.string(),
      kind: movementKindValidator,
      /** Signed for adjustments (a stock count may be negative). */
      quantity: v.number(),
      unitCost: v.optional(v.number()),
      supplier: v.optional(v.string()),
      reference: v.optional(v.string()),
      note: v.optional(v.string()),
      isTestData: v.boolean(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_date", ["date"])
      .index("by_material", ["materialId"])
      .index("by_branch", ["branchId"]),

    /** Fleet and plant assets whose service due date drives the planning. */
    equipment: defineTable({
      branchId: v.optional(v.id("branches")),
      code: v.string(),
      name: v.string(),
      kind: equipmentKindValidator,
      meterUnit: meterUnitValidator,
      /** Current meter reading (hours or km). */
      meterReading: v.number(),
      /** Reading captured at the last service. */
      lastServiceMeter: v.number(),
      /** Distance between services, in the same meter unit. */
      serviceInterval: v.number(),
      /** Calendar interval in days, when the manual specifies one. */
      serviceIntervalDays: v.optional(v.number()),
      lastServiceDate: v.optional(v.string()),
      /** Recent average usage per day, in meter units. */
      avgDailyUsage: v.number(),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
    })
      .index("by_branch", ["branchId"]),

    /** Threshold rules evaluated against the live measures. */
    alertRules: defineTable({
      name: v.string(),
      metric: alertMetricValidator,
      comparator: alertComparatorValidator,
      threshold: v.number(),
      channel: alertChannelValidator,
      recipients: v.array(v.string()),
      /** Rolling window the metric is measured over. */
      windowDays: v.number(),
      branchId: v.optional(v.id("branches")),
      isActive: v.boolean(),
      lastCheckedAt: v.optional(v.number()),
      lastTriggeredAt: v.optional(v.number()),
      lastValue: v.optional(v.number()),
      createdBy: v.optional(v.id("users")),
    }),

    /** Every fired (or simulated) alert, with the value that broke the rule. */
    alertEvents: defineTable({
      ruleId: v.optional(v.id("alertRules")),
      ruleName: v.string(),
      metric: alertMetricValidator,
      comparator: alertComparatorValidator,
      value: v.number(),
      threshold: v.number(),
      channel: alertChannelValidator,
      recipients: v.array(v.string()),
      message: v.string(),
      firedAt: v.number(),
      date: v.string(),
      status: alertStatusValidator,
      error: v.optional(v.string()),
    }).index("by_fired", ["firedAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
