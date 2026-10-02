import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Arabic ⇄ English switch. Renders a compact two-state pill so the operator can
 * flip the whole interface (and its text direction) with one tap.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, isRTL } = useI18n();

  return (
    <div
      role="group"
      aria-label={isRTL ? "تغيير اللغة" : "Switch language"}
      className={cn(
        "inline-flex items-center rounded-full border border-border/70 bg-card p-0.5",
        className,
      )}
    >
      <Languages className="mx-1.5 size-3.5 text-muted-foreground" />
      {(["ar", "en"] as const).map((code) => (
        <Button
          key={code}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            "h-7 rounded-full px-2.5 text-[11px] font-semibold",
            lang === code
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code === "ar" ? "AR" : "EN"}
        </Button>
      ))}
    </div>
  );
}
