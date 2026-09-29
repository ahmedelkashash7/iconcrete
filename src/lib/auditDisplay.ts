import type { AuditAction } from "@/convex/auditLog";
import { normalizeRole, ROLE_LABELS } from "@/convex/permissions";
import { SHIFT_LABELS, STATUS_LABELS } from "@/lib/concrete";
import type { LogStatus, Shift } from "@/lib/concrete";
import { formatEGP, formatM3 } from "@/lib/format";

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
    case "role": {
      const role = normalizeRole(value);
      return role ? ROLE_LABELS[role] : "بدون دور";
    }
    case "pricePerM3":
    case "costPerM3":
      return formatEGP(Number(value));
    case "quantityM3":
    case "deliveredM3":
    case "returnedM3":
      return formatM3(Number(value), 1);
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
