import type { PackTable } from "./model";
import { TABLES_A } from "./tablesA";
import { TABLES_B } from "./tablesB";
import { TABLES_C } from "./tablesC";
import { TABLES_D } from "./tablesD";

/** The published model: 47 sheets covering the plant end to end. */
export const DATA_MODEL_TABLES: PackTable[] = [
  ...TABLES_A,
  ...TABLES_B,
  ...TABLES_C,
  ...TABLES_D,
];

export const MODEL_COLUMN_COUNT = DATA_MODEL_TABLES.reduce(
  (total, table) => total + table.columns.length,
  0,
);

/** Sheets whose data arrives live from the deployment's export endpoints. */
export const EXPORT_LINKED_TABLES = DATA_MODEL_TABLES.filter(
  (table) => table.sourceKind === "endpoint",
);

export const MODEL_GROUPS = [...new Set(DATA_MODEL_TABLES.map((table) => table.group))];

export function tableByName(name: string): PackTable | undefined {
  return DATA_MODEL_TABLES.find((table) => table.name === name);
}

/** Money columns of a sheet, used by the masking rules and the DAX audit. */
export function moneyColumns(table: PackTable): string[] {
  return table.columns
    .filter((column) => column.type === "money")
    .map((column) => column.name);
}
