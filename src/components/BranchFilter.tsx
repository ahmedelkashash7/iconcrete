import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";
import type { BranchOption } from "@/hooks/use-branch";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

const ALL = "__all__";

/**
 * Branch switcher. Selecting «كل الفروع» leaves the branch filter open, which
 * is how the owner reads the consolidated group numbers.
 */
export function BranchFilter({
  branches,
  value,
  onChange,
  className,
}: {
  branches: BranchOption[];
  value: Id<"branches"> | undefined;
  onChange: (value: Id<"branches"> | null) => void;
  className?: string;
}) {
  const disabled = branches.length === 0;

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? null : (next as Id<"branches">))}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn("min-w-[11rem] gap-2", className)}
        aria-label="اختيار الفرع"
      >
        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="كل الفروع" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>كل الفروع (مجمّع)</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch._id} value={branch._id}>
            <span className="flex items-center gap-2">
              <span className="font-medium">{branch.name}</span>
              <span className="text-[11px] text-muted-foreground">{branch.code}</span>
              {!branch.isActive && (
                <span className="text-[11px] text-muted-foreground">(موقوف)</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
