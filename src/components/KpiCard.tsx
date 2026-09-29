import { cn } from "@/lib/utils";
import { formatPercent, formatSigned } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  /** Change against the previous window. `null` = no comparable data. */
  delta?: number | null;
  /** Percentage metrics compare in points (i.e. «+1.4 نقطة»). */
  deltaMode?: "percent" | "points";
  /** Which direction is good news — costs go down, revenue goes up. */
  goodDirection?: "up" | "down";
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  deltaMode = "percent",
  goodDirection = "up",
}: KpiCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isFlat = hasDelta && Math.abs(delta) < 0.05;
  const isGood = hasDelta
    ? (delta > 0 && goodDirection === "up") ||
      (delta < 0 && goodDirection === "down")
    : false;

  const DeltaIcon = !hasDelta ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="soft-card soft-card-hover group rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-5 text-muted-foreground">
          {label}
        </p>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="size-4" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {hasDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums",
              isFlat
                ? "bg-muted text-muted-foreground"
                : isGood
                  ? "bg-success/15 text-success"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            <DeltaIcon className="size-3" />
            {deltaMode === "points"
              ? `${formatSigned(delta)} نقطة`
              : formatPercent(Math.abs(delta))}
          </span>
        ) : (
          <span className="text-muted-foreground">لا توجد فترة مقارنة</span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
