import { cn } from "@/lib/utils";
import { useId } from "react";

/** Concrete block mark: graphite cube with an amber face. */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = `ic-brand-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label="IConcrete"
      className={cn("size-9 shrink-0", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#414d5e" />
          <stop offset="1" stopColor="#1b222c" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="22" fill={`url(#${gradientId})`} />
      <path d="M48 22 76 38 48 54 20 38Z" fill="#ffffff" />
      <path d="M20 38 48 54v22L20 60Z" fill="#ffffff" fillOpacity="0.72" />
      <path d="M76 38 48 54v22l28-16Z" fill="#e9a13f" />
    </svg>
  );
}

export function BrandLockup({
  className,
  markClassName,
  subtitle = "نظام متكامل لإدارة محطات الخرسانة الجاهزة",
}: {
  className?: string;
  markClassName?: string;
  subtitle?: string | null;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={markClassName} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight">
          IConcrete <span className="text-brand">System</span>
        </p>
        {subtitle && (
          <p className="truncate text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
