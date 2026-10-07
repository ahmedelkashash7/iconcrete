/**
 * IConcrete System — offline database schema.
 *
 * The desktop (Tauri) build keeps a local SQLite database so the plant can run
 * with the network cable unplugged. This file is the single definition of that
 * database: every table below mirrors one table from `src/convex/schema.ts` and
 * every column keeps the **exact same name** as the Convex field, so a row can
 * move between SQLite and Convex without any mapping layer.
 *
 * Convex bookkeeping fields are mirrored too:
 *   `_id`            document id (a local id is replaced by the server id on first push)
 *   `_creationTime`  Convex creation time (ms)
 *   `_updatedAt`     Last-Write-Wins clock of this row (ms)
 *   `_dirty`         1 = changed locally and still waiting to reach Convex
 *   `_deleted`       1 = deleted locally, waiting for the delete to reach Convex
 *   `_syncedAt`      last time this row was confirmed on Convex
 */

export type SqlType = "TEXT" | "INTEGER" | "REAL";

export type ColumnDef = {
  name: string;
  type: SqlType;
  /** JSON-encoded value (arrays / audit changes). */
  json?: boolean;
  notNull?: boolean;
};

export type IndexDef = {
  name: string;
  columns: string[];
};

export type TableDef = {
  /** Table name — identical to the Convex table name. */
  name: string;
  /** Arabic label shown in the Excel template and the sync screens. */
  label: string;
  /** English label used in the workbook's mapping sheet. */
  englishLabel: string;
  columns: ColumnDef[];
  indexes?: IndexDef[];
  /** Writable tables can be queued offline; read-only tables are pull-only. */
  writable?: boolean;
  /** Roles allowed to write this table (mirrors the Convex capability matrix). */
  writeCapability?: string;
  /**
   * True for tables the plant asked for that have no first-class Convex table
   * yet: they live only in the local database and are neither pushed nor
   * pulled. Their Excel sheets are computed from the real ledger instead.
   */
  localOnly?: boolean;
};

const t = (name: string, type: SqlType = "TEXT"): ColumnDef => ({ name, type });
const j = (name: string): ColumnDef => ({ name, type: "TEXT", json: true });
const n = (name: string, type: SqlType = "REAL"): ColumnDef => ({ name, type });
const b = (name: string): ColumnDef => ({ name, type: "INTEGER" });

/** Columns every mirrored table carries, in a fixed order. */
const BOOKKEEPING: ColumnDef[] = [
  { name: "_creationTime", type: "INTEGER" },
  { name: "_updatedAt", type: "INTEGER", notNull: true },
  { name: "_dirty", type: "INTEGER", notNull: true },
  { name: "_deleted", type: "INTEGER", notNull: true },
  { name: "_syncedAt", type: "INTEGER" },
];

export const MIRRORED_TABLES: TableDef[] = [
  {
    name: "customers",
    label: "العملاء",
    englishLabel: "Customers",
    localOnly: true,
    writable: true,
    columns: [
      t("name"),
      t("phone"),
      t("contactName"),
      t("address"),
      t("taxId"),
      t("creditTerms"),
      n("creditLimit", "REAL"),
      b("isActive"),
      t("notes"),
      n("updatedAt", "INTEGER"),
      t("createdBy"),
    ],
    indexes: [{ name: "customers_by_name", columns: ["name"] }],
  },
  {
    name: "suppliers",
    label: "الموردين",
    englishLabel: "Suppliers",
    localOnly: true,
    writable: true,
    columns: [
      t("name"),
      t("phone"),
      t("contactName"),
      t("materialCategory"),
      t("address"),
      t("taxId"),
      t("paymentTerms"),
      b("isActive"),
      t("notes"),
      n("updatedAt", "INTEGER"),
      t("createdBy"),
    ],
    indexes: [{ name: "suppliers_by_name", columns: ["name"] }],
  },
  {
    name: "materials",
    label: "المواد",
    englishLabel: "Materials",
    writable: true,
    writeCapability: "manageInventory",
    columns: [
      t("branchId"),
      t("name"),
      t("category"),
      t("unit"),
      n("openingQty"),
      n("reorderLevel"),
      n("standardCost"),
      t("supplier"),
      b("isActive"),
      n("updatedAt", "INTEGER"),
    ],
    indexes: [
      { name: "materials_by_branch", columns: ["branchId"] },
      { name: "materials_by_name", columns: ["name"] },
    ],
  },
  {
    name: "mixPrices",
    label: "الخلطات",
    englishLabel: "MixDesigns",
    writable: true,
    writeCapability: "manageSettings",
    columns: [
      t("name"),
      n("price"),
      n("cost"),
      n("strengthMpa"),
      n("cementKgPerM3"),
      t("notes"),
      b("isActive"),
      n("updatedAt", "INTEGER"),
    ],
    indexes: [{ name: "mixPrices_by_name", columns: ["name"] }],
  },
  {
    name: "productionLogs",
    label: "الطلبيات",
    englishLabel: "Orders",
    writable: true,
    writeCapability: "createLog",
    columns: [
      t("branchId"),
      t("date"),
      t("shift"),
      t("mixDesign"),
      t("customer"),
      t("site"),
      t("orderRef"),
      n("quantityM3"),
      n("deliveredM3"),
      n("returnedM3"),
      n("pricePerM3"),
      n("costPerM3"),
      n("truckCount", "INTEGER"),
      b("onTime"),
      t("status"),
      t("notes"),
      b("isTestData"),
      t("createdBy"),
    ],
    indexes: [
      { name: "productionLogs_by_date", columns: ["date"] },
      { name: "productionLogs_by_customer", columns: ["customer"] },
      { name: "productionLogs_by_branch", columns: ["branchId"] },
    ],
  },
  {
    name: "batches",
    label: "الانتاج اليومي",
    englishLabel: "Batches",
    localOnly: true,
    writable: true,
    writeCapability: "createLog",
    columns: [
      t("branchId"),
      t("date"),
      t("shift"),
      t("mixDesign"),
      t("customer"),
      t("orderRef"),
      n("batchNumber", "INTEGER"),
      n("quantityM3"),
      n("cementKg"),
      n("sandM3"),
      n("gravelM3"),
      n("waterLiters"),
      n("additiveKg"),
      n("truckCount", "INTEGER"),
      t("status"),
      t("notes"),
      b("isTestData"),
      t("createdBy"),
    ],
    indexes: [
      { name: "batches_by_date", columns: ["date"] },
      { name: "batches_by_branch", columns: ["branchId"] },
    ],
  },
  {
    name: "qualityTests",
    label: "اختبارات الجودة",
    englishLabel: "QualityTests",
    writable: true,
    writeCapability: "createQualityTest",
    columns: [
      t("branchId"),
      t("date"),
      t("kind"),
      t("mixDesign"),
      t("customer"),
      t("site"),
      t("orderRef"),
      t("productionLogId"),
      t("sampleRef"),
      t("labName"),
      n("targetValue"),
      n("tolerance"),
      n("actualValue"),
      t("result"),
      t("testedBy"),
      t("notes"),
      b("isTestData"),
      t("createdBy"),
    ],
    indexes: [{ name: "qualityTests_by_date", columns: ["date"] }],
  },
  {
    name: "invoices",
    label: "الفواتير",
    englishLabel: "Invoices",
    localOnly: true,
    writable: true,
    writeCapability: "viewFinancials",
    columns: [
      t("branchId"),
      t("number"),
      t("date"),
      t("customer"),
      t("month"),
      n("quantityM3"),
      n("unitPrice"),
      n("subtotal"),
      n("taxPct"),
      n("taxAmount"),
      n("total"),
      n("paidAmount"),
      t("status"),
      t("notes"),
      n("updatedAt", "INTEGER"),
      t("createdBy"),
    ],
    indexes: [
      { name: "invoices_by_date", columns: ["date"] },
      { name: "invoices_by_customer", columns: ["customer"] },
    ],
  },
  {
    name: "materialMovements",
    label: "المخازن",
    englishLabel: "Warehouses",
    writable: true,
    writeCapability: "manageInventory",
    columns: [
      t("branchId"),
      t("materialId"),
      t("date"),
      t("kind"),
      n("quantity"),
      n("unitCost"),
      t("supplier"),
      t("reference"),
      t("note"),
      b("isTestData"),
      t("createdBy"),
    ],
    indexes: [{ name: "materialMovements_by_date", columns: ["date"] }],
  },
  {
    name: "expenses",
    label: "المصروفات",
    englishLabel: "Expenses",
    localOnly: true,
    writable: true,
    writeCapability: "viewFinancials",
    columns: [
      t("branchId"),
      t("date"),
      t("category"),
      t("description"),
      n("amount"),
      t("vendor"),
      t("paymentMethod"),
      t("reference"),
      t("notes"),
      n("updatedAt", "INTEGER"),
      t("createdBy"),
    ],
    indexes: [{ name: "expenses_by_date", columns: ["date"] }],
  },
  {
    name: "equipment",
    label: "الشاحنات والسائقين",
    englishLabel: "TrucksDrivers",
    writable: true,
    writeCapability: "manageMaintenance",
    columns: [
      t("branchId"),
      t("code"),
      t("name"),
      t("kind"),
      t("driverName"),
      t("driverPhone"),
      t("plateNumber"),
      t("meterUnit"),
      n("meterReading"),
      n("lastServiceMeter"),
      n("serviceInterval"),
      n("serviceIntervalDays"),
      t("lastServiceDate"),
      n("avgDailyUsage"),
      b("isActive"),
      t("notes"),
      n("updatedAt", "INTEGER"),
    ],
    indexes: [{ name: "equipment_by_branch", columns: ["branchId"] }],
  },
  {
    name: "maintenanceRecords",
    label: "الصيانة",
    englishLabel: "Maintenance",
    localOnly: true,
    writable: true,
    writeCapability: "manageMaintenance",
    columns: [
      t("branchId"),
      t("equipmentId"),
      t("date"),
      t("kind"),
      t("description"),
      n("meterReading"),
      n("cost"),
      t("vendor"),
      t("downtimeHours"),
      t("notes"),
      t("createdBy"),
    ],
    indexes: [{ name: "maintenanceRecords_by_date", columns: ["date"] }],
  },
  {
    name: "warehouses",
    label: "المخازن",
    englishLabel: "Warehouses",
    localOnly: true,
    writable: true,
    writeCapability: "manageSettings",
    columns: [
      t("branchId"),
      t("code"),
      t("name"),
      t("location"),
      t("keeperName"),
      t("keeperPhone"),
      b("isActive"),
      t("notes"),
      n("updatedAt", "INTEGER"),
    ],
    indexes: [{ name: "warehouses_by_branch", columns: ["branchId"] }],
  },
  {
    name: "inventory",
    label: "أرصدة المخزون",
    englishLabel: "Inventory",
    localOnly: true,
    writable: true,
    writeCapability: "manageInventory",
    columns: [
      t("branchId"),
      t("warehouseId"),
      t("materialId"),
      t("materialName"),
      t("unit"),
      n("qty"),
      n("reorderLevel"),
      n("unitCost"),
      n("updatedAt", "INTEGER"),
    ],
    indexes: [
      { name: "inventory_by_branch", columns: ["branchId"] },
      { name: "inventory_by_material", columns: ["materialId"] },
    ],
  },
  {
    name: "branches",
    label: "الفروع",
    englishLabel: "Branches",
    writable: true,
    writeCapability: "manageBranches",
    columns: [
      t("code"),
      t("name"),
      t("city"),
      t("address"),
      t("managerName"),
      t("phone"),
      n("capacityM3Day"),
      b("isActive"),
      t("notes"),
      t("createdBy"),
    ],
  },
  {
    name: "plantSettings",
    label: "بيانات المحطة",
    englishLabel: "PlantSettings",
    writable: true,
    writeCapability: "manageSettings",
    columns: [
      t("plantName"),
      t("legalName"),
      t("taxId"),
      t("phone"),
      t("email"),
      t("address"),
      t("currency"),
      n("capacityM3Day"),
      t("alertEmail"),
      t("alertPhone"),
      n("updatedAt", "INTEGER"),
      t("updatedBy"),
    ],
  },
  {
    name: "users",
    label: "المستخدمون والصلاحيات",
    englishLabel: "Users",
    writable: false,
    columns: [
      t("name"),
      t("image"),
      t("email"),
      n("emailVerificationTime", "INTEGER"),
      b("isAnonymous"),
      t("role"),
    ],
    indexes: [{ name: "users_by_email", columns: ["email"] }],
  },
  {
    name: "alertRules",
    label: "قواعد التنبيه",
    englishLabel: "AlertRules",
    writable: true,
    writeCapability: "manageAlerts",
    columns: [
      t("name"),
      t("metric"),
      t("comparator"),
      n("threshold"),
      t("channel"),
      j("recipients"),
      n("windowDays", "INTEGER"),
      t("branchId"),
      b("isActive"),
      n("lastCheckedAt", "INTEGER"),
      n("lastTriggeredAt", "INTEGER"),
      n("lastValue"),
      t("createdBy"),
    ],
  },
  {
    name: "alertEvents",
    label: "سجل التنبيهات",
    englishLabel: "AlertEvents",
    writable: false,
    columns: [
      t("ruleId"),
      t("ruleName"),
      t("metric"),
      t("comparator"),
      n("value"),
      n("threshold"),
      t("channel"),
      j("recipients"),
      t("message"),
      n("firedAt", "INTEGER"),
      t("date"),
      t("status"),
      t("error"),
    ],
    indexes: [{ name: "alertEvents_by_fired", columns: ["firedAt"] }],
  },
  {
    name: "auditLogs",
    label: "سجل التتبع",
    englishLabel: "AuditLog",
    writable: false,
    columns: [
      t("actorId"),
      t("actorName"),
      t("actorEmail"),
      t("actorRole"),
      b("isAnonymous"),
      t("action"),
      t("entity"),
      t("entityId"),
      t("label"),
      j("changes"),
      n("at", "INTEGER"),
      t("date"),
    ],
    indexes: [
      { name: "auditLogs_by_at", columns: ["at"] },
      { name: "auditLogs_by_date", columns: ["date"] },
    ],
  },
];

/** Queue of local writes waiting to reach Convex. */
export const SYNC_QUEUE_TABLE: TableDef = {
  name: "sync_queue",
  label: "طابور المزامنة",
  englishLabel: "SyncQueue",
  columns: [
    // `id` is the public queue key (mirrored into "_id" for SQLite storage).
    { name: "id", type: "TEXT", notNull: true },
    { name: "tableName", type: "TEXT", notNull: true },
    { name: "recordId", type: "TEXT", notNull: true },
    /** create | update | delete */
    { name: "action", type: "TEXT", notNull: true },
    /** JSON snapshot of the local row that must reach Convex. */
    { name: "payload", type: "TEXT", notNull: true },
    /** pending | synced | failed */
    { name: "status", type: "TEXT", notNull: true },
    { name: "createdAt", type: "INTEGER", notNull: true },
    { name: "updatedAt", type: "INTEGER" },
    { name: "attempts", type: "INTEGER", notNull: true },
    { name: "lastError", type: "TEXT" },
  ],
  indexes: [
    { name: "sync_queue_by_status", columns: ["status", "createdAt"] },
  ],
};

/** Small key/value store for `lastSyncAt`, the local id map, and settings. */
export const LOCAL_META_TABLE: TableDef = {
  name: "local_meta",
  label: "بيانات محلية",
  englishLabel: "LocalMeta",
  columns: [
    { name: "key", type: "TEXT", notNull: true },
    { name: "value", type: "TEXT" },
  ],
};

export const ALL_TABLES: TableDef[] = [
  ...MIRRORED_TABLES,
  SYNC_QUEUE_TABLE,
  LOCAL_META_TABLE,
];

export const WRITABLE_TABLES = MIRRORED_TABLES.filter((table) => table.writable);

export const TABLE_NAMES = MIRRORED_TABLES.map((table) => table.name);

export function findTable(name: string): TableDef | undefined {
  return ALL_TABLES.find((table) => table.name === name);
}

/** Stable local id for a row created while offline. */
export function localId(table: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `local_${table}_${Date.now().toString(36)}${random}`;
}

export function isLocalId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("local_");
}

function columnSql(table: TableDef): string[] {
  const lines = ['  "_id" TEXT PRIMARY KEY'];
  if (table.name !== LOCAL_META_TABLE.name) {
    for (const column of BOOKKEEPING) {
      lines.push(`  "${column.name}" ${column.type}${column.notNull ? " NOT NULL" : ""}`);
    }
  }
  for (const column of table.columns) {
    lines.push(`  "${column.name}" ${column.type}${column.notNull ? " NOT NULL" : ""}`);
  }
  return lines;
}

/** Full DDL, executed once when the local database is opened. */
export function buildSchemaSql(): string[] {
  const statements: string[] = [];
  for (const table of ALL_TABLES) {
    statements.push(
      `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${columnSql(table).join(",\n")}\n)`,
    );
    for (const index of table.indexes ?? []) {
      statements.push(
        `CREATE INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" (${index.columns
          .map((column) => `"${column}"`)
          .join(", ")})`,
      );
    }
  }
  return statements;
}

/** Column names used when writing a row (bookkeeping + business columns). */
export function writableColumns(table: TableDef): string[] {
  const names = table.columns.map((column) => column.name);
  if (table.name === LOCAL_META_TABLE.name) return names;
  return [
    "_creationTime",
    "_updatedAt",
    "_dirty",
    "_deleted",
    "_syncedAt",
    ...names,
  ];
}
