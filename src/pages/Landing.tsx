import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  ALL_MODULES,
  DEPARTMENT_LINE,
  LIVE_MODULES,
  ROADMAP_MODULE_COUNT,
  SYSTEM_MODULES,
  SYSTEM_PRINCIPLES,
} from "@/lib/modules";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const AUTH_LINK = "/auth?returnTo=%2Fdashboard";

const BARS = [44, 58, 37, 72, 63, 88, 51, 77, 60, 94, 69, 83];

const HERO_STATS = [
  { label: "كمية منتجة", value: "24,180", unit: "م³" },
  { label: "الإيراد", value: "32.4", unit: "مليون ج.م" },
  { label: "صافي الربح", value: "+3.9", unit: "مليون ج.م" },
];

const CAPABILITIES: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: BarChart3,
    title: "لوحة أرباح وخسائر واضحة",
    body: "الإيرادات والتكاليف يوميًا مع خط صافي الربح، وتلوين تلقائي عندما تتحول المحطة إلى الخسارة.",
  },
  {
    icon: ClipboardList,
    title: "إنتاج وكميات بدقة القيد",
    body: "لكل طلبية: الخلطة، العميل، الموقع، الكمية المنتجة والمسلّمة والمرتجعة، وعدد العربات.",
  },
  {
    icon: Sparkles,
    title: "حساب فوري أثناء الإدخال",
    body: "الإيراد والتكلفة والربح المتوقع تظهر قبل الحفظ، فلا تنتظر نهاية الشهر لتعرف النتيجة.",
  },
  {
    icon: Calculator,
    title: "تكلفة المتر وهوامشها",
    body: "تكلفة المتر مقابل سعر البيع لكل خلطة، ونسبة المرتجع والهدر، وأثرهما على الهامش.",
  },
  {
    icon: Timer,
    title: "التسليم والورديات",
    body: "مقارنة الورديات، كفاءة الإنتاج، معدل استخدام العربة، ونسبة التسليم في الموعد المتفق عليه.",
  },
  {
    icon: LayoutDashboard,
    title: "ملخص يومي وتصدير فوري",
    body: "جدول يومي بإجمالي الكميات والأرباح، وتصدير CSV يفتح مباشرة في Excel بترميز عربي سليم.",
  },
];

const AUDIENCE: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
}> = [
  {
    icon: ClipboardList,
    title: "فريق الإدخال والتشغيل",
    body: "تسجيل بيانات اليوم من الموبايل أو مكتب المشغّل في دقائق.",
    points: [
      "تعبئة تلقائية للسعر وعدد العربات والكمية المرتجعة",
      "تحقق فوري يمنع تعارض الكميات قبل الحفظ",
      "تعديل أو حذف موثّق مع بقاء أثر القيد",
    ],
  },
  {
    icon: Gauge,
    title: "المراجعة والإشراف",
    body: "مراجعة قيود الوردية والتحقق من أي رقم في ثوانٍ.",
    points: [
      "فلترة بالفترة والخلطة والحالة والعميل",
      "ملخص يومي وإجماليات للفترة المختارة",
      "تصدير ما يظهر على الشاشة كما هو إلى Excel",
    ],
  },
  {
    icon: BarChart3,
    title: "الإدارة وصاحب العمل",
    body: "متابعة الأرباح والخسائر لحظيًا دون انتظار تقرير نهاية الشهر.",
    points: [
      "صافي الربح والهامش لكل يوم وكل فترة",
      "أعلى العملاء ربحية وأكثر الخلطات مساهمة",
      "مقارنة تلقائية بالفترة السابقة وتنبيه عند التدهور",
    ],
  },
];

const STEPS = [
  {
    title: "يُسجّل القيد في الوردية",
    body: "المشغّل يختار التاريخ والوردية والخلطة، ويُدخل الكميات — والنظام يملأ السعر والتكلفة وعدد العربات نيابة عنه.",
  },
  {
    title: "تتحول البيانات إلى مؤشرات",
    body: "كل قيد يُترجم فورًا إلى إيراد وتكلفة وهامش وكفاءة إنتاج، دون معادلات يدوية أو جداول منفصلة.",
  },
  {
    title: "يقرأ المالك النتيجة",
    body: "لوحة القيادة تُظهر أي وردية رابحة، وأي خلطة تفقد الهامش، وأي عميل يستحق أولوية الجدولة.",
  },
];

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
              لوحة القيادة · آخر 30 يومًا
            </p>
            <p className="mt-1 text-base font-semibold">محطة القاهرة الجديدة</p>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 border-success/40 bg-success/10 text-success"
          >
            هامش 14.2٪
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {HERO_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/60 bg-muted/40 p-3"
            >
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {stat.value}
              </p>
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
            الإيرادات
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-brand/70" />
            التكاليف
          </span>
          <span className="ms-auto inline-flex items-center gap-1.5 text-success">
            <Sparkles className="size-3.5" />
            صافي الربح +3.9 مليون ج.م
          </span>
        </div>
      </div>

      <div className="mt-8 text-center text-[11px] text-muted-foreground">
        شكل توضيحي للواجهة — أرقام محطتك تُبنى من قيود فريقك.
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const liveCount = LIVE_MODULES.length;

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
              ماذا يفعل
            </a>
            <a className="transition-colors hover:text-foreground" href="#audience">
              لمن
            </a>
            <a className="transition-colors hover:text-foreground" href="#system">
              منظومة الوحدات
            </a>
            <a className="transition-colors hover:text-foreground" href="#principles">
              مبادئ النظام
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button asChild>
                <Link to="/dashboard">
                  الدخول إلى لوحة القيادة
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link to={AUTH_LINK}>تسجيل الدخول</Link>
                </Button>
                <Button asChild>
                  <Link to={AUTH_LINK}>ابدأ الآن</Link>
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
                IConcrete System · الإصدار الأول يعمل الآن
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 text-3xl font-semibold leading-[1.25] tracking-tight sm:text-4xl lg:text-[2.75rem]"
            >
              نظام واحد يدير محطة الخرسانة الجاهزة
              <span className="text-brand"> من الألف إلى الياء</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base"
            >
              IConcrete System يجمع التشغيل والإنتاج، الحسابات والهوامش، المخازن
              والمواد، الجودة والاختبارات، الأسطول والتوزيع، والصيانة والوقود في
              منظومة واحدة مترابطة. ويبدأ من الأساس الذي لا يُبنى نظام بدونه:
              قيود إنتاج وكميات يومية دقيقة تتحول لحظيًا إلى إيراد وتكلفة وصافي
              ربح وهامش — يسجّلها فريق المحطة، ويراها صاحب العمل في اللحظة نفسها.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link to={AUTH_LINK}>
                  إنشاء حساب والدخول
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#system">
                  <LayoutDashboard className="size-4" />
                  استعرض خريطة النظام
                </a>
              </Button>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"
            >
              <li className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                دخول آمن لجميع أعضاء الفريق
              </li>
              <li className="inline-flex items-center gap-2">
                <Gauge className="size-4 text-success" />
                تحقق مزدوج يمنع أخطاء الإدخال
              </li>
              <li className="inline-flex items-center gap-2">
                <Sparkles className="size-4 text-success" />
                عربي بالكامل على الموبايل والمكتب
              </li>
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
              label: "قطاعات تشغيلية داخل المنظومة الواحدة",
            },
            {
              value: String(liveCount),
              label: "وحدات تعمل فعليًا في الإصدار الأول",
            },
            { value: "6", label: "مؤشرات تُحسب تلقائيًا لكل قيد إنتاج" },
            {
              value: String(ROADMAP_MODULE_COUNT),
              label: "وحدة قادمة تُبنى على نفس السجل",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-brand tabular-nums">
                {item.value}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities of the first release */}
      <section
        id="capabilities"
        className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20"
      >
        <SectionTitle
          index="01"
          eyebrow="ما يعمل الآن"
          title="الأساس الذي تبدأ منه المنظومة"
          description="الإصدار الأول يثبّت دقة الأرقام اليومية: إدخال واحد يتحول إلى مؤشرات قابلة للقرار، بلا معادلات يدوية ولا جداول متراكمة."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((item, index) => (
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
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {item.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Audience */}
      <section id="audience" className="border-y border-border/60 bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle
            index="02"
            eyebrow="لمن هذا النظام"
            title="لكل من يمسك رقماً في المحطة"
            description="الفريق يُدخل ويراجع، والإدارة تقرأ النتيجة — على نفس البيانات وفي نفس اللحظة."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {AUDIENCE.map((item) => (
              <div
                key={item.title}
                className="soft-card flex flex-col rounded-2xl border border-border/70 bg-card p-6"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-brand/15 text-brand">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {item.body}
                </p>
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
          eyebrow="دورة العمل اليومية"
          title="من الخلاطة إلى قرار المالك في ثلاث خطوات"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="soft-card relative rounded-2xl border border-border/70 bg-card p-6"
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                {index + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Module map */}
      <section id="system" className="border-y border-border/60 bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle
            index="04"
            eyebrow="منظومة الوحدات"
            title="خريطة كاملة لمحطة الخرسانة الجاهزة"
            description="كل قطاع في المحطة له موضع محدد في المنظومة: قسم يعمل الآن، والباقي على خارطة مبنية على نفس السجل ونفس الصلاحيات."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_MODULES.map((group) => {
              const live = group.modules.filter(
                (module) => module.availability === "live",
              );
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
                        ? `${live.length} متاح الآن`
                        : "قريبًا"}
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

      {/* Principles */}
      <section id="principles" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionTitle
          index="05"
          eyebrow="مبادئ النظام"
          title="قواعد ثابتة في كل وحدة"
          description="تُطبَّق على ما يعمل الآن، وتُلزم كل وحدة قادمة بالبناء عليها."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {SYSTEM_PRINCIPLES.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border/70 bg-card p-5"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand/15 text-brand">
                <item.icon className="size-5" />
              </span>
              <p className="mt-3.5 text-sm font-semibold">{item.title}</p>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-border/70 bg-primary px-6 py-12 text-primary-foreground sm:px-12">
          <div className="bp-grid pointer-events-none absolute inset-0 opacity-10" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                ابدأ من الأساس الصحيح: أرقام دقيقة من اليوم الأول
              </h2>
              <p className="mt-3 text-sm leading-7 text-primary-foreground/80">
                أنشئ حسابك، سجّل قيد إنتاج واحد، وستُبنى أمامك لوحة الأرباح
                والكميات كاملة. يمكنك أيضًا استعراض المنظومة ببيانات تجريبية قبل
                التشغيل الفعلي.
              </p>
            </div>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="bg-background text-foreground hover:bg-background/90"
            >
              <Link to={AUTH_LINK}>
                إنشاء حساب والدخول
                <ArrowLeft className="size-4" />
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
                نظام متكامل لإدارة محطات الخرسانة الجاهزة
              </p>
            </div>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {ALL_MODULES.length} وحدة عبر {SYSTEM_MODULES.length} قطاعات · الإصدار
            الأول: لوحة القيادة والإنتاج والكميات اليومية ·{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
