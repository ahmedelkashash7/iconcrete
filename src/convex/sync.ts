import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireViewer } from "./access";
import { recordAudit } from "./auditLog";
import { MAX_ROWS, utcToday } from "./measures";
import { can } from "./permissions";
import type { Viewer } from "./permissions";

/**
 * IConcrete System — offline sync endpoints.
 *
 * The desktop build keeps every row in a local SQLite database and pushes its
 * queued changes to the cloud through the *existing* mutations (so the plant's
 * validation, pricing and audit rules are never bypassed). Convex only has to
 * provide the two halves the client cannot do itself:
 *
 *   • `pull`            — the current cloud state of every mirrored table, so
 *                         `Sync End of Day` can refresh the local database.
 *   • `reportConflicts` — writes Last-Write-Wins decisions into `auditLogs`, so
 *                         every overwritten value is traceable.
 *
 * Money is stripped here exactly like everywhere else: a role without
 * `viewFinancials` never receives prices, even in a pull.
 */

/** Tables the client mirrors locally, in the order the Excel template uses. */
export const SYNC_TABLES = [
  "branches",
  "mixPrices",
  "plantSettings",
  "materials",
  "materialMovements",
  "equipment",
  "productionLogs",
  "qualityTests",
  "alertRules",
  "alertEvents",
  "users",
  "auditLogs",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

type Row = Record<string, unknown>;

const MONEY_FIELDS = ["price", "cost", "standardCost", "unitCost", "pricePerM3", "costPerM3"];

function redact(row: Row): Row {
  const next: Row = { ...row };
  for (const field of MONEY_FIELDS) {
    if (field in next) next[field] = 0;
  }
  return next;
}

async function readTable(
  ctx: QueryCtx,
  table: SyncTable,
  viewer: Viewer,
): Promise<Row[]> {
  const financials = can(viewer, "viewFinancials");
  const asRows = <T extends object>(rows: T[]): Row[] =>
    rows.map((row) => {
      const plain: Row = { ...(row as unknown as Row) };
      return financials ? plain : redact(plain);
    });

  switch (table) {
    case "branches":
      return asRows(await ctx.db.query("branches").take(MAX_ROWS));
    case "mixPrices":
      return asRows(await ctx.db.query("mixPrices").take(MAX_ROWS));
    case "plantSettings":
      return asRows(await ctx.db.query("plantSettings").take(MAX_ROWS));
    case "materials":
      return asRows(await ctx.db.query("materials").take(MAX_ROWS));
    case "materialMovements":
      return asRows(await ctx.db.query("materialMovements").take(MAX_ROWS));
    case "equipment":
      return asRows(await ctx.db.query("equipment").take(MAX_ROWS));
    case "productionLogs":
      return asRows(
        await ctx.db.query("productionLogs").withIndex("by_date", (q) => q).take(MAX_ROWS),
      );
    case "qualityTests":
      return asRows(
        await ctx.db.query("qualityTests").withIndex("by_date", (q) => q).take(MAX_ROWS),
      );
    case "alertRules":
      return asRows(await ctx.db.query("alertRules").take(MAX_ROWS));
    case "alertEvents":
      return asRows(
        await ctx.db.query("alertEvents").withIndex("by_fired", (q) => q).take(MAX_ROWS),
      );
    case "users": {
      if (!can(viewer, "viewTeam")) return [];
      return asRows(await ctx.db.query("users").take(MAX_ROWS));
    }
    case "auditLogs": {
      if (!can(viewer, "viewAudit")) return [];
      return asRows(
        await ctx.db.query("auditLogs").withIndex("by_at", (q) => q).take(MAX_ROWS),
      );
    }
    default:
      return [];
  }
}

/** Current cloud state of every mirrored table, for the pull half of a sync. */
export const pull = query({
  args: { tables: v.optional(v.array(v.string())) },
  handler: async (ctx, { tables }) => {
    const viewer = await requireViewer(ctx);
    const requested = (tables?.length
      ? SYNC_TABLES.filter((table) => tables.includes(table))
      : SYNC_TABLES) as SyncTable[];
    const rows: Record<string, Row[]> = {};
    for (const table of requested) {
      rows[table] = await readTable(ctx, table, viewer);
    }
    return {
      rows,
      tables: requested as string[],
      financialsVisible: can(viewer, "viewFinancials"),
      pulledAt: Date.now(),
      today: utcToday(),
    };
  },
});

const conflictValidator = v.object({
  tableName: v.string(),
  recordId: v.string(),
  action: v.string(),
  /** Which copy was kept: `local` (pushed) or `remote` (cloud wins). */
  resolution: v.union(v.literal("local"), v.literal("remote")),
  localUpdatedAt: v.optional(v.number()),
  remoteUpdatedAt: v.optional(v.number()),
  fields: v.optional(v.array(v.string())),
  note: v.optional(v.string()),
});

/**
 * Records the Last-Write-Wins decisions taken while syncing.
 *
 * Conflicts are written to the same `auditLogs` trail every manual edit uses,
 * so an offline overwrite is as traceable as an online one.
 */
export const reportConflicts = mutation({
  args: { conflicts: v.array(conflictValidator) },
  handler: async (ctx, { conflicts }) => {
    const viewer = await requireViewer(ctx);
    const kept: Array<{ tableName: string; recordId: string; resolution: string }> = [];

    for (const conflict of conflicts.slice(0, 200)) {
      const winner = conflict.resolution === "local" ? "النسخة المحلية" : "نسخة الكلاود";
      await recordAudit(ctx, {
        actorId: viewer.userId,
        action: conflict.action === "delete" ? "delete" : "update",
        entity: conflict.tableName,
        entityId: conflict.recordId,
        label: `مزامنة آخر اليوم — تعارض حُسم لصالح ${winner}`,
        changes: [
          {
            field: "syncConflict",
            before: `local ${new Date(conflict.localUpdatedAt ?? 0).toISOString()}`,
            after: `remote ${new Date(conflict.remoteUpdatedAt ?? 0).toISOString()} · ${winner}`,
          },
          ...(conflict.fields ?? []).map((field) => ({
            field,
            before: conflict.note ?? "قيمة محلية",
            after: conflict.resolution === "local" ? "قيمة محلية" : "قيمة الكلاود",
          })),
        ],
      });
      kept.push({
        tableName: conflict.tableName,
        recordId: conflict.recordId,
        resolution: conflict.resolution,
      });
    }

    return { logged: kept.length, conflicts: kept };
  },
});
