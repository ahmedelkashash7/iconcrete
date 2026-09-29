import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TONES = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  destructive: "bg-destructive/10 text-destructive",
} as const;

/** Compact KPI used where a trend delta is not meaningful (counts, ratios). */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "soft-card soft-card-hover rounded-2xl border border-border/70 bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-5 text-muted-foreground">{label}</p>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl",
            TONES[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{hint}</p>}
    </div>
  );
}
