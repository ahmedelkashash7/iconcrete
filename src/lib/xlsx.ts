import * as XLSX from "xlsx";

/**
 * IConcrete System — Excel bridge.
 *
 * Excel is the plant's primary data-entry surface: the employee fills the
 * template, uploads it, and the numbers land in Convex in the same moment so
 * every screen updates reactively. This module owns the parsing and the
 * template generation on the client; the mutation only receives clean rows.
 */

export type ParsedLogRow = {
  date: string;
  shift: "morning" | "evening" | "night";
  mixDesign: string;
  customer: string;
  site?: string;
  orderRef?: string;
  quantityM3: number;
  deliveredM3: number;
  returnedM3: number;
  pricePerM3: number;
  costPerM3: number;
  truckCount: number;
  onTime: boolean;
  status: "delivered" | "in_progress" | "cancelled";
  notes?: string;
};

export type RowIssue = { row: number; message: string };

export type ParseResult = {
  rows: ParsedLogRow[];
  issues: RowIssue[];
  /** Total data rows seen in the sheet (including rejected ones). */
  total: number;
};

const ARABIC_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/g;

function toLatinDigits(text: string): string {
  return text.replace(ARABIC_DIGITS, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Header aliases (Arabic + English) → canonical field. */
const HEADERS: Record<keyof ParsedLogRow, string[]> = {
  date: ["date", "day", "التاريخ", "تاريخ"],
  shift: ["shift", "الوردية", "وردية"],
  mixDesign: ["mix", "mixdesign", "mixdesignname", "grade", "type", "الخلطة", "نوعالخلطة", "الخلطةالمعتمدة"],
  customer: ["customer", "client", "outlet", "العميل", "اسم العميل", "العميلاوالجهة", "الجهة"],
  site: ["site", "location", "الموقع", "اسم الموقع"],
  orderRef: ["order", "orderref", "ordernumber", "reference", "مرجع الطلب", "رقم الطلبية", "الطلبية", "مرجع الطلبية"],
  quantityM3: ["quantity", "quantitym3", "producedm3", "batchm3", "الكمية المنتجة", "الكمية (م3)", "الكميةالمنتجة", "كمية منتجة", "الانتاج"],
  deliveredM3: ["delivered", "deliveredm3", "acceptedm3", "الكمية المسلمة", "الكميةالمسلّمة", "المسلمة", "المسلّمة", "الكمية المسلّمة"],
  returnedM3: ["returned", "returnedm3", "rejectedm3", "الكمية المرتجعة", "المرجع", "المرتجع", "المرتجعة"],
  pricePerM3: ["price", "priceperm3", "saleprice", "سعر البيع", "سعر المتر", "سعرالبيع", "سعر المتر المكعب"],
  costPerM3: ["cost", "costperm3", "unitcost", "التكلفة", "تكلفة المتر", "تكلفةالمتر", "تكلفة المتر المكعب"],
  truckCount: ["trucks", "truckcount", "truck", "mixers", "عدد العربات", "العربات", "عددالعربات", "عدد السيارات"],
  onTime: ["ontime", "intime", "التسليم في الموعد", "في الموعد", "الالتزام بالموعد"],
  status: ["status", "state", "الحالة"],
  notes: ["notes", "note", "comment", "remarks", "ملاحظات", "بيان", "ملاحظة"],
};

function normalizeKey(text: string): string {
  return toLatinDigits(String(text))
    .toLowerCase()
    .replace(/[\s_\-().%]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

const LOOKUP: Record<string, keyof ParsedLogRow> = (() => {
  const map: Record<string, keyof ParsedLogRow> = {};
  (Object.keys(HEADERS) as Array<keyof ParsedLogRow>).forEach((field) => {
    HEADERS[field].forEach((alias) => {
      map[normalizeKey(alias)] = field;
    });
    map[normalizeKey(field)] = field;
  });
  return map;
})();

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;
  const text = toLatinDigits(String(value)).replace(/[,\s٪%]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date (days since 1899-12-30).
    const ms = Math.round((value - 25569) * 86_400_000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (value === null || value === undefined) return null;
  const text = toLatinDigits(String(value)).trim();
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
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseShift(value: unknown): ParsedLogRow["shift"] {
  const text = normalizeKey(String(value ?? ""));
  if (/night|ليلي|مسائي|ليل/.test(text)) return "night";
  if (/evening|مسا|عصر/.test(text)) return "evening";
  return "morning";
}

function parseStatus(value: unknown): ParsedLogRow["status"] {
  const text = normalizeKey(String(value ?? ""));
  if (/cancel|ملغ|الغاء/.test(text)) return "cancelled";
  if (/progress|جار|waiting|انتظار/.test(text)) return "in_progress";
  return "delivered";
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return fallback;
  const text = normalizeKey(String(value));
  if (/^(yes|y|true|1|نعم|صحيح|صح|✔)/.test(text)) return true;
  if (/^(no|n|false|0|لا|خطا|✘)/.test(text)) return false;
  return fallback;
}

/** Reads a sheet file (xlsx/xls/csv) into raw row objects with original headers. */
export async function readWorkbookRows(
  file: File,
  sheetName?: string,
): Promise<Array<Record<string, unknown>>> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  // `raw: true` + `cellDates` keeps dates as Date objects and numbers as
  // numbers, which is far more reliable than parsing Excel's display formats.
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });
}

export function listSheets(file: File): Promise<string[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { cellDates: true });
    return workbook.SheetNames;
  });
}

/**
 * Maps raw spreadsheet rows onto the production-log shape, collecting a
 * per-row Arabic error message for anything that cannot be imported instead of
 * silently dropping it.
 */
export function mapRows(rawRows: Array<Record<string, unknown>>): ParseResult {
  const rows: ParsedLogRow[] = [];
  const issues: RowIssue[] = [];

  rawRows.forEach((raw, index) => {
    const excelRow = index + 2; // +1 header, +1 for 1-based rows
    const values: Partial<Record<keyof ParsedLogRow, unknown>> = {};
    Object.entries(raw).forEach(([header, value]) => {
      const field = LOOKUP[normalizeKey(header)];
      if (field !== undefined) values[field] = value;
    });

    const date = parseDate(values.date);
    const customer = String(values.customer ?? "").trim();
    const mixDesign = String(values.mixDesign ?? "").trim();
    const quantity = parseNumber(values.quantityM3) ?? 0;
    const deliveredRaw = parseNumber(values.deliveredM3);
    const returned = parseNumber(values.returnedM3) ?? 0;
    const delivered = deliveredRaw === null ? Math.max(0, quantity - returned) : deliveredRaw;
    const price = parseNumber(values.pricePerM3) ?? 0;
    const cost = parseNumber(values.costPerM3) ?? 0;
    const trucks =
      parseNumber(values.truckCount) ?? Math.max(1, Math.round(quantity / 9));

    const problems: string[] = [];
    if (!date) problems.push("تاريخ غير صالح");
    if (!customer) problems.push("اسم العميل مفقود");
    if (!mixDesign) problems.push("نوع الخلطة مفقود");
    if (!(quantity > 0)) problems.push("الكمية المنتجة يجب أن تكون أكبر من صفر");
    if (returned < 0) problems.push("الكمية المرتجعة بالسالب");
    if (delivered + returned > quantity + 0.01) {
      problems.push("المسلّمة + المرتجعة تتجاوز المنتجة");
    }

    if (problems.length > 0) {
      issues.push({ row: excelRow, message: problems.join(" · ") });
      return;
    }

    rows.push({
      date: date as string,
      shift: parseShift(values.shift),
      mixDesign,
      customer,
      site: values.site ? String(values.site).trim() : undefined,
      orderRef: values.orderRef ? String(values.orderRef).trim() : undefined,
      quantityM3: quantity,
      deliveredM3: delivered,
      returnedM3: returned,
      pricePerM3: price,
      costPerM3: cost,
      truckCount: Math.max(0, Math.round(trucks)),
      onTime: parseBoolean(values.onTime, true),
      status: parseStatus(values.status),
      notes: values.notes ? String(values.notes).trim() : undefined,
    });
  });

  return { rows, issues, total: rawRows.length };
}

export const TEMPLATE_HEADERS = [
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

const TEMPLATE_ARABIC_HEADERS = [
  "التاريخ",
  "الوردية",
  "نوع الخلطة",
  "العميل",
  "الموقع",
  "رقم الطلبية",
  "الكمية المنتجة",
  "الكمية المسلّمة",
  "الكمية المرتجعة",
  "سعر المتر",
  "تكلفة المتر",
  "عدد العربات",
  "في الموعد",
  "الحالة",
  "ملاحظات",
];

function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Builds the empty import template with headers, an example row and notes. */
export function buildTemplateWorkbook(includeSample = true): Blob {
  const data: Array<Array<string | number>> = [TEMPLATE_ARABIC_HEADERS.slice()];
  if (includeSample) {
    data.push([
      today(),
      "صباحي",
      "C30/37",
      "شركة المقاولات الحديثة",
      "العاصمة الإدارية - حي R7",
      "IC-0001",
      60,
      58,
      2,
      1530,
      1205,
      7,
      "نعم",
      "مسلّم",
      "صبّة ناجحة",
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = TEMPLATE_ARABIC_HEADERS.map(() => ({ wch: 16 }));

  const keys = XLSX.utils.aoa_to_sheet([
    ["المفتاح الإنجليزي", "المفتاح العربي", "القيم المسموحة", "ملاحظة"],
    ["date", "التاريخ", "YYYY-MM-DD أو تاريخ Excel", "مطلوب"],
    ["shift", "الوردية", "morning | evening | night أو صباحي/مسائي/ليلي", "صباحي افتراضيًا"],
    ["mixDesign", "نوع الخلطة", "C20/25 … C40/50", "مطلوب — يجب أن يكون في قائمة الأسعار"],
    ["customer", "العميل", "نص", "مطلوب"],
    ["quantityM3", "الكمية المنتجة", "رقم > 0", "مطلوب"],
    ["deliveredM3", "الكمية المسلّمة", "رقم", "لو تُرك فارغًا = المنتجة − المرتجعة"],
    ["returnedM3", "الكمية المرتجعة", "رقم ≥ 0", "افتراضي 0"],
    ["pricePerM3", "سعر المتر", "رقم", "يُملأ تلقائيًا من قائمة الأسعار لغير الماليين"],
    ["costPerM3", "تكلفة المتر", "رقم", "يُملأ تلقائيًا من قائمة الأسعار لغير الماليين"],
    ["truckCount", "عدد العربات", "رقم", "افتراضيًا الكمية ÷ 9"],
    ["onTime", "في الموعد", "نعم/لا أو yes/no", "افتراضي نعم"],
    ["status", "الحالة", "delivered | in_progress | cancelled أو مسلّم/جارٍ/ملغي", "مسلّم افتراضيًا"],
  ]);
  keys["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 38 }, { wch: 40 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "الإدخال");
  XLSX.utils.book_append_sheet(workbook, keys, "دليل الأعمدة");

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Exports the current rows back to Excel (round-trip with the template). */
export function buildWorkbookFromRows(rows: ParsedLogRow[]): Blob {
  const data: Array<Array<string | number>> = [TEMPLATE_ARABIC_HEADERS.slice()];
  rows.forEach((row) => {
    data.push([
      row.date,
      row.shift,
      row.mixDesign,
      row.customer,
      row.site ?? "",
      row.orderRef ?? "",
      row.quantityM3,
      row.deliveredM3,
      row.returnedM3,
      row.pricePerM3,
      row.costPerM3,
      row.truckCount,
      row.onTime ? "نعم" : "لا",
      row.status,
      row.notes ?? "",
    ]);
  });
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = TEMPLATE_ARABIC_HEADERS.map(() => ({ wch: 16 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "الإدخال");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
