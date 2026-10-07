/**
 * IConcrete System — local database adapter.
 *
 * One API, two engines:
 *
 *   • Tauri desktop build  → real SQLite file (`iconcrete.db`) through
 *     `@tauri-apps/plugin-sql`. This is the offline store that survives
 *     restarts and works with the network cable unplugged.
 *
 *   • Browser / Vercel build → the same operations over an in-memory map that is
 *     mirrored into `localStorage`, so the deployed web app keeps working
 *     exactly as before while still exposing the sync surface.
 *
 * Both engines store rows with the same shape as a Convex document plus the
 * bookkeeping columns declared in `./schema`.
 */

import { buildSchemaSql, findTable } from "./schema";
import type { TableDef } from "./schema";

export type LocalRow = {
  /** Absent only for a brand-new row that has not been stored yet. */
  _id?: string;
  _creationTime?: number | null;
  _updatedAt?: number | null;
  _dirty?: number;
  _deleted?: number;
  _syncedAt?: number | null;
  [field: string]: unknown;
};

/** Convex stores booleans; SQLite stores 0/1. These fields round-trip. */
const BOOLEAN_FIELDS = new Set([
  "isActive",
  "isAnonymous",
  "isTestData",
  "onTime",
]);

export interface LocalDb {
  /** "sqlite" for the desktop build, "memory" for the browser build. */
  readonly kind: "sqlite" | "memory";
  ready(): Promise<void>;
  all(table: string): Promise<LocalRow[]>;
  get(table: string, id: string): Promise<LocalRow | null>;
  upsert(table: string, row: LocalRow): Promise<void>;
  upsertMany(table: string, rows: LocalRow[]): Promise<void>;
  remove(table: string, id: string): Promise<void>;
  clear(table: string): Promise<void>;
  meta(key: string): Promise<string | null>;
  setMeta(key: string, value: string | null): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Serialisation                                                      */
/* ------------------------------------------------------------------ */

function serializeValue(field: string, value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function deserializeRow(table: TableDef | undefined, raw: LocalRow): LocalRow {
  const row: LocalRow = { ...raw };
  if (!table) return row;
  for (const column of table.columns) {
    const value = row[column.name];
    if (value === null || value === undefined) continue;
    if (column.json) {
      if (typeof value === "string") {
        try {
          row[column.name] = JSON.parse(value);
        } catch {
          row[column.name] = [];
        }
      }
      continue;
    }
    if (BOOLEAN_FIELDS.has(column.name)) {
      row[column.name] = value === 1 || value === true || value === "1";
      continue;
    }
    if (column.type !== "TEXT" && typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) row[column.name] = parsed;
    }
  }
  for (const field of ["_dirty", "_deleted"]) {
    row[field] = row[field] === 1 || row[field] === true ? 1 : 0;
  }
  return row;
}

/** Column list used by `INSERT`, in a stable order. */
function columnsFor(table: TableDef): string[] {
  const columns = ["_id", "_creationTime", "_updatedAt", "_dirty", "_deleted", "_syncedAt"];
  for (const column of table.columns) columns.push(column.name);
  return columns;
}

/* ------------------------------------------------------------------ */
/* SQLite (Tauri desktop)                                             */
/* ------------------------------------------------------------------ */

type SqlClient = {
  execute(sql: string, values?: unknown[]): Promise<unknown>;
  select<T>(sql: string, values?: unknown[]): Promise<T[]>;
};

class SqliteLocalDb implements LocalDb {
  readonly kind = "sqlite" as const;
  private client: SqlClient | null = null;
  private opening: Promise<void> | null = null;

  async ready(): Promise<void> {
    if (this.client) return;
    if (!this.opening) this.opening = this.open();
    await this.opening;
  }

  private async open(): Promise<void> {
    const mod = await import("@tauri-apps/plugin-sql");
    const Database = mod.default;
    const db = await Database.load("sqlite:iconcrete.db");
    this.client = db as unknown as SqlClient;
    for (const statement of buildSchemaSql()) {
      await db.execute(statement);
    }
    await db.execute("PRAGMA journal_mode = WAL");
  }

  private async db(): Promise<SqlClient> {
    await this.ready();
    if (!this.client) throw new Error("Local database is not available");
    return this.client;
  }

  async all(table: string): Promise<LocalRow[]> {
    const client = await this.db();
    const rows = await client.select<LocalRow>(`SELECT * FROM "${table}"`);
    const definition = findTable(table);
    return rows.map((row) => deserializeRow(definition, row));
  }

  async get(table: string, id: string): Promise<LocalRow | null> {
    const client = await this.db();
    const rows = await client.select<LocalRow>(
      `SELECT * FROM "${table}" WHERE "_id" = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? deserializeRow(findTable(table), rows[0]) : null;
  }

  async upsert(table: string, row: LocalRow): Promise<void> {
    await this.upsertMany(table, [row]);
  }

  async upsertMany(table: string, rows: LocalRow[]): Promise<void> {
    if (rows.length === 0) return;
    const definition = findTable(table);
    if (!definition) throw new Error(`Unknown local table: ${table}`);
    const client = await this.db();
    const columns = columnsFor(definition);
    const quoted = columns.map((column) => `"${column}"`).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const updates = columns
      .filter((column) => column !== "_id")
      .map((column) => `"${column}" = excluded."${column}"`)
      .join(", ");
    const sql = `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders}) ON CONFLICT("_id") DO UPDATE SET ${updates}`;
    for (const row of rows) {
      const values = columns.map((column) =>
        serializeValue(column, row[column]),
      );
      await client.execute(sql, values);
    }
  }

  async remove(table: string, id: string): Promise<void> {
    const client = await this.db();
    await client.execute(`DELETE FROM "${table}" WHERE "_id" = ?`, [id]);
  }

  async clear(table: string): Promise<void> {
    const client = await this.db();
    await client.execute(`DELETE FROM "${table}"`);
  }

  async meta(key: string): Promise<string | null> {
    const client = await this.db();
    const rows = await client.select<{ value: string | null }>(
      `SELECT "value" FROM "local_meta" WHERE "_id" = ? LIMIT 1`,
      [key],
    );
    return rows[0]?.value ?? null;
  }

  async setMeta(key: string, value: string | null): Promise<void> {
    const client = await this.db();
    if (value === null) {
      await client.execute(`DELETE FROM "local_meta" WHERE "_id" = ?`, [key]);
      return;
    }
    await client.execute(
      `INSERT INTO "local_meta" ("_id", "key", "value") VALUES (?, ?, ?)
       ON CONFLICT("_id") DO UPDATE SET "value" = excluded."value"`,
      [key, key, value],
    );
  }
}

/* ------------------------------------------------------------------ */
/* Memory + localStorage (browser / Vercel)                           */
/* ------------------------------------------------------------------ */

const STORAGE_PREFIX = "iconcrete.db.";

class MemoryLocalDb implements LocalDb {
  readonly kind = "memory" as const;
  private tables = new Map<string, Map<string, LocalRow>>();
  private opened = false;

  async ready(): Promise<void> {
    if (this.opened) return;
    this.opened = true;
    if (typeof window === "undefined") return;
    for (const table of ["productionLogs", "sync_queue", "local_meta"]) {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + table);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as LocalRow[];
        const map = new Map<string, LocalRow>();
        for (const row of parsed) map.set(String(row._id), row);
        this.tables.set(table, map);
      } catch {
        /* ignore corrupt cache */
      }
    }
  }

  private table(name: string): Map<string, LocalRow> {
    let map = this.tables.get(name);
    if (!map) {
      map = new Map<string, LocalRow>();
      this.tables.set(name, map);
    }
    return map;
  }

  private persist(name: string): void {
    if (typeof window === "undefined") return;
    if (!this.opened) return;
    if (!["productionLogs", "sync_queue", "local_meta"].includes(name)) return;
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + name,
        JSON.stringify([...this.table(name).values()].slice(-4000)),
      );
    } catch {
      /* quota exceeded — the cloud copy is still authoritative */
    }
  }

  async all(table: string): Promise<LocalRow[]> {
    await this.ready();
    return [...this.table(table).values()];
  }

  async get(table: string, id: string): Promise<LocalRow | null> {
    await this.ready();
    return this.table(table).get(id) ?? null;
  }

  async upsert(table: string, row: LocalRow): Promise<void> {
    await this.upsertMany(table, [row]);
  }

  async upsertMany(table: string, rows: LocalRow[]): Promise<void> {
    await this.ready();
    const map = this.table(table);
    for (const row of rows) map.set(String(row._id), { ...row });
    this.persist(table);
  }

  async remove(table: string, id: string): Promise<void> {
    await this.ready();
    this.table(table).delete(id);
    this.persist(table);
  }

  async clear(table: string): Promise<void> {
    await this.ready();
    this.table(table).clear();
    this.persist(table);
  }

  async meta(key: string): Promise<string | null> {
    await this.ready();
    const row = this.table("local_meta").get(key);
    return row ? String(row.value ?? "") : null;
  }

  async setMeta(key: string, value: string | null): Promise<void> {
    await this.ready();
    if (value === null) this.table("local_meta").delete(key);
    else this.table("local_meta").set(key, { _id: key, key, value });
    this.persist("local_meta");
  }
}

/* ------------------------------------------------------------------ */
/* Singleton                                                          */
/* ------------------------------------------------------------------ */

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const candidate = window as unknown as Record<string, unknown>;
  return (
    "__TAURI_INTERNALS__" in candidate ||
    "__TAURI__" in candidate ||
    navigator.userAgent.includes("Tauri")
  );
}

let instance: LocalDb | null = null;

/**
 * The local database for the current runtime. The desktop build gets SQLite;
 * the browser build gets the in-memory mirror. Both behave identically from the
 * caller's point of view.
 */
export function getLocalDb(): LocalDb {
  if (instance) return instance;
  instance = isTauri() ? new SqliteLocalDb() : new MemoryLocalDb();
  return instance;
}

/** Test seam: lets the sync engine run against a specific engine. */
export function setLocalDb(db: LocalDb | null): void {
  instance = db;
}
