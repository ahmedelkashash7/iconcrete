import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { formatFullDate, todayISO } from "@/lib/format";
import { SYSTEM_MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BellRing,
  Boxes,
  CalendarDays,
  Factory,
  FlaskConical,
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
  label: string;
  hint: string;
  icon: LucideIcon;
  audience: string;
};

const APP_NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "لوحة القيادة",
    hint: "الأرباح والخسائر ومؤشرات التشغيل",
    icon: LayoutDashboard,
    audience: "الإدارة والمالك",
  },
  {
    to: "/production",
    label: "الإنتاج والكميات",
    hint: "إدخال ومراجعة بيانات اليوم",
    icon: Factory,
    audience: "فريق التشغيل",
  },
  {
    to: "/quality",
    label: "الجودة والاختبارات",
    hint: "مكعبات الخرسانة واختبارات الركود",
    icon: FlaskConical,
    audience: "الجودة والمراجع",
  },
  {
    to: "/inventory",
    label: "المخازن والمواد",
    hint: "أرصدة الأسمنت والركام وحركتها",
    icon: Boxes,
    audience: "المخازن والتشغيل",
  },
  {
    to: "/forecast",
    label: "التنبؤ والصيانة",
    hint: "توقع الطلب وخطة الصيانة الوقائية",
    icon: TrendingUp,
    audience: "التخطيط والصيانة",
  },
  {
    to: "/alerts",
    label: "التنبيهات والحدود",
    hint: "تنبيه تلقائي عند تجاوز أي حد",
    icon: BellRing,
    audience: "الإدارة والمالك",
  },
  {
    to: "/settings",
    label: "إعدادات المحطة",
    hint: "الفروع وأسعار الخلطات المعتمدة",
    icon: Settings2,
    audience: "المالك والمدير",
  },
  {
    to: "/team",
    label: "الفريق والصلاحيات",
    hint: "من يرى ماذا ومن يعدّل ماذا",
    icon: ShieldCheck,
    audience: "المالك والمدير",
  },
  {
    to: "/audit",
    label: "سجل التتبع",
    hint: "كل عملية بالقيم قبل وبعد",
    icon: ScrollText,
    audience: "المالك والمراجع",
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
  const navigate = useNavigate();

  const displayName =
    user?.name?.trim() || (user?.email ? user.email.split("@")[0] : "عضو الفريق");

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
          aria-label="حساب المستخدم"
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
            {user?.email ?? "حساب زائر"}
          </span>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <ShieldCheck className="size-3" />
            الدور: {access.isReady ? access.label : "جارٍ التحديد…"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/team")}
          className="cursor-pointer"
        >
          <Users className="size-4" />
          الفريق والصلاحيات
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/settings")}
          className="cursor-pointer"
        >
          <Settings2 className="size-4" />
          إعدادات المحطة
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/audit")}
          className="cursor-pointer"
        >
          <ScrollText className="size-4" />
          سجل التتبع
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {item.audience}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
              {item.hint}
            </span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Compact department map: shows the whole system scope from the sidebar. */
function ModuleNav({ onNavigate }: { onNavigate?: () => void }) {
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
              {liveCount > 0 ? `${liveCount} متاح` : "قريبًا"}
            </span>
          </NavLink>
        );
      })}
      <NavLink
        to="/system"
        onClick={onNavigate}
        className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-dashed border-sidebar-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        خريطة النظام الكاملة
        <ArrowLeft className="size-3.5" />
      </NavLink>
    </div>
  );
}

function ScopeNote() {
  return (
    <div className="m-3 rounded-xl border border-sidebar-border bg-background/70 p-3">
      <p className="text-[11px] font-semibold">التغطية الحالية</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        الفروع وأسعار الخلطات والجودة والمخازن والتنبيهات والتنبؤ تعمل فوق نفس سجل
        الإنتاج، والوحدات القادمة تُبنى عليه دون إدخال مزدوج.
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar (start side = right in RTL) */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <NavLink to="/dashboard">
            <BrandLockup subtitle="نظام متكامل لمحطات الخرسانة الجاهزة" />
          </NavLink>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 text-[11px] font-medium text-muted-foreground">
            التشغيل اليومي
          </p>
          <NavLinks />
          <p className="mt-5 px-3 pb-2 text-[11px] font-medium text-muted-foreground">
            منظومة الوحدات
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
                aria-label="القائمة"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[19rem] overflow-y-auto p-0">
              <SheetHeader className="border-b border-border/70 px-4 py-4 text-start">
                <SheetTitle>
                  <BrandLockup
                    markClassName="size-8"
                    subtitle="نظام متكامل لمحطات الخرسانة الجاهزة"
                  />
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
                <p className="mt-5 px-3 pb-2 text-[11px] font-medium text-muted-foreground">
                  منظومة الوحدات
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
            <span className="tabular-nums">{formatFullDate(todayISO())}</span>
          </span>
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
    </div>
  );
}
