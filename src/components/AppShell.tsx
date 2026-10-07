import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SyncStatus } from "@/components/SyncStatus";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import AskAIAgent from "./AskAIAgent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAccess } from "@/hooks/use-access";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSeed } from "@/hooks/use-auto-seed";
import { useI18n } from "@/lib/i18n";
import { SYSTEM_MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Boxes,
  CalendarDays,
  CloudOff,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";

type NavItem = {
  to: string;
  labelKey: string;
  hint: { ar: string; en: string };
  icon: LucideIcon;
  audience: { ar: string; en: string };
};

const APP_NAV: NavItem[] = [
  {
    to: "/dashboard",
    labelKey: "nav.dashboard",
    hint: {
      ar: "الأرباح والخسائر ومؤشرات التشغيل",
      en: "Profit & loss and operating KPIs",
    },
    icon: LayoutDashboard,
    audience: { ar: "الإدارة والمالك", en: "Management & owner" },
  },
  {
    to: "/production",
    labelKey: "nav.production",
    hint: { ar: "إدخال ومراجعة بيانات اليوم", en: "Enter and review daily data" },
    icon: Factory,
    audience: { ar: "فريق التشغيل", en: "Operations team" },
  },
  {
    to: "/quality",
    labelKey: "nav.quality",
    hint: { ar: "مكعبات الخرسانة واختبارات الركود", en: "Concrete cubes and slump tests" },
    icon: FlaskConical,
    audience: { ar: "الجودة والمراجع", en: "Quality & reviewer" },
  },
  {
    to: "/inventory",
    labelKey: "nav.inventory",
    hint: { ar: "أرصدة الأسمنت والركام وحركتها", en: "Cement and aggregate balances" },
    icon: Boxes,
    audience: { ar: "المخازن والتشغيل", en: "Stores & operations" },
  },
  {
    to: "/forecast",
    labelKey: "nav.forecast",
    hint: { ar: "توقع الطلب وخطة الصيانة الوقائية", en: "Demand forecast and maintenance plan" },
    icon: TrendingUp,
    audience: { ar: "التخطيط والصيانة", en: "Planning & maintenance" },
  },
  {
    to: "/alerts",
    labelKey: "nav.alerts",
    hint: { ar: "تنبيه تلقائي عند تجاوز أي حد", en: "Automatic alerts on threshold breach" },
    icon: BellRing,
    audience: { ar: "الإدارة والمالك", en: "Management & owner" },
  },
  {
    to: "/import",
    labelKey: "nav.import",
    hint: { ar: "رفع ملف Excel وتحديث الكلاود فورًا", en: "Upload Excel and sync the cloud instantly" },
    icon: FileUp,
    audience: { ar: "المشغّل والمراجع", en: "Operator & reviewer" },
  },
  {
    to: "/sync",
    labelKey: "nav.sync",
    hint: {
      ar: "طابور التغييرات وقاعدة البيانات المحلية والمزامنة",
      en: "Offline queue, local database and sync",
    },
    icon: CloudOff,
    audience: { ar: "المشغّل والمدير", en: "Operator & manager" },
  },
  {
    to: "/settings",
    labelKey: "nav.settings",
    hint: { ar: "الفروع وأسعار الخلطات المعتمدة", en: "Branches and approved mix prices" },
    icon: Settings2,
    audience: { ar: "المالك والمدير", en: "Owner & manager" },
  },
  {
    to: "/excel-pack",
    labelKey: "nav.excelPack",
    hint: {
      ar: "نموذج البيانات و Power Query و DAX ولوحات القيادة",
      en: "Data model, Power Query, DAX and dashboards",
    },
    icon: FileSpreadsheet,
    audience: { ar: "الإدارة والتقارير", en: "Management & reporting" },
  },
  {
    to: "/team",
    labelKey: "nav.team",
    hint: { ar: "من يرى ماذا ومن يعدّل ماذا", en: "Who sees and edits what" },
    icon: ShieldCheck,
    audience: { ar: "المالك والمدير", en: "Owner & manager" },
  },
  {
    to: "/audit",
    labelKey: "nav.audit",
    hint: { ar: "كل عملية بالقيم قبل وبعد", en: "Every action with before/after values" },
    icon: ScrollText,
    audience: { ar: "المالك والمراجع", en: "Owner & reviewer" },
  },
];

function AvatarBadge({ name, email }: { name?: string; email?: string }) {
  const initials = (name?.trim() || email?.trim() || "؟")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <Avatar className="size-8 border border-border/70">
      <AvatarFallback className="bg-secondary text-[11px] font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const access = useAccess();
  const { t, pick } = useI18n();
  const navigate = useNavigate();

  const displayName =
    user?.name?.trim() || (user?.email ? user.email.split("@")[0] : pick("عضو الفريق", "Team member"));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-full pe-2 ps-1 sm:pe-3"
          aria-label={t("shell.user.account")}
        >
          <AvatarBadge name={user?.name ?? undefined} email={user?.email ?? undefined} />
          <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user?.email ?? t("shell.guest")}
          </span>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <ShieldCheck className="size-3" />
            {t("shell.role")}: {access.isReady ? access.label : t("shell.determining")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/team")} className="cursor-pointer">
          <Users className="size-4" />
          {t("nav.team")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
          <Settings2 className="size-4" />
          {t("nav.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/audit")} className="cursor-pointer">
          <ScrollText className="size-4" />
          {t("nav.audit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          {t("shell.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t, pick, isRTL } = useI18n();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  return (
    <nav className="flex flex-col gap-1">
      {APP_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )
          }
        >
          <item.icon className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="block text-sm font-medium">{t(item.labelKey)}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {pick(item.audience.ar, item.audience.en)}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
              {pick(item.hint.ar, item.hint.en)}
              <Arrow className="ms-1 inline size-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Compact department map: shows the whole system scope from the sidebar. */
function ModuleNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t, pick } = useI18n();
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      {SYSTEM_MODULES.map((group) => {
        const liveCount = group.modules.filter(
          (module) => module.availability === "live",
        ).length;
        return (
          <NavLink
            key={group.id}
            to="/system"
            onClick={onNavigate}
            title={group.summary}
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <group.icon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{group.name}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                liveCount > 0
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {liveCount > 0
                ? `${liveCount} ${t("nav.available")}`
                : t("nav.soon")}
            </span>
          </NavLink>
        );
      })}
      <NavLink
        to="/system"
        onClick={onNavigate}
        className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-dashed border-sidebar-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        {t("nav.systemMap")}
        {pick("\u2190", "\u2192")}
      </NavLink>
      <p className="px-3 pt-2 text-[10px] leading-4 text-muted-foreground/70">
        {pick(
          "أسماء القطاعات معروضة بالعربية كما هي معرّفة في دليل النظام.",
          "Module names stay in Arabic as defined in the system registry.",
        )}
      </p>
    </div>
  );
}

function ScopeNote() {
  const { t } = useI18n();
  return (
    <div className="m-3 rounded-xl border border-sidebar-border bg-background/70 p-3">
      <p className="text-[11px] font-semibold">{t("shell.coverage.title")}</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        {t("shell.coverage.body")}
      </p>
    </div>
  );
}

export function AppShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  /** Small label above the page title, e.g. «إدخال ومراجعة البيانات». */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, isRTL, lang } = useI18n();
  // Fills the demo estate on the very first visit so no screen looks empty.
  useAutoSeed();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar (start side = right in RTL) */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <NavLink to="/dashboard">
            <BrandLockup subtitle={t("app.tagline")} />
          </NavLink>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 text-[11px] font-medium text-muted-foreground">
            {t("nav.section.operations")}
          </p>
          <NavLinks />
          <p className="mt-5 px-3 pb-2 text-[11px] font-medium text-muted-foreground">
            {t("nav.section.modules")}
          </p>
          <ModuleNav />
        </div>
        <ScopeNote />
      </aside>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur sm:px-4 lg:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={t("shell.menu")}
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={isRTL ? "right" : "left"}
              className="w-[19rem] overflow-y-auto p-0"
            >
              <SheetHeader className="border-b border-border/70 px-4 py-4 text-start">
                <SheetTitle>
                  <BrandLockup
                    markClassName="size-8"
                    subtitle={t("app.tagline")}
                  />
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
                <p className="mt-5 px-3 pb-2 text-[11px] font-medium text-muted-foreground">
                  {t("nav.section.modules")}
                </p>
                <ModuleNav onNavigate={() => setMenuOpen(false)} />
              </div>
              <ScopeNote />
            </SheetContent>
          </Sheet>

          <NavLink to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <BrandMark className="size-7" />
            <span className="text-sm font-semibold">
              IConcrete <span className="text-brand">System</span>
            </span>
          </NavLink>

          <div className="flex-1" />

          <span className="hidden items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground md:inline-flex">
            <CalendarDays className="size-3.5" />
            <span className="tabular-nums">
              {new Intl.DateTimeFormat(
                lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
                { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
              ).format(new Date())}
            </span>
          </span>
          <SyncStatus />
          <LanguageToggle />
          <UserMenu />
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              {eyebrow && (
                <p className="mb-2 text-[11px] font-semibold tracking-wide text-brand">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
          </div>

          <div className="mt-6">{children}</div>
        </main>
      </div>
      <AskAIAgent />
    </div>
  );
}
