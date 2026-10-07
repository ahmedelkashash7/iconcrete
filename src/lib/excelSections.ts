/**
 * IConcrete System — the section workbook (`iConcrete_Template.xlsx`).
 *
 * One sheet per section of the app, in the same order the sidebar shows them,
 * and with the same column order the screens display — so the workbook reads
 * like the system itself rather than a generic data dump.
 *
 * Importable sheets carry the Convex field names internally, which means a row
 * can go Excel → SQLite → Convex (and back) without a translation table. The
 * remaining sheets are aggregates the plant needs in Excel (customers, invoices,
 * suppliers, daily production, expenses) and are exported from the same ledger.
 */

import * as XLSX from "xlsx";
import type { LocalRow } from "@/lib/offline/db";
import { mapRows } from "@/lib/xlsx";
import type { RowIssue } from "@/lib/xlsx";

export const ICONCRETE_TEMPLATE_FILENAME = "iConcrete_Template.xlsx";

export type SectionColumn = {
  /** Convex field name (importable sheets) or aggregate key. */
  field: string;
  /** Arabic header written into the sheet. */
  label: string;
  /** English header used by the column-guide sheet. */
  english: string;
  type: "text" | "number" | "money" | "date" | "bool";
  /** Column width in characters. */
  width?: number;
};

export type AppSection = {
  id: string;
  /** Exact Arabic sheet name, in app order. */
  sheet: string;
  english: string;
  /** Where the sheet's rows come from. */
  source:
    | "productionLogs"
    | "materials"
    | "mixPrices"
    | "materialMovements"
    | "equipment"
    | "derived";
  /** Route of the app screen the sheet mirrors. */
  route: string;
  /** Importable sheets write back into SQLite + Convex. */
  writable: boolean;
  columns: SectionColumn[];
};

const c = (
  field: string,
  label: string,
  english: string,
  type: SectionColumn["type"],
  width = 16,
): SectionColumn => ({ field, label, english, type, width });

/** The production sheet keeps the exact columns of the original import template. */
const ORDER_COLUMNS: SectionColumn[] = [
  c("date", "التاريخ", "date", "date", 14),
  c("shift", "الوردية", "shift", "text", 10),
  c("mixDesign", "نوع الخلطة", "mixDesign", "text", 14),
  c("customer", "العميل", "customer", "text", 26),
  c("site", "الموقع", "site", "text", 24),
  c("orderRef", "رقم الطلبية", "orderRef", "text", 14),
  c("quantityM3", "الكمية المنتجة", "quantityM3", "number", 16),
  c("deliveredM3", "الكمية المسلّمة", "deliveredM3", "number", 16),
  c("returnedM3", "الكمية المرتجعة", "returnedM3", "number", 16),
  c("pricePerM3", "سعر المتر", "pricePerM3", "money", 14),
  c("costPerM3", "تكلفة المتر", "costPerM3", "money", 14),
  c("truckCount", "عدد العربات", "truckCount", "number", 12),
  c("onTime", "في الموعد", "onTime", "bool", 12),
  c("status", "الحالة", "status", "text", 12),
  c("notes", "ملاحظات", "notes", "text", 30),
];

/**
 * The ten sheets, in the order the operator uses the system. The first five are
 * importable master/transaction sheets; the rest are the reports the plant hands
 * to management.
 */
export const ICONCRETE_SECTIONS: AppSection[] = [
  {
    id: "customers",
    sheet: "العملاء",
    english: "Customers",
    source: "derived",
    route: "/dashboard",
    writable: false,
    columns: [
      c("customer", "العميل", "customer", "text", 28),
      c("orders", "عدد الطلبيات", "orders", "number", 14),
      c("quantityM3", "الكمية المنتجة", "quantityM3", "number", 16),
      c("deliveredM3", "الكمية المسلّمة", "deliveredM3", "number", 16),
      c("revenue", "الإيراد", "revenue", "money", 16),
      c("cost", "التكلفة", "cost", "money", 16),
      c("profit", "الربح", "profit", "money", 16),
      c("marginPct", "الهامش %", "marginPct", "number", 12),
      c("lastDate", "آخر تاريخ", "lastDate", "date", 14),
    ],
  },
  {
    id: "suppliers",
    sheet: "الموردين",
    english: "Suppliers",
    source: "derived",
    route: "/inventory",
    writable: false,
    columns: [
      c("supplier", "المورد", "supplier", "text", 28),
      c("materials", "المواد الموردة", "materials", "text", 30),
      c("receipts", "عدد الاستلامات", "receipts", "number", 14),
      c("amount", "القيمة الإجمالية", "amount", "money", 18),
      c("lastDate", "آخر تاريخ", "lastDate", "date", 14),
    ],
  },
  {
    id: "materials",
    sheet: "المواد",
    english: "Materials",
    source: "materials",
    route: "/inventory",
    writable: true,
    columns: [
      c("name", "اسم المادة", "name", "text", 24),
      c("category", "التصنيف", "category", "text", 16),
      c("unit", "الوحدة", "unit", "text", 12),
      c("openingQty", "الرصيد الافتتاحي", "openingQty", "number", 18),
      c("reorderLevel", "حد إعادة الطلب", "reorderLevel", "number", 18),
      c("standardCost", "التكلفة المعيارية", "standardCost", "money", 18),
      c("supplier", "المورد", "supplier", "text", 24),
      c("isActive", "مفعّل", "isActive", "bool", 10),
    ],
  },
  {
    id: "mixDesigns",
    sheet: "الخلطات",
    english: "MixDesigns",
    source: "mixPrices",
    route: "/settings",
    writable: true,
    columns: [
      c("name", "اسم الخلطة", "name", "text", 18),
      c("price", "سعر البيع", "price", "money", 14),
      c("cost", "التكلفة", "cost", "money", 14),
      c("strengthMpa", "المقاومة (MPa)", "strengthMpa", "number", 16),
      c("cementKgPerM3", "الأسمنت (كجم/م³)", "cementKgPerM3", "number", 18),
      c("notes", "ملاحظات", "notes", "text", 28),
      c("isActive", "مفعّل", "isActive", "bool", 10),
    ],
  },
  {
    id: "orders",
    sheet: "الطلبيات",
    english: "Orders",
    source: "productionLogs",
    route: "/production",
    writable: true,
    columns: ORDER_COLUMNS,
  },
  {
    id: "dailyProduction",
    sheet: "الانتاج اليومي",
    english: "DailyProduction",
    source: "derived",
    route: "/production",
    writable: false,
    columns: [
      c("date", "التاريخ", "date", "date", 14),
      c("shift", "الوردية", "shift", "text", 12),
      c("orders", "عدد الطلبيات", "orders", "number", 14),
      c("quantityM3", "الكمية المنتجة", "quantityM3", "number", 16),
      c("deliveredM3", "الكمية المسلّمة", "deliveredM3", "number", 16),
      c("returnedM3", "الكمية المرتجعة", "returnedM3", "number", 16),
      c("truckCount", "عدد العربات", "truckCount", "number", 14),
      c("onTimePct", "نسبة الالتزام %", "onTimePct", "number", 16),
    ],
  },
  {
    id: "invoices",
    sheet: "الفواتير",
    english: "Invoices",
    source: "derived",
    route: "/dashboard",
    writable: false,
    columns: [
      c("number", "رقم الفاتورة", "number", "text", 18),
      c("month", "الشهر", "month", "text", 12),
      c("customer", "العميل", "customer", "text", 28),
      c("quantityM3", "الكمية (م³)", "quantityM3", "number", 14),
      c("unitPrice", "متوسط سعر المتر", "unitPrice", "money", 18),
      c("subtotal", "الإجمالي قبل الضريبة", "subtotal", "money", 20),
      c("taxAmount", "ضريبة القيمة المضافة", "taxAmount", "money", 18),
      c("total", "الإجمالي", "total", "money", 18),
      c("status", "الحالة", "status", "text", 14),
    ],
  },
  {
    id: "warehouses",
    sheet: "المخازن",
    english: "Warehouses",
    source: "materialMovements",
    route: "/inventory",
    writable: true,
    columns: [
      c("date", "التاريخ", "date", "date", 14),
      c("materialName", "المادة", "materialName", "text", 22),
      c("kind", "نوع الحركة", "kind", "text", 14),
      c("quantity", "الكمية", "quantity", "number", 14),
      c("unitCost", "تكلفة الوحدة", "unitCost", "money", 16),
      c("supplier", "المورد", "supplier", "text", 22),
      c("reference", "المرجع", "reference", "text", 18),
      c("note", "ملاحظة", "note", "text", 28),
    ],
  },
  {
    id: "expenses",
    sheet: "المصروفات",
    english: "Expenses",
    source: "derived",
    route: "/dashboard",
    writable: false,
    columns: [
      c("date", "التاريخ", "date", "date", 14),
      c("category", "البند", "category", "text", 18),
      c("description", "البيان", "description", "text", 30),
      c("vendor", "المورد", "vendor", "text", 22),
      c("quantity", "الكمية", "quantity", "number", 14),
      c("unitCost", "تكلفة الوحدة", "unitCost", "money", 16),
      c("amount", "المبلغ", "amount", "money", 18),
      c("notes", "ملاحظات", "notes", "text", 24),
    ],
  },
  {
    id: "fleet",
    sheet: "الشاحنات والسائقين",
    english: "TrucksDrivers",
    source: "equipment",
    route: "/forecast",
    writable: true,
    columns: [
      c("code", "الكود", "code", "text", 12),
      c("name", "الاسم", "name", "text", 22),
      c("kind", "النوع", "kind", "text", 12),
      c("driverName", "السائق", "driverName", "text", 20),
      c("driverPhone", "هاتف السائق", "driverPhone", "text", 16),
      c("plateNumber", "رقم اللوحة", "plateNumber", "text", 16),
      c("meterUnit", "وحدة العداد", "meterUnit", "text", 12),
      c("meterReading", "قراءة العداد", "meterReading", "number", 16),
      c("lastServiceMeter", "عداد آخر صيانة", "lastServiceMeter", "number", 16),
      c("serviceInterval", "فاصل الصيانة", "serviceInterval", "number", 16),
      c("serviceIntervalDays", "فاصل الصيانة (أيام)", "serviceIntervalDays", "number", 20),
      c("lastServiceDate", "تاريخ آخر صيانة", "lastServiceDate", "date", 18),
      c("avgDailyUsage", "متوسط الاستخدام اليومي", "avgDailyUsage", "number", 22),
      c("isActive", "مفعّل", "isActive", "bool", 10),
      c("notes", "ملاحظات", "notes", "text", 26),
    ],
  },
];

export const IMPORTABLE_SECTIONS = ICONCRETE_SECTIONS.filter(
  (section) => section.writable,
);

export type SectionData = {
  productionLogs?: LocalRow[];
  materials?: LocalRow[];
  mixPrices?: LocalRow[];
  materialMovements?: LocalRow[];
  equipment?: LocalRow[];
};

const VAT_PCT = 14;
const STATUS_LABELS: Record<string, string> = {
  delivered: "مسلّم",
  in_progress: "جارٍ",
  cancelled: "ملغي",
};
const SHIFT_LABELS: Record<string, string> = {
  morning: "صباحي",
  evening: "مسائي",
  night: "ليلي",
};
const MOVEMENT_LABELS: Record<string, string> = {
  receipt: "استلام",
  issue: "صرف",
  adjustment: "تسوية",
};

/* ------------------------------------------------------------------ */
/* Aggregates (the report sheets)                                     */
/* ------------------------------------------------------------------ */

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: number) => Math.round(value * 100) / 100;

function customerRows(logs: LocalRow[]): LocalRow[] {
  const groups = new Map<string, LocalRow>();
  for (const log of logs) {
    const customer = String(log.customer ?? "").trim() || "غير محدد";
    const entry =
      groups.get(customer) ??
      ({
        customer,
        orders: 0,
        quantityM3: 0,
        deliveredM3: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPct: 0,
        lastDate: "",
      } as LocalRow);
    const delivered = num(log.deliveredM3);
    const revenue = delivered * num(log.pricePerM3);
    const cost = delivered * num(log.costPerM3);
    entry.orders = num(entry.orders) + 1;
    entry.quantityM3 = money(num(entry.quantityM3) + num(log.quantityM3));
    entry.deliveredM3 = money(num(entry.deliveredM3) + delivered);
    entry.revenue = money(num(entry.revenue) + revenue);
    entry.cost = money(num(entry.cost) + cost);
    entry.profit = money(num(entry.revenue) - num(entry.cost));
    const margin = num(entry.revenue) > 0 ? (num(entry.profit) / num(entry.revenue)) * 100 : 0;
    entry.marginPct = Math.round(margin * 10) / 10;
    const date = String(log.date ?? "");
    if (date > String(entry.lastDate ?? "")) entry.lastDate = date;
    groups.set(customer, entry);
  }
  return [...groups.values()].sort(
    (a, b) => num(b.revenue) - num(a.revenue),
  );
}

function supplierRows(materials: LocalRow[], movements: LocalRow[]): LocalRow[] {
  const groups = new Map<string, LocalRow>();
  const ensure = (supplier: string) => {
    const key = supplier.trim() || "غير محدد";
    let entry = groups.get(key);
    if (!entry) {
      entry = { supplier: key, materials: "", receipts: 0, amount: 0, lastDate: "" };
      groups.set(key, entry);
    }
    return entry;
  };

  for (const movement of movements) {
    if (String(movement.kind ?? "") !== "receipt") continue;
    const entry = ensure(String(movement.supplier ?? ""));
    entry.receipts = num(entry.receipts) + 1;
    entry.amount = money(num(entry.amount) + num(movement.quantity) * num(movement.unitCost));
    const date = String(movement.date ?? "");
    if (date > String(entry.lastDate ?? "")) entry.lastDate = date;
  }

  for (const material of materials) {
    const supplier = String(material.supplier ?? "").trim();
    if (!supplier) continue;
    const entry = ensure(supplier);
    const names = String(entry.materials ?? "")
      .split("، ")
      .filter(Boolean);
    const name = String(material.name ?? "");
    if (name && !names.includes(name)) names.push(name);
    entry.materials = names.join("، ");
  }

  return [...groups.values()].sort((a, b) => num(b.amount) - num(a.amount));
}

function dailyRows(logs: LocalRow[]): LocalRow[] {
  const groups = new Map<string, LocalRow>();
  for (const log of logs) {
    const key = `${log.date}|${log.shift}`;
    const entry =
      groups.get(key) ??
      ({
        date: String(log.date ?? ""),
        shift: SHIFT_LABELS[String(log.shift)] ?? String(log.shift ?? ""),
        orders: 0,
        quantityM3: 0,
        deliveredM3: 0,
        returnedM3: 0,
        truckCount: 0,
        onTimePct: 0,
        _onTime: 0,
      } as LocalRow);
    entry.orders = num(entry.orders) + 1;
    entry.quantityM3 = money(num(entry.quantityM3) + num(log.quantityM3));
    entry.deliveredM3 = money(num(entry.deliveredM3) + num(log.deliveredM3));
    entry.returnedM3 = money(num(entry.returnedM3) + num(log.returnedM3));
    entry.truckCount = num(entry.truckCount) + num(log.truckCount);
    if (log.onTime === true || log.onTime === 1) entry._onTime = num(entry._onTime) + 1;
    entry.onTimePct = Math.round((num(entry._onTime) / num(entry.orders)) * 1000) / 10;
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) =>
    `${b.date}`.localeCompare(String(a.date)),
  );
}

function invoiceRows(logs: LocalRow[]): LocalRow[] {
  const groups = new Map<string, LocalRow>();
  for (const log of logs) {
    const month = String(log.date ?? "").slice(0, 7);
    const customer = String(log.customer ?? "").trim() || "غير محدد";
    const key = `${month}|${customer}`;
    const entry =
      groups.get(key) ??
      ({ month, customer, quantityM3: 0, _revenue: 0 } as LocalRow);
    entry.quantityM3 = money(num(entry.quantityM3) + num(log.deliveredM3));
    entry._revenue = money(
      num(entry._revenue) + num(log.deliveredM3) * num(log.pricePerM3),
    );
    groups.set(key, entry);
  }

  return [...groups.values()]
    .map((entry, index) => {
      const subtotal = num(entry._revenue);
      const taxAmount = money((subtotal * VAT_PCT) / 100);
      return {
        number: `INV-${entry.month}-${String(index + 1).padStart(3, "0")}`,
        month: entry.month,
        customer: entry.customer,
        quantityM3: num(entry.quantityM3),
        unitPrice: num(entry.quantityM3) > 0 ? money(subtotal / num(entry.quantityM3)) : 0,
        subtotal,
        taxAmount,
        total: money(subtotal + taxAmount),
        status: "مسودة",
      } as LocalRow;
    })
    .sort((a, b) => `${a.month}`.localeCompare(String(b.month)));
}

function expenseRows(movements: LocalRow[]): LocalRow[] {
  return movements
    .filter((movement) => String(movement.kind ?? "") === "receipt")
    .map((movement) => {
      const quantity = num(movement.quantity);
      const unitCost = num(movement.unitCost);
      return {
        date: String(movement.date ?? ""),
        category: "خامات",
        description: `استلام خامات${movement.reference ? ` — ${movement.reference}` : ""}`,
        vendor: String(movement.supplier ?? ""),
        quantity,
        unitCost,
        amount: money(quantity * unitCost),
        notes: String(movement.note ?? ""),
      } as LocalRow;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ------------------------------------------------------------------ */
/* Sheet building                                                     */
/* ------------------------------------------------------------------ */

type Cell = string | number;

const BOOL_YES = "نعم";
const BOOL_NO = "لا";

function displayValue(column: SectionColumn, row: LocalRow): Cell {
  const value = row[column.field];
  if (value === null || value === undefined) return "";
  switch (column.type) {
    case "bool":
      return value === true || value === 1 || value === "1" ? BOOL_YES : BOOL_NO;
    case "number":
    case "money":
      return num(value);
    default:
      return String(value);
  }
}

function buildSheet(section: AppSection, rows: LocalRow[]): XLSX.WorkSheet {
  const header = section.columns.map((column) => column.label);
  const data: Cell[][] = [header];
  for (const row of rows) {
    data.push(section.columns.map((column) => displayValue(column, row)));
  }
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = section.columns.map((column) => ({ wch: column.width ?? 16 }));
  sheet["!freeze"] = { xSplit: "0", ySplit: "1" };
  return sheet;
}

function guideSheet(): XLSX.WorkSheet {
  const rows: Cell[][] = [
    ["#", "الشاشة في النظام", "ورقة Excel", "القسم", "English", "الأعمدة", "الاتجاه"],
    [],
  ];
  ICONCRETE_SECTIONS.forEach((section, index) => {
    rows.push([
      index + 1,
      section.route,
      section.sheet,
      section.english,
      section.english,
      section.columns.map((column) => column.label).join(" · "),
      section.writable ? "استيراد وتصدير" : "تصدير فقط (يُحسب من نفس السجل)",
    ]);
  });
  rows.push([]);
  rows.push(["", "الأعمدة بالإنجليزية (تُقبل أيضًا عند الاستيراد)", "", "", "", "", ""]);
  for (const section of ICONCRETE_SECTIONS) {
    rows.push([
      "",
      section.sheet,
      section.source,
      "",
      section.columns.map((column) => column.english).join(", "),
      "",
      "",
    ]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 18 },
    { wch: 60 },
    { wch: 36 },
  ];
  return sheet;
}

function syncSheet(meta: {
  lastSync?: number | null;
  engine?: string;
  storedRows?: number;
  pending?: number;
}): XLSX.WorkSheet {
  const stamp = meta.lastSync
    ? new Date(meta.lastSync).toISOString().replace("T", " ").slice(0, 16)
    : "—";
  const rows: Cell[][] = [
    ["معلومة", "القيمة", "ملاحظة"],
    ["اسم الملف", ICONCRETE_TEMPLATE_FILENAME, "نموذج أقسام IConcrete"],
    ["محرّك التخزين المحلي", meta.engine ?? "SQLite", "نفس الملف يعمل على الويب (ذاكرة المتصفح) والديسكتوب (SQLite)"],
    ["آخر مزامنة", stamp, "تُحدَّث عند كل ضغط على زر «مزامنة آخر اليوم»"],
    ["سطور محفوظة محليًا", String(meta.storedRows ?? 0), "إجمالي السطور في قاعدة البيانات المحلية"],
    ["تغييرات منتظرة", String(meta.pending ?? 0), "لم تصل إلى Convex بعد"],
    [],
    ["كيف تُزامن؟", "", ""],
    ["1", "املأ الأوراق القابلة للاستيراد: المواد · الخلطات · الطلبيات · المخازن · الشاحنات والسائقين", ""],
    ["2", "ارفع الملف من شاشة «استيراد Excel» في النظام", ""],
    ["3", "تُحفظ السطور في SQLite أولًا ثم تُرسل إلى Convex، وتظهر فورًا في كل الشاشات", ""],
    ["4", "اضغط «مزامنة آخر اليوم» لرفع كل ما تبقّى وتنزيل أحدث بيانات الكلاود", ""],
    ["5", "عند التعارض تفوز النسخة الأحدث زمنيًا (Last Write Wins) ويُسجَّل التعارض في سجل التتبع", ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 26 }, { wch: 64 }, { wch: 56 }];
  return sheet;
}

export type WorkbookMeta = {
  lastSync?: number | null;
  engine?: string;
  storedRows?: number;
  pending?: number;
};

/**
 * Builds the workbook. With no data it is the empty template; with data it is
 * the plant's own figures in the same layout, so the same file round-trips.
 */
export function buildIconcreteWorkbook(
  data: SectionData = {},
  meta: WorkbookMeta = {},
): Blob {
  const logs = data.productionLogs ?? [];
  const materials = data.materials ?? [];
  const mixes = data.mixPrices ?? [];
  const fleet = data.equipment ?? [];

  // Stock movements store a material id; Excel speaks in material names, so the
  // sheet is written with the resolved name and can be re-imported unchanged.
  const materialById = new Map(
    materials.map((material) => [String(material._id), String(material.name ?? "")]),
  );
  const movements = (data.materialMovements ?? []).map((movement) => ({
    ...movement,
    materialName:
      movement.materialName ?? materialById.get(String(movement.materialId)) ?? "",
    kindLabel:
      MOVEMENT_LABELS[String(movement.kind ?? "")] ?? String(movement.kind ?? ""),
  }));

  const bySection: Record<string, LocalRow[]> = {
    customers: customerRows(logs),
    suppliers: supplierRows(materials, movements),
    materials,
    mixDesigns: mixes,
    orders: logs,
    dailyProduction: dailyRows(logs),
    invoices: invoiceRows(logs),
    warehouses: movements,
    expenses: expenseRows(movements),
    fleet,
  };

  const workbook = XLSX.utils.book_new();
  for (const section of ICONCRETE_SECTIONS) {
    XLSX.utils.book_append_sheet(
      workbook,
      buildSheet(section, bySection[section.id] ?? []),
      section.sheet,
    );
  }
  XLSX.utils.book_append_sheet(workbook, guideSheet(), "دليل الأعمدة");
  XLSX.utils.book_append_sheet(workbook, syncSheet(meta), "المزامنة");

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* ------------------------------------------------------------------ */
/* Reading the workbook back                                          */
/* ------------------------------------------------------------------ */

export type SectionImport = {
  id: string;
  sheet: string;
  tableName: string;
  rows: LocalRow[];
  issues: RowIssue[];
};

export type WorkbookImport = {
  sections: SectionImport[];
  sheetNames: string[];
  totalRows: number;
  totalIssues: number;
};

const ARABIC_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/g;

function key(text: string): string {
  return String(text)
    .replace(ARABIC_DIGITS, (ch) => {
      const code = ch.charCodeAt(0);
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(code - base);
    })
    .toLowerCase()
    .replace(/[\s_\-().%³]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

const TRUTHY = new Set(["نعم", "yes", "y", "true", "1", "صح", "صحيح"]);
const FALSY = new Set(["لا", "no", "n", "false", "0", "خطأ"]);

function asBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return fallback;
  const text = key(String(value));
  if (TRUTHY.has(text)) return true;
  if (FALSY.has(text)) return false;
  return fallback;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const text = String(value).replace(/[\s,٪%]/g, "");
  const parsed = Number(text.replace(ARABIC_DIGITS, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  }));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function asDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const text = asText(value);
  if (!text) return undefined;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [y, m, d] = text.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, rawY] = dmy;
    const y = rawY.length === 2 ? `20${rawY}` : rawY;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

const CATEGORIES: Record<string, string> = {
  cement: "cement",
  اسمنت: "cement",
  ركام: "aggregate",
  aggregate: "aggregate",
  رمل: "sand",
  sand: "sand",
  اضافات: "admixture",
  admixture: "admixture",
  مياه: "water",
  water: "water",
  اخرى: "other",
  other: "other",
};

const UNITS: Record<string, string> = {
  طن: "ton",
  ton: "ton",
  م3: "m3",
  m3: "m3",
  كجم: "kg",
  kg: "kg",
  لتر: "liter",
  liter: "liter",
};

const KINDS: Record<string, string> = {
  استلام: "receipt",
  receipt: "receipt",
  صرف: "issue",
  issue: "issue",
  تسويه: "adjustment",
  adjustment: "adjustment",
  شاحنه: "truck",
  truck: "truck",
  خلاطه: "mixer",
  mixer: "mixer",
  مضخه: "pump",
  pump: "pump",
  لودر: "loader",
  loader: "loader",
  مولد: "generator",
  generator: "generator",
  اخرى: "other",
  other: "other",
};

/** Index of header → column, tolerant of Arabic/English spellings. */
function headerIndex(
  section: AppSection,
  raw: Record<string, unknown>,
): Partial<Record<string, string>> {
  const lookup = new Map<string, string>();
  for (const column of section.columns) {
    lookup.set(key(column.label), column.field);
    lookup.set(key(column.english), column.field);
    lookup.set(key(column.field), column.field);
  }
  const found: Partial<Record<string, string>> = {};
  for (const header of Object.keys(raw)) {
    const field = lookup.get(key(header));
    if (field) found[header] = field;
  }
  return found;
}

function pick(raw: Record<string, unknown>, found: Partial<Record<string, string>>, field: string) {
  for (const [header, mapped] of Object.entries(found)) {
    if (mapped === field) return raw[header];
  }
  return undefined;
}

function parseMaterials(section: AppSection, raw: Record<string, unknown>[], issues: RowIssue[], table: string): LocalRow[] {
  const rows: LocalRow[] = [];
  raw.forEach((entry, index) => {
    const found = headerIndex(section, entry);
    const name = asText(pick(entry, found, "name"));
    if (!name) {
      issues.push({ row: index + 2, message: "اسم المادة مفقود" });
      return;
    }
    rows.push({
      _table: table,
      name,
      category: CATEGORIES[key(String(pick(entry, found, "category") ?? "cement"))] ?? "cement",
      unit: UNITS[key(String(pick(entry, found, "unit") ?? "ton"))] ?? "ton",
      openingQty: asNumber(pick(entry, found, "openingQty")),
      reorderLevel: asNumber(pick(entry, found, "reorderLevel")),
      standardCost: asNumber(pick(entry, found, "standardCost")),
      supplier: asText(pick(entry, found, "supplier")),
      isActive: asBool(pick(entry, found, "isActive"), true),
    });
  });
  return rows;
}

function parseMixes(section: AppSection, raw: Record<string, unknown>[], issues: RowIssue[]): LocalRow[] {
  const rows: LocalRow[] = [];
  raw.forEach((entry, index) => {
    const found = headerIndex(section, entry);
    const name = asText(pick(entry, found, "name"));
    if (!name) {
      issues.push({ row: index + 2, message: "اسم الخلطة مفقود" });
      return;
    }
    const price = asNumber(pick(entry, found, "price"));
    const cost = asNumber(pick(entry, found, "cost"));
    if (price <= 0) {
      issues.push({ row: index + 2, message: "سعر البيع يجب أن يكون أكبر من صفر" });
      return;
    }
    if (cost > price) {
      issues.push({ row: index + 2, message: "تكلفة المتر لا يمكن أن تتجاوز سعر البيع" });
      return;
    }
    rows.push({
      name,
      price,
      cost,
      strengthMpa: asNumber(pick(entry, found, "strengthMpa")) || undefined,
      cementKgPerM3: asNumber(pick(entry, found, "cementKgPerM3")) || undefined,
      notes: asText(pick(entry, found, "notes")),
      isActive: asBool(pick(entry, found, "isActive"), true),
    });
  });
  return rows;
}

function parseMovements(section: AppSection, raw: Record<string, unknown>[], issues: RowIssue[]): LocalRow[] {
  const rows: LocalRow[] = [];
  raw.forEach((entry, index) => {
    const found = headerIndex(section, entry);
    const date = asDate(pick(entry, found, "date"));
    const materialName = asText(pick(entry, found, "materialName"));
    const quantity = asNumber(pick(entry, found, "quantity"));
    if (!date) {
      issues.push({ row: index + 2, message: "تاريخ الحركة غير صالح" });
      return;
    }
    if (!materialName) {
      issues.push({ row: index + 2, message: "اسم المادة مفقود" });
      return;
    }
    if (quantity === 0) {
      issues.push({ row: index + 2, message: "الكمية يجب أن تكون مختلفة عن صفر" });
      return;
    }
    rows.push({
      _materialName: materialName,
      date,
      kind: KINDS[key(String(pick(entry, found, "kind") ?? "receipt"))] ?? "receipt",
      quantity,
      unitCost: asNumber(pick(entry, found, "unitCost")) || undefined,
      supplier: asText(pick(entry, found, "supplier")),
      reference: asText(pick(entry, found, "reference")),
      note: asText(pick(entry, found, "note")),
    });
  });
  return rows;
}

function parseFleet(section: AppSection, raw: Record<string, unknown>[], issues: RowIssue[]): LocalRow[] {
  const rows: LocalRow[] = [];
  raw.forEach((entry, index) => {
    const found = headerIndex(section, entry);
    const code = asText(pick(entry, found, "code"));
    const name = asText(pick(entry, found, "name"));
    if (!code || !name) {
      issues.push({ row: index + 2, message: "كود واسم المعدة مطلوبان" });
      return;
    }
    rows.push({
      code,
      name,
      kind: KINDS[key(String(pick(entry, found, "kind") ?? "truck"))] ?? "truck",
      driverName: asText(pick(entry, found, "driverName")),
      driverPhone: asText(pick(entry, found, "driverPhone")),
      plateNumber: asText(pick(entry, found, "plateNumber")),
      meterUnit: key(String(pick(entry, found, "meterUnit") ?? "km")).includes("ساع")
        ? "hours"
        : "km",
      meterReading: asNumber(pick(entry, found, "meterReading")),
      lastServiceMeter: asNumber(pick(entry, found, "lastServiceMeter")),
      serviceInterval: asNumber(pick(entry, found, "serviceInterval")),
      serviceIntervalDays: asNumber(pick(entry, found, "serviceIntervalDays")) || undefined,
      lastServiceDate: asDate(pick(entry, found, "lastServiceDate")),
      avgDailyUsage: asNumber(pick(entry, found, "avgDailyUsage")),
      isActive: asBool(pick(entry, found, "isActive"), true),
      notes: asText(pick(entry, found, "notes")),
    });
  });
  return rows;
}

/** Table the importable sheet writes into. */
const SECTION_TABLE: Record<string, string> = {
  materials: "materials",
  mixDesigns: "mixPrices",
  orders: "productionLogs",
  warehouses: "materialMovements",
  fleet: "equipment",
};

/**
 * Reads an `iConcrete_Template.xlsx` file (or any file that uses the same sheet
 * names) and returns one import batch per section, with per-row Arabic errors.
 */
export async function parseIconcreteWorkbook(file: File): Promise<WorkbookImport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sections: SectionImport[] = [];
  let totalRows = 0;
  let totalIssues = 0;

  for (const section of IMPORTABLE_SECTIONS) {
    const sheet = workbook.Sheets[section.sheet];
    if (!sheet) continue;
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });
    const issues: RowIssue[] = [];
    let rows: LocalRow[] = [];

    if (section.id === "orders") {
      const mapped = mapRows(raw);
      rows = mapped.rows.map((row) => ({ ...row }));
      issues.push(...mapped.issues);
    } else if (section.id === "materials") {
      rows = parseMaterials(section, raw, issues, "materials");
    } else if (section.id === "mixDesigns") {
      rows = parseMixes(section, raw, issues);
    } else if (section.id === "warehouses") {
      rows = parseMovements(section, raw, issues);
    } else if (section.id === "fleet") {
      rows = parseFleet(section, raw, issues);
    }

    totalRows += raw.length;
    totalIssues += issues.length;
    sections.push({
      id: section.id,
      sheet: section.sheet,
      tableName: SECTION_TABLE[section.id] ?? section.source,
      rows,
      issues,
    });
  }

  return {
    sections,
    sheetNames: workbook.SheetNames,
    totalRows,
    totalIssues,
  };
}

export function isIconcreteWorkbook(sheetNames: string[]): boolean {
  return ICONCRETE_SECTIONS.some((section) => sheetNames.includes(section.sheet));
}

export const ICONCRETE_SECTION_COUNT = ICONCRETE_SECTIONS.length;

/** Labels used by the import preview table. */
export const SECTION_KIND_LABELS = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
} as const;

export { STATUS_LABELS, SHIFT_LABELS, MOVEMENT_LABELS };
