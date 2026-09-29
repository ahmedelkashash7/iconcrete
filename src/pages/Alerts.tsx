import { AppShell } from "@/components/AppShell";
import { BranchFilter } from "@/components/BranchFilter";
import { Panel } from "@/components/Panel";
import { RoleNotice } from "@/components/RoleNotice";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/hooks/use-access";
import { useBranch } from "@/hooks/use-branch";
import {
  ALERT_CHANNEL_LABELS,
  ALERT_COMPARATOR_LABELS,
  ALERT_METRIC_DEFAULTS,
  ALERT_METRIC_LABELS,
  ALERT_METRIC_ORDER,
  ALERT_STATUS_LABELS,
  formatMetricValue,
} from "@/lib/concrete";
import type { AlertChannel, AlertComparator, AlertMetric, AlertStatus } from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import { formatFullDate, formatNumber, formatTime, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BellRing,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type RuleRow = {
  _id: Id<"alertRules">;
  name: string;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  channel: AlertChannel;
  recipients: string[];
  windowDays: number;
  branchId: string | null;
  isActive: boolean;
  lastCheckedAt: number | null;
  lastTriggeredAt: number | null;
  lastValue: number | null;
  currentValue: number | null;
  breaching: boolean;
};

type RuleForm = {
  name: string;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: string;
  channel: AlertChannel;
  recipients: string;
  windowDays: string;
  isActive: boolean;
};

const emptyRule: RuleForm = {
  name: "",
  metric: "marginPct",
  comparator: "lt",
  threshold: "8",
  channel: "email",
  recipients: "",
  windowDays: "30",
  isActive: true,
};

function RuleDialog({
  open,
  onOpenChange,
  rule,
  defaultRecipients,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: RuleRow | null;
  defaultRecipients: string[];
}) {
  const create = useMutation(api.alerts.createRule);
  const update = useMutation(api.alerts.updateRule);
  const [saving, setSaving] = useState(false);
  // Seeded once per mount; the parent mounts a fresh dialog for each record.
  const [form, setForm] = useState<RuleForm>(() =>
    rule
      ? {
          name: rule.name,
          metric: rule.metric,
          comparator: rule.comparator,
          threshold: String(rule.threshold),
          channel: rule.channel,
          recipients: rule.recipients.join(", "),
          windowDays: String(rule.windowDays),
          isActive: rule.isActive,
        }
      : { ...emptyRule, recipients: defaultRecipients.join(", ") },
  );

  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const applyMetric = (metric: AlertMetric) => {
    const defaults = ALERT_METRIC_DEFAULTS[metric];
    setForm((prev) => ({
      ...prev,
      metric,
      comparator: defaults.comparator,
      threshold: String(defaults.threshold),
      windowDays: String(defaults.windowDays),
    }));
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        metric: form.metric,
        comparator: form.comparator,
        threshold: Number(form.threshold) || 0,
        channel: form.channel,
        recipients: form.recipients
          .split(/[,;\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
        windowDays: Number(form.windowDays) || 1,
        isActive: form.isActive,
      };
      if (rule) {
        await update({ id: rule._id, ...payload });
        toast.success("تم تحديث قاعدة التنبيه");
      } else {
        await create(payload);
        toast.success("تمت إضافة قاعدة التنبيه");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(readError(error, "تعذر حفظ قاعدة التنبيه"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-start">
          <DialogTitle>{rule ? "تعديل قاعدة تنبيه" : "قاعدة تنبيه جديدة"}</DialogTitle>
          <DialogDescription>
            يُقاس المؤشر من نفس سجل الإنتاج خلال المدة المحددة، ويُرسل التنبيه عند
            تجاوز الحد مرة واحدة في اليوم.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">اسم القاعدة</Label>
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="هامش ربح منخفض"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">المؤشر</Label>
            <Select
              value={form.metric}
              onValueChange={(value) => applyMetric(value as AlertMetric)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALERT_METRIC_ORDER.map((metric) => (
                  <SelectItem key={metric} value={metric}>
                    {ALERT_METRIC_LABELS[metric]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">المقارنة</Label>
            <Select
              value={form.comparator}
              onValueChange={(value) => set("comparator", value as AlertComparator)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lt">أقل من</SelectItem>
                <SelectItem value="gt">أعلى من</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الحد</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.threshold}
              onChange={(event) => set("threshold", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">مدة القياس (يوم)</Label>
            <Input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.windowDays}
              onChange={(event) => set("windowDays", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">قناة الإرسال</Label>
            <Select
              value={form.channel}
              onValueChange={(value) => set("channel", value as AlertChannel)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">بريد إلكتروني</SelectItem>
                <SelectItem value="sms">رسالة نصية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">
              المستلمون (بريد أو رقم جوال، مفصولة بفاصلة)
            </Label>
            <Input
              value={form.recipients}
              onChange={(event) => set("recipients", event.target.value)}
              placeholder="owner@company.com, +201000000000"
            />
            <p className="text-[11px] text-muted-foreground">
              كل عنوان بريد يُرسل عبر قناة البريد، وكل رقم يبدأ بـ + يُرسل كرسالة نصية.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 sm:col-span-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(value) => set("isActive", value)}
            />
            <span className="text-xs text-muted-foreground">
              {form.isActive ? "القاعدة مفعّلة في الفحص اليومي" : "القاعدة موقوفة"}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Alerts() {
  const access = useAccess();
  const { branches, branchId, setBranchId } = useBranch();
  const settings = useQuery(api.settings.get);
  const [dialog, setDialog] = useState<{ open: boolean; rule: RuleRow | null }>({
    open: false,
    rule: null,
  });
  const [running, setRunning] = useState(false);
  const today = useMemo(() => todayISO(), []);
  const data = useQuery(api.alerts.list, { branchId, today });
  const toggleRule = useMutation(api.alerts.toggleRule);
  const removeRule = useMutation(api.alerts.removeRule);
  const runCheck = useAction(api.alerts.runCheck);

  const canManage = access.can("manageAlerts");
  const rules = (data?.rules ?? []) as RuleRow[];

  const defaultRecipients = useMemo(() => {
    const values: string[] = [];
    if (settings?.plant.alertEmail) values.push(settings.plant.alertEmail);
    if (settings?.plant.alertPhone) values.push(settings.plant.alertPhone);
    return values;
  }, [settings]);

  const handleToggle = async (rule: RuleRow, isActive: boolean) => {
    try {
      await toggleRule({ id: rule._id, isActive });
      toast.success(isActive ? "تم تفعيل القاعدة" : "تم إيقاف القاعدة");
    } catch (error) {
      toast.error(readError(error, "تعذر تغيير حالة القاعدة"));
    }
  };

  const handleDelete = async (rule: RuleRow) => {
    try {
      await removeRule({ id: rule._id });
      toast.success(`تم حذف «${rule.name}»`);
    } catch (error) {
      toast.error(readError(error, "تعذر حذف القاعدة"));
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runCheck({ today });
      toast.success(
        result.fired > 0
          ? `تم فحص ${formatNumber(result.checked)} قاعدة — ${formatNumber(
              result.fired,
            )} تنبيه جديد، ${formatNumber(result.dispatched)} محاولة إرسال`
          : `تم فحص ${formatNumber(result.checked)} قاعدة — لا توجد حدود متجاوزة`,
      );
    } catch (error) {
      toast.error(readError(error, "تعذر تشغيل الفحص"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell
      eyebrow="التنبيهات الذكية"
      title="حدود المحطة والتنبيهات التلقائية"
      description="قواعد تُقاس من سجل الإنتاج نفسه: هامش ربح، تأخير تسليم، نتائج جودة، نقص مخزون، صيانة متأخرة — وتُرسل بالبريد أو الرسائل عند تجاوز الحد."
      actions={
        <>
          <BranchFilter branches={branches} value={branchId} onChange={setBranchId} />
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={handleRun} disabled={running}>
                {running ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                تشغيل الفحص الآن
              </Button>
              <Button size="sm" onClick={() => setDialog({ open: true, rule: null })}>
                <Plus className="size-4" />
                قاعدة جديدة
              </Button>
            </>
          )}
        </>
      }
    >
      {!access.isReady || data === undefined ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="قواعد التنبيه"
              value={formatNumber(data.totals.rules)}
              hint={`${formatNumber(data.totals.active)} قاعدة مفعّلة في الفحص اليومي`}
              icon={BellRing}
              tone="primary"
            />
            <StatTile
              label="حدود متجاوزة الآن"
              value={formatNumber(data.totals.breaching)}
              hint={
                data.totals.breaching > 0
                  ? "تحتاج قرارًا تشغيليًا اليوم"
                  : "كل المؤشرات داخل الحدود المحددة"
              }
              icon={TriangleAlert}
              tone={data.totals.breaching > 0 ? "destructive" : "success"}
            />
            <StatTile
              label="تنبيهات أُرسلت"
              value={formatNumber(data.totals.sent)}
              hint={
                data.deliveryConfigured
                  ? "تم الإرسال عبر قناة الإشعارات"
                  : "الإرسال غير مفعّل بعد — تُسجَّل كتجريبية"
              }
              icon={Mail}
              tone={data.deliveryConfigured ? "success" : "warning"}
            />
            <StatTile
              label="تنبيهات تجريبية"
              value={formatNumber(data.totals.simulated)}
              hint={`${formatNumber(data.totals.failed)} محاولة إرسال فاشلة`}
              icon={ScrollText}
              tone={data.totals.failed > 0 ? "destructive" : "default"}
            />
          </div>

          {!data.deliveryConfigured && (
            <Panel
              title="تشغيل الإرسال الفعلي"
              description="المنظومة تعمل بالكامل الآن وتُسجَّل كل تنبيهاتها، لكن الإرسال الفعلي يحتاج مفتاح قناة الإشعارات."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 lg:col-span-2">
                  <p className="text-xs font-semibold">ما الذي يحدث حاليًا؟</p>
                  <p className="mt-1.5 text-[11px] leading-6 text-muted-foreground">
                    الفحص اليومي يعمل تلقائيًا في الساعة ٧ صباحًا: تُقاس كل القواعد،
                    وتُسجَّل الحدود المتجاوزة في الجدول أدناه بحالتها ومستلميها. ولحظة
                    إضافة مفتاح الإرسال، تتحول كل قواعدك الحالية إلى إرسال فعلي دون أي
                    تعديل.
                  </p>
                  <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                    أضف المفتاح باسم{" "}
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
                      KNOCK_API_KEY
                    </code>{" "}
                    من تبويب المفاتيح، واتركه سرًّا في بيئة Convex. يمكنك أيضًا ضبط{" "}
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
                      KNOCK_ALERT_WORKFLOW
                    </code>{" "}
                    لاسم قالب الرسالة.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  <ShieldCheck className="size-4 text-brand" />
                  <p className="mt-2 text-xs font-semibold">مسؤولية واضحة</p>
                  <p className="mt-1.5 text-[11px] leading-6 text-muted-foreground">
                    لا يُحذف أي تنبيه بعد إرساله: يبقى في السجل مع قيمته والحد الذي
                    تجاوزه ومن استلمه، وهو ما يعتمد عليه المراجع الخارجي.
                  </p>
                </div>
              </div>
            </Panel>
          )}

          <Panel
            title="قواعد التنبيه"
            description="القيمة الحالية تُقاس لحظيًا من سجل الإنتاج، ويُقارَن بها الحد لتعرف حالة كل قاعدة قبل أن تُرسل."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleRun}
                disabled={running || !canManage}
              >
                {running ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                تحديث القياس
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>القاعدة</TableHead>
                    <TableHead>المؤشر</TableHead>
                    <TableHead>الشرط</TableHead>
                    <TableHead className="text-end">القيمة الحالية</TableHead>
                    <TableHead className="text-end">الحد</TableHead>
                    <TableHead>القناة</TableHead>
                    <TableHead>المستلمون</TableHead>
                    <TableHead>الحالة</TableHead>
                    {canManage && <TableHead className="text-end">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule._id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ALERT_METRIC_LABELS[rule.metric]}
                        <span className="ms-1">({rule.windowDays} يومًا)</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {ALERT_COMPARATOR_LABELS[rule.comparator]}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-end tabular-nums font-medium",
                          rule.breaching && "text-destructive",
                        )}
                      >
                        {rule.currentValue === null
                          ? "—"
                          : formatMetricValue(rule.metric, rule.currentValue)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">
                        {formatMetricValue(rule.metric, rule.threshold)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          {rule.channel === "email" ? (
                            <Mail className="size-3.5" />
                          ) : (
                            <MessageSquare className="size-3.5" />
                          )}
                          {ALERT_CHANNEL_LABELS[rule.channel]}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate text-[11px] text-muted-foreground">
                        {rule.recipients.length > 0
                          ? rule.recipients.join(" · ")
                          : "لا يوجد مستلمون"}
                      </TableCell>
                      <TableCell>
                        {rule.breaching ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 bg-destructive/10 text-destructive"
                          >
                            متجاوزة
                          </Badge>
                        ) : rule.isActive ? (
                          <Badge
                            variant="outline"
                            className="border-success/40 bg-success/10 text-success"
                          >
                            داخل الحد
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            موقوفة
                          </Badge>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={(value) => handleToggle(rule, value)}
                              aria-label="تفعيل القاعدة"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="تعديل"
                              onClick={() => setDialog({ open: true, rule })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="حذف"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(rule)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 9 : 8}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        لا توجد قواعد تنبيه بعد — أضف أول قاعدة لمتابعة هامش الربح.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Panel>

          {!canManage && (
            <RoleNotice
              icon={Lock}
              title="عرض فقط"
              message="إنشاء قواعد التنبيه وتعديل حدودها متاح للمالك والمدير."
            />
          )}

          <Panel
            title="سجل التنبيهات"
            description={`آخر ${formatNumber(data.events.length)} تنبيه، مع القيمة التي تجاوزت الحد وحالة الإرسال.`}
          >
            {data.events.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                لم يتم تسجيل أي تنبيه حتى الآن — هذا يعني أن المؤشرات داخل الحدود
                المحددة.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.events.map((event) => (
                  <li
                    key={event._id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {event.ruleName}
                        <Badge
                          variant="outline"
                          className={
                            event.status === "sent"
                              ? "border-success/40 bg-success/10 text-success"
                              : event.status === "failed"
                                ? "border-destructive/40 bg-destructive/10 text-destructive"
                                : "border-border bg-muted text-muted-foreground"
                          }
                        >
                          {ALERT_STATUS_LABELS[event.status as AlertStatus]}
                        </Badge>
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {event.message}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatFullDate(event.date)} · {formatTime(event.firedAt)}
                        {event.recipients.length > 0
                          ? ` · ${event.recipients.join(" · ")}`
                          : " · بدون مستلمين"}
                      </p>
                      {event.error && (
                        <p className="mt-1 text-[11px] text-destructive">{event.error}</p>
                      )}
                    </div>
                    <div className="text-end">
                      <p className="text-[11px] text-muted-foreground">
                        {ALERT_METRIC_LABELS[event.metric as AlertMetric]}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatMetricValue(event.metric as AlertMetric, event.value)}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        الحد {formatMetricValue(event.metric as AlertMetric, event.threshold)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {dialog.open && (
        <RuleDialog
          open
          onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
          rule={dialog.rule}
          defaultRecipients={defaultRecipients}
        />
      )}
    </AppShell>
  );
}
