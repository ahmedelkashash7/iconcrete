import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { AuditAction } from "./schema";

/**
 * IConcrete System — audit trail.
 *
 * Every mutating function calls `recordAudit` with the actor and the field-level
 * diff, so the change history is produced by the same code path that performs
 * the change (it cannot be skipped from the interface).
 */

export type { AuditAction };

export type AuditChange = {
  field: string;
  before?: string;
  after?: string;
};

export type AuditEntry = {
  actorId?: Id<"users">;
  action: AuditAction;
  entity: string;
  entityId?: string;
  label?: string;
  changes?: AuditChange[];
};

/** Fields audited for each entity, in the order they should be read. */
export const AUDITED_FIELDS = [
  "date",
  "shift",
  "mixDesign",
  "customer",
  "site",
  "orderRef",
  "quantityM3",
  "deliveredM3",
  "returnedM3",
  "pricePerM3",
  "costPerM3",
  "truckCount",
  "onTime",
  "status",
  "notes",
] as const;

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export async function recordAudit(
  ctx: MutationCtx,
  entry: AuditEntry,
): Promise<void> {
  let actorName = "عضو الفريق";
  let actorEmail: string | undefined;
  let actorRole: string | undefined;
  let isAnonymous = false;

  if (entry.actorId) {
    const actor = await ctx.db.get(entry.actorId);
    if (actor) {
      actorName =
        actor.name?.trim() ||
        (actor.email ? actor.email.split("@")[0] : "عضو الفريق");
      actorEmail = actor.email ?? undefined;
      actorRole = actor.role ?? undefined;
      isAnonymous = actor.isAnonymous === true;
    }
  }

  const at = Date.now();
  await ctx.db.insert("auditLogs", {
    actorId: entry.actorId,
    actorName,
    actorEmail,
    actorRole,
    isAnonymous,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    label: entry.label,
    changes: entry.changes ?? [],
    at,
    date: new Date(at).toISOString().slice(0, 10),
  });
}

const read = (record: object, field: string) =>
  asText((record as Record<string, unknown>)[field]);

/** Field-level diff between the stored record and the incoming values. */
export function diffRecords(
  before: object,
  after: object,
  fields: readonly string[] = AUDITED_FIELDS,
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const previous = read(before, field);
    const next = read(after, field);
    if (previous !== next) {
      changes.push({ field, before: previous, after: next });
    }
  }
  return changes;
}

/** Full snapshot of a record, used for creations and deletions. */
export function snapshotRecord(
  record: object,
  side: "before" | "after" = "after",
  fields: readonly string[] = AUDITED_FIELDS,
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const value = read(record, field);
    if (!value) continue;
    changes.push(
      side === "after" ? { field, after: value } : { field, before: value },
    );
  }
  return changes;
}
