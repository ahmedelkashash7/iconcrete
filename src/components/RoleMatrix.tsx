import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_ORDER,
} from "@/convex/permissions";
import type { PlantRole } from "@/convex/permissions";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

/** «من يرى ماذا ويملك تعديله» — the plant permission matrix. */
export function RoleMatrix({
  className,
  highlightRole,
}: {
  className?: string;
  highlightRole?: PlantRole | null;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-start text-xs">
        <thead>
          <tr>
            <th className="w-64 border-b border-border/70 px-3 py-3 text-start font-medium text-muted-foreground">
              الصلاحية
            </th>
            {ROLE_ORDER.map((role) => (
              <th
                key={role}
                className={cn(
                  "border-b border-border/70 px-3 py-3 text-center font-semibold",
                  highlightRole === role && "bg-primary/5 text-primary",
                )}
              >
                <span className="block">{ROLE_LABELS[role]}</span>
                <span className="mt-1 block text-[10px] font-normal leading-4 text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAPABILITIES.map((capability) => (
            <tr key={capability}>
              <td className="border-b border-border/60 px-3 py-2.5 leading-5">
                {CAPABILITY_LABELS[capability]}
              </td>
              {ROLE_ORDER.map((role) => {
                const allowed = ROLE_CAPABILITIES[role].includes(capability);
                return (
                  <td
                    key={role}
                    className={cn(
                      "border-b border-border/60 px-3 py-2.5 text-center",
                      highlightRole === role && "bg-primary/5",
                    )}
                  >
                    {allowed ? (
                      <Check className="mx-auto size-4 text-success" />
                    ) : (
                      <Minus className="mx-auto size-4 text-muted-foreground/40" />
                    )}
                    <span className="sr-only">
                      {allowed ? "مسموح" : "غير مسموح"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
