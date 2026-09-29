import type { AuditAction } from "@/convex/auditLog";
import { normalizeRole, ROLE_LABELS } from "@/convex/permissions";
import {
  ALERT_CHANNEL_LABELS,
  ALERT_COMPARATOR_LABELS,
  ALERT_METRIC_LABELS,
  EQUIPMENT_KIND_LABELS,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_UNIT_LABELS,
  METER_UNIT_LABELS,
  MOVEMENT_KIND_LABELS,
  QUALITY_KIND_LABELS,
  QUALITY_RESULT_LABELS,
  SHIFT_LABELS,
  STATUS_LABELS,
} from "@/lib/concrete";
import type {
  AlertChannel,
  AlertComparator,
  AlertMetric,
  EquipmentKind,
  LogStatus,
  MaterialCategory,
  MaterialUnit,
  MeterUnit,
  MovementKind,
  QualityKind,
  QualityResult,
  Shift,
} from "@/lib/concrete";
import { formatEGP, formatM3, formatNumber } from "@/lib/format";

/** Presentation layer for the audit trail (Arabic labels + value formatting). */

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  role_change: "تغيير دور",
  seed: "تحميل بيانات تجريبية",
  purge: "حذف بيانات تجريبية",
};

export const AUDIT_ACTION_ORDER: AuditAction[] = [
  "create",
  "update",
  "delete",
  "role_change",
  "seed",
  "purge",
];

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  productionLogs: "قيد إنتاج",
  users: "عضو فريق",
  branches: "فرع",
  mixPrices: "خلطة معتمدة",
  plantSettings: "بيانات المحطة",
  qualityTests: "اختبار جودة",
  materials: "مادة",
  materialMovements: "حركة مخزون",
  equipment: "معدة",
  alertRules: "قاعدة تنبيه",
};

const FIELD_LABELS: Record<string, string> = {
  date: "التاريخ",
  shift: "الوردية",
  mixDesign: "نوع الخلطة",
  customer: "العميل",
  site: "الموقع / المشروع",
  orderRef: "رقم الطلبية",
  quantityM3: "الكمية المنتجة",
  deliveredM3: "الكمية المسلّمة",
  returnedM3: "الكمية المرتجعة",
  pricePerM3: "سعر المتر",
  costPerM3: "تكلفة المتر",
  truckCount: "عدد العربات",
  onTime: "التسليم في الموعد",
  status: "الحالة",
  notes: "ملاحظات",
  role: "الدور",
  // branches / plant settings
  code: "الكود",
  name: "الاسم",
  city: "المدينة",
  address: "العنوان",
  managerName: "مدير الفرع",
  phone: "الهاتف",
  capacityM3Day: "الطاقة اليومية",
  isActive: "التشغيل",
  plantName: "اسم المحطة",
  legalName: "الاسم القانوني",
  taxId: "الرقم الضريبي",
  email: "البريد الإلكتروني",
  currency: "العملة",
  alertEmail: "بريد التنبيهات",
  alertPhone: "جوال التنبيهات",
  // mix prices
  strengthMpa: "المقاومة المميزة (MPa)",
  cementKgPerM3: "الأسمنت لكل م٣",
  // quality
  kind: "نوع الاختبار / المعدة",
  targetValue: "القيمة المستهدفة",
  tolerance: "السماحية",
  actualValue: "القراءة الفعلية",
  result: "النتيجة",
  sampleRef: "رقم العينة",
  labName: "المعمل",
  testedBy: "الفاحص",
  // stores
  category: "التصنيف",
  unit: "وحدة القياس",
  openingQty: "الرصيد الافتتاحي",
  reorderLevel: "حد إعادة الطلب",
  standardCost: "التكلفة المعيارية",
  supplier: "المورد",
  quantity: "الكمية",
  unitCost: "تكلفة الوحدة",
  reference: "المرجع",
  note: "ملاحظة",
  // fleet
  meterUnit: "وحدة العداد",
  meterReading: "قراءة العداد",
  lastServiceMeter: "عداد آخر صيانة",
  serviceInterval: "الفترة بين الصيانات",
  serviceIntervalDays: "الفترة الزمنية (يوم)",
  lastServiceDate: "تاريخ آخر صيانة",
  avgDailyUsage: "الاستهلاك اليومي",
  // alerts
  metric: "المؤشر",
  comparator: "المقارنة",
  threshold: "الحد",
  channel: "قناة الإرسال",
  recipients: "المستلمون",
  windowDays: "مدة القياس (يوم)",
};

export function auditFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function auditEntityLabel(entity: string): string {
  return AUDIT_ENTITY_LABELS[entity] ?? entity;
}

/** Renders a stored audit value using the plant vocabulary. */
export function formatAuditValue(field: string, value?: string): string {
  if (value === undefined || value === "") return "—";
  switch (field) {
    case "shift":
      return SHIFT_LABELS[value as Shift] ?? value;
    case "status":
      return STATUS_LABELS[value as LogStatus] ?? value;
    case "onTime":
      return value === "true" ? "في الموعد" : "متأخر";
    case "kind":
      return (
        QUALITY_KIND_LABELS[value as QualityKind] ??
        EQUIPMENT_KIND_LABELS[value as EquipmentKind] ??
        MOVEMENT_KIND_LABELS[value as MovementKind] ??
        value
      );
    case "role": {
      const role = normalizeRole(value);
      return role ? ROLE_LABELS[role] : "بدون دور";
    }
    case "pricePerM3":
    case "costPerM3":
    case "standardCost":
    case "unitCost":
      return formatEGP(Number(value));
    case "quantityM3":
    case "deliveredM3":
    case "returnedM3":
    case "quantity":
      return formatM3(Number(value), 1);
    case "isActive":
      return value === "true" ? "مفعّل" : "معطّل";
    case "result":
      return QUALITY_RESULT_LABELS[value as QualityResult] ?? value;
    case "metric":
      return ALERT_METRIC_LABELS[value as AlertMetric] ?? value;
    case "comparator":
      return ALERT_COMPARATOR_LABELS[value as AlertComparator] ?? value;
    case "channel":
      return ALERT_CHANNEL_LABELS[value as AlertChannel] ?? value;
    case "unit":
      return MATERIAL_UNIT_LABELS[value as MaterialUnit] ?? value;
    case "category":
      return MATERIAL_CATEGORY_LABELS[value as MaterialCategory] ?? value;
    case "meterUnit":
      return METER_UNIT_LABELS[value as MeterUnit] ?? value;
    case "threshold":
    case "targetValue":
    case "tolerance":
    case "actualValue":
    case "openingQty":
    case "reorderLevel":
    case "meterReading":
    case "lastServiceMeter":
    case "serviceInterval":
    case "capacityM3Day":
    case "windowDays":
      return formatNumber(Number(value), 2);
    default:
      return value;
  }
}

export function auditActionTone(action: AuditAction): string {
  switch (action) {
    case "create":
      return "border-success/40 bg-success/10 text-success";
    case "delete":
    case "purge":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "role_change":
      return "border-brand/40 bg-brand/10 text-brand-foreground dark:text-brand";
    case "update":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "text-muted-foreground";
  }
}
