import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ALL_MODULES,
  DEPARTMENT_LINE,
  LIVE_MODULES,
  ROADMAP_MODULE_COUNT,
  SYSTEM_MODULES,
  SYSTEM_PRINCIPLES,
} from "@/lib/modules";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export default function SystemMap() {
  const liveCount = LIVE_MODULES.length;

  return (
    <AppShell
      eyebrow="منظومة الوحدات"
      title="خريطة نظام IConcrete"
      description={`${DEPARTMENT_LINE} — في منظومة واحدة. الإصدار الأول يغطّي الأساس فعليًا، وكل وحدة قادمة لها موضعها المحدد في هذه الخريطة.`}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              لوحة القيادة
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild>
            <Link to="/production">
              الإنتاج والكميات
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="soft-card rounded-2xl border border-border/70 bg-card p-5">
          <p className="text-xs text-muted-foreground">إجمالي وحدات النظام</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {ALL_MODULES.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            موزّعة على {SYSTEM_MODULES.length} قطاعًا تشغيليًا
          </p>
        </div>
        <div className="soft-card rounded-2xl border border-border/70 bg-card p-5">
          <p className="text-xs text-muted-foreground">تعمل الآن</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-success">
            {liveCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            لوحة القيادة والإنتاج والكميات اليومية
          </p>
        </div>
        <div className="soft-card rounded-2xl border border-border/70 bg-card p-5">
          <p className="text-xs text-muted-foreground">على خارطة الطريق</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {ROADMAP_MODULE_COUNT}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            تُبنى على نفس السجل ونفس الصلاحيات
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {SYSTEM_MODULES.map((group) => {
          const live = group.modules.filter((m) => m.availability === "live");
          return (
            <Panel
              key={group.id}
              title={group.name}
              description={group.summary}
              action={
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5",
                    live.length > 0
                      ? "border-success/40 bg-success/10 text-success"
                      : "text-muted-foreground",
                  )}
                >
                  <group.icon className="size-3" />
                  {live.length > 0 ? `${live.length} متاح الآن` : "قريبًا"}
                </Badge>
              }
            >
              <ul className="space-y-2">
                {group.modules.map((module) => {
                  const isLive = module.availability === "live";
                  const content = (
                    <>
                      <span
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl",
                          isLive
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <module.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {module.name}
                          </span>
                          {isLive && (
                            <span className="shrink-0 text-[10px] font-medium text-success">
                              متاح الآن
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">
                          {module.purpose}
                        </span>
                      </span>
                      {isLive && module.route && (
                        <ArrowLeft className="mt-2 size-4 shrink-0 text-muted-foreground" />
                      )}
                    </>
                  );

                  return (
                    <li key={module.id}>
                      {isLive && module.route ? (
                        <Link
                          to={module.route}
                          className="soft-card-hover flex items-start gap-3 rounded-xl border border-border/70 bg-background/60 p-3"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border/80 p-3">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })}
      </div>

      <Panel
        className="mt-4"
        title="الأساس الذي بُني عليه الإصدار الأول"
        description="مبادئ ثابتة في كل وحدة، سواء كانت جاهزة الآن أو قادمة."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SYSTEM_PRINCIPLES.map((item) => (
            <div key={item.title} className="rounded-xl bg-muted/50 p-4">
              <span className="grid size-9 place-items-center rounded-xl bg-background text-primary">
                <item.icon className="size-4" />
              </span>
              <p className="mt-3 text-sm font-medium">{item.title}</p>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
