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
import { useAuth } from "@/hooks/use-auth";
import { formatFullDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarDays, Factory, LayoutDashboard, LogOut, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";

type NavItem = {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
};

const APP_NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "لوحة القيادة",
    hint: "الأرباح والخسائر ومؤشرات التشغيل",
    icon: LayoutDashboard,
  },
  {
    to: "/production",
    label: "الإنتاج اليومي",
    hint: "قيود الإنتاج والكميات لكل وردية",
    icon: Factory,
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user?.email ?? "حساب زائر"}
          </span>
        </DropdownMenuLabel>
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
          <span className="min-w-0">
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
              {item.hint}
            </span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

function ScopeNote() {
  return (
    <div className="m-3 rounded-xl border border-sidebar-border bg-background/70 p-3">
      <p className="text-[11px] font-semibold">الإصدار الأول</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        لوحة الإنتاج والكميات اليومية مع مؤشرات الأرباح والخسائر. طبقات IoT،
        تعدد الفروع والتكاملات المحاسبية تأتي في الإصدارات التالية.
      </p>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
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
          <BrandLockup />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 text-[11px] font-medium text-muted-foreground">
            التشغيل
          </p>
          <NavLinks />
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
            <SheetContent side="right" className="w-[19rem] p-0">
              <SheetHeader className="border-b border-border/70 px-4 py-4 text-start">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  <BrandMark className="size-8" />
                  IConcrete
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
              </div>
              <ScopeNote />
            </SheetContent>
          </Sheet>

          <NavLink to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <BrandMark className="size-7" />
            <span className="text-sm font-semibold">IConcrete</span>
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
