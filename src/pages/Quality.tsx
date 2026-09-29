import { AppShell } from "@/components/AppShell";
import { BranchFilter } from "@/components/BranchFilter";
import { Panel } from "@/components/Panel";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/hooks/use-access";
import { useBranch } from "@/hooks/use-branch";
import { downloadCsv } from "@/lib/csv";
import {
  DEFAULT_SLUMP_TOLERANCE_MM,
  QUALITY_KIND_LABELS,
  QUALITY_KIND_ORDER,
  QUALITY_KIND_SHORT,
  QUALITY_RESULT_LABELS,
  QUALITY_UNITS,
  evaluateQualityPreview,
  testTargetValue,
} from "@/lib/concrete";
import type { QualityKind, QualityResult } from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import { formatDay, formatDayWithWeekday, formatNumber, formatPercent, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FlaskConical,
  Gauge,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

const RANGES = [
  { days: 30, label: "30 يومًا" },
  { days: 90, label: "90 يومًا" },
  { days: 180, label: "180 يومًا" },
];

const cubeConfig = {
  avgActual: { label: "المقاومة الفعلية", color: "var(--chart-2)" },
  avgTarget: { label: "المقاومة المطلوبة", color: "var(--chart-1)" },
} satisfies ChartConfig;

const RESULT_TONE: Record<QualityResult, string> = {
  pass: "border-success/40 bg-success/10 text-success",
  fail: "border-destructive/40 bg-destructive/10 text-destructive",
  pending: "border-border bg-muted text-muted-foreground",
};

type TestRow = {
  _id: Id<"qualityTests">;
  date: string;
  kind: QualityKind;
  mixDesign: string;
  customer: string;
  site?: string;
  orderRef?: string;
  sampleRef?: string;
  labName?: string;
  targetValue: number;
  tolerance?: number;
  actualValue: number;
  result: QualityResult;
  testedBy?: string;
  notes?: string;
};

type TestForm = {
  date: string;
  kind: QualityKind;
  mixDesign: string;
  customer: string;
  site: string;
  orderRef: string;
  sampleRef: string;
  labName: string;
  targetValue: string;
  tolerance: string;
  actualValue: string;
  testedBy: string;
  notes: string;
};

function TestDialog({
  open,
  onOpenChange,
  test,
  mixNames,
  branchId,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test?: TestRow | null;
  mixNames: string[];
  branchId: Id<"branches"> | undefined;
  defaults: { customer: string; site: string };
}) {
  const create = useMutation(api.quality.create);
  const update = useMutation(api.quality.update);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TestForm>(() => ({
    date: todayISO(),
    kind: "cube28",
    mixDesign: mixNames[0] ?? "C30/37",
    customer: defaults.customer,
    site: defaults.site,
    orderRef: "",
    sampleRef: "",
    labName: "معمل المحطة",
    targetValue: "",
    tolerance: String(DEFAULT_SLUMP_TOLERANCE_MM),
    actualValue: "",
    testedBy: "",
    notes: "",
  }));
  // Re-seed the form whenever the dialog opens on a different record.
  useEffect(() => {
    if (!open) return;
    setForm(
        test
          ? {
              date: test.date,
              kind: test.kind,
              mixDesign: test.mixDesign,
              customer: test.customer,
              site: test.site ?? "",
              orderRef: test.orderRef ?? "",
              sampleRef: test.sampleRef ?? "",
              labName: test.labName ?? "",
              targetValue: String(test.targetValue),
              tolerance: String(test.tolerance ?? DEFAULT_SLUMP_TOLERANCE_MM),
              actualValue: String(test.actualValue),
              testedBy: test.testedBy ?? "",
              notes: test.notes ?? "",
            }
          : {
              date: todayISO(),
              kind: "cube28",
              mixDesign: mixNames[0] ?? "C30/37",
              customer: defaults.customer,
              site: defaults.site,
              orderRef: "",
              sampleRef: "",
              labName: "معمل المحطة",
              targetValue: "",
              tolerance: String(DEFAULT_SLUMP_TOLERANCE_MM),
              actualValue: "",
              testedBy: "",
              notes: "",
            },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, test]);

  const set = <K extends keyof TestForm>(key: K, value: TestForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const target =
    form.targetValue && Number(form.targetValue) > 0
      ? Number(form.targetValue)
      : testTargetValue(form.kind, form.mixDesign);
  const tolerance = Number(form.tolerance) || DEFAULT_SLUMP_TOLERANCE_MM;
  const actual = Number(form.actualValue) || 0;
  const preview = evaluateQualityPreview(form.kind, target, tolerance, actual);
  const unit = QUALITY_UNITS[form.kind];

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        branchId,
        date: form.date,
        kind: form.kind,
        mixDesign: form.mixDesign.trim(),
        customer: form.customer.trim(),
        site: form.site.trim() || undefined,
        orderRef: form.orderRef.trim() || undefined,
        sampleRef: form.sampleRef.trim() || undefined,
        labName: form.labName.trim() || undefined,
        targetValue: form.targetValue ? Number(form.targetValue) : undefined,
        tolerance: form.kind === "slump" ? tolerance : undefined,
        actualValue: actual,
        testedBy: form.testedBy.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (test) {
        await update({ id: test._id, ...payload });
        toast.success("تم تحديث اختبار الجودة");
      } else {
        await create(payload);
        toast.success("تم تسجيل اختبار الجودة");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(readError(error, "تعذر حفظ اختبار الجودة"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-start">
          <DialogTitle>
            {test ? "تعديل اختبار جودة" : "تسجيل اختبار جودة"}
          </DialogTitle>
          <DialogDescription>
            النتيجة تُحسب على الخادم من المقاومة المميزة للخلطة، فلا يمكن تسجيل اختبار
            ناجح تحت الحد المطلوب.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">نوع الاختبار</Label>
            <Select
              value={form.kind}
              onValueChange={(value) => set("kind", value as QualityKind)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_KIND_ORDER.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {QUALITY_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">تاريخ الاختبار</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(event) => set("date", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">نوع الخلطة</Label>
            <Input
              list="quality-mixes"
              value={form.mixDesign}
              onChange={(event) => set("mixDesign", event.target.value)}
              placeholder="C30/37"
            />
            <datalist id="quality-mixes">
              {mixNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">العميل / المشروع</Label>
            <Input
              value={form.customer}
              onChange={(event) => set("customer", event.target.value)}
              placeholder="اسم الشركة"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الموقع</Label>
            <Input
              value={form.site}
              onChange={(event) => set("site", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">رقم الطلبية</Label>
            <Input
              value={form.orderRef}
              onChange={(event) => set("orderRef", event.target.value)}
              placeholder="IC-260929-01"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">رقم العينة</Label>
            <Input
              value={form.sampleRef}
              onChange={(event) => set("sampleRef", event.target.value)}
              placeholder="QT-260929-001"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">المعمل</Label>
            <Input
              value={form.labName}
              onChange={(event) => set("labName", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              القيمة المطلوبة ({unit})
            </Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.targetValue}
              onChange={(event) => set("targetValue", event.target.value)}
              placeholder={String(target)}
            />
            <p className="text-[11px] text-muted-foreground">
              تلقائيًا من الخلطة: {formatNumber(target, 1)} {unit}
            </p>
          </div>
          {form.kind === "slump" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">السماحية (مم)</Label>
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                value={form.tolerance}
                onChange={(event) => set("tolerance", event.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">القراءة الفعلية ({unit})</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.actualValue}
              onChange={(event) => set("actualValue", event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الفاحص</Label>
            <Input
              value={form.testedBy}
              onChange={(event) => set("testedBy", event.target.value)}
              placeholder="اسم فني الجودة"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">ملاحظات</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="أي ملاحظة على العينة أو الصبّة"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
          <div>
            <p className="text-[11px] text-muted-foreground">النتيجة المتوقعة</p>
            <p className="mt-1 text-sm font-semibold">
              {QUALITY_RESULT_LABELS[preview]}
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] text-muted-foreground">النسبة إلى المطلوب</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {target > 0 ? formatPercent((actual / target) * 100) : "—"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {test ? "حفظ التعديلات" : "تسجيل الاختبار"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Quality() {
  const access = useAccess();
  const { branches, branchId, setBranchId } = useBranch();
  const settings = useQuery(api.settings.get);
  const [days, setDays] = useState(90);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; test: TestRow | null }>({
    open: false,
    test: null,
  });
  const today = useMemo(() => todayISO(), []);
  const data = useQuery(api.quality.overview, { days, today, branchId });
  const removeTest = useMutation(api.quality.remove);

  const canManage = access.can("manageQuality");
  const mixNames = useMemo(
    () => (settings?.mixes ?? []).filter((mix) => mix.isActive).map((mix) => mix.name),
    [settings],
  );

  const rows = useMemo(() => {
    const list = (data?.recent ?? []) as TestRow[];
    const needle = search.trim().toLowerCase();
    return list.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (resultFilter !== "all" && row.result !== resultFilter) return false;
      if (!needle) return true;
      return [row.customer, row.mixDesign, row.sampleRef, row.site]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, kindFilter, resultFilter, search]);

  const handleDelete = async (row: TestRow) => {
    try {
      await removeTest({ id: row._id });
      toast.success("تم حذف اختبار الجودة");
    } catch (error) {
      toast.error(readError(error, "تعذر حذف الاختبار"));
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `quality-${today}.csv`,
      rows.map((row) => ({
        "التاريخ": row.date,
        "النوع": QUALITY_KIND_LABELS[row.kind],
        "الخلطة": row.mixDesign,
        "العميل": row.customer,
        "رقم العينة": row.sampleRef ?? "",
        "المطلوب": row.targetValue,
        "الفعلي": row.actualValue,
        "النتيجة": QUALITY_RESULT_LABELS[row.result],
      })),
    );
  };

  const totals = data?.totals;
  const cubes = data?.cubes;
  const slumps = data?.slumps;

  return (
    <AppShell
      eyebrow="الجودة والاختبارات"
      title="مكعبات الخرسانة واختبارات الركود"
      description="إثبات مطابقة الخرسانة للمواصفة يومًا بيوم: مقاومة الضغط بعد ٧ و٢٨ يومًا، وركود الخرسانة الطازجة عند الصب."
      actions={
        <>
          <ToggleGroup
            type="single"
            value={String(days)}
            onValueChange={(value) => value && setDays(Number(value))}
            variant="outline"
            size="sm"
          >
            {RANGES.map((range) => (
              <ToggleGroupItem key={range.days} value={String(range.days)}>
                {range.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <BranchFilter branches={branches} value={branchId} onChange={setBranchId} />
          {canManage && (
            <Button size="sm" onClick={() => setDialog({ open: true, test: null })}>
              <Plus className="size-4" />
              اختبار جديد
            </Button>
          )}
        </>
      }
    >
      {!access.isReady || data === undefined || !totals ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              label="نسبة مطابقة المكعبات"
              value={
                totals.passed + totals.failed > 0
                  ? formatPercent(totals.passRate)
                  : "—"
              }
              hint={`${formatNumber(totals.passed)} مطابق من ${formatNumber(
                totals.passed + totals.failed,
              )} اختبار مقاومة`}
              icon={CheckCircle2}
              tone={totals.passRate >= 95 ? "success" : totals.passRate >= 85 ? "warning" : "destructive"}
            />
            <StatTile
              label="مقاومة ٢٨ يومًا مقابل المطلوب"
              value={cubes ? formatPercent(cubes.strengthRatio) : "—"}
              hint={
                cubes
                  ? `${formatNumber(cubes.avg28Actual, 1)} MPa مقابل مستهدف ${formatNumber(
                      cubes.avg28Target,
                      1,
                    )} MPa`
                  : undefined
              }
              icon={FlaskConical}
              tone={cubes && cubes.strengthRatio >= 100 ? "success" : "warning"}
            />
            <StatTile
              label="الركود داخل حدود المواصفة"
              value={slumps && slumps.tests > 0 ? formatPercent(slumps.inBandPct) : "—"}
              hint={
                slumps && slumps.tests > 0
                  ? `متوسط ${formatNumber(slumps.avgActual, 0)} مم مقابل مستهدف ${formatNumber(
                      slumps.avgTarget,
                      0,
                    )} مم`
                  : "لا توجد اختبارات ركود في الفترة"
              }
              icon={Gauge}
              tone={slumps && slumps.inBandPct >= 95 ? "success" : "warning"}
            />
            <StatTile
              label="نتائج غير مطابقة"
              value={formatNumber(totals.failed)}
              hint="تحتاج إجراء تصحيح وفحص الجذع"
              icon={TriangleAlert}
              tone={totals.failed === 0 ? "success" : "destructive"}
            />
            <StatTile
              label="بانتظار النتيجة"
              value={formatNumber(totals.pending)}
              hint="عينات لم تُسجَّل قراءتها بعد"
              icon={TriangleAlert}
              tone="warning"
            />
            <StatTile
              label="إجمالي الاختبارات"
              value={formatNumber(totals.tests)}
              hint={`${formatNumber(totals.cubes28)} مكعب ٢٨ يوم · ${formatNumber(
                totals.cubes7,
              )} مكعب ٧ أيام · ${formatNumber(totals.slumps)} ركود`}
              icon={ClipboardCheck}
              tone="primary"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="مقاومة ٢٨ يومًا مقابل المستهدف"
              description="متوسط القراءات اليومية لكل خلطة، مقابل المقاومة المميزة المطلوبة للتشغيل."
            >
              {data.trend.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  لا توجد نتائج مكعبات في هذه الفترة.
                </p>
              ) : (
                <ChartContainer config={cubeConfig} className="aspect-auto h-[300px] w-full">
                  <ComposedChart
                    data={data.trend}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={28}
                      tickFormatter={(value: string) => formatDay(value)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(value: number) => formatNumber(value)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => formatDayWithWeekday(String(label))}
                          formatter={(value) => `${formatNumber(Number(value), 1)} MPa`}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="avgActual"
                      fill="var(--color-avgActual)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={22}
                    />
                    <Line
                      dataKey="avgTarget"
                      type="monotone"
                      stroke="var(--color-avgTarget)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </Panel>

            <Panel
              title="المطابقة لكل خلطة"
              description="نسبة الاختبارات المطابقة ومتوسط المقاومة لكل خلطة معتمدة."
            >
              {data.byMix.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  لا توجد نتائج مكعبات.
                </p>
              ) : (
                <ul className="space-y-4">
                  {data.byMix.map((mix) => {
                    const rate =
                      mix.passed + mix.failed > 0
                        ? (mix.passed / (mix.passed + mix.failed)) * 100
                        : 0;
                    return (
                      <li key={mix.key}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium">{mix.key}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatPercent(rate)} مطابقة
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              rate >= 95 ? "bg-success" : rate >= 85 ? "bg-warning" : "bg-destructive",
                            )}
                            style={{ width: `${Math.max(2, Math.min(100, rate))}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                          {formatNumber(mix.avgActual, 1)} MPa فعلي ·{" "}
                          {formatNumber(mix.avgTarget, 1)} MPa مطلوب ·{" "}
                          {formatNumber(mix.tests)} اختبار
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {data.failures.length > 0 && (
            <Panel
              title="نتائج تحتاج إجراء تصحيح"
              description="عينات لم تصل إلى المقاومة المميزة — تُراجع فورًا مع استشاري الجودة وترفع تقرير عدم مطابقة."
            >
              <ul className="space-y-3">
                {data.failures.map((row) => (
                  <li
                    key={row._id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {row.mixDesign} · {row.customer}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDayWithWeekday(row.date)} ·{" "}
                        {QUALITY_KIND_LABELS[row.kind as QualityKind]}
                        {row.sampleRef ? ` · العينة ${row.sampleRef}` : ""}
                      </p>
                      {row.notes && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">{row.notes}</p>
                      )}
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold tabular-nums text-destructive">
                        {formatNumber(row.actualValue, 1)} / {formatNumber(row.targetValue, 1)}{" "}
                        {QUALITY_UNITS[row.kind as QualityKind]}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatPercent((row.actualValue / (row.targetValue || 1)) * 100)} من
                        المطلوب
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            title="سجل الاختبارات"
            description={`آخر ${formatNumber(rows.length)} اختبار داخل الفترة المحددة.`}
            action={
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="size-4" />
                تصدير CSV
              </Button>
            }
          >
            <div className="flex flex-wrap gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث بالعميل أو الخلطة أو رقم العينة"
                className="max-w-xs"
              />
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger className="w-[11rem]">
                  <SelectValue placeholder="كل الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {QUALITY_KIND_ORDER.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {QUALITY_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="w-[10rem]">
                  <SelectValue placeholder="كل النتائج" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل النتائج</SelectItem>
                  <SelectItem value="pass">مطابق</SelectItem>
                  <SelectItem value="fail">غير مطابق</SelectItem>
                  <SelectItem value="pending">بانتظار النتيجة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الخلطة</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>العينة</TableHead>
                    <TableHead className="text-end">المطلوب</TableHead>
                    <TableHead className="text-end">الفعلي</TableHead>
                    <TableHead>النتيجة</TableHead>
                    {canManage && <TableHead className="text-end">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDay(row.date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {QUALITY_KIND_SHORT[row.kind]}
                      </TableCell>
                      <TableCell className="font-medium">{row.mixDesign}</TableCell>
                      <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                        {row.customer}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {row.sampleRef ?? "—"}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatNumber(row.targetValue, 1)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums font-medium">
                        {formatNumber(row.actualValue, 1)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={RESULT_TONE[row.result]}>
                          {QUALITY_RESULT_LABELS[row.result]}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="تعديل"
                              onClick={() => setDialog({ open: true, test: row })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="حذف"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(row)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 9 : 8}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        لا توجد اختبارات مطابقة للفلاتر الحالية.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Panel
            title="الاتجاهات والامتثال"
            description="ما يعنيه هذا السجل في المراجعة الخارجية."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                <ShieldCheck className="size-4 text-brand" />
                <p className="mt-2 text-xs font-semibold">ISO 9001 — بند 8.6</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  نتيجة كل صبّة موثّقة بتاريخها وعينتها ومعملها، ويمكن إخراجها للمراجع
                  دون أي عمل تحضيري.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                <FlaskConical className="size-4 text-brand" />
                <p className="mt-2 text-xs font-semibold">ECP 203-2007</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  المقاومة المميزة لكل خلطة هي الحد الأدنى للقبول، ومكعب ٧ أيام يُقبل من
                  ٧٠٪ من المقاومة المميزة.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                <Lock className="size-4 text-brand" />
                <p className="mt-2 text-xs font-semibold">حماية السجل</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  أي تعديل على اختبار مسجّل يُكتب في سجل التتبع بالقيمة قبل وبعد، مع اسم
                  من عدّل ووقت التعديل.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <TestDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        test={dialog.test}
        mixNames={mixNames}
        branchId={branchId}
        defaults={{ customer: "", site: "" }}
      />
    </AppShell>
  );
}
