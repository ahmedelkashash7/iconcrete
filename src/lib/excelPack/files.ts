import {
  DAX_CALCULATED_COLUMNS,
  DAX_MEASURES,
  type DaxMeasure,
} from "./dax";
import {
  API_ENDPOINTS,
  AUTH_LAYER,
  DASHBOARDS,
  INTEGRATIONS,
  ML_MODELS,
  PROTECTION_CHECKLIST,
  RBAC_ROLES,
  RETENTION_POLICY,
  STANDARDS,
  WEBHOOK_EVENTS,
} from "./layers";
import { M_TYPES, SHAREPOINT_TYPES, SQL_TYPES, type PackTable } from "./model";
import { DATA_MODEL_TABLES, MODEL_COLUMN_COUNT, moneyColumns } from "./tables";

/**
 * IConcrete System — artifact generators.
 *
 * Everything the download contains is produced here from the published model,
 * which keeps the workbook, the Azure SQL schema, the SharePoint lists and the
 * live Power Query scripts in sync by construction.
 */

export type PackFile = {
  /** Folder + file name inside the zip. */
  path: string;
  content: string;
  language: string;
  note: string;
};

const runtimeEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/** Baked from the running project so the scripts work on first refresh. */
export const DEPLOYMENT_URL =
  runtimeEnv.VITE_CONVEX_URL ?? "https://REPLACE-WITH-YOUR-DEPLOYMENT.convex.cloud";

export const EXPORT_TOKEN_PLACEHOLDER = "REPLACE_WITH_ICONCRETE_EXPORT_TOKEN";

/* ------------------------------------------------------------------ */
/* Power Query                                                        */
/* ------------------------------------------------------------------ */

const SHARED_FUNCTIONS = `// ===================================================================
// IConcrete System — Power Query shared functions
// ضع هذا الاستعلام في مجموعة «IConcrete_Functions» كدوال محمّلة.
// ===================================================================

// عنوان المنظومة والرمز: عدّل السطرين قبل التحديث الأول.
PACK_DEPLOYMENT_URL = "${DEPLOYMENT_URL}",
PACK_TOKEN = "${EXPORT_TOKEN_PLACEHOLDER}",

// -------------------------------------------------------------------
// fnExportCsv — يقرأ كيانًا من طبقة التصدير الموحّدة (CSV مع BOM)
// -------------------------------------------------------------------
fnExportCsv = (Endpoint as text, Filters as record) as table =>
    let
        from = Record.FieldOrDefault(Filters, "from", null),
        to = Record.FieldOrDefault(Filters, "to", null),
        branch = Record.FieldOrDefault(Filters, "branch", null),
        Query =
            "?token=" & PACK_TOKEN
                & (if from = null then "" else "&from=" & from)
                & (if to = null then "" else "&to=" & to)
                & (if branch = null then "" else "&branch=" & Uri.EscapeDataString(branch)),
        Response = Web.Contents(PACK_DEPLOYMENT_URL & Endpoint & Query),
        Parsed = Csv.Document(Response, [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
        WithoutComment = Table.Skip(Parsed, 1),
        Promoted = Table.PromoteHeaders(WithoutComment, [PromoteAllScalars = true])
    in
        Promoted,

// -------------------------------------------------------------------
// fnManualSource — مصدر ورقة داخل المصنف (للجداول غير المرتبطة بنقطة تصدير)
// بدائل: SharePoint.Tables · Sql.Database · OData.Feed حسب بيئة المؤسسة.
// -------------------------------------------------------------------
fnManualSource = (TableName as text) as table =>
    let
        Source = Excel.CurrentWorkbook(){[Name = TableName]}[Content]
    in
        Source,

// -------------------------------------------------------------------
// fnToType — تحويل تلقائي لأنواع البيانات للحقول الموجودة فقط
// -------------------------------------------------------------------
fnToType = (Tbl as table, Specs as list) as table =>
    let
        Present = List.Select(Specs, each Table.HasColumns(Tbl, _{0})),
        Typed = if List.IsEmpty(Present) then Tbl else Table.TransformColumnTypes(Tbl, Present, "en-US")
    in
        Typed,

// -------------------------------------------------------------------
// fnDedupeRows — إزالة التكرار بمفتاح العمل، مع الأخذ بأحدث صف
// -------------------------------------------------------------------
fnDedupeRows = (Tbl as table, Keys as list, OrderColumn as nullable text) as table =>
    let
        Present = List.Select(Keys, each Table.HasColumns(Tbl, {_})),
        Sorted =
            if OrderColumn <> null and Table.HasColumns(Tbl, {OrderColumn})
            then Table.Sort(Tbl, {{OrderColumn, Order.Descending}})
            else Tbl,
        Deduped = if List.IsEmpty(Present) then Sorted else Table.Distinct(Sorted, Present)
    in
        Deduped,

// -------------------------------------------------------------------
// fnFlagRowErrors — تحقق من الأخطاء مع رسالة عربية ودليل حل
// Rules = { {"quantity_m3", 0, 5000}, {"margin_pct", -100, 100} }
// -------------------------------------------------------------------
fnFlagRowErrors = (Tbl as table, Rules as list) as table =>
    let
        Checks = List.Transform(
            List.Select(Rules, each Table.HasColumns(Tbl, _{0})),
            (rule) =>
                let
                    col = rule{0},
                    lo = rule{1},
                    hi = rule{2},
                    test = (row) =>
                        let
                            v = Record.FieldOrDefault(row, col, null)
                        in
                            v <> null and (v < lo or v > hi)
                in
                    { col, test, lo, hi }
        ),
        Flagged = Table.AddColumn(
            Tbl,
            "_Validation_Message",
            (row) =>
                let
                    hits = List.Select(Checks, each _{1}(row)),
                    messages = List.Transform(
                        hits,
                        each "قيمة " & _{0} & " = " & Text.From(Record.FieldOrDefault(row, _{0}, null))
                            & " خارج النطاق المسموح (" & Text.From(_{2}) & " – " & Text.From(_{3}) & ")"
                    )
                in
                    if List.IsEmpty(messages) then null else Text.Combine(messages, " | "),
            type nullable text
        ),
        WithStatus = Table.AddColumn(
            Flagged,
            "_Row_Status",
            each if [ _Validation_Message ] = null then "OK" else "REVIEW",
            type text
        )
    in
        WithStatus,

// -------------------------------------------------------------------
// fnTestDataFlag — يضمن وجود عمود الحماية على كل جدول
// -------------------------------------------------------------------
fnTestDataFlag = (Tbl as table) as table =>
    if Table.HasColumns(Tbl, {"test_data_flag"})
    then Tbl
    else Table.AddColumn(Tbl, "test_data_flag", each false, type logical),

// -------------------------------------------------------------------
// fnAddAuditColumns — ختم وقت التحميل والمصدر على كل صف
// -------------------------------------------------------------------
fnAddAuditColumns = (Tbl as table, SourceName as text) as table =>
    let
        Stamped = Table.AddColumn(Tbl, "_Loaded_At", each DateTime.LocalNow(), type datetime),
        WithSource = Table.AddColumn(Stamped, "_Source_System", each SourceName, type text)
    in
        WithSource,

// -------------------------------------------------------------------
// fnSortByDate — الفرز المعياري: التاريخ ثم الوردية (شرط الجدول الزمني)
// -------------------------------------------------------------------
fnSortByDate = (Tbl as table, DateColumn as text, ShiftColumn as nullable text) as table =>
    let
        SortKeys =
            if ShiftColumn <> null and Table.HasColumns(Tbl, {ShiftColumn})
            then { { DateColumn, Order.Ascending }, { ShiftColumn, Order.Ascending } }
            else { { DateColumn, Order.Ascending } },
        Sorted = if Table.HasColumns(Tbl, {DateColumn}) then Table.Sort(Tbl, SortKeys) else Tbl
    in
        Sorted;
`;

function sourceBlock(table: PackTable): string {
  if (table.sourceKind === "endpoint" && table.endpoint) {
    return `    // المصدر الحيّ: ${table.endpoint} — عدّل from/to لتحصر نافذة التحميل
    Source = fnExportCsv(
        "/api/v1/iconcrete/${table.endpoint}.csv",
        [ from = null, to = null, branch = null ]
    ),`;
  }
  if (table.sourceKind === "iot") {
    return `    // المصدر: نقطة استقبال القياسات (IoT) — حتى توصيل الأجهزة تُملأ من ورقة العمل
    Source = fnManualSource("${table.name}"),
    // بديل عند توصيل الجهاز:
    // Source = Json.Document(Web.Contents(PACK_DEPLOYMENT_URL & "/api/v1/telemetry/gps"))[rows],`;
  }
  const alternative =
    table.sourceKind === "sharepoint"
      ? `    // Source = SharePoint.Tables(PACK_SHAREPOINT_URL, [ApiVersion = 15]){[Title = "${table.name}"]}[Items],`
      : `    // Source = Sql.Database(PACK_SQL_SERVER, "IConcrete"){[Schema = "dbo", Item = "${table.name}"]}[Data],`;
  return `    // المصدر: ورقة داخل المصنف باسم الجدول ${table.name}
    Source = fnManualSource("${table.name}"),
${alternative}`;
}

export function powerQueryForTable(table: PackTable): string {
  const types = table.columns
    .map((column) => `            {"${column.name}", ${M_TYPES[column.type]}}`)
    .join(",\n");
  const keys = table.columns
    .filter((column) => column.key)
    .map((column) => `"${column.name}"`)
    .join(", ");
  const rules = table.columns
    .filter((column) => column.range)
    .map((column) => `            {"${column.name}", ${column.range![0]}, ${column.range![1]}}`)
    .join(",\n");
  const dateColumn = table.columns.find((column) => column.type === "date");
  const shiftColumn = table.columns.find((column) => column.name === "shift");

  return `// ===================================================================
// ${table.name} — ${table.label}
// الطبقة: ${table.group} · ${table.description}
// ===================================================================
let
${sourceBlock(table)}
    Typed = fnToType(
        Source,
        {
${types}
        }
    ),
    Deduped = fnDedupeRows(Typed, { ${keys || '"no_key"'} }, ${dateColumn ? `"${dateColumn.name}"` : "null"}),
    Checked = fnFlagRowErrors(
        Deduped,
        {
${rules || "            // لا نطاقات رقمية على هذا الجدول"}
        }
    ),${dateColumn ? `\n    Sorted = fnSortByDate(Checked, "${dateColumn.name}", ${shiftColumn ? `"${shiftColumn.name}"` : "null"}),` : ""}
    Flagged = fnTestDataFlag(${dateColumn ? "Sorted" : "Checked"}),
    Audited = fnAddAuditColumns(Flagged, "IConcrete")
in
    Audited
// تحقق: _Row_Status = REVIEW يعني صفًا يحتاج مراجعة، ورسالته في _Validation_Message.
`;
}

const MERGE_ALL = `// ===================================================================
// 99_Merge_All — توحيد الحقائق في جدول واحد للتحليل السريع
// يُستخدم عندما تحتاج مقارنة أنواع مختلفة على نفس المحور الزمني.
// ===================================================================
let
    Orders = fact_Orders,
    Production = fact_ProductionDaily,

    // الحقيقة الموحّدة: كل مصدر يحمل وسم نوعه ووحداته
    FromOrders = Table.AddColumn(
        Table.SelectColumns(
            Orders,
            { "order_date", "branch", "customer", "mix_design", "delivered_m3", "revenue", "total_cost", "gross_profit" }
        ),
        "_Fact_Type",
        each "طلبية",
        type text
    ),
    FromProduction = Table.AddColumn(
        Table.SelectColumns(
            Production,
            { "date", "branch", "shift", "delivered_m3", "revenue", "total_cost", "gross_profit" }
        ),
        "_Fact_Type",
        each "إنتاج يومي",
        type text
    ),
    RenamedOrders = Table.RenameColumns(FromOrders, { { "order_date", "date" } }, MissingField.Ignore),
    Appended = Table.Combine({ RenamedOrders, FromProduction }),
    Grouped = Table.Group(
        Appended,
        { "date", "branch" },
        {
            { "delivered_m3", each List.Sum([delivered_m3]), type number },
            { "revenue", each List.Sum([revenue]), type number },
            { "total_cost", each List.Sum([total_cost]), type number },
            { "gross_profit", each List.Sum([gross_profit]), type number }
        }
    ),
    Flagged = Table.AddColumn(Grouped, "test_data_flag", each false, type logical)
in
    Flagged
// تنبيه: قد يحتوي الجدولان على نفس اليوم (طلبية مقابل مجمّع يومي)،
// فاستخدم هذا الاستعلام للمقارنة النوعية، واستخدم fact_Orders للأرقام الرسمية.
`;

/* ------------------------------------------------------------------ */
/* DAX / SQL / SharePoint                                             */
/* ------------------------------------------------------------------ */

function measureBlock(measure: DaxMeasure): string {
  return `// ${measure.description}
// المجلد: ${measure.folder} · تنسيق العرض: ${measure.format}
${measure.expression}
`;
}

export function daxMeasuresFile(): string {
  const folders = [...new Set(DAX_MEASURES.map((measure) => measure.folder))];
  return [
    "// ===================================================================",
    "// IConcrete System — مكتبة مقاييس DAX للحزمة",
    `// ${DAX_MEASURES.length} مقياسًا موزّعة على ${folders.length} مجلدات تطابق لوحات القيادة.`,
    "// الصقها في جدول _Measures ثم رتّب المجلد (Display folder) كما هو مكتوب.",
    "// ===================================================================",
    "",
    ...folders.flatMap((folder) => [
      `/* ---------------------------- ${folder} ---------------------------- */`,
      "",
      ...DAX_MEASURES.filter((measure) => measure.folder === folder).map(measureBlock),
    ]),
  ].join("\n");
}

export function daxColumnsFile(): string {
  return [
    "// IConcrete System — أعمدة محسوبة تجعل النموذج يشرح نفسه",
    "",
    ...DAX_CALCULATED_COLUMNS.map(
      (column) =>
        `// ${column.table} · ${column.description}\n${column.expression}\n`,
    ),
  ].join("\n");
}

function sqlTable(table: PackTable): string {
  const columns = table.columns.map((column) => {
    const type = SQL_TYPES[column.type];
    const nullable = column.key ? "NOT NULL" : "NULL";
    return `    [${column.name}] ${type} ${nullable}`;
  });
  const keys = table.columns.filter((column) => column.key).map((column) => `[${column.name}]`);
  const dateColumn = table.columns.find((column) => column.type === "date");
  const body = [
    ...columns.map((column) => `${column},`),
    // كل جدول يحمل عمود الحماية، وفي جداول الأبعاد يكون دائمًا 0.
    `    [test_data_flag] bit NOT NULL CONSTRAINT [DF_${table.name}_test] DEFAULT (0),`,
    table.audited
      ? "    [created_at] datetime2(0) NOT NULL CONSTRAINT [DF_" +
        table.name +
        "_created] DEFAULT (SYSUTCDATETIME()),\n    [created_by] nvarchar(200) NULL,\n    [updated_at] datetime2(0) NULL,\n    [updated_by] nvarchar(200) NULL,"
      : null,
    "    [_hash] varbinary(32) NULL,  -- بصمة الصف لكشف أي تلاعب مباشر",
    keys.length > 0 ? `    CONSTRAINT [PK_${table.name}] PRIMARY KEY (${keys.join(", ")})` : null,
  ].filter((line): line is string => line !== null);

  const lines = [
    `/* ${table.label} — ${table.description} */`,
    `CREATE TABLE dbo.${table.name} (`,
    ...body,
    ");",
  ];

  if (dateColumn) {
    lines.push(
      `CREATE NONCLUSTERED INDEX [IX_${table.name}_date] ON dbo.${table.name} ([${dateColumn.name}] DESC);`,
    );
  }
  const money = moneyColumns(table);
  if (money.length > 0) {
    lines.push(
      `-- أعمدة مالية تخصيصية: ${money.join(" · ")} — تُشفَّر بالكامل (Always Encrypted)`,
    );
  }
  return lines.join("\n");
}

export function sqlDdlFile(): string {
  return [
    "/* ====================================================================",
    "   IConcrete System — Azure SQL schema",
    `   ${DATA_MODEL_TABLES.length} جدولاً · ${MODEL_COLUMN_COUNT} عمودًا`,
    "   الخطوات: إنشاء قاعدة بيانات جديدة، تنفيذ هذا الملف، ثم ربط Power Query",
    "   بـ Sql.Database مع Authentication = OrganizationalAccount.",
    "   ==================================================================== */",
    "",
    "CREATE SCHEMA dbo AUTHORIZATION dbo;",
    "GO",
    "",
    "/* 1) جدول تشغيل ومراقبة التحميل */",
    "CREATE TABLE dbo.etl_run_log (",
    "    run_id int IDENTITY(1,1) PRIMARY KEY,",
    "    started_at datetime2(0) NOT NULL,",
    "    finished_at datetime2(0) NULL,",
    "    entity nvarchar(100) NOT NULL,",
    "    rows_read int NULL,",
    "    rows_written int NULL,",
    "    status nvarchar(20) NOT NULL,",
    "    message nvarchar(400) NULL",
    ");",
    "GO",
    "",
    ...DATA_MODEL_TABLES.map((table) => `${sqlTable(table)}\nGO`),
    "",
    "/* 2) العرض الموحّد للطلبيات — أول ما تستهلكه لوحات القيادة */",
    "CREATE VIEW dbo.vw_OrdersOverview AS",
    "SELECT",
    "    o.order_date, o.branch, o.customer, o.mix_design,",
    "    SUM(o.delivered_m3) AS delivered_m3,",
    "    SUM(o.revenue) AS revenue,",
    "    SUM(o.total_cost) AS total_cost,",
    "    SUM(o.gross_profit) AS gross_profit,",
    "    CASE WHEN SUM(o.revenue) = 0 THEN 0",
    "         ELSE SUM(o.gross_profit) / SUM(o.revenue) END AS margin_pct,",
    "    COUNT(*) AS orders_count",
    "FROM dbo.fact_Orders AS o",
    "WHERE o.test_data_flag = 0",
    "GROUP BY o.order_date, o.branch, o.customer, o.mix_design;",
    "GO",
    "",
    "/* 3) سياسة الاحتفاظ — تُطبَّق على القراءات التشغيلية عالية الحجم */",
    "CREATE TABLE dbo.cfg_RetentionPolicy (",
    "    policy_id nvarchar(50) NOT NULL PRIMARY KEY,",
    "    data_domain nvarchar(100) NOT NULL,",
    "    retention_years int NOT NULL,",
    "    legal_basis nvarchar(200) NOT NULL,",
    "    archive_target nvarchar(100) NOT NULL,",
    "    purge_method nvarchar(200) NOT NULL",
    ");",
    "GO",
  ].join("\n");
}

export function sharePointListsFile(): string {
  return JSON.stringify(
    {
      site: "https://REPLACE-WITH-TENANT.sharepoint.com/sites/IConcrete",
      note: "أنشئ قائمة لكل جدول، ثم اضبط الأعمدة كما هو مكتوب؛ الأنواع مطابقة لأنواع النموذج المنشور.",
      lists: DATA_MODEL_TABLES.map((table) => ({
        title: table.name,
        description: `${table.label} — ${table.description}`,
        itemCount: 0,
        versioning: true,
        contentApproval: table.audited ?? false,
        columns: table.columns.map((column) => ({
          name: column.name,
          displayName: column.label,
          type: SHAREPOINT_TYPES[column.type],
          required: Boolean(column.key),
          indexed: Boolean(column.key),
          sensitive: Boolean(column.sensitive),
        })),
        testFlagColumn: table.testFlag ?? false,
      })),
    },
    null,
    2,
  );
}

/* ------------------------------------------------------------------ */
/* CSV / JSON                                                         */
/* ------------------------------------------------------------------ */

function csvLine(values: Array<string | number | boolean | null>): string {
  return values
    .map((value) => {
      if (value === null) return "";
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(",");
}

/** Header-only sheet template: one sheet per table, ready to paste into Excel. */
export function csvTemplate(table: PackTable): string {
  return [
    `# ${table.name} — ${table.label} · ${table.description}`,
    csvLine(table.columns.map((column) => column.name)),
    csvLine(table.columns.map((column) => column.label)),
    "ملاحظة: الصف الثاني أسماء الأعمدة (لمحرك Power Query)، والصف الثالث عناوين عربية للعرض.",
  ].join("\r\n");
}

export function schemaJson(): string {
  return JSON.stringify(
    {
      product: "IConcrete System",
      artifact: "Data model",
      version: "1.0",
      generatedFor: "Excel / Power Platform",
      tables: DATA_MODEL_TABLES.length,
      columns: MODEL_COLUMN_COUNT,
      tables_detail: DATA_MODEL_TABLES.map((table) => ({
        name: table.name,
        label: table.label,
        group: table.group,
        description: table.description,
        sourceKind: table.sourceKind,
        endpoint: table.endpoint ?? null,
        testFlag: Boolean(table.testFlag),
        audited: Boolean(table.audited),
        keys: table.columns.filter((column) => column.key).map((column) => column.name),
        columns: table.columns.map((column) => ({
          name: column.name,
          label: column.label,
          type: column.type,
          key: Boolean(column.key),
          sensitive: Boolean(column.sensitive),
          range: column.range ?? null,
          sql: SQL_TYPES[column.type],
          sharepoint: SHAREPOINT_TYPES[column.type],
          powerQuery: M_TYPES[column.type],
        })),
      })),
      relationships: MODEL_RELATIONSHIPS,
    },
    null,
    2,
  );
}

export const MODEL_RELATIONSHIPS = [
  { fromTable: "fact_Orders", fromColumn: "branch", toTable: "dim_Branches", toColumn: "branch_name", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_Orders", fromColumn: "mix_design", toTable: "dim_MixDesigns", toColumn: "mix_design", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_Orders", fromColumn: "customer", toTable: "dim_Customers", toColumn: "customer_name", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_Orders", fromColumn: "order_date", toTable: "dim_Calendar", toColumn: "date", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_ProductionDaily", fromColumn: "date", toTable: "dim_Calendar", toColumn: "date", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_ProductionDaily", fromColumn: "branch", toTable: "dim_Branches", toColumn: "branch_name", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_QualityTests", fromColumn: "mix_design", toTable: "dim_MixDesigns", toColumn: "mix_design", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_QualityTests", fromColumn: "test_date", toTable: "dim_Calendar", toColumn: "date", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_MaterialMovements", fromColumn: "material_name", toTable: "dim_Materials", toColumn: "material_name", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_MaterialMovements", fromColumn: "movement_date", toTable: "dim_Calendar", toColumn: "date", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_MaintenanceOrders", fromColumn: "asset_code", toTable: "dim_Equipment", toColumn: "code", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_Telemetry_GPS", fromColumn: "truck_code", toTable: "dim_Equipment", toColumn: "code", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_FuelLog", fromColumn: "truck_code", toTable: "dim_Equipment", toColumn: "code", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "fact_Invoices", fromColumn: "customer", toTable: "dim_Customers", toColumn: "customer_name", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "ml_DemandForecast", fromColumn: "target_date", toTable: "dim_Calendar", toColumn: "date", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "ml_PredictiveMaintenance", fromColumn: "asset_code", toTable: "dim_Equipment", toColumn: "code", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "ml_ChurnPrediction", fromColumn: "customer", toTable: "dim_Customers", toColumn: "customer_name", cardinality: "متعدد إلى واحد", crossFilter: "اتجاه واحد" },
  { fromTable: "stg_ValidationErrors", fromColumn: "source_table", toTable: "dim_Branches", toColumn: "branch_name", cardinality: "غير مرتبط", crossFilter: "—" },
];

export function relationshipsCsv(): string {
  return [
    "# علاقات نموذج Power Pivot / Power BI — أنشئها في Order المذكور",
    csvLine(["from_table", "from_column", "to_table", "to_column", "cardinality", "cross_filter"]),
    ...MODEL_RELATIONSHIPS.map((relation) =>
      csvLine([
        relation.fromTable,
        relation.fromColumn,
        relation.toTable,
        relation.toColumn,
        relation.cardinality,
        relation.crossFilter,
      ]),
    ),
  ].join("\r\n");
}

export function measuresCatalogCsv(): string {
  return [
    "# كتالوج المقاييس — لبناء جدول _Measures برمجيًا",
    csvLine(["measure_name", "folder", "format_string", "description"]),
    ...DAX_MEASURES.map((measure) =>
      csvLine([measure.name, measure.folder, measure.format, measure.description]),
    ),
  ].join("\r\n");
}

export function apiSpecJson(): string {
  return JSON.stringify(
    {
      product: "IConcrete System",
      artifact: "Integration API",
      version: "1.0",
      liveLayer: {
        baseUrl: `${DEPLOYMENT_URL}/api/v1/iconcrete/`,
        auth: "?token=ICONCRETE_EXPORT_TOKEN أو ترويسة x-iconcrete-token",
        health: "GET health",
        manifest: "GET manifest.json",
        csv: "GET {entity}.csv?from=&to=&branch=&limit=&money=0|1",
        entities: DATA_MODEL_TABLES.filter((table) => table.endpoint).map((table) => ({
          entity: table.endpoint,
          sheet: table.name,
          label: table.label,
        })),
      },
      endpoints: API_ENDPOINTS,
      webhooks: WEBHOOK_EVENTS,
      authAndEncryption: AUTH_LAYER,
      errorFormat: {
        shape: "{ ok: false, error: 'CODE', message: 'شرح عربي', available?: [] }",
        codes: ["EXPORT_TOKEN_MISSING", "UNAUTHORIZED", "UNKNOWN_ENTITY", "VALIDATION_FAILED"],
      },
      rateLimits: {
        perEndpoint: "600 طلب/دقيقة لكل رمز",
        telemetry: "قراءة كل 30 ثانية لكل عربة، وبثّ مجمّع لكل خط خلاطة",
      },
    },
    null,
    2,
  );
}

export function iotFiles(): { dictionary: string; schema: string } {
  const iotTables = DATA_MODEL_TABLES.filter((table) => table.sourceKind === "iot");
  const dictionary = [
    "# قاموس حقول IoT / GPS / SCADA — كل حقل بوحدته ومصدره ومعدّل تحديثه",
    csvLine(["table", "field", "label", "type", "unit_or_note", "source_device", "update_rate"]),
    ...iotTables.flatMap((table) =>
      table.columns.map((column) =>
        csvLine([
          table.name,
          column.name,
          column.label,
          column.type,
          column.type === "geo" ? "درجة عشرية (WGS84)" : column.type === "datetime" ? "UTC" : "—",
          table.name.includes("GPS")
            ? "جهاز تتبع العربة"
            : table.name.includes("SCADA")
              ? "متحكم الخلاطة / PLC"
              : "ورقة إدخال أو نظام خارجي",
          table.name.includes("GPS") ? "كل 30 ثانية أثناء الرحلة" : "كل دفعة أو كل وردية",
        ]),
      ),
    ),
  ].join("\r\n");

  const schema = JSON.stringify(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "IConcrete telemetry payload",
      oneOf: [
        {
          title: "GPS reading",
          required: ["truck_code", "latitude", "longitude", "captured_at"],
          properties: {
            truck_code: { type: "string" },
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
            speed_kmh: { type: "number", minimum: 0, maximum: 140 },
            heading_deg: { type: "integer", minimum: 0, maximum: 359 },
            ignition: { type: "boolean" },
            fuel_level_pct: { type: "number", minimum: 0, maximum: 100 },
            geofence_status: { enum: ["inside", "approaching", "outside"] },
            eta_minutes: { type: "integer", minimum: 0 },
            captured_at: { type: "string", format: "date-time" },
          },
        },
        {
          title: "SCADA / PLC reading",
          required: ["line_code", "controller_status", "captured_at"],
          properties: {
            line_code: { type: "string" },
            batch_controller_status: { enum: ["idle", "batching", "complete", "fault"] },
            target_batched_m3: { type: "number", minimum: 0 },
            actual_batched_m3: { type: "number", minimum: 0 },
            load_cell_reading_kg: { type: "number", minimum: 0 },
            motor_temp_c: { type: "number", minimum: -20, maximum: 180 },
            conveyor_speed_mps: { type: "number", minimum: 0, maximum: 10 },
            mixer_current_a: { type: "number", minimum: 0 },
            silo_level_pct: { type: "number", minimum: 0, maximum: 100 },
            pump_pressure_bar: { type: "number", minimum: 0 },
            alarm_code: { type: ["string", "null"] },
            captured_at: { type: "string", format: "date-time" },
          },
        },
      ],
      "$comment":
        "أي قراءة خارج النطاق تُرفض في الطبقة الأولى، وتُسجَّل في stg_ValidationErrors برسالة عربية ودليل حل.",
    },
    null,
    2,
  );

  return { dictionary, schema };
}

export function mlFeaturesCsv(): string {
  return [
    "# مواصفة النماذج — المصدر المطلوب لكل مجموعة خصائص",
    csvLine(["model", "target", "features", "algorithm", "cadence", "output_table", "guardrails"]),
    ...ML_MODELS.map((model) =>
      csvLine([
        model.name,
        model.target,
        model.features,
        model.algorithm,
        model.cadence,
        model.output,
        model.guardrails,
      ]),
    ),
  ].join("\r\n");
}

export function dashboardsGuide(): string {
  return [
    "# لوحات القيادة الثمانية — دليل البناء",
    "",
    "كل لوحة مبنية على نفس النموذج ونفس المقاييس، والاختلاف في الجمهور والسؤال الذي تجيب عنه.",
    "",
    ...DASHBOARDS.flatMap((dashboard, index) => [
      `## ${index + 1}) ${dashboard.name}`,
      `- الجمهور: ${dashboard.audience}`,
      `- السؤال: ${dashboard.question}`,
      `- المؤشرات: ${dashboard.kpis}`,
      `- المقاطعات (Slicers): ${dashboard.slicers}`,
      `- التنقيب (Drill-down): ${dashboard.drill}`,
      `- التنبيهات: ${dashboard.alerts}`,
      `- التصدير: ${dashboard.export}`,
      "",
    ]),
    "## قواعد مشتركة لكل لوحة",
    "- صف واحد للبطاقات (Cards) أعلى الشاشة لا يزيد عن 6 مؤشرات.",
    "- كل مؤشر بجانبه خط اتجاه 12 أسبوعًا ومقارنة بالفترة السابقة.",
    "- المقاطعات في شريط واحد أعلى اليمين (الفرع · الفترة · الخلطة · حقيقي/تجريبي).",
    "- لون واحد للمعنى: أخضر داخل الحد، أصفر تحذير، أحمر حرج، ولا ألوان زخرفية.",
    "- لكل لوحة صفحة «تفصيل» واحدة على الأقل للتنقيب، وصفحة «دليل» تشرح المصدر والحساب.",
  ].join("\n");
}

export function governanceFiles(): {
  rbac: string;
  retention: string;
  standards: string;
  integrations: string;
  protection: string;
  dr: string;
} {
  const capabilities = [
    "عرض المالية",
    "تعديل الأسعار",
    "إدخال الطلبيات",
    "تعديل قيد بعد 24 ساعة",
    "حذف قيد",
    "اختبارات الجودة",
    "المخازن والصرف",
    "الفروع",
    "أدوار الفريق",
    "سجل التتبع",
    "التصدير الخارجي",
  ];
  const matrix: Record<string, boolean[]> = {
    Admin: [true, true, true, true, true, true, true, true, true, true, true],
    Manager: [true, false, true, true, true, true, true, false, false, true, true],
    Supervisor: [true, false, true, true, false, true, true, false, false, true, false],
    Operator: [false, false, true, false, false, true, true, false, false, false, false],
    Viewer: [true, false, false, false, false, true, true, false, false, false, false],
    Auditor: [true, false, false, false, false, true, true, false, false, true, true],
  };
  const rbac = [
    "# مصفوفة الصلاحيات — الأدوار الستة × الصلاحيات",
    csvLine(["role_code", "role_label_ar", "scope", "needs_approval", "note", ...capabilities]),
    ...RBAC_ROLES.map((role) =>
      csvLine([
        role.code,
        role.label,
        role.scope,
        role.approval,
        role.note,
        ...matrix[role.code].map((allowed) => (allowed ? "مسموح" : "ممنوع")),
      ]),
    ),
  ].join("\r\n");

  const retention = [
    "# سياسة الاحتفاظ بالبيانات (GDPR + متطلبات التدقيق)",
    csvLine(["data_domain", "retention_years", "legal_basis", "archive_target", "purge_method", "owner_role"]),
    ...RETENTION_POLICY.map((row) =>
      csvLine([row.domain, row.years, row.basis, row.archive, row.purge, row.owner]),
    ),
  ].join("\r\n");

  const standards = [
    "# مصفوفة المواصفات الدولية ومكان الدليل في المنظومة",
    csvLine(["standard", "title", "evidence_required", "where_in_system"]),
    ...STANDARDS.map((row) => csvLine([row.code, row.title, row.evidence, row.where])),
  ].join("\r\n");

  const integrations = JSON.stringify(
    { artifact: "Accounting & logistics integrations", integrations: INTEGRATIONS },
    null,
    2,
  );

  const protection = [
    "# قائمة الحماية قبل التسليم",
    "",
    ...PROTECTION_CHECKLIST.map((item, index) => `${index + 1}. **${item.item}** — ${item.detail}`),
    "",
    "## تصدير البيانات",
    "- CSV (مع BOM لقراءة العربية) · JSON (للتكامل) · XML (للأنظمة القديمة).",
    "- كل تصدير يمر على قواعد التعمية: الحقول الحساسة تُستبعد إلا لمن يملك الصلاحية.",
    "",
    "## Accessibility",
    "- كل شاشة لها بديل لقارئ الشاشة: عناوين أعمدة واضحة، وترتيب تنقّل منطقي، وتباين لا يقل عن 4.5:1.",
    "- التقارير المطبوعة بترويسة المحطة وتاريخ الطباعة واسم المُصدِر.",
  ].join("\n");

  const dr = [
    "# النسخ الاحتياطي وخطة الاستعادة (Backup & DR)",
    "",
    "## النسخ",
    "| النسخة | التوقيت | الاحتفاظ | المكان |",
    "| --- | --- | --- | --- |",
    "| يومية | 23:30 توقيت القاهرة | 30 يومًا | منطقة ثانية (Azure) |",
    "| أسبوعية | الجمعة 02:00 | 12 أسبوعًا | منطقة ثانية |",
    "| شهرية | أول الشهر | 7 سنوات | تخزين بارد (Archive) |",
    "| قبل أي ترحيل بنيوي | يدويًا | حتى نجاح التحقق | لقطة فورية |",
    "",
    "## الاستعادة",
    "- هدف زمن الاستعادة (RTO): 4 ساعات للعمليات، 24 ساعة للتقارير التاريخية.",
    "- هدف نقطة الاستعادة (RPO): 15 دقيقة باستخدام السجل المستمر.",
    "- اختبار استعادة كامل كل ربع سنة، بتقرير موقّع من المالك.",
    "",
    "## إدارة الإصدارات",
    "- كل كيان يحمل created_at/updated_at و_hash، وأي تعديل يمر بسجل التتبع.",
    "- النموذج واللوحات والمقاييس محفوظة في مستودع Git، وبكل إصدار سجل تغييرات.",
    "- لا نشر مباشر على الإنتاج: ترقية عبر بيئة اختبار ثم اعتماد كتابي.",
  ].join("\n");

  return { rbac, retention, standards, integrations, protection, dr };
}

/* ------------------------------------------------------------------ */
/* README + manifest                                                  */
/* ------------------------------------------------------------------ */

export function readme(): string {
  const liveTables = DATA_MODEL_TABLES.filter((table) => table.sourceKind === "endpoint");
  return `# IConcrete System — حزمة Excel / Power Platform

نظام إدارة محطات الخرسانة الجاهزة، جاهزًا للاستيراد: نموذج بيانات كامل،
استعلامات Power Query، مكتبة مقاييس DAX، مخطط Azure SQL، قوائم SharePoint،
نقاط تكامل API، حقول IoT/SCADA، نماذج تعلّم آلي، ثماني لوحات قيادة، وسجل امتثال.

- جداول النموذج: **${DATA_MODEL_TABLES.length}** · الأعمدة: **${MODEL_COLUMN_COUNT}**
- مقاييس DAX: **${DAX_MEASURES.length}**
- جداول مرتبطة بطبقة تصدير حيّة: **${liveTables.length}**
- لوحات القيادة: **${DASHBOARDS.length}** · نماذج التعلّم الآلي: **${ML_MODELS.length}**

## التشغيل في 6 خطوات

1. **افتح المصنف الفارغ** وأنشئ جدولاً لكل ملف في \`01_DataModel\` (Insert → Table، وسمِّه بنفس اسم الملف).
2. **افتح Power Query** (Data → Get Data → Launch Power Query Editor) ثم Data → Get Data → Blank Query:
   - الصق محتوى \`02_PowerQuery/00_Functions.pq\` وسمِّ الاستعلامات بدقة (fnExportCsv، fnToType، fnDedupeRows، fnFlagRowErrors، fnTestDataFlag، fnAddAuditColumns، fnSortByDate).
   - أضف استعلامًا لكل ملف في \`02_PowerQuery/Sources\` بنفس اسم الجدول.
3. **صِل الطبقة الحيّة** (للجداول التي تحمل \`sourceKind = endpoint\`):
   - من تبويب المفاتيح في المشروع أضف مفتاحًا باسم \`ICONCRETE_EXPORT_TOKEN\` بقيمة قوية.
   - في الاستعلام \`PACK_TOKEN\` ضع نفس الرمز، وفي \`PACK_DEPLOYMENT_URL\` عنوان النشر:
     \`${DEPLOYMENT_URL}\`
   - اختبر فورًا: \`${DEPLOYMENT_URL}/api/v1/iconcrete/health\` ثم \`…/manifest.json?token=…\`.
4. **أضف النموذج إلى Power Pivot / Power BI**: Relationships حسب ملف \`01_DataModel/Model_Relationships.csv\`، والصق مقاييس \`03_DAX/Measures_IConcrete.dax\` في جدول \`_Measures\`، ثم رتّب المجلدات.
5. **ابنِ اللوحات الثمانية** حسب \`08_Dashboards/Dashboards_Guide.md\`، واضبط حدود المؤشرات من \`cfg_KPIThresholds\`.
6. **أضف الحماية**: سياسة الاحتفاظ والنسخ الاحتياطي من \`09_Governance\`، ومصفوفة الصلاحيات على مستوى الورقة، وتأكد من عمود \`test_data_flag\` في كل جدول.

## التحديث التلقائي

- Excel على سطح المكتب: Data → Queries & Connections → Properties → Refresh every 30 minutes.
- Power BI Service: Gateway شخصي/مؤسسي للـ CSV، أو ربط مباشر بقاعدة Azure SQL (Import mode للتجمعات اليومية).
- Azure SQL: استخدم \`04_Cloud/AzureSQL_IConcrete.sql\` ثم مهمة \`etl_run_log\` لتسجيل كل تحميل.

## ما تحتاجه من مفاتيح

| المفتاح | الغرض | إلزامي؟ |
| --- | --- | --- |
| \`ICONCRETE_EXPORT_TOKEN\` | تفعيل طبقة التصدير الحيّة (CSV/JSON) | نعم للطبقة الحيّة |
| \`KNOCK_API_KEY\` | إرسال التنبيهات بالبريد والرسائل فعليًا | للتنبيهات الحقيقية |
| مفاتيح مزوّدي التكامل | Google Maps · Twilio · SendGrid · QuickBooks/Xero/SAP | حسب المزوّد |

## ملاحظات مهنية

- كل جدول يحمل \`test_data_flag\` (وفي جداول الأبعاد والقوائم يكون دائمًا 0)، وتُستبعد الصفوف التجريبية من التقارير الرسمية بمقياس \`Real_Data_Only\`.
- الحقول المعلَّمة \`sensitive\` (مالية أو شخصية) لا تُصدَّر لأي جهة بلا صلاحية صريحة.
- أرقام الأسعار تُدار من المنظومة، وأي تعديل يمر باعتماد ويُسجَّل في \`fact_PriceHistory\` و \`fact_AuditLog\`.
- الطبقات غير المنفَّذة تقنيًا بعد (توصيل SCADA، أجهزة GPS، نماذج ML) لها شبكات وحقول وواجهات جاهزة هنا، وتعمل فور توصيل المصدر.
`;
}

/* ------------------------------------------------------------------ */
/* Assembly                                                           */
/* ------------------------------------------------------------------ */

export function buildPackFiles(): PackFile[] {
  const iot = iotFiles();
  const gov = governanceFiles();
  const files: PackFile[] = [
    {
      path: "README_IConcrete_Pack.md",
      content: readme(),
      language: "markdown",
      note: "دليل التركيب خطوة بخطوة في Excel و Power BI",
    },
    {
      path: "manifest.json",
      content: "",
      language: "json",
      note: "فهرس كل ملفات الحزمة وأحجامها",
    },
    {
      path: "01_DataModel/Schema.json",
      content: schemaJson(),
      language: "json",
      note: "نموذج البيانات الكامل: الجداول والأعمدة والأنواع والعلاقات",
    },
    {
      path: "01_DataModel/Model_Relationships.csv",
      content: relationshipsCsv(),
      language: "csv",
      note: "علاقات Power Pivot / Power BI جاهزة للإنشاء بالترتيب",
    },
    {
      path: "04_Cloud/AzureSQL_IConcrete.sql",
      content: sqlDdlFile(),
      language: "sql",
      note: "مخطط Azure SQL كامل + العرض الموحّد + سياسة الاحتفاظ",
    },
    {
      path: "04_Cloud/SharePoint_Lists.json",
      content: sharePointListsFile(),
      language: "json",
      note: "تعريف قوائم SharePoint بكل أعمدتها وأنواعها",
    },
    {
      path: "05_Integration/API_Endpoints.json",
      content: apiSpecJson(),
      language: "json",
      note: "نقاط الـ API الحيّة والمواصفات والويب هوك ومعدلات الطلب",
    },
    {
      path: "05_Integration/Auth_Encryption.md",
      content: [
        "# طبقة المصادقة والتشفير",
        "",
        ...AUTH_LAYER.map((row) => `- **${row.item}** — ${row.detail}`),
        "",
        "## سجل التدقيق لكل عملية",
        "كل عملية تُسجَّل بالحقول: من (actor_name/actor_role) · ماذا (action/entity/entity_id) · متى (occurred_at) · من أي جهاز (ip_address) · القيمة القديمة والجديدة (changes_json).",
      ].join("\n"),
      language: "markdown",
      note: "OAuth 2.0 والتشفير في النقل والسكون وسجل التدقيق",
    },
    {
      path: "06_IoT/IoT_Field_Dictionary.csv",
      content: iot.dictionary,
      language: "csv",
      note: "قاموس حقول GPS و SCADA والوقود ومعدّل تحديث كل حقل",
    },
    {
      path: "06_IoT/Telemetry_Payload.schema.json",
      content: iot.schema,
      language: "json",
      note: "JSON Schema لحمولات التتبع والخلاطة بقواعد نطاق صارمة",
    },
    {
      path: "07_ML/ML_Models.json",
      content: JSON.stringify({ artifact: "Machine learning contracts", models: ML_MODELS }, null, 2),
      language: "json",
      note: "النماذج الستة: الهدف والخصائص والخوارزمية والضوابط",
    },
    {
      path: "07_ML/ML_Feature_Spec.csv",
      content: mlFeaturesCsv(),
      language: "csv",
      note: "جدول الخصائص ومصادرها لكل نموذج",
    },
    {
      path: "08_Dashboards/Dashboards_Spec.json",
      content: JSON.stringify({ artifact: "Dashboard suite", dashboards: DASHBOARDS }, null, 2),
      language: "json",
      note: "اللوحات الثمانية: المؤشرات والمقاطعات والتنقيب والتنبيهات",
    },
    {
      path: "08_Dashboards/Dashboards_Guide.md",
      content: dashboardsGuide(),
      language: "markdown",
      note: "دليل بناء اللوحات وقواعد العرض المشتركة",
    },
    {
      path: "09_Governance/RBAC_Matrix.csv",
      content: gov.rbac,
      language: "csv",
      note: "الأدوار الستة × الصلاحيات مع النطاق ومتطلب الاعتماد",
    },
    {
      path: "09_Governance/Retention_Policy.csv",
      content: gov.retention,
      language: "csv",
      note: "مدة الاحتفاظ والأساس القانوني والأرشفة والإتلاف",
    },
    {
      path: "09_Governance/Standards_Matrix.csv",
      content: gov.standards,
      language: "csv",
      note: "ISO 9001/14001/45001 و ECP 203 و ASTM C94 و EN 206 و GDPR",
    },
    {
      path: "09_Governance/Integrations.json",
      content: gov.integrations,
      language: "json",
      note: "QuickBooks · Xero · Oracle · SAP · Google Maps · Twilio · SendGrid · FedEx/DHL",
    },
    {
      path: "09_Governance/Protection_Checklist.md",
      content: gov.protection,
      language: "markdown",
      note: "الحماية والتصدير والوصول Accessibility قبل التسليم",
    },
    {
      path: "09_Governance/Backup_DR_Plan.md",
      content: gov.dr,
      language: "markdown",
      note: "النسخ اليومية والأسبوعية والشهرية وخطة الاستعادة وإدارة الإصدارات",
    },
    {
      path: "02_PowerQuery/00_Functions.pq",
      content: SHARED_FUNCTIONS,
      language: "powerquery",
      note: "دوال Power Query المشتركة: التنظيف والتحقق والفرز والتعمية",
    },
    {
      path: "02_PowerQuery/99_Merge_All.pq",
      content: MERGE_ALL,
      language: "powerquery",
      note: "دمج الحقائق في جدول واحد للمقارنة النوعية",
    },
    {
      path: "03_DAX/Measures_IConcrete.dax",
      content: daxMeasuresFile(),
      language: "dax",
      note: "مكتبة المقاييس كاملة بمجلدات تطابق اللوحات",
    },
    {
      path: "03_DAX/Calculated_Columns.dax",
      content: daxColumnsFile(),
      language: "dax",
      note: "أعمدة محسوبة للتصنيف والوصف العربي",
    },
    {
      path: "03_DAX/Measures_Catalog.csv",
      content: measuresCatalogCsv(),
      language: "csv",
      note: "كتالوج المقاييس للبحث والفلترة",
    },
  ];

  for (const table of DATA_MODEL_TABLES) {
    files.push({
      path: `02_PowerQuery/Sources/${table.name}.pq`,
      content: powerQueryForTable(table),
      language: "powerquery",
      note: `استعلام ${table.label}`,
    });
    files.push({
      path: `01_DataModel/Templates/${table.name}.csv`,
      content: csvTemplate(table),
      language: "csv",
      note: `قالب ورقة ${table.label} بعناوين عربية`,
    });
  }

  const manifestFile = files.find((file) => file.path === "manifest.json");
  if (manifestFile) {
    manifestFile.content = JSON.stringify(
      {
        product: "IConcrete System",
        artifact: "Excel / Power Platform pack",
        version: "1.0",
        deployment: DEPLOYMENT_URL,
        model: { tables: DATA_MODEL_TABLES.length, columns: MODEL_COLUMN_COUNT },
        daxMeasures: DAX_MEASURES.length,
        files: files.map((file) => ({ path: file.path, bytes: file.content.length, note: file.note })),
      },
      null,
      2,
    );
  }

  return files;
}

export const PACK_FILE_COUNT = buildPackFiles().length;
