import { STANDARD_MIX_PRICES, cubeTargetValue, strengthFromName } from "@/convex/pricing";
import { formatNumber, formatPercent } from "@/lib/format";

/** Shared vocabulary of the ready-mix plant used by the v1 screens. */

export type Shift = "morning" | "evening" | "night";
export type LogStatus = "delivered" | "in_progress" | "cancelled";

export const SHIFT_ORDER: Shift[] = ["morning", "evening", "night"];

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: "الوردية الصباحية",
  evening: "الوردية المسائية",
  night: "الوردية الليلية",
};

export const SHIFT_SHORT_LABELS: Record<Shift, string> = {
  morning: "صباحي",
  evening: "مسائي",
  night: "ليلي",
};

export const STATUS_ORDER: LogStatus[] = ["delivered", "in_progress", "cancelled"];

export const STATUS_LABELS: Record<LogStatus, string> = {
  delivered: "مكتمل",
  in_progress: "قيد التنفيذ",
  cancelled: "ملغي",
};

/**
 * Standard grades with the plant's approved selling price and cost per m³
 * (EGP). The same table prices operator entries on the server, so the form and
 * the backend can never disagree about a grade's price.
 */
export { STANDARD_MIX_PRICES as MIX_PRESETS } from "@/convex/pricing";

export const MIX_NAMES = STANDARD_MIX_PRICES.map((mix) => mix.name);

/** Truck mixer drum capacity used to estimate the number of trips. */
export const TRUCK_CAPACITY_M3 = 9;

/* ------------------------------------------------------------------ */
/* Multi-branch                                                        */
/* ------------------------------------------------------------------ */

/** Shown for records created before the branch layer was switched on. */
export const BRANCH_UNASSIGNED_LABEL = "غير محدد";

/* ------------------------------------------------------------------ */
/* Quality control — cubes and slump (ECP 203 / ASTM C94)              */
/* ------------------------------------------------------------------ */

export type QualityKind = "cube28" | "cube7" | "slump";

export const QUALITY_KIND_ORDER: QualityKind[] = ["cube28", "cube7", "slump"];

export const QUALITY_KIND_LABELS: Record<QualityKind, string> = {
  cube28: "مكعب مقاومة ٢٨ يومًا",
  cube7: "مكعب مقاومة ٧ أيام",
  slump: "اختبار الركود (Slump)",
};

export const QUALITY_KIND_SHORT: Record<QualityKind, string> = {
  cube28: "٢٨ يومًا",
  cube7: "٧ أيام",
  slump: "ركود",
};

/** Reading unit for each test type. */
export const QUALITY_UNITS: Record<QualityKind, string> = {
  cube28: "MPa",
  cube7: "MPa",
  slump: "مم",
};

export type QualityResult = "pass" | "fail" | "pending";

export const QUALITY_RESULT_LABELS: Record<QualityResult, string> = {
  pass: "مطابق",
  fail: "غير مطابق",
  pending: "بانتظار النتيجة",
};

export const QUALITY_RESULT_TONE: Record<
  QualityResult,
  "success" | "destructive" | "muted"
> = {
  pass: "success",
  fail: "destructive",
  pending: "muted",
};

/** Standard slump target used by the plant's approved mixes. */
export const DEFAULT_SLUMP_TARGET_MM = 120;
export const DEFAULT_SLUMP_TOLERANCE_MM = 25;

/** A 7-day cube is accepted from 70% of the characteristic strength. */
export const CUBE_7_ACCEPTANCE_RATIO = 0.7;

export { cubeTargetValue, strengthFromName };

/** The target the server will store for a test, mirrored for the live preview. */
export function testTargetValue(kind: QualityKind, mixDesign: string): number {
  if (kind === "slump") return DEFAULT_SLUMP_TARGET_MM;
  return cubeTargetValue(mixDesign, kind === "cube7" ? "cube7" : "cube28");
}

/** Mirrors the server's acceptance rule so the form can warn before saving. */
export function evaluateQualityPreview(
  kind: QualityKind,
  targetValue: number,
  tolerance: number,
  actualValue: number,
): QualityResult {
  if (!Number.isFinite(actualValue) || actualValue <= 0) return "pending";
  if (kind === "slump") {
    const band = tolerance > 0 ? tolerance : DEFAULT_SLUMP_TOLERANCE_MM;
    return Math.abs(actualValue - targetValue) <= band ? "pass" : "fail";
  }
  return actualValue >= targetValue ? "pass" : "fail";
}

/* ------------------------------------------------------------------ */
/* Stores & materials                                                  */
/* ------------------------------------------------------------------ */

export type MaterialCategory =
  | "cement"
  | "aggregate"
  | "sand"
  | "admixture"
  | "water"
  | "other";

export const MATERIAL_CATEGORY_ORDER: MaterialCategory[] = [
  "cement",
  "aggregate",
  "sand",
  "admixture",
  "water",
  "other",
];

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  cement: "أسمنت",
  aggregate: "ركام",
  sand: "رمل",
  admixture: "إضافات",
  water: "مياه",
  other: "أخرى",
};

export type MaterialUnit = "ton" | "m3" | "kg" | "liter";

export const MATERIAL_UNIT_ORDER: MaterialUnit[] = ["ton", "m3", "kg", "liter"];

export const MATERIAL_UNIT_LABELS: Record<MaterialUnit, string> = {
  ton: "طن",
  m3: "م³",
  kg: "كجم",
  liter: "لتر",
};

export type MovementKind = "receipt" | "issue" | "adjustment";

export const MOVEMENT_KIND_ORDER: MovementKind[] = [
  "receipt",
  "issue",
  "adjustment",
];

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  receipt: "استلام من المورد",
  issue: "صرف للخلاطة",
  adjustment: "تسوية جرد",
};

export type StockStatus = "ok" | "low" | "negative" | "idle";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: "رصيد كافٍ",
  low: "تحت حد إعادة الطلب",
  negative: "رصيد سالب",
  idle: "بدون استهلاك",
};

/* ------------------------------------------------------------------ */
/* Fleet & preventive maintenance                                      */
/* ------------------------------------------------------------------ */

export type EquipmentKind =
  | "mixer"
  | "truck"
  | "pump"
  | "loader"
  | "generator"
  | "other";

export const EQUIPMENT_KIND_ORDER: EquipmentKind[] = [
  "mixer",
  "truck",
  "pump",
  "loader",
  "generator",
  "other",
];

export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  mixer: "خلاطة مركزية",
  truck: "عربة خلاط",
  pump: "مضخة خرسانة",
  loader: "معدة تحميل",
  generator: "مولد كهربائي",
  other: "معدة أخرى",
};

export type MeterUnit = "hours" | "km";

export const METER_UNIT_LABELS: Record<MeterUnit, string> = {
  hours: "ساعة تشغيل",
  km: "كيلومتر",
};

export type MaintenanceStatus = "overdue" | "due_soon" | "scheduled" | "ok";

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  overdue: "متأخرة",
  due_soon: "مستحقة قريبًا",
  scheduled: "مبرمجة",
  ok: "سليمة",
};

export const MAINTENANCE_STATUS_TONE: Record<
  MaintenanceStatus,
  "destructive" | "warning" | "primary" | "success"
> = {
  overdue: "destructive",
  due_soon: "warning",
  scheduled: "primary",
  ok: "success",
};

/* ------------------------------------------------------------------ */
/* Threshold alerts                                                    */
/* ------------------------------------------------------------------ */

export type AlertMetric =
  | "dailyProfit"
  | "marginPct"
  | "onTimePct"
  | "qualityFailCount"
  | "lowStockCount"
  | "equipmentOverdueCount";

export const ALERT_METRIC_ORDER: AlertMetric[] = [
  "dailyProfit",
  "marginPct",
  "onTimePct",
  "qualityFailCount",
  "lowStockCount",
  "equipmentOverdueCount",
];

export const ALERT_METRIC_LABELS: Record<AlertMetric, string> = {
  dailyProfit: "ربح آخر يوم مسجّل",
  marginPct: "هامش الربح",
  onTimePct: "نسبة التسليم في الموعد",
  qualityFailCount: "نتائج جودة غير مطابقة",
  lowStockCount: "مواد تحت حد إعادة الطلب",
  equipmentOverdueCount: "معدات متأخرة الصيانة",
};

export const ALERT_METRIC_UNITS: Record<AlertMetric, string> = {
  dailyProfit: "ج.م",
  marginPct: "٪",
  onTimePct: "٪",
  qualityFailCount: "اختبار",
  lowStockCount: "مادة",
  equipmentOverdueCount: "معدة",
};

export const ALERT_METRIC_DEFAULTS: Record<
  AlertMetric,
  { comparator: AlertComparator; threshold: number; windowDays: number }
> = {
  dailyProfit: { comparator: "lt", threshold: 0, windowDays: 3 },
  marginPct: { comparator: "lt", threshold: 8, windowDays: 30 },
  onTimePct: { comparator: "lt", threshold: 85, windowDays: 7 },
  qualityFailCount: { comparator: "gt", threshold: 2, windowDays: 30 },
  lowStockCount: { comparator: "gt", threshold: 0, windowDays: 7 },
  equipmentOverdueCount: { comparator: "gt", threshold: 0, windowDays: 7 },
};

export type AlertComparator = "lt" | "gt";

export const ALERT_COMPARATOR_LABELS: Record<AlertComparator, string> = {
  lt: "أقل من",
  gt: "أعلى من",
};

export type AlertChannel = "email" | "sms";

export const ALERT_CHANNEL_LABELS: Record<AlertChannel, string> = {
  email: "بريد إلكتروني",
  sms: "رسالة نصية",
};

export type AlertStatus = "pending" | "sent" | "simulated" | "failed";

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  pending: "في الانتظار",
  sent: "أُرسل",
  simulated: "تجريبي (لم يُرسل)",
  failed: "فشل الإرسال",
};

export const ALERT_STATUS_TONE: Record<
  AlertStatus,
  "success" | "muted" | "destructive" | "warning"
> = {
  sent: "success",
  simulated: "muted",
  failed: "destructive",
  pending: "warning",
};

/** Formats an alert metric the way its own unit demands. */
export function formatMetricValue(metric: AlertMetric, value: number): string {
  if (metric === "dailyProfit") return `${formatNumber(Math.round(value))} ج.م`;
  if (metric === "marginPct" || metric === "onTimePct") {
    return formatPercent(value);
  }
  return `${formatNumber(value)} ${ALERT_METRIC_UNITS[metric]}`;
}
