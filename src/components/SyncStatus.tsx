import { Button } from "@/components/ui/button";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

/** «متصل / غير متصل» + وقت آخر مزامنة + عدّاد التغييرات المنتظرة. */
function StatusPill() {
  const { pick, lang } = useI18n();
  const { online, cloudReachable, pending, lastSync, engine } = useOfflineSync();

  const connected = online && cloudReachable;
  const label = connected
    ? pick("متصل", "Online")
    : pick("غير متصل", "Offline");

  const lastSyncLabel = lastSync
    ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      }).format(new Date(lastSync))
    : pick("لم تتم مزامنة بعد", "Never synced");

  return (
    <span
      className={cn(
        "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] sm:inline-flex",
        connected
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
      title={`${engine === "sqlite" ? "SQLite" : "Memory"} · ${lastSyncLabel}`}
    >
      {connected ? <Wifi className="size-3.5" /> : <CloudOff className="size-3.5" />}
      <span className="font-semibold">{label}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        {pick("آخر مزامنة", "Last sync")}: <span className="tabular-nums">{lastSyncLabel}</span>
      </span>
      {pending > 0 && (
        <span className="rounded-full bg-warning/20 px-1.5 py-0.5 font-semibold text-warning tabular-nums">
          {pending} {pick("منتظرة", "queued")}
        </span>
      )}
    </span>
  );
}

/**
 * The two things the operator needs at all times: whether the machine is online,
 * and one button that pushes everything queued and pulls the latest cloud state.
 */
export function SyncStatus() {
  const { pick } = useI18n();
  const { online, cloudReachable, pending, syncing, runSync } = useOfflineSync();
  const [busy, setBusy] = useState(false);

  const disabled = syncing || busy || !online;

  const handleSync = async () => {
    setBusy(true);
    try {
      const report = await runSync();
      if (!report) return;
      if (report.failed > 0) toast.warning(report.message);
      else toast.success(report.message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : pick("تعذر إتمام المزامنة", "Sync could not complete"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <StatusPill />
      <span
        className={cn(
          "inline-flex size-2.5 shrink-0 rounded-full sm:hidden",
          online && cloudReachable ? "bg-success" : "bg-destructive",
        )}
        title={online && cloudReachable ? pick("متصل", "Online") : pick("غير متصل", "Offline")}
      />
      <Button
        size="sm"
        variant={pending > 0 ? "default" : "outline"}
        onClick={handleSync}
        disabled={disabled}
        className="gap-2"
        title={pick(
          "ترفع كل التغييرات المحلية وتنزّل أحدث بيانات الكلاود",
          "Push every local change and pull the latest cloud data",
        )}
      >
        <RefreshCw className={cn("size-4", (syncing || busy) && "animate-spin")} />
        <span className="hidden md:inline">
          {pick("مزامنة آخر اليوم", "Sync End of Day")}
        </span>
      </Button>
    </div>
  );
}
