import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Soft layered card used for every dashboard block: hairline border, ambient
 * shadow, generous internal padding and an optional header action.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "soft-card rounded-2xl border border-border/70 bg-card",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("px-5 pb-5 pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}
