import { addDays } from "./measures";

/**
 * IConcrete System — roles & capabilities.
 *
 * Single source of truth for what each plant role may see and do. It is a plain
 * module (no Convex runtime imports) so the backend enforces the same matrix the
 * interface renders.
 */

export const PLANT_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  REVIEWER: "reviewer",
  OPERATOR: "operator",
} as const;

export type PlantRole = (typeof PLANT_ROLES)[keyof typeof PLANT_ROLES];

export type Capability =
  | "viewFinancials"
  | "createLog"
  | "editLog"
  | "deleteLog"
  | "manageTestData"
  | "viewTeam"
  | "viewAudit"
  | "manageRoles"
  | "manageSettings"
  | "manageBranches"
  | "viewQuality"
  | "manageQuality"
  | "viewInventory"
  | "manageInventory"
  | "viewForecast"
  | "viewAlerts"
  | "manageAlerts"
  | "viewExport";

export const CAPABILITIES: Capability[] = [
  "viewFinancials",
  "createLog",
  "editLog",
  "deleteLog",
  "manageTestData",
  "viewQuality",
  "manageQuality",
  "viewInventory",
  "manageInventory",
  "viewForecast",
  "viewAlerts",
  "manageAlerts",
  "viewExport",
  "manageSettings",
  "manageBranches",
  "viewTeam",
  "viewAudit",
  "manageRoles",
];

export const ROLE_ORDER: PlantRole[] = ["owner", "manager", "reviewer", "operator"];

export const ROLE_LABELS: Record<PlantRole, string> = {
  owner: "مالك",
  manager: "مدير",
  reviewer: "مراجع",
  operator: "مشغّل",
};

export const ROLE_DESCRIPTIONS: Record<PlantRole, string> = {
  owner: "المسؤول الأول عن النظام: كل الصلاحيات بما فيها إدارة أدوار الفريق.",
  manager:
    "إدارة التشغيل والأرقام المالية والبيانات التجريبية، دون تغيير الأدوار.",
  reviewer:
    "مراجعة وتصحيح القيود واختبارات الجودة، واطلاع كامل على الأرقام المالية وسجل التتبع.",
  operator:
    "إدخال بيانات الوردية والجودة والمخازن وتعديل قيود يومه، دون عرض الأرقام المالية أو الحذف.",
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  viewFinancials: "عرض الأرقام المالية (الإيراد، التكلفة، الربح، الهامش)",
  createLog: "تسجيل قيد إنتاج جديد",
  editLog: "تعديل قيد إنتاج قائم",
  deleteLog: "حذف قيد إنتاج",
  manageTestData: "تحميل أو حذف البيانات التجريبية",
  viewQuality: "عرض اختبارات الجودة (مكعبات الخرسانة والركود)",
  manageQuality: "تسجيل وتعديل اختبارات الجودة",
  viewInventory: "عرض أرصدة المخازن وحركة المواد",
  manageInventory: "تسجيل استلام وصرف المواد وتعديل الأرصدة",
  viewForecast: "عرض تنبؤ الطلب وخطة الصيانة",
  viewAlerts: "عرض التنبيهات الذكية وسجل ما أُرسل",
  manageAlerts: "إنشاء وتعديل قواعد التنبيه وحدودها",
  viewExport:
    "تنزيل حزمة Excel / Power Platform وربط الطبقة الموحّدة للتصدير",
  manageSettings: "تعديل أسعار الخلطات المعتمدة وبيانات المحطة",
  manageBranches: "إضافة فروع المحطة وتعديل بياناتها",
  viewTeam: "عرض الفريق وأدواره",
  viewAudit: "عرض سجل التتبع لكل عملية (من عدّل ماذا وبأي قيمة سابقة)",
  manageRoles: "تغيير أدوار الفريق",
};

export const ROLE_CAPABILITIES: Record<PlantRole, Capability[]> = {
  owner: [...CAPABILITIES],
  manager: [
    "viewFinancials",
    "createLog",
    "editLog",
    "deleteLog",
    "manageTestData",
    "viewQuality",
    "manageQuality",
    "viewInventory",
    "manageInventory",
    "viewForecast",
    "viewAlerts",
    "manageAlerts",
    "viewExport",
    "manageSettings",
    "viewTeam",
    "viewAudit",
  ],
  reviewer: [
    "viewFinancials",
    "editLog",
    "viewQuality",
    "manageQuality",
    "viewInventory",
    "viewForecast",
    "viewAlerts",
    "viewExport",
    "viewAudit",
  ],
  operator: [
    "createLog",
    "editLog",
    "viewQuality",
    "manageQuality",
    "viewInventory",
    "manageInventory",
    "viewForecast",
  ],
};

/**
 * Capabilities granted to an anonymous visitor **and only while the deployment
 * has DEMO_MODE on** (see ./demoMode, default OFF).
 *
 * It is deliberately a read-only subset. It excludes `viewFinancials`,
 * `viewExport`, `viewAudit`, `manageTestData` and every write capability, so a
 * demo visitor cannot price the plant, download the ledger or read the audit
 * trail. With DEMO_MODE off an anonymous viewer gets nothing at all.
 */
export const DEMO_GUEST_CAPABILITIES: Capability[] = [
  "viewQuality",
  "viewInventory",
  "viewForecast",
  "viewAlerts",
];

export type Viewer = {
  userId: string | null;
  role: PlantRole | null;
  isAnonymous?: boolean;
  /** Resolved server-side from DEMO_MODE; absent means "off". */
  demoMode?: boolean;
};

/** Least-privileged role stored for an anonymous user while DEMO_MODE is on. */
export const GUEST_ROLE: PlantRole = "operator";

/** Maps stored roles (including the template's legacy ones) onto plant roles. */
export function normalizeRole(role?: string | null): PlantRole | null {
  switch (role) {
    case "owner":
    case "manager":
    case "reviewer":
    case "operator":
      return role;
    case "admin":
      return "owner";
    case "member":
      return "manager";
    case "user":
      return "operator";
    default:
      return null;
  }
}

export function isPlantRole(value: string): value is PlantRole {
  return (ROLE_ORDER as string[]).includes(value);
}

export function can(viewer: Viewer, capability: Capability): boolean {
  if (!viewer.userId || !viewer.role) return false;
  if (viewer.isAnonymous) {
    // DEMO_MODE off (the default) => no capability at all.
    if (viewer.demoMode !== true) return false;
    return DEMO_GUEST_CAPABILITIES.includes(capability);
  }
  return ROLE_CAPABILITIES[viewer.role].includes(capability);
}

/** Guests are labelled «زائر» even though they run with manager-level access. */
export function roleLabel(viewer: {
  role: PlantRole | null;
  isAnonymous?: boolean;
}): string {
  if (viewer.isAnonymous) return "زائر (استعراض)";
  if (!viewer.role) return "بدون دور";
  return ROLE_LABELS[viewer.role];
}

/**
 * Operators may only correct their own entries (or unassigned ones) and only
 * around the current day; everyone else with `editLog` may edit freely.
 */
export function canEditLog(
  viewer: Viewer,
  log: { createdBy?: string; date: string },
  today: string,
): boolean {
  if (!can(viewer, "editLog")) return false;
  if (viewer.isAnonymous) return true;
  if (viewer.role !== "operator") return true;
  const ownsEntry = !log.createdBy || log.createdBy === viewer.userId;
  const withinWindow =
    log.date >= addDays(today, -1) && log.date <= addDays(today, 1);
  return ownsEntry && withinWindow;
}
