import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { getLocalDb } from "@/lib/offline/db";
import { MIRRORED_TABLES } from "@/lib/offline/schema";
import { pendingOperations } from "@/lib/offline/syncService";
import type { QueueRow } from "@/lib/offline/syncService";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import {
  CloudOff,
  Database,
  HardDriveDownload,
  History,
  Layers,
  ListChecks,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type MirrorCount = {
  name: string;
  label: string;
  rows: number;
  /** True when the plant asked for the table but Convex has no match yet. */
  localOnly: boolean;
};

/**
 * مرکز المزامنة — the operator's window into the offline database: what is
 * stored locally, what is still waiting to reach the cloud, and the button that
 * flushes everything at the end of the day.
 */
export default function SyncCenter() {
  const { pick, lang } = useI18n();
  const { online, cloudReachable, pending, lastSync, syncing, engine, runSync } = useOfflineSync();
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [mirror, setMirror] = useState<MirrorCount[]>([]);

  const loadLocal = useCallback(async () => {
    const db = getLocalDb();
    await db.ready();
    setQueue(await pendingOperations());
    const counts: MirrorCount[] = [];
    for (const table of MIRRORED_TABLES) {
      const rows = await db.all(table.name);
      counts.push({
        name: table.name,
        label: table.label,
        rows: rows.length,
        localOnly: table.localOnly === true,
      });
    }
    setMirror(counts);
  }, []);

  // The page is a live view of the local queue, so it subscribes to it: one
  // immediate tick, then a light poll while the screen stays open.
  useEffect(() => {
    const tick = () => void loadLocal();
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 5_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [loadLocal]);

  const handleSync = async () => {
    try {
      const report = await runSync();
      if (!report) return;
      if (report.failed > 0) toast.warning(report.message);
      else toast.success(report.message);
      await loadLocal();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : pick("تعذرت المزامنة", "Sync failed"),
      );
    }
  };

  const connected = online && cloudReachable;
  const storedRows = mirror.reduce((total, entry) => total + entry.rows, 0);
  const timestamp = (value: number) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  return (
    <AppShell
      eyebrow={pick("العمل دون إنترنت", "Working without internet")}
      title={pick("مركز المزامنة", "Sync centre")}
      description={pick(
        "كل إدخال يُحفظ أولًا في قاعدة البيانات المحلية (SQLite على نسخة الديسكتوب) ثم يُرسل إلى الكلاود. اضغط «مزامنة آخر اليوم» في نهاية الوردية لرفع كل التغييرات المعلّقة وتنزيل أحدث بيانات الكلاود، مع حسم أي تعارض لصالح النسخة الأحدث وتسجيله في سجل التتبع.",
        "Every entry is stored locally first (SQLite in the desktop build) and then sent to the cloud. Press «Sync End of Day» at the end of the shift to push all queued changes and pull the latest cloud data, resolving any conflict in favour of the newest copy and recording it in the audit trail.",
      )}
      actions={
        <Button onClick={handleSync} disabled={syncing || !online} className="gap-2">
          <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
          {pick("مزامنة آخر اليوم", "Sync End of Day")}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={connected ? Wifi : CloudOff}
          label={pick("حالة الاتصال", "Connection")}
          value={connected ? pick("متصل", "Online") : pick("غير متصل", "Offline")}
          hint={
            connected
              ? pick("الكتابة تُرسل للكلاود فورًا", "Writes reach the cloud immediately")
              : pick("الكتابة تُحفظ محليًا في الطابور", "Writes are stored locally in the queue")
          }
          tone={connected ? "success" : "danger"}
        />
        <Tile
          icon={Database}
          label={pick("محرّك التخزين المحلي", "Local engine")}
          value={engine === "sqlite" ? "SQLite" : pick("ذاكرة المتصفح", "Browser memory")}
          hint={
            engine === "sqlite"
              ? pick("ملف iconcrete.db على الجهاز", "iconcrete.db on this machine")
              : pick("يعمل داخل المتصفح — نسخة الديسكتوب تستخدم SQLite", "Runs in the browser — the desktop build uses SQLite")
          }
          tone="brand"
        />
        <Tile
          icon={ListChecks}
          label={pick("تغييرات في الطابور", "Queued changes")}
          value={formatNumber(pending)}
          hint={
            pending === 0
              ? pick("كل شيء وصل إلى الكلاود", "Everything reached the cloud")
              : pick("ستُرفع بضغطة المزامنة", "Will be pushed by the sync button")
          }
          tone={pending === 0 ? "success" : "warning"}
        />
        <Tile
          icon={History}
          label={pick("آخر مزامنة", "Last sync")}
          value={lastSync ? timestamp(lastSync) : pick("لم تتم بعد", "Not yet")}
          hint={pick("يشمل الرفع والتنزيل معًا", "Covers both push and pull")}
          tone="neutral"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2 overflow-hidden"
          title={pick("التغييرات المنتظرة", "Pending changes")}
          description={pick(
            "كل سطر هنا محفوظ بأمان على الجهاز، ويُرسل إلى Convex بضغطة واحدة.",
            "Every row here is safely stored on this machine and is sent to Convex in one click.",
          )}
          bodyClassName="px-0 pb-0 pt-2"
        >
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="grid size-11 place-items-center rounded-2xl bg-success/15 text-success">
                <HardDriveDownload className="size-5" />
              </span>
              <p className="text-sm font-medium">
                {pick("لا يوجد شيء في الطابور", "Nothing in the queue")}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {pick(
                  "أي إدخال جديد يُسجَّل هنا مباشرة إذا كان الجهاز غير متصل بالإنترنت.",
                  "Any new entry appears here the moment the machine goes offline.",
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-5">{pick("الجدول", "Table")}</TableHead>
                    <TableHead>{pick("العملية", "Action")}</TableHead>
                    <TableHead>{pick("الوقت", "Time")}</TableHead>
                    <TableHead className="pe-5">{pick("الحالة", "Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.slice(0, 25).map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className="ps-5 font-medium">
                        {MIRRORED_TABLES.find((table) => table.name === row.tableName)?.label ??
                          row.tableName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {{ create: pick("إضافة", "Create"), update: pick("تعديل", "Update"), delete: pick("حذف", "Delete") }[row.action]}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {timestamp(row.createdAt)}
                      </TableCell>
                      <TableCell className="pe-5">
                        {row.status === "failed" ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 bg-destructive/10 text-destructive"
                          >
                            {row.lastError ?? pick("فشل — ستُعاد المحاولة", "Failed — will retry")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-warning/40 bg-warning/10 text-warning"
                          >
                            {pick("منتظر", "Pending")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        <Panel
          title={pick("قاعدة البيانات المحلية", "Local database")}
          description={pick(
            "عدد السطور المحفوظة على الجهاز لكل قسم.",
            "Rows stored on this machine per section.",
          )}
        >
          <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="size-3.5" />
            {pick(
              `${formatNumber(storedRows)} سطرًا محليًا في ${formatNumber(mirror.filter((entry) => entry.rows > 0).length)} جدولًا`,
              `${formatNumber(storedRows)} local rows across ${formatNumber(mirror.filter((entry) => entry.rows > 0).length)} tables`,
            )}
          </p>
          <p className="mb-3 rounded-lg bg-muted/50 p-2 text-[11px] leading-4 text-muted-foreground">
            {pick(
              "الجداول المعلّمة «محلي فقط» محفوظة على الجهاز ولا يوجد لها جدول مقابل في Convex بعد؛ أوراق Excel الخاصة بها تُحسب من سجل الإنتاج نفسه.",
              "Tables marked «local only» are stored on the device and have no Convex counterpart yet; their Excel sheets are computed from the production ledger itself.",
            )}
          </p>
          <ul className="space-y-1.5">
            {mirror.map((entry) => (
              <li
                key={entry.name}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs odd:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="truncate">{entry.label}</span>
                  {entry.localOnly && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {pick("محلي فقط", "local only")}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(entry.rows)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title={pick("كيف تعمل المزامنة", "How the sync works")}
        description={pick(
          "نفس القواعد تُطبَّق على الويب وعلى نسخة الديسكتوب، وكلاهما يشارك نفس قاعدة بيانات Convex.",
          "The same rules apply to the web and desktop builds, and both share the same Convex backend.",
        )}
      >
        <ol className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
          <Step
            index="١"
            title={pick("اكتب محليًا أولًا", "Write locally first")}
            body={pick(
              "كل إضافة أو تعديل أو حذف يُحفظ في قاعدة البيانات المحلية ثم يُضاف إلى طابور المزامنة.",
              "Every create, update or delete is stored locally and added to the sync queue.",
            )}
          />
          <Step
            index="٢"
            title={pick("متصل؟ يُرسل فورًا", "Online? Send immediately")}
            body={pick(
              "إذا كان الاتصال متاحًا يُرسل التغيير إلى Convex في نفس اللحظة ويُعلَّم كمُزامَن.",
              "If the connection is up, the change is sent to Convex right away and marked synced.",
            )}
          />
          <Step
            index="٣"
            title={pick("غير متصل؟ ينتظر", "Offline? It waits")}
            body={pick(
              "يبقى التغيير في الطابور بحالة «منتظر» حتى تعود الشبكة ويعمل زر المزامنة.",
              "The change stays queued as pending until the network returns and the sync button runs.",
            )}
          />
          <Step
            index="٤"
            title={pick("الأحدث يفوز", "Last write wins")}
            body={pick(
              "عند تعارض النسختين تُحفظ الأحدث زمنيًا، ويُسجَّل التعارض في سجل التتبع.",
              "When the two copies disagree the newest wins, and the conflict is written to the audit trail.",
            )}
          />
        </ol>
      </Panel>
    </AppShell>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Wifi;
  label: string;
  value: string;
  hint: string;
  tone: "success" | "danger" | "warning" | "brand" | "neutral";
}) {
  const tones = {
    success: "bg-success/15 text-success",
    danger: "bg-destructive/15 text-destructive",
    warning: "bg-warning/15 text-warning",
    brand: "bg-brand/15 text-brand",
    neutral: "bg-muted text-muted-foreground",
  } as const;

  return (
    <div className="soft-card rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-lg", tones[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}

function Step({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <li className="rounded-xl border border-border/70 bg-background/60 p-3">
      <span className="mb-1.5 inline-grid size-6 place-items-center rounded-lg bg-brand/15 text-[11px] font-semibold text-brand">
        {index}
      </span>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-1 leading-5">{body}</p>
    </li>
  );
}
