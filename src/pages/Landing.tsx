import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  Gauge,
  Radio,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const AUTH_LINK = "/auth?returnTo=%2Fdashboard";

const BARS = [44, 58, 37, 72, 63, 88, 51, 77, 60, 94, 69, 83];

const HERO_STATS = [
  { label: "كمية منتجة", value: "24,180", unit: "م³" },
  { label: "الإيراد", value: "32.4", unit: "مليون ج.م" },
  { label: "صافي الربح", value: "+3.9", unit: "مليون ج.م" },
];

const HIGHLIGHTS = [
  {
    icon: BarChart3,
    title: "لوحة أرباح وخسائر واضحة",
    body: "الإيرادات والتكاليف يوميًا مع خط صافي الربح، وتلوين تلقائي عند تحوّل المحطة إلى الخسارة.",
  },
  {
    icon: ClipboardList,
    title: "قيود إنتاج وكميات دقيقة",
    body: "لكل طلبية: الخلطة، العميل، الموقع، الكمية المنتجة والمسلّمة والمرتجعة، وعدد العربات.",
  },
  {
    icon: Sparkles,
    title: "حساب فوري أثناء الإدخال",
    body: "الإيراد والتكلفة والربح المتوقع تظهر قبل الحفظ، فلا تنتظر نهاية الشهر لتعرف النتيجة.",
  },
  {
    icon: Gauge,
    title: "توزيع الخلطات والعملاء",
    body: "نسب كل خلطة وربحية أعلى العملاء، لتعرف أين يتحقق الهامش فعلًا وأين يُفقد.",
  },
  {
    icon: Timer,
    title: "أداء الورديات والتسليم",
    body: "مقارنة الورديات، كفاءة الإنتاج، معدل استخدام العربة، ونسبة التسليم في الموعد المتفق عليه.",
  },
  {
    icon: FileSpreadsheet,
    title: "ملخص يومي وتصدير فوري",
    body: "جدول يومي بإجمالي الكميات والأرباح، وتصدير CSV يفتح مباشرة في Excel بترميز عربي صحيح.",
  },
];

const STEPS = [
  {
    title: "سجّل قيد الإنتاج",
    body: "اختر التاريخ والوردية ونوع الخلطة، وأدخل الكميات — يملأ النظام السعر والمرتجع وعدد العربات نيابة عنك.",
  },
  {
    title: "تتحول البيانات إلى مؤشرات",
    body: "كل قيد يُترجم فورًا إلى إيراد وتكلفة وهامش ونسب كفاءة، دون أي معادلات يدوية أو جداول منفصلة.",
  },
  {
    title: "راجع اللوحة وقرّر",
    body: "افتح لوحة القيادة صباحًا: أي وردية رابحة، أي خلطة تخسر، وأي عميل يستحق أولوية الجدولة.",
  },
];

const ROADMAP = [
  { icon: Radio, label: "تتبّع GPS وحساسات IoT للعربات والخلاطات" },
  { icon: Factory, label: "تعدد الفروع مع لوحة موحّدة للإدارة المركزية" },
  { icon: BarChart3, label: "ربط محاسبي مع QuickBooks و Oracle و SAP" },
  { icon: Users, label: "تنبيهات البريد والرسائل وإشعارات الموبايل الحرجة" },
];

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-wide text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
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
            <p className="text-xs text-muted-foreground">أداء آخر 30 يومًا</p>
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

      <div className="soft-card absolute -bottom-5 -start-4 hidden items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 sm:flex">
        <span className="grid size-9 place-items-center rounded-xl bg-success/15 text-success">
          <Truck className="size-4" />
        </span>
        <div>
          <p className="text-[11px] text-muted-foreground">مسلّم اليوم</p>
          <p className="text-sm font-semibold tabular-nums">842 م³</p>
        </div>
      </div>

      <div className="mt-8 text-center text-[11px] text-muted-foreground">
        شكل توضيحي للواجهة — الأرقام الحقيقية تُبنى من قيود محطتك.
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/">
            <BrandLockup />
          </Link>
          <nav className="ms-6 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a className="transition-colors hover:text-foreground" href="#features">
              المزايا
            </a>
            <a className="transition-colors hover:text-foreground" href="#how">
              كيف يعمل
            </a>
            <a className="transition-colors hover:text-foreground" href="#roadmap">
              خارطة الطريق
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
                <Button variant="ghost" asChild>
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
        <div className="pointer-events-none absolute -top-32 start-1/4 size-72 rounded-full bg-brand/20 blur-[110px]" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
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
                <Factory className="size-3.5 text-brand" />
                الإصدار الأول · لوحة الإنتاج والكميات اليومية
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 text-3xl font-semibold leading-[1.25] tracking-tight sm:text-4xl lg:text-5xl"
            >
              اعرف أرباح محطة الخرسانة
              <span className="text-brand"> يوميًا</span>… من شاشة واحدة
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base"
            >
              IConcrete يجمع قيود الإنتاج من كل وردية ويحوّلها فورًا إلى كميات
              مسلّمة، إيراد، تكلفة، صافي ربح وهامش — مع كفاءة الإنتاج ونسبة
              التسليم في الموعد. كل فريق المحطة يعمل على نفس الأرقام.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link to={AUTH_LINK}>
                  تسجيل الدخول وبدء التسجيل
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">
                  <BarChart3 className="size-4" />
                  استعرض المزايا
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
                دخول محمي لكل أعضاء الفريق
              </li>
              <li className="inline-flex items-center gap-2">
                <CalendarCheck className="size-4 text-success" />
                واجهة عربية كاملة تعمل على الموبايل
              </li>
              <li className="inline-flex items-center gap-2">
                <Sparkles className="size-4 text-success" />
                بدون تثبيت أي برنامج إضافي
              </li>
            </motion.ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* Highlights strip */}
      <section className="border-y border-border/60 bg-card/60">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            { value: "6", label: "مؤشرات أداء محسوبة تلقائيًا لكل قيد" },
            { value: "3", label: "ورديات تشغيل تُقارَن لحظيًا" },
            { value: "90", label: "يومًا من السجل والاتجاهات" },
            { value: "CSV", label: "تصدير فوري يفتح في Excel" },
          ].map((item) => (
            <div key={item.label} className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-brand">
                {item.value}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionTitle
          eyebrow="ما يوجد داخل الإصدار الأول"
          title="كل ما تحتاجه لقراءة يوم المحطة في دقيقة"
          description="لا جداول متراكمة ولا معادلات يدوية: إدخال واحد يحوّل كل رقم إلى مؤشر قابل للقرار."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((item, index) => (
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

      {/* How it works */}
      <section id="how" className="border-y border-border/60 bg-card/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle
            eyebrow="دورة العمل اليومية"
            title="ثلاث خطوات من الخلاطة إلى القرار"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border/70 bg-card p-6"
              >
                <span className="grid size-9 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand-foreground dark:text-brand">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="soft-card rounded-3xl border border-border/70 bg-card p-6 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand">
                على خارطة الطريق
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                الطبقات المتقدمة قادمة بعد تثبيت الأساس
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                هذا الإصدار يركّز على صدق الأرقام اليومية. الطبقات التالية تُبنى
                فوق نفس السجل حتى لا يُعاد إدخال أي بيانات مرتين.
              </p>
            </div>
            <Badge variant="outline" className="border-border/70 text-[11px]">
              خارج نطاق الإصدار الأول
            </Badge>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {ROADMAP.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-muted-foreground">
                  <item.icon className="size-4" />
                </span>
                <p className="text-xs leading-6 text-muted-foreground">
                  {item.label}
                </p>
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
                جاهز ترى أرقام محطتك بلا انتظار؟
              </h2>
              <p className="mt-3 text-sm leading-7 text-primary-foreground/80">
                سجّل الدخول بحسابك، أضف أول قيد إنتاج، وسترى لوحة الأرباح
                والكميات مكتملة خلال دقائق — ويمكنك استعراض اللوحة ببيانات
                تجريبية فورًا.
              </p>
            </div>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="bg-background text-foreground hover:bg-background/90"
            >
              <Link to={AUTH_LINK}>
                ابدأ الآن
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
              <p className="text-sm font-semibold">IConcrete</p>
              <p className="text-[11px] text-muted-foreground">
                نظام إدارة محطات الخرسانة الجاهزة
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            الإصدار الأول — لوحة الإنتاج والكميات اليومية ·{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
