/**
 * IConcrete System — Excel / Power Platform pack: data-model types.
 *
 * The model below is the single source of truth the pack is generated from:
 * every Power Query script, Azure SQL table, SharePoint list, CSV template and
 * JSON schema in the download is produced from these definitions, so the
 * workbook, the database and the live export layer can never drift apart.
 */

export type PackColumnType =
  | "text"
  | "int"
  | "decimal"
  | "money"
  | "date"
  | "datetime"
  | "bool"
  | "geo"
  | "json";

export type PackColumn = {
  /** English identifier used by Power Query, SQL and the CSV headers. */
  name: string;
  /** Arabic label written into the workbook's header row comment. */
  label: string;
  type: PackColumnType;
  /** Primary or business key of the sheet. */
  key?: boolean;
  /** Personally identifiable / financial value: encrypted at rest, masked in exports. */
  sensitive?: boolean;
  /** Value range enforced by the sheet's validation rule. */
  range?: [number, number];
};

export type PackTable = {
  /** Excel table name, Azure SQL table name and SharePoint list name. */
  name: string;
  label: string;
  group: string;
  /** Live export entity key from the Convex export layer, when one exists. */
  endpoint?: string;
  description: string;
  /** Physical source the Power Query script reads when there is no endpoint. */
  sourceKind: "endpoint" | "sharepoint" | "sql" | "excel" | "iot";
  columns: PackColumn[];
  /** Sheet carries the Test_Data_Flag guard column. */
  testFlag?: boolean;
  /** Audit columns appended by fnAddAuditColumns. */
  audited?: boolean;
};

/** Column shorthand: flags are `k` (key), `s` (sensitive), `t` (text range). */
export function c(
  name: string,
  label: string,
  type: PackColumnType,
  flags = "",
  range?: [number, number],
): PackColumn {
  return {
    name,
    label,
    type,
    key: flags.includes("k") || undefined,
    sensitive: flags.includes("s") || undefined,
    range,
  };
}

export const MONEY_TYPE: PackColumnType = "money";

/** Azure SQL type per model type. */
export const SQL_TYPES: Record<PackColumnType, string> = {
  text: "nvarchar(200)",
  int: "int",
  decimal: "decimal(18,3)",
  money: "decimal(18,2)",
  date: "date",
  datetime: "datetime2(0)",
  bool: "bit",
  geo: "decimal(10,6)",
  json: "nvarchar(max)",
};

/** SharePoint list column type per model type. */
export const SHAREPOINT_TYPES: Record<PackColumnType, string> = {
  text: "Text",
  int: "Number",
  decimal: "Number",
  money: "Currency",
  date: "DateTime",
  datetime: "DateTime",
  bool: "Boolean",
  geo: "Number",
  json: "Note",
};

/** Power Query `type` literal per model type. */
export const M_TYPES: Record<PackColumnType, string> = {
  text: "type text",
  int: "Int64.Type",
  decimal: "type number",
  money: "Currency.Type",
  date: "type date",
  datetime: "type datetime",
  bool: "type logical",
  geo: "type number",
  json: "type text",
};

/** Culture used when reading dates and numbers out of the export endpoint. */
export const PACK_LOCALE = "en-US";
