/**
 * IConcrete System — offline sync engine.
 *
 * Every write goes through `writeLocalFirst`: the row lands in the local SQLite
 * (desktop) or browser database first and is queued in `sync_queue`. When the
 * machine is online the queue is flushed straight away; when it is offline the
 * queue grows until the operator presses «مزامنة آخر اليوم — Sync End of Day».
 *
 * `syncAll()` is that button. It runs in two phases so Last-Write-Wins stays
 * honest:
 *
 *   1. MERGE — pull the cloud state of every mirrored table and compare it with
 *      the local rows. A row that is dirty locally but older than the cloud copy
 *      loses (the cloud value is kept and the pending operation is dropped); a
 *      row that is dirty and newer keeps its local value.
 *   2. PUSH  — send everything still pending to Convex through the plant's
 *      normal mutations, so validation, pricing and auditing are never bypassed.
 *
 * Every conflict is written to `auditLogs` (locally and on Convex) with the
 * timestamps of both copies and which side won.
 */

import { api } from "@/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import { getLocalDb } from "./db";
import type { LocalRow } from "./db";
import { isLocalId, localId } from "./schema";

export type SyncAction = "create" | "update" | "delete";
export type SyncStatus = "pending" | "synced" | "failed";

export type QueueRow = {
  /** SQLite primary key (mirrors `id`). */
  _id: string;
  /** Public queue key, as defined in the offline schema. */
  id: string;
  tableName: string;
  recordId: string;
  action: SyncAction;
  payload: string;
  status: SyncStatus;
  createdAt: number;
  attempts: number;
  lastError?: string | null;
};

export type SyncConflict = {
  tableName: string;
  recordId: string;
  action: SyncAction;
  resolution: "local" | "remote";
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  fields: string[];
  note?: string;
};

export type SyncReport = {
  merged: number;
  pushed: number;
  failed: number;
  conflicts: SyncConflict[];
  pulledAt: number;
  tables: string[];
  online: boolean;
  message: string;
};

export type SyncClient = {
  query: ConvexReactClient["query"];
  mutation: ConvexReactClient["mutation"];
};

const META_LAST_SYNC = "lastSyncAt";
const META_ID_MAP = "idmap";
const QUEUE_TABLE = "sync_queue";

/* ------------------------------------------------------------------ */
/* Value coercion                                                     */
/* ------------------------------------------------------------------ */

const text = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const parsed = String(value).trim();
  return parsed ? parsed : undefined;
};

const required = (value: unknown): string => String(value ?? "").trim();

const number = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const flag = (value: unknown): boolean =>
  value === true ||
  value === 1 ||
  value === "1" ||
  value === "true" ||
  value === "نعم";

/** Convex document references: `never` lets one helper feed every table. */
const ref = (value: unknown) => (text(value) ?? undefined) as never;

const list = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const parsed = text(value);
  if (!parsed) return [];
  return parsed
    .split(/[،,;·]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

/* ------------------------------------------------------------------ */
/* Per-table mutation arguments                                       */
/* ------------------------------------------------------------------ */

type Args = Record<string, unknown>;

function logArgs(p: LocalRow): Args {
  return {
    branchId: ref(p.branchId),
    date: required(p.date),
    shift: (p.shift ?? "morning") as never,
    mixDesign: required(p.mixDesign),
    customer: required(p.customer),
    site: text(p.site),
    orderRef: text(p.orderRef),
    quantityM3: number(p.quantityM3),
    deliveredM3: number(p.deliveredM3),
    returnedM3: number(p.returnedM3),
    pricePerM3: number(p.pricePerM3),
    costPerM3: number(p.costPerM3),
    truckCount: Math.round(number(p.truckCount)),
    onTime: flag(p.onTime),
    status: (p.status ?? "delivered") as never,
    notes: text(p.notes),
  };
}

function qualityArgs(p: LocalRow): Args {
  return {
    branchId: ref(p.branchId),
    date: required(p.date),
    kind: (p.kind ?? "cube28") as never,
    mixDesign: required(p.mixDesign),
    customer: required(p.customer),
    site: text(p.site),
    orderRef: text(p.orderRef),
    sampleRef: text(p.sampleRef),
    labName: text(p.labName),
    targetValue: number(p.targetValue),
    tolerance: p.tolerance === null || p.tolerance === undefined ? undefined : number(p.tolerance),
    actualValue: number(p.actualValue),
    testedBy: text(p.testedBy),
    notes: text(p.notes),
  };
}

function materialArgs(p: LocalRow): Args {
  return {
    branchId: ref(p.branchId),
    name: required(p.name),
    category: (p.category ?? "cement") as never,
    unit: (p.unit ?? "ton") as never,
    openingQty: number(p.openingQty),
    reorderLevel: number(p.reorderLevel),
    standardCost: number(p.standardCost),
    supplier: text(p.supplier),
    isActive: p.isActive === undefined ? true : flag(p.isActive),
  };
}

function movementArgs(p: LocalRow): Args {
  return {
    branchId: ref(p.branchId),
    materialId: ref(p.materialId),
    date: required(p.date),
    kind: (p.kind ?? "receipt") as never,
    quantity: number(p.quantity),
    unitCost: p.unitCost === null || p.unitCost === undefined ? undefined : number(p.unitCost),
    supplier: text(p.supplier),
    reference: text(p.reference),
    note: text(p.note),
  };
}

function equipmentArgs(p: LocalRow): Args {
  return {
    branchId: ref(p.branchId),
    code: required(p.code),
    name: required(p.name),
    kind: (p.kind ?? "truck") as never,
    meterUnit: (p.meterUnit ?? "km") as never,
    meterReading: number(p.meterReading),
    lastServiceMeter: number(p.lastServiceMeter),
    serviceInterval: number(p.serviceInterval),
    serviceIntervalDays:
      p.serviceIntervalDays === null || p.serviceIntervalDays === undefined
        ? undefined
        : number(p.serviceIntervalDays),
    lastServiceDate: text(p.lastServiceDate),
    avgDailyUsage: number(p.avgDailyUsage),
    isActive: p.isActive === undefined ? true : flag(p.isActive),
    notes: text(p.notes),
  };
}

function mixArgs(p: LocalRow): Args {
  return {
    name: required(p.name),
    price: number(p.price),
    cost: number(p.cost),
    strengthMpa: p.strengthMpa === null || p.strengthMpa === undefined ? undefined : number(p.strengthMpa),
    cementKgPerM3:
      p.cementKgPerM3 === null || p.cementKgPerM3 === undefined ? undefined : number(p.cementKgPerM3),
    notes: text(p.notes),
    isActive: p.isActive === undefined ? true : flag(p.isActive),
  };
}

function branchArgs(p: LocalRow): Args {
  return {
    code: required(p.code),
    name: required(p.name),
    city: text(p.city),
    address: text(p.address),
    managerName: text(p.managerName),
    phone: text(p.phone),
    capacityM3Day: number(p.capacityM3Day),
    isActive: p.isActive === undefined ? true : flag(p.isActive),
    notes: text(p.notes),
  };
}

function ruleArgs(p: LocalRow): Args {
  return {
    name: required(p.name),
    metric: (p.metric ?? "dailyProfit") as never,
    comparator: (p.comparator ?? "lt") as never,
    threshold: number(p.threshold),
    channel: (p.channel ?? "email") as never,
    recipients: list(p.recipients),
    windowDays: Math.round(number(p.windowDays)),
    branchId: ref(p.branchId),
    isActive: p.isActive === undefined ? true : flag(p.isActive),
  };
}

type Operation = {
  fn: unknown;
  args: Args;
};

type TableSpec = {
  create?: (payload: LocalRow) => Operation;
  update?: (payload: LocalRow, serverId: string) => Operation;
  remove?: (serverId: string) => Operation;
};

/**
 * How each mirrored table maps onto the plant's existing mutations. Nothing here
 * writes to the database directly — every queued change travels through the same
 * guarded, priced and audited path as an online edit.
 */
const TABLE_SPECS: Record<string, TableSpec> = {
  productionLogs: {
    create: (p) => ({ fn: api.production.create, args: logArgs(p) }),
    update: (p, id) => ({ fn: api.production.update, args: { id, ...logArgs(p) } }),
    remove: (id) => ({ fn: api.production.remove, args: { id } }),
  },
  qualityTests: {
    create: (p) => ({ fn: api.quality.create, args: qualityArgs(p) }),
    update: (p, id) => ({ fn: api.quality.update, args: { id, ...qualityArgs(p) } }),
    remove: (id) => ({ fn: api.quality.remove, args: { id } }),
  },
  materials: {
    create: (p) => ({ fn: api.inventory.createMaterial, args: materialArgs(p) }),
    update: (p, id) => ({ fn: api.inventory.updateMaterial, args: { id, ...materialArgs(p) } }),
    remove: (id) => ({ fn: api.inventory.removeMaterial, args: { id } }),
  },
  materialMovements: {
    create: (p) => ({ fn: api.inventory.recordMovement, args: movementArgs(p) }),
    remove: (id) => ({ fn: api.inventory.removeMovement, args: { id } }),
  },
  equipment: {
    create: (p) => ({ fn: api.forecast.createEquipment, args: equipmentArgs(p) }),
    update: (p, id) => ({ fn: api.forecast.updateEquipment, args: { id, ...equipmentArgs(p) } }),
    remove: (id) => ({ fn: api.forecast.removeEquipment, args: { id } }),
  },
  mixPrices: {
    create: (p) => ({ fn: api.settings.upsertMix, args: mixArgs(p) }),
    update: (p, id) => ({ fn: api.settings.upsertMix, args: { id, ...mixArgs(p) } }),
    remove: (id) => ({ fn: api.settings.removeMix, args: { id } }),
  },
  branches: {
    create: (p) => ({ fn: api.branches.create, args: branchArgs(p) }),
    update: (p, id) => ({ fn: api.branches.update, args: { id, ...branchArgs(p) } }),
    remove: (id) => ({ fn: api.branches.remove, args: { id } }),
  },
  alertRules: {
    create: (p) => ({ fn: api.alerts.createRule, args: ruleArgs(p) }),
    update: (p, id) => ({ fn: api.alerts.updateRule, args: { id, ...ruleArgs(p) } }),
    remove: (id) => ({ fn: api.alerts.removeRule, args: { id } }),
  },
};

/** Tables the queue knows how to push. Everything else is pull-only. */
export const PUSHABLE_TABLES = Object.keys(TABLE_SPECS);

/* ------------------------------------------------------------------ */
/* Local identity map (local id → server id)                          */
/* ------------------------------------------------------------------ */

async function readIdMap(): Promise<Record<string, string>> {
  const raw = await getLocalDb().meta(META_ID_MAP);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function rememberId(localKey: string, serverId: string): Promise<void> {
  const map = await readIdMap();
  map[localKey] = serverId;
  await getLocalDb().setMeta(META_ID_MAP, JSON.stringify(map));
}

/** Replaces locally-created references with their server ids. */
function remap(payload: LocalRow, map: Record<string, string>): LocalRow {
  const next: LocalRow = { ...payload };
  for (const [field, value] of Object.entries(next)) {
    if (typeof value === "string" && map[value]) next[field] = map[value];
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Queue                                                              */
/* ------------------------------------------------------------------ */

export async function enqueueWrite(
  tableName: string,
  action: SyncAction,
  recordId: string,
  payload: LocalRow,
): Promise<string> {
  const db = getLocalDb();
  await db.ready();
  const at = Date.now();
  const id = `q_${at.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await db.upsert(QUEUE_TABLE, {
    _id: id,
    id,
    tableName,
    recordId,
    action,
    payload: JSON.stringify(payload),
    status: "pending",
    createdAt: at,
    attempts: 0,
    lastError: null,
  });
  return id;
}

export async function pendingOperations(): Promise<QueueRow[]> {
  const rows = (await getLocalDb().all(QUEUE_TABLE)) as unknown as QueueRow[];
  return rows
    .filter((row) => row.status === "pending" || row.status === "failed")
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingCount(): Promise<number> {
  return (await pendingOperations()).length;
}

async function markQueue(
  id: string,
  patch: Partial<QueueRow> & { _id: string },
): Promise<void> {
  const db = getLocalDb();
  const existing = await db.get(QUEUE_TABLE, id);
  if (!existing) return;
  await db.upsert(QUEUE_TABLE, { ...existing, ...patch });
}

/** Drops the pending operations of a row that lost a conflict. */
async function dropOperations(tableName: string, recordId: string): Promise<number> {
  const db = getLocalDb();
  const rows = (await db.all(QUEUE_TABLE)) as unknown as QueueRow[];
  let dropped = 0;
  for (const row of rows) {
    if (row.tableName !== tableName || row.recordId !== recordId) continue;
    if (row.status === "synced") continue;
    await markQueue(row._id, { _id: row._id, status: "synced", lastError: "حُسم لصالح الكلاود" });
    dropped += 1;
  }
  return dropped;
}

/* ------------------------------------------------------------------ */
/* Local-first write                                                  */
/* ------------------------------------------------------------------ */

export type LocalWriteOutcome = {
  /** The id the caller should keep using (local until the first successful push). */
  recordId: string;
  /** True when the row already reached Convex in this call. */
  pushed: boolean;
  /** The server's rejection message, when an online push failed. */
  error: string | null;
};

/**
 * The write path every screen uses: SQLite first, cloud second.
 *
 * When the caller passes a client and the machine is online, the queued change
 * is flushed immediately — which is the «online mode: every save syncs at once»
 * half of the requirement. Offline it simply stays queued.
 */
export async function writeLocalFirst(
  tableName: string,
  action: SyncAction,
  values: LocalRow,
  options: { flush?: SyncClient | null } = {},
): Promise<LocalWriteOutcome> {
  const db = getLocalDb();
  await db.ready();
  const now = Date.now();
  const recordId = String(values._id ?? localId(tableName));
  const row: LocalRow = {
    ...values,
    _id: recordId,
    _creationTime: values._creationTime ?? now,
    _updatedAt: now,
    _dirty: 1,
    _deleted: action === "delete" ? 1 : 0,
    _syncedAt: values._syncedAt ?? null,
  };
  await db.upsert(tableName, row);
  const queueId = await enqueueWrite(tableName, action, recordId, row);

  let pushed = false;
  let error: string | null = null;
  if (options.flush && isOnline()) {
    await flushPending(options.flush);
    const queued = (await getLocalDb().get(QUEUE_TABLE, queueId)) as unknown as QueueRow | null;
    if (queued?.status === "synced") pushed = true;
    else if (queued?.status === "failed") {
      error = queued.lastError ?? "تعذرت مزامنة القيد مع الكلاود";
    }
  }

  return { recordId, pushed, error };
}

/* ------------------------------------------------------------------ */
/* Push                                                               */
/* ------------------------------------------------------------------ */

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

async function pushOne(client: SyncClient, operation: QueueRow): Promise<string | null> {
  const spec = TABLE_SPECS[operation.tableName];
  if (!spec) throw new Error(`لا يوجد مسار مزامنة للجدول «${operation.tableName}»`);

  const map = await readIdMap();
  const payload = remap(JSON.parse(operation.payload) as LocalRow, map);
  const localKey = isLocalId(operation.recordId) ? operation.recordId : null;

  if (operation.action === "create") {
    if (!spec.create) throw new Error("إنشاء سجل في هذا الجدول غير مدعوم للمزامنة");
    const { fn, args } = spec.create(payload);
    const serverId = (await client.mutation(fn as never, args as never)) as unknown as string;
    if (localKey && serverId) await rememberId(localKey, serverId);
    return serverId ?? null;
  }

  const serverId = localKey ? map[localKey] : operation.recordId;
  if (!serverId) throw new Error("السجل لم يصل إلى الكلاود بعد");

  if (operation.action === "update") {
    if (spec.update) {
      const { fn, args } = spec.update(payload, serverId);
      await client.mutation(fn as never, args as never);
      return serverId;
    }
    // No update route (e.g. stock movements) → replace: delete then create.
    if (spec.remove && spec.create) {
      const removal = spec.remove(serverId);
      await client.mutation(removal.fn as never, removal.args as never);
      const creation = spec.create(payload);
      return (await client.mutation(creation.fn as never, creation.args as never)) as unknown as string;
    }
    throw new Error("تعديل هذا الجدول غير مدعوم للمزامنة");
  }

  if (!spec.remove) throw new Error("حذف هذا الجدول غير مدعوم للمزامنة");
  const removal = spec.remove(serverId);
  await client.mutation(removal.fn as never, removal.args as never);
  return serverId;
}

/** Sends every pending operation to Convex and marks the rows clean. */
export async function flushPending(client: SyncClient): Promise<{ pushed: number; failed: number }> {
  const db = getLocalDb();
  const operations = await pendingOperations();
  let pushed = 0;
  let failed = 0;

  for (const operation of operations) {
    try {
      const serverId = await pushOne(client, operation);
      await markQueue(operation._id, { _id: operation._id, status: "synced", lastError: null });
      const current = await db.get(operation.tableName, operation.recordId);
      if (current) {
        const next: LocalRow = { ...current, _dirty: 0, _syncedAt: Date.now() };
        if (serverId && serverId !== operation.recordId) {
          next._id = serverId;
          await db.remove(operation.tableName, operation.recordId);
          // Point later operations of the same row at the server id.
          const rest = (await db.all(QUEUE_TABLE)) as unknown as QueueRow[];
          for (const row of rest) {
            if (row.tableName === operation.tableName && row.recordId === operation.recordId) {
              await db.upsert(QUEUE_TABLE, { ...row, recordId: serverId });
            }
          }
        }
        await db.upsert(operation.tableName, next);
      }
      pushed += 1;
    } catch (error) {
      failed += 1;
      await markQueue(operation._id, {
        _id: operation._id,
        status: "failed",
        attempts: (operation.attempts ?? 0) + 1,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { pushed, failed };
}

/* ------------------------------------------------------------------ */
/* Pull + merge (Last-Write-Wins)                                     */
/* ------------------------------------------------------------------ */

const MONEY_FIELDS = ["price", "cost", "standardCost", "unitCost", "pricePerM3", "costPerM3"];

function clockOf(row: LocalRow): number {
  const updated = typeof row.updatedAt === "number" ? row.updatedAt : 0;
  const created = typeof row._creationTime === "number" ? row._creationTime : 0;
  return Math.max(updated, created);
}

function differingFields(local: LocalRow, remote: LocalRow): string[] {
  const fields: string[] = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const key of keys) {
    if (key.startsWith("_")) continue;
    const a = local[key];
    const b = remote[key];
    if (a === b) continue;
    if (a === null && b === undefined) continue;
    if (a === undefined && b === null) continue;
    fields.push(key);
  }
  return fields.sort();
}

async function mergeTable(
  tableName: string,
  remoteRows: LocalRow[],
): Promise<{ merged: number; conflicts: SyncConflict[] }> {
  const db = getLocalDb();
  const conflicts: SyncConflict[] = [];
  const seen = new Set<string>();
  let merged = 0;

  for (const remote of remoteRows) {
    const remoteId = String(remote._id);
    seen.add(remoteId);
    const local = await db.get(tableName, remoteId);
    if (!local) {
      await db.upsert(tableName, {
        ...remote,
        _creationTime: remote._creationTime ?? null,
        _updatedAt: clockOf(remote),
        _dirty: 0,
        _deleted: 0,
        _syncedAt: Date.now(),
      });
      merged += 1;
      continue;
    }

    const dirty = local._dirty === 1;
    const localClock = typeof local._updatedAt === "number" ? local._updatedAt : 0;
    const remoteClock = clockOf(remote);

    if (!dirty) {
      await db.upsert(tableName, {
        ...remote,
        _creationTime: remote._creationTime ?? null,
        _updatedAt: Math.max(localClock, remoteClock),
        _dirty: 0,
        _deleted: 0,
        _syncedAt: Date.now(),
      });
      merged += 1;
      continue;
    }

    // Dirty locally: Last Write Wins on the timestamps.
    const fields = differingFields(local, remote);
    if (remoteClock > localClock + 1000) {
      await dropOperations(tableName, remoteId);
      await db.upsert(tableName, {
        ...remote,
        _creationTime: remote._creationTime ?? null,
        _updatedAt: remoteClock,
        _dirty: 0,
        _deleted: 0,
        _syncedAt: Date.now(),
      });
      conflicts.push({
        tableName,
        recordId: remoteId,
        action: "update",
        resolution: "remote",
        localUpdatedAt: localClock,
        remoteUpdatedAt: remoteClock,
        fields,
        note: "النسخة الأحدث من الكلاود",
      });
      merged += 1;
      continue;
    }

    if (fields.length > 0) {
      conflicts.push({
        tableName,
        recordId: remoteId,
        action: "update",
        resolution: "local",
        localUpdatedAt: localClock,
        remoteUpdatedAt: remoteClock,
        fields,
        note: "النسخة المحلية الأحدث",
      });
    }
  }

  // Local rows deleted on the cloud while we were offline.
  const localRows = await db.all(tableName);
  for (const local of localRows) {
    if (local._dirty === 1) continue;
    if (seen.has(String(local._id))) continue;
    await db.remove(tableName, String(local._id));
  }

  return { merged, conflicts };
}

/** Merges the cloud state into the local database, resolving conflicts. */
export async function pullAndMerge(client: SyncClient): Promise<{
  merged: number;
  conflicts: SyncConflict[];
  tables: string[];
}> {
  const result = await client.query(api.sync.pull as never, {} as never);
  const payload = result as unknown as {
    rows: Record<string, LocalRow[]>;
    tables: string[];
  };
  let merged = 0;
  const conflicts: SyncConflict[] = [];

  for (const [tableName, rows] of Object.entries(payload.rows ?? {})) {
    const outcome = await mergeTable(tableName, rows ?? []);
    merged += outcome.merged;
    conflicts.push(...outcome.conflicts);
  }

  return { merged, conflicts, tables: payload.tables ?? [] };
}

/* ------------------------------------------------------------------ */
/* The Sync End of Day button                                         */
/* ------------------------------------------------------------------ */

/** Writes the conflict decisions into the local audit mirror. */
async function logLocally(conflicts: SyncConflict[]): Promise<void> {
  if (conflicts.length === 0) return;
  const db = getLocalDb();
  const at = Date.now();
  for (const conflict of conflicts) {
    const winner = conflict.resolution === "local" ? "النسخة المحلية" : "نسخة الكلاود";
    await db.upsert("auditLogs", {
      _id: `conflict_${at}_${Math.random().toString(36).slice(2, 8)}`,
      actorName: "مزامنة آخر اليوم",
      action: "update",
      entity: conflict.tableName,
      entityId: conflict.recordId,
      label: `تعارض حُسم لصالح ${winner}`,
      changes: [
        {
          field: "syncConflict",
          before: new Date(conflict.localUpdatedAt).toISOString(),
          after: new Date(conflict.remoteUpdatedAt).toISOString(),
        },
        ...conflict.fields.map((field) => ({
          field,
          before: winner === "النسخة المحلية" ? "محلي" : "كلاود",
          after: winner,
        })),
      ],
      at,
      date: new Date(at).toISOString().slice(0, 10),
      _creationTime: at,
      _updatedAt: at,
      _dirty: 0,
      _deleted: 0,
      _syncedAt: null,
    });
  }
}

/**
 * «مزامنة آخر اليوم — Sync End of Day».
 * Merge first (so a stale local edit never overwrites newer cloud data), then
 * push everything still pending, then record the outcome.
 */
export async function syncAll(client: SyncClient): Promise<SyncReport> {
  const online = isOnline();
  const merge = await pullAndMerge(client);
  const push = await flushPending(client);

  if (merge.conflicts.length > 0) {
    await logLocally(merge.conflicts);
    try {
      await client.mutation(api.sync.reportConflicts as never, {
        conflicts: merge.conflicts,
      } as never);
    } catch {
      /* the local mirror already holds the trail; retry on the next sync */
    }
  }

  const pulledAt = Date.now();
  await getLocalDb().setMeta(META_LAST_SYNC, String(pulledAt));

  const parts = [
    `تم دمج ${merge.merged} سجلًا من الكلاود`,
    `ورفع ${push.pushed} تغييرًا`,
  ];
  if (push.failed > 0) parts.push(`${push.failed} فشل — ستُعاد المحاولة`);
  if (merge.conflicts.length > 0) parts.push(`${merge.conflicts.length} تعارض سُجّل في سجل التتبع`);

  return {
    merged: merge.merged,
    pushed: push.pushed,
    failed: push.failed,
    conflicts: merge.conflicts,
    pulledAt,
    tables: merge.tables,
    online,
    message: parts.join(" · "),
  };
}

export async function lastSyncAt(): Promise<number | null> {
  const raw = await getLocalDb().meta(META_LAST_SYNC);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Cheap liveness probe used by the status indicator to distinguish
 *  "browser says online" from "the cloud actually answers". */
export async function probeCloud(client: SyncClient): Promise<boolean> {
  try {
    await client.query(api.sync.pull as never, { tables: [] } as never);
    return true;
  } catch {
    return false;
  }
}

export const MONEY_SYNC_FIELDS = MONEY_FIELDS;
