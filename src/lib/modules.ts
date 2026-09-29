import {
  BarChart3,
  Boxes,
  Calculator,
  ClipboardList,
  Cog,
  DatabaseBackup,
  FileSpreadsheet,
  Factory,
  FlaskConical,
  Fuel,
  Gauge,
  Handshake,
  KeyRound,
  Layers,
  LayoutDashboard,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
  Waypoints,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * IConcrete System — module registry.
 *
 * The system covers the whole plant, from operations and accounting down to
 * inventory, quality, fleet and maintenance. The registry is the single source
 * of truth for what the first release already does and what the next releases
 * build on top of the same ledger.
 */

export type ModuleAvailability = "live" | "roadmap";

export type SystemModule = {
  id: string;
  name: string;
  purpose: string;
  icon: LucideIcon;
  availability: ModuleAvailability;
  /** Route of the working screen, for modules that are live. */
  route?: string;
};

export type ModuleGroup = {
  id: string;
  name: string;
  summary: string;
  icon: LucideIcon;
  modules: SystemModule[];
};

export const SYSTEM_MODULES: ModuleGroup[] = [
  {
    id: "command",
    name: "القيادة والمتابعة",
    summary: "الأرقام التي يحتاجها صاحب العمل والإدارة في شاشة واحدة.",
    icon: LayoutDashboard,
    modules: [
      {
        id: "executive-dashboard",
        name: "لوحة القيادة التنفيذية",
        purpose:
          "أرباح المحطة وخسائرها ومؤشرات التشغيل والجودة والتسليم في شاشة واحدة.",
        icon: Gauge,
        availability: "live",
        route: "/dashboard",
      },
      {
        id: "period-reports",
        name: "التقارير الدورية",
        purpose: "تقارير يومية وشهرية جاهزة للطباعة والمشاركة مع الإدارة.",
        icon: FileSpreadsheet,
        availability: "roadmap",
      },
      {
        id: "threshold-alerts",
        name: "التنبيهات والحدود",
        purpose:
          "تنبيه تلقائي بالبريد أو الرسائل عند تخطي حد الربح أو نسبة التأخير أو المخزون.",
        icon: ScrollText,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "operations",
    name: "الإنتاج والتشغيل",
    summary: "من طلبية العميل إلى تذكرة التسليم الموقّعة.",
    icon: Factory,
    modules: [
      {
        id: "daily-production",
        name: "الإنتاج والكميات اليومية",
        purpose:
          "قيود الإنتاج لكل وردية: الخلطات والكميات والمرتجعات والإيراد والتكلفة.",
        icon: ClipboardList,
        availability: "live",
        route: "/production",
      },
      {
        id: "scheduling",
        name: "جدولة الطلبيات والخلاطات",
        purpose: "توزيع الطلبيات على الخلاطات والعربات حسب الطاقة المتاحة.",
        icon: Cog,
        availability: "roadmap",
      },
      {
        id: "delivery-tickets",
        name: "تذاكر التسليم",
        purpose: "تذكرة لكل عربة: زمن الخروج والكمية والتوقيع عند الاستلام.",
        icon: Truck,
        availability: "roadmap",
      },
      {
        id: "mix-library",
        name: "معايير الخلطات",
        purpose:
          "مكتبة خلطات معتمدة (ASTM C94 / ECP 203) مع تكلفتها القياسية وهامشها.",
        icon: FlaskConical,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "finance",
    name: "الحسابات والمالية",
    summary: "الإيراد والتكلفة والهامش لكل قيد، ثم الفواتير والتحصيل.",
    icon: Wallet,
    modules: [
      {
        id: "profit-loss",
        name: "الأرباح والخسائر والهوامش",
        purpose:
          "إيراد وتكلفة وهامش كل قيد وكل يوم وكل عميل وكل وردية، محسوبة تلقائيًا.",
        icon: BarChart3,
        availability: "live",
        route: "/dashboard",
      },
      {
        id: "invoicing",
        name: "الفواتير والتحصيل",
        purpose: "فواتير العملاء وأعمار الديون والمبالغ المتأخرة عن السداد.",
        icon: Receipt,
        availability: "roadmap",
      },
      {
        id: "cost-centers",
        name: "مراكز التكلفة والميزانيات",
        purpose: "مقارنة الإنفاق الفعلي بالميزانية المعتمدة لكل بند تشغيلي.",
        icon: Calculator,
        availability: "roadmap",
      },
      {
        id: "tax-documents",
        name: "المستندات الضريبية",
        purpose: "منظومة الفاتورة الإلكترونية والمستندات المعتمدة للتحصيل.",
        icon: ScrollText,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "inventory",
    name: "المخازن والمواد",
    summary: "أرصدة الأسمنت والركام والإضافات وحركتها اليومية.",
    icon: Boxes,
    modules: [
      {
        id: "stock",
        name: "الاستلام والتخزين",
        purpose:
          "أرصدة الأسمنت والركام والإضافات مع حد إعادة الطلب وتنبيه النقص.",
        icon: Boxes,
        availability: "roadmap",
      },
      {
        id: "consumption",
        name: "أوامر الصرف للخلاطة",
        purpose:
          "صرف المواد لكل خلطة ومقارنته بالاستهلاك المعياري وكشف الفاقد.",
        icon: ClipboardList,
        availability: "roadmap",
      },
      {
        id: "stocktake",
        name: "الجرد والتسويات",
        purpose: "جرد دوري وتسويات موثّقة تشرح فرق الرصيد وتكلفته.",
        icon: Calculator,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "quality",
    name: "الجودة والاختبارات",
    summary: "إثبات أن الخرسانة مطابقة للمواصفات، يومًا بيوم.",
    icon: FlaskConical,
    modules: [
      {
        id: "cube-tests",
        name: "نتائج مكعبات الخرسانة",
        purpose:
          "مقاومة الضغط بعد 7 و28 يومًا ونسبة النجاح لكل خلطة وكل صبّة.",
        icon: FlaskConical,
        availability: "roadmap",
      },
      {
        id: "slump-tests",
        name: "اختبارات الركود والمواد",
        purpose: "التحقق من الركود ونسب الخلط ومطابقة مواد التوريد.",
        icon: Gauge,
        availability: "roadmap",
      },
      {
        id: "non-conformity",
        name: "العيوب وعدم المطابقة",
        purpose: "تسجيل حالات عدم المطابقة وإجراء التصحيح ومنع تكرارها.",
        icon: ScrollText,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "fleet",
    name: "الأسطول والتوزيع",
    summary: "أين العربة، ومتى تصل، وبكم تكلّف الرحلة.",
    icon: Truck,
    modules: [
      {
        id: "fleet-tracking",
        name: "مراقبة العربات",
        purpose:
          "موقع كل عربة وسرعتها وحالة النطاق الجغرافي ووقت الوصول المتوقع للعميل.",
        icon: Truck,
        availability: "roadmap",
      },
      {
        id: "trip-planning",
        name: "تخطيط الرحلات",
        purpose: "توزيع الرحلات لتقليل زمن الانتظار ومسافة الوقود.",
        icon: Cog,
        availability: "roadmap",
      },
      {
        id: "fuel-log",
        name: "الوقود وتشغيل العربات",
        purpose: "استهلاك الوقود لكل رحلة وتكلفة الكيلومتر لكل عربة.",
        icon: Fuel,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "maintenance",
    name: "الصيانة والأصول",
    summary: "تشغيل الخلاطة والعربات دون توقف مفاجئ.",
    icon: Wrench,
    modules: [
      {
        id: "preventive",
        name: "الصيانة الوقائية",
        purpose:
          "جدول صيانة بالعدادات وتاريخ الاستحقاق لكل معدة وتنبيه قبل الموعد.",
        icon: Wrench,
        availability: "roadmap",
      },
      {
        id: "breakdowns",
        name: "الأعطال والإصلاح",
        purpose: "بلاغ العطل وزمن التوقف وتكلفة الإصلاح وأثره على الإنتاج.",
        icon: Cog,
        availability: "roadmap",
      },
      {
        id: "spare-parts",
        name: "قطع الغيار",
        purpose: "مخزون قطع الغيار والحد الآمن لكل معدة.",
        icon: Boxes,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "partners",
    name: "العملاء والموردون",
    summary: "من نتعامل معه، بأي شرط، وبأي ربحية.",
    icon: Handshake,
    modules: [
      {
        id: "customer-contracts",
        name: "ملفات العملاء والعقود",
        purpose:
          "شروط التسعير والكميات المتعاقد عليها وتاريخ التجديد والملفات الفنية.",
        icon: Handshake,
        availability: "roadmap",
      },
      {
        id: "procurement",
        name: "المشتريات وأداء الموردين",
        purpose: "أوامر الشراء والتزام المورد بالمواعيد والجودة والسعر.",
        icon: ClipboardList,
        availability: "roadmap",
      },
      {
        id: "customer-profit",
        name: "ربحية العميل",
        purpose:
          "صافي مساهمة كل عميل بعد التكلفة والمهلة الائتمانية ومعدل التأخير.",
        icon: BarChart3,
        availability: "roadmap",
      },
    ],
  },
  {
    id: "governance",
    name: "الصلاحيات والحماية",
    summary: "من يرى ماذا ومن يعدّل ماذا، ثم أثر كل تغيير وكيف تُستعاد البيانات.",
    icon: ShieldCheck,
    modules: [
      {
        id: "roles",
        name: "الأدوار والصلاحيات",
        purpose:
          "أدوار محددة (مالك، مدير، مراجع، مشغّل) لكل شاشة وكل إجراء، منفَّذة على مستوى النظام.",
        icon: KeyRound,
        availability: "live",
        route: "/team",
      },
      {
        id: "audit-trail",
        name: "سجل التتبع والتدقيق",
        purpose:
          "من أنشأ أو عدّل أو حذف أي قيد، ومتى، وبأي قيمة سابقة — أساس التوثيق في ISO 9001.",
        icon: ScrollText,
        availability: "live",
        route: "/audit",
      },
      {
        id: "backup",
        name: "النسخ الاحتياطي والاستعادة",
        purpose: "نسخ دورية تلقائية وخطة استعادة معتمدة للبيانات الحرجة.",
        icon: DatabaseBackup,
        availability: "roadmap",
      },
    ],
  },
];

export const ALL_MODULES: SystemModule[] = SYSTEM_MODULES.flatMap(
  (group) => group.modules,
);

export const LIVE_MODULES = ALL_MODULES.filter(
  (module) => module.availability === "live",
);

export const ROADMAP_MODULE_COUNT = ALL_MODULES.length - LIVE_MODULES.length;

/** Departments listed as a single line under the product name. */
export const DEPARTMENT_LINE =
  "التشغيل · الحسابات · المخازن · الجودة · الأسطول · الصيانة · العملاء والموردون";

/** Principles that hold for every module, shipped now or later. */
export const SYSTEM_PRINCIPLES: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: Layers,
    title: "مصدر واحد للأرقام",
    body: "كل مؤشر يُحسب من نفس سجل الإنتاج، فلا يظهر رقمان مختلفان لنفس اليوم في شاشتين.",
  },
  {
    icon: ShieldCheck,
    title: "تحقق مزدوج قبل الحفظ",
    body: "قواعد الإدخال تمنع تعارض الكميات والقيم الشاذة على الشاشة وعلى مستوى قاعدة البيانات.",
  },
  {
    icon: Waypoints,
    title: "جاهزية للتوسع",
    body: "الوحدات القادمة (المخازن، الجودة، الأسطول، الصيانة) تُبنى فوق نفس السجل دون إعادة إدخال.",
  },
  {
    icon: Sparkles,
    title: "عربي كامل على كل شاشة",
    body: "واجهة عربية من اليمين إلى اليسار تعمل على الموبايل والتابلت ومكتب المشغّل.",
  },
];
