import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shown in place of anything the current role may not see or do. */
export function RoleNotice({
  title,
  message,
  hint,
  icon: Icon = ShieldAlert,
  action,
  className,
}: {
  title: string;
  message: string;
  hint?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-muted-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {message}
          </p>
          {hint && (
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground/80">
              {hint}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
