import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { RoleMatrix } from "@/components/RoleMatrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  ALL_MODULES,
  DEPARTMENT_LINE,
  LIVE_MODULES,
  ROADMAP_MODULE_COUNT,
  SYSTEM_MODULES,
} from "@/lib/modules";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calculator,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Sparkles,
  Timer,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const AUTH_LINK = "/auth?returnTo=%2Fdashboard";

const BARS = [44, 58, 37, 72, 63, 88, 51, 77, 60, 94, 69, 83];

type Item = { icon: LucideIcon; title: string; body: string };

function SectionTitle({
  index,
  eyebrow,
  title,
  description,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="flex items-center justify-center gap-2 text-[11px] font-semibold tracking-widest text-brand">
        <span className="tabular-nums">{index}</span>
        <span className="h-px w-6 bg-brand/40" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function HeroPreview() {
  const { pick } = useI18n();
  const stats = [
    { label: pick("كمية منتجة", "Produced volume"), value: "24,180", unit: "م³" },
    { label: pick("الإيراد", "Revenue"), value: "32.4", unit: pick("مليون ج.م", "M EGP") },
    { label: pick("صافي الربح", "Net profit"), value: "+3.9", unit: pick("مليون ج.م", "M EGP") },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
      className="relative"
    >
      <div className="soft-card rounded-3xl border border-border/70 bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-wide text-muted-foreground">
              {pick("لوحة القيادة · آخر 30 يومًا", "Dashboard · last 30 days")}
            </p>
            <p className="mt-1 text-base font-semibold">
              {pick("محطة القاهرة الجديدة", "New Cairo plant")}
            </p>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-success/40 bg-success/10 text-success"
          >
            {pick("هامش 14.2٪", "14.2% margin")}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/60 bg-muted/40 p-3"
            >
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.unit}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex h-40 items-end gap-1.5" aria-hidden>
          {BARS.map((value, index) => (
            <div key={index} className="flex flex-1 items-end gap-0.5">
              <div
                className="flex-1 rounded-t bg-primary/90"
                style={{ height: `${value}%` }}
              />
              <div
                className="flex-1 rounded-t bg-brand/60"
                style={{ height: `${Math.max(18, value * 0.7)}%` }}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" />
            {pick("الإيرادات", "Revenue")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-brand/70" />
            {pick("التكاليف", "Costs")}
          </span>
          <span className="ms-auto inline-flex items-center gap-1.5 text-success">
            <Sparkles className="size-3.5" />
            {pick("صافي الربح +3.9 مليون ج.م", "Net profit +3.9M EGP")}
          </span>
        </div>
      </div>

      <div className="mt-8 text-center text-[11px] text-muted-foreground">
        {pick(
          "شكل توضيحي للواجهة — أرقام محطتك تُبنى من قيود فريقك.",
          "Illustrative UI — your plant's numbers come from your team's entries.",
        )}
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const { pick, isRTL } = useI18n();
  const liveCount = LIVE_MODULES.length;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const capabilities: Item[] = [
    {
      icon: BarChart3,
      title: pick("لوحة أرباح وخسائر واضحة", "A clear profit & loss board"),
      body: pick(
        "الإيرادات والتكاليف يوميًا مع خط صافي الربح، وتلوين تلقائي عندما تتحول المحطة إلى الخسارة.",
        "Daily revenue and cost with a net-profit line, auto-coloured when the plant turns to a loss.",
      ),
    },
    {
      icon: ClipboardList,
      title: pick("إنتاج وكميات بدقة القيد", "Production down to the entry"),
      body: pick(
        "لكل طلبية: الخلطة، العميل، الموقع، الكمية المنتجة والمسلّمة والمرتجعة، وعدد العربات.",
        "Per order: mix, customer, site, produced / delivered / returned volume, and truck count.",
      ),
    },
    {
      icon: Sparkles,
      title: pick("حساب فوري أثناء الإدخال", "Instant maths while typing"),
      body: pick(
        "الإيراد والتكلفة والربح المتوقع تظهر قبل الحفظ، فلا تنتظر نهاية الشهر لتعرف النتيجة.",
        "Expected revenue, cost and profit appear before you save — no month-end wait.",
      ),
    },
    {
      icon: Calculator,
      title: pick("تكلفة المتر وهوامشها", "Cost per m³ and margins"),
      body: pick(
        "تكلفة المتر مقابل سعر البيع لكل خلطة، ونسبة المرتجع والهدر، وأثرهما على الهامش.",
        "Cost per m³ versus selling price per mix, plus return/waste rates and their margin impact.",
      ),
    },
    {
      icon: Timer,
      title: pick("التسليم والورديات", "Delivery and shifts"),
      body: pick(
        "مقارنة الورديات، كفاءة الإنتاج، معدل استخدام العربة، ونسبة التسليم في الموعد المتفق عليه.",
        "Shift comparison, production efficiency, truck utilisation and on-time delivery rate.",
      ),
    },
    {
      icon: LayoutDashboard,
      title: pick("ملخص يومي وتصدير فوري", "Daily summary and instant export"),
      body: pick(
        "جدول يومي بإجمالي الكميات والأرباح، وتصدير CSV و Excel يفتح مباشرة بترميز عربي سليم.",
        "A daily table of volumes and profit, plus CSV and Excel export that opens with correct Arabic.",
      ),
    },
  ];

  const audience: Array<Item & { points: string[] }> = [
    {
      icon: ClipboardList,
      title: pick("فريق الإدخال والتشغيل", "Data entry & operations"),
      body: pick(
        "تسجيل بيانات اليوم من الموبايل أو مكتب المشغّل في دقائق.",
        "Capture the day's data from a phone or the operator desk in minutes.",
      ),
      points: pick(
        "تعبئة تلقائية للسعر وعدد العربات والكمية المرتجعة||تحقق فوري يمنع تعارض الكميات قبل الحفظ||تعديل أو حذف موثّق مع بقاء أثر القيد",
        "Auto-filled price, truck count and returned volume||Instant validation blocks conflicting volumes before saving||Documented edit/delete with a full record trail",
      ).split("||"),
    },
    {
      icon: Gauge,
      title: pick("المراجعة والإشراف", "Review & supervision"),
      body: pick(
        "مراجعة قيود الوردية والتحقق من أي رقم في ثوانٍ.",
        "Review shift entries and verify any figure in seconds.",
      ),
      points: pick(
        "فلترة بالفترة والخلطة والحالة والعميل||ملخص يومي وإجماليات للفترة المختارة||تصدير ما يظهر على الشاشة كما هو إلى Excel",
        "Filter by period, mix, status and customer||Daily summary and totals for the selected window||Export exactly what is on screen to Excel",
      ).split("||"),
    },
    {
      icon: BarChart3,
      title: pick("الإدارة وصاحب العمل", "Management & owner"),
      body: pick(
        "متابعة الأرباح والخسائر لحظيًا دون انتظار تقرير نهاية الشهر.",
        "Live profit and loss with no month-end report wait.",
      ),
      points: pick(
        "صافي الربح والهامش لكل يوم وكل فترة||أعلى العملاء ربحية وأكثر الخلطات مساهمة||مقارنة تلقائية بالفترة السابقة وتنبيه عند التدهور",
        "Net profit and margin per day and period||Most profitable customers and contributing mixes||Automatic previous-period comparison and alerts on decline",
      ).split("||"),
    },
  ];

  const steps = [
    {
      title: pick("يُسجّل القيد في الوردية", "The entry is recorded on shift"),
      body: pick(
        "المشغّل يختار التاريخ والوردية والخلطة، ويُدخل الكميات — والنظام يملأ السعر والتكلفة وعدد العربات نيابة عنه.",
        "The operator picks the date, shift and mix and enters volumes — the system fills price, cost and trucks.",
      ),
    },
    {
      title: pick("تتحول البيانات إلى مؤشرات", "Data becomes KPIs"),
      body: pick(
        "كل قيد يُترجم فورًا إلى إيراد وتكلفة وهامش وكفاءة إنتاج، دون معادلات يدوية أو جداول منفصلة.",
        "Every entry turns instantly into revenue, cost, margin and efficiency — no manual formulas or side sheets.",
      ),
    },
    {
      title: pick("يقرأ المالك النتيجة", "The owner reads the result"),
      body: pick(
        "لوحة القيادة تُظهر أي وردية رابحة، وأي خلطة تفقد الهامش، وأي عميل يستحق أولوية الجدولة.",
        "The dashboard shows which shift is profitable, which mix loses margin, and which customer deserves priority.",
      ),
    },
  ];

  const principles: Item[] = [
    {
      icon: Layers,
      title: pick("مصدر واحد للأرقام", "One source of numbers"),
      body: pick(
        "كل مؤشر يُحسب من نفس سجل الإنتاج، فلا يظهر رقمان مختلفان لنفس اليوم في شاشتين.",
        "Every KPI is computed from the same ledger, so two screens never disagree on a day.",
      ),
    },
    {
      icon: ShieldCheck,
      title: pick("تحقق مزدوج قبل الحفظ", "Double validation before saving"),
      body: pick(
        "قواعد الإدخال تمنع تعارض الكميات والقيم الشاذة على الشاشة وعلى مستوى قاعدة البيانات.",
        "Entry rules block conflicting volumes and outliers on screen and at the database level.",
      ),
    },
    {
      icon: Waypoints,
      title: pick("جاهزية للتوسع", "Built to extend"),
      body: pick(
        "الوحدات القادمة (المخازن، الجودة، الأسطول، الصيانة) تُبنى فوق نفس السجل دون إعادة إدخال.",
        "Future modules (stores, quality, fleet, maintenance) build on the same ledger with no re-entry.",
      ),
    },
    {
      icon: Sparkles,
      title: pick("عربي وإنجليزي على كل شاشة", "Arabic and English on every screen"),
      body: pick(
        "واجهة كاملة تعمل من اليمين إلى اليسار وبالعكس على الموبايل والتابلت ومكتب المشغّل.",
        "A full interface that flips direction and language on phone, tablet and operator desk.",
      ),
    },
  ];

  const roles = [
    {
      name: pick("مالك", "Owner"),
      body: pick(
        "المسؤول الأول عن النظام: كل الصلاحيات بما فيها إدارة أدوار الفريق.",
        "The system owner: every capability, including managing team roles.",
      ),
    },
    {
      name: pick("مدير", "Manager"),
      body: pick(
        "إدارة التشغيل والأرقام المالية والبيانات التجريبية، دون تغيير الأدوار.",
        "Runs operations, finances and demo data, but cannot change roles.",
      ),
    },
    {
      name: pick("مراجع", "Reviewer"),
      body: pick(
        "مراجعة وتصحيح القيود واختبارات الجودة، واطلاع كامل على الأرقام المالية وسجل التتبع.",
        "Reviews and corrects entries and quality tests with full financial and audit visibility.",
      ),
    },
    {
      name: pick("مشغّل", "Operator"),
      body: pick(
        "إدخال بيانات الوردية والجودة والمخازن وتعديل قيود يومه، دون عرض الأرقام المالية أو الحذف.",
        "Enters shift, quality and stores data and edits the day's entries, with no financials or deletion.",
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/">
            <BrandLockup subtitle={null} />
          </Link>
          <nav className="ms-6 hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
            <a className="transition-colors hover:text-foreground" href="#capabilities">
              {pick("ماذا يفعل", "What it does")}
            </a>
            <a className="transition-colors hover:text-foreground" href="#audience">
              {pick("لمن", "Who it's for")}
            </a>
            <a className="transition-colors hover:text-foreground" href="#system">
              {pick("منظومة الوحدات", "Module map")}
            </a>
            <a className="transition-colors hover:text-foreground" href="#roles">
              {pick("الأدوار والصلاحيات", "Roles & access")}
            </a>
            <a className="transition-colors hover:text-foreground" href="#principles">
              {pick("مبادئ النظام", "Principles")}
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle className="hidden sm:inline-flex" />
            {!isLoading && isAuthenticated ? (
              <Button asChild>
                <Link to="/dashboard">
                  {pick("الدخول إلى لوحة القيادة", "Open the dashboard")}
                  <Arrow className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link to={AUTH_LINK}>{pick("تسجيل الدخول", "Sign in")}</Link>
                </Button>
                <Button asChild>
                  <Link to={AUTH_LINK}>{pick("ابدأ الآن", "Start now")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bp-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]" />
        <div className="pointer-events-none absolute -top-32 start-1/4 size-80 rounded-full bg-brand/20 blur-[120px]" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge
                variant="outline"
                className="gap-2 border-border/70 bg-card/80 py-1 text-[11px] font-medium"
              >
                <ShieldCheck className="size-3.5 text-brand" />
                {pick(
                  "IConcrete System · الإصدار الأول يعمل الآن",
                  "IConcrete System · first release is live",
                )}
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 text-3xl font-semibold leading-[1.25] tracking-tight sm:text-4xl lg:text-[2.75rem]"
            >
              {pick(
                "منصة لإدارة محطات الخرسانة الجاهزة",
                "A ready-mix concrete plant management platform",
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base"
            >
              {pick(
                "منصة لإدارة محطات الخرسانة الجاهزة: تسجيل الإنتاج والجودة والمخازن والأسطول ومتابعة الربحية في مكان واحد.",
                "A ready-mix concrete plant management platform: track production, quality, inventory, fleet and profitability in one place.",
              )}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link to={AUTH_LINK}>
                  {pick("إنشاء حساب والدخول", "Create an account")}
                  <Arrow className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#system">
                  <LayoutDashboard className="size-4" />
                  {pick("استعرض خريطة النظام", "Explore the system")}
                </a>
              </Button>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"
            >
              {[
                pick("دخول بأدوار محددة لكل عضو", "Role-based access for each member"),
                pick("استيراد وتصدير Excel", "Excel import and export"),
                pick("سجل تتبع لكل عملية بالقيم قبل وبعد", "Audit trail with before/after values"),
              ].map((line) => (
                <li key={line} className="inline-flex items-center gap-2">
                  <ShieldCheck className="size-4 text-success" />
                  {line}
                </li>
              ))}
            </motion.ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* System scope strip */}
      <section className="border-y border-border/60 bg-card/60">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            {
              value: String(SYSTEM_MODULES.length),
              label: pick("قطاعات تشغيلية داخل المنظومة الواحدة", "operating sectors in one platform"),
            },
            {
              value: String(liveCount),
              label: pick("وحدات تعمل فعليًا في الإصدار الأول", "modules live in the first release"),
            },
            { value: "6", label: pick("مؤشرات تُحسب تلقائيًا لكل قيد إنتاج", "KPIs computed per production entry") },
            {
              value: String(ROADMAP_MODULE_COUNT),
              label: pick("وحدة قادمة تُبنى على نفس السجل", "upcoming modules on the same ledger"),
            },
          ].map((item) => (
            <div key={item.label} className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-brand tabular-nums">
                {item.value}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionTitle
          index="01"
          eyebrow={pick("ما يعمل الآن", "Working now")}
          title={pick("الأساس الذي تبدأ منه المنظومة", "The foundation the platform starts from")}
          description={pick(
            "قيود الإنتاج اليومية تتحول إلى إيراد وتكلفة وهامش لكل وردية، بلا معادلات يدوية.",
            "Daily production entries become revenue, cost and margin per shift, without manual formulas.",
          )}
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="soft-card soft-card-hover rounded-2xl border border-border/70 bg-card p-6"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Audience */}
      <section id="audience" className="border-y border-border/60 bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle
            index="02"
            eyebrow={pick("لمن هذا النظام", "Who it's for")}
            title={pick("لكل من يمسك رقماً في المحطة", "Everyone who owns a number at the plant")}
            description={pick(
              "الفريق يُدخل ويراجع، والإدارة تقرأ النتيجة — على نفس البيانات وفي نفس اللحظة.",
              "The team enters and reviews, management reads the result — same data, same moment.",
            )}
          />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {audience.map((item) => (
              <div
                key={item.title}
                className="soft-card flex flex-col rounded-2xl border border-border/70 bg-card p-6"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-brand/15 text-brand">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.body}</p>
                <ul className="mt-4 space-y-2 border-t border-border/60 pt-4">
                  {item.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand/70" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily cycle */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionTitle
          index="03"
          eyebrow={pick("دورة العمل اليومية", "The daily cycle")}
          title={pick("من الخلاطة إلى قرار المالك في ثلاث خطوات", "From the mixer to the owner's decision in three steps")}
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="soft-card relative rounded-2xl border border-border/70 bg-card p-6"
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                {index + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Module map */}
      <section id="system" className="border-y border-border/60 bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle
            index="04"
            eyebrow={pick("منظومة الوحدات", "Module map")}
            title={pick("خريطة كاملة لمحطة الخرسانة الجاهزة", "A complete map of the ready-mix plant")}
            description={pick(
              "كل قطاع في المحطة له موضع محدد في المنظومة: قسم يعمل الآن، والباقي على خارطة مبنية على نفس السجل ونفس الصلاحيات.",
              "Every plant sector has its place: some run now, the rest sit on a roadmap built on the same ledger and roles.",
            )}
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_MODULES.map((group) => {
              const live = group.modules.filter((module) => module.availability === "live");
              return (
                <div
                  key={group.id}
                  className="soft-card flex flex-col rounded-2xl border border-border/70 bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-muted text-primary">
                      <group.icon className="size-5" />
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        live.length > 0
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {live.length > 0
                        ? pick(`${live.length} متاح الآن`, `${live.length} live now`)
                        : pick("قريبًا", "Soon")}
                    </span>
                  </div>
                  <h3 className="mt-3.5 text-sm font-semibold">{group.name}</h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                    {group.summary}
                  </p>
                  {live.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                      {live.map((module) =>
                        module.route ? (
                          <Link
                            key={module.id}
                            to={module.route}
                            className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/15"
                          >
                            {module.name}
                          </Link>
                        ) : null,
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            {DEPARTMENT_LINE}
          </p>
        </div>
      </section>

      {/* Roles & permissions */}
      <section id="roles" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionTitle
          index="05"
          eyebrow={pick("الأدوار والصلاحيات", "Roles & access")}
          title={pick("من يرى ماذا، ومن يعدّل ماذا", "Who sees what, who edits what")}
          description={pick(
            "أربعة أدوار تغطي فريق المحطة: المالك يوزّع الصلاحيات، والمدير يدير التشغيل والأرقام، والمراجع يطالع ويصحّح، والمشغّل يُدخل بيانات ورديته.",
            "Four roles cover the plant team: the owner grants access, the manager runs operations and finances, the reviewer checks and corrects, and the operator enters shift data.",
          )}
        />

        <div className="soft-card mt-12 overflow-hidden rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
          <RoleMatrix />
          <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
            {pick(
              "الصلاحيات مفروضة من قاعدة البيانات نفسها، وليست إخفاءً لأزرار: كل طلب لا يملك صاحبه صلاحيته يُرفض حتى لو أُرسل خارج الواجهة. والمشغّل لا يُدخل أسعارًا — يُسعِّر النظام قيوده من قائمة الأسعار المعتمدة للمحطة. وكل إنشاء أو تعديل أو حذف أو تغيير دور يُسجَّل في سجل التتبع باسم صاحبه ووقته وبالقيمة السابقة والجديدة لكل حقل.",
              "Permissions are enforced by the database itself, not by hiding buttons: any request without the right capability is rejected even outside the UI. Operators never type prices — the system prices their entries from the approved list. Every create, update, delete or role change is logged with author, time and before/after values.",
            )}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => (
            <div key={role.name} className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm font-semibold">{role.name}</p>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{role.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section id="principles" className="border-y border-border/60 bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle
            index="06"
            eyebrow={pick("مبادئ النظام", "System principles")}
            title={pick("قواعد ثابتة في كل وحدة", "Fixed rules in every module")}
            description={pick(
              "تُطبَّق على ما يعمل الآن، وتُلزم كل وحدة قادمة بالبناء عليها.",
              "Applied to what runs now, and binding on every upcoming module.",
            )}
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {principles.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/70 bg-background p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-brand/15 text-brand">
                  <item.icon className="size-5" />
                </span>
                <p className="mt-3.5 text-sm font-semibold">{item.title}</p>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-border/70 bg-primary px-6 py-12 text-primary-foreground sm:px-12">
          <div className="bp-grid pointer-events-none absolute inset-0 opacity-10" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {pick(
                  "ابدأ من الأساس الصحيح: أرقام دقيقة من اليوم الأول",
                  "Start on the right foundation: accurate numbers from day one",
                )}
              </h2>
              <p className="mt-3 text-sm leading-7 text-primary-foreground/80">
                {pick(
                  "أنشئ حسابك، حمّل بياناتك من ملف Excel، وستُبنى أمامك لوحة الأرباح والكميات كاملة. يمكنك أيضًا استعراض المنظومة ببيانات تجريبية قبل التشغيل الفعلي.",
                  "Create your account, upload your Excel file, and the full profit and volume board builds itself. You can also explore the platform with demo data first.",
                )}
              </p>
            </div>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="bg-background text-foreground hover:bg-background/90"
            >
              <Link to={AUTH_LINK}>
                {pick("إنشاء حساب والدخول", "Create an account")}
                <Arrow className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark className="size-8" />
            <div>
              <p className="text-sm font-semibold">
                IConcrete <span className="text-brand">System</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {pick(
                  "نظام متكامل لإدارة محطات الخرسانة الجاهزة",
                  "An integrated ready-mix plant management system",
                )}
              </p>
            </div>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {pick(
              `${ALL_MODULES.length} وحدة عبر ${SYSTEM_MODULES.length} قطاعات · الإصدار الأول: لوحة القيادة والإنتاج والكميات اليومية · ${new Date().getFullYear()}`,
              `${ALL_MODULES.length} modules across ${SYSTEM_MODULES.length} sectors · first release: dashboard and daily production · ${new Date().getFullYear()}`,
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
