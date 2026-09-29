import { AppShell } from "@/components/AppShell";
import { BranchFilter } from "@/components/BranchFilter";
import { Panel } from "@/components/Panel";
import { RoleNotice } from "@/components/RoleNotice";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/hooks/use-access";
import { useBranch } from "@/hooks/use-branch";
import {
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_KIND_ORDER,
  MAINTENANCE_STATUS_LABELS,
  METER_UNIT_LABELS,
} from "@/lib/concrete";
import type { EquipmentKind, MaintenanceStatus, MeterUnit } from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import {
  formatDay,
  formatDayWithWeekday,
  formatM3,
  formatNumber,
  formatPercent,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  CalendarClock,
  Gauge,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

const demandConfig = {
  actual: { label: "الطلب الفعلي", color: "var(--chart-1)" },
  predicted: { label: "الطلب المتوقع", color: "var(--chart-4)" },
  high: { label: "الحد الأعلى", color: "var(--chart-3)" },
  low: { label: "الحد الأدنى", color: "var(--chart-3)" },
} satisfies ChartConfig;

const STATUS_BADGE: Record<MaintenanceStatus, string> = {
  overdue: "border-destructive/40 bg-destructive/10 text-destructive",
  due_soon: "border-warning/40 bg-warning/15 text-warning",
  scheduled: "border-primary/30 bg-primary/10 text-primary",
  ok: "border-success/40 bg-success/10 text-success",
};

type FleetRow = {
  _id: Id<"equipment">;
  code: string;
  name: string;
  kind: EquipmentKind;
  meterUnit: MeterUnit;
  meterReading: number;
  lastServiceMeter: number;
  serviceInterval: number;
  serviceIntervalDays: number | null;
  lastServiceDate: string | null;
  avgDailyUsage: number;
  notes: string | null;
  usedSinceService: number;
  remainingMeter: number;
  meterPct: number;
  remainingDays: number | null;
  dateDue: string | null;
  status: MaintenanceStatus;
};

type EquipmentForm = {
  code: string;
  name: string;
  kind: EquipmentKind;
  meterUnit: MeterUnit;
  meterReading: string;
  lastServiceMeter: string;
  serviceInterval: string;
  serviceIntervalDays: string;
  lastServiceDate: string;
  avgDailyUsage: string;
  isActive: boolean;
  notes: string;
};

const emptyEquipment: EquipmentForm = {
  code: "",
  name: "",
  kind: "truck",
  meterUnit: "km",
  meterReading: "0",
  lastServiceMeter: "0",
  serviceInterval: "15000",
  serviceIntervalDays: "60",
  lastServiceDate: todayISO(),
  avgDailyUsage: "150",
  isActive: true,
  notes: "",
};

function EquipmentDialog({
  open,
  onOpenChange,
  equipment,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: FleetRow | null;
  branchId: Id<"branches"> | undefined;
}) {
  const create = useMutation(api.forecast.createEquipment);
  const update = useMutation(api.forecast.updateEquipment);
  const [saving, setSaving] = useState(false);
  // Seeded once per mount; the parent mounts a fresh dialog for each record.
  const [form, setForm] = useState<EquipmentForm>(() =>
    equipment
      ? {
          code: equipment.code,
          name: equipment.name,
          kind: equipment.kind,
          meterUnit: equipment.meterUnit,
          meterReading: String(equipment.meterReading),
          lastServiceMeter: String(equipment.lastServiceMeter),
          serviceInterval: String(equipment.serviceInterval),
          serviceIntervalDays: equipment.serviceIntervalDays
            ? String(equipment.serviceIntervalDays)
            : "",
          lastServiceDate: equipment.lastServiceDate ?? todayISO(),
          avgDailyUsage: String(equipment.avgDailyUsage),
          isActive: true,
          notes: equipment.notes ?? "",
        }
      : emptyEquipment,
  );

  const set = <K extends keyof EquipmentForm>(key: K, value: EquipmentForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        branchId,
        code: form.code.trim(),
        name: form.name.trim(),
        kind: form.kind,
        meterUnit: form.meterUnit,
        meterReading: Number(form.meterReading) || 0,
        lastServiceMeter: Number(form.lastServiceMeter) || 0,
        serviceInterval: Number(form.serviceInterval) || 0,
        serviceIntervalDays: form.serviceIntervalDays
          ? Number(form.serviceIntervalDays)
          : undefined,
        lastServiceDate: form.lastServiceDate || undefined,
        avgDailyUsage: Number(form.avgDailyUsage) || 0,
        isActive: form.isActive,
        notes: form.notes.trim() || undefined,
      };
      if (equipment) {
        await update({ id: equipment._id, ...payload });
        toast.success("تم تحديث بيانات المعدة");
      } else {
        await create(payload);
        toast.success("تمت إضافة المعدة");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(readError(error, "تعذر حفظ المعدة"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-start">
          <DialogTitle>{equipment ? "تعديل معدة" : "إضافة معدة"}</DialogTitle>
          <DialogDescription>
            جدول الصيانة يُبنى على العداد (ساعات أو كيلومترات) وعلى الفترة الزمنية
            المعتمدة من الشركة المصنّعة — أيهما أقرب.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الكود</Label>
            <Input
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              placeholder="TR-07"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الاسم</Label>
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="عربة خلاط ٧"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">النوع</Label>
            <Select
              value={form.kind}
              onValueChange={(value) => set("kind", value as EquipmentKind)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_KIND_ORDER.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {EQUIPMENT_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">وحدة العداد</Label>
            <Select
              value={form.meterUnit}
              onValueChange={(value) => set("meterUnit", value as MeterUnit)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">ساعة تشغيل</SelectItem>
                <SelectItem value="km">كيلومتر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">قراءة العداد الحالية</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.meterReading}
              onChange={(event) => set("meterReading", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">عداد آخر صيانة</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.lastServiceMeter}
              onChange={(event) => set("lastServiceMeter", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الفترة بين الصيانات (بالعداد)</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.serviceInterval}
              onChange={(event) => set("serviceInterval", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الفترة الزمنية (يوم)</Label>
            <Input
              type="number"
              step="1"
              inputMode="numeric"
              value={form.serviceIntervalDays}
              onChange={(event) => set("serviceIntervalDays", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">تاريخ آخر صيانة</Label>
            <Input
              type="date"
              value={form.lastServiceDate}
              onChange={(event) => set("lastServiceDate", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">متوسط الاستهلاك اليومي</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.avgDailyUsage}
              onChange={(event) => set("avgDailyUsage", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">ملاحظات</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 sm:col-span-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(value) => set("isActive", value)}
            />
            <span className="text-xs text-muted-foreground">
              {form.isActive ? "المعدة في الخدمة" : "المعدة خارج الخدمة"}
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

function FleetActionDialog({
  open,
  onOpenChange,
  equipment,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: FleetRow | null;
  mode: "service" | "meter";
}) {
  const logService = useMutation(api.forecast.logService);
  const recordMeter = useMutation(api.forecast.recordMeter);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState("");
  const [usage, setUsage] = useState("");
  const [note, setNote] = useState("");

  const unit = equipment ? METER_UNIT_LABELS[equipment.meterUnit] : "";

  const submit = async () => {
    if (!equipment) return;
    setSaving(true);
    try {
      if (mode === "service") {
        await logService({
          id: equipment._id,
          date: todayISO(),
          meterReading: value ? Number(value) : undefined,
          note: note.trim() || undefined,
        });
        toast.success("تم تسجيل الصيانة وتصفير العداد الدوري");
      } else {
        await recordMeter({
          id: equipment._id,
          reading: Number(value) || 0,
          avgDailyUsage: usage ? Number(usage) : undefined,
        });
        toast.success("تم تحديث قراءة العداد");
      }
      onOpenChange(false);
      setValue("");
      setUsage("");
      setNote("");
    } catch (error) {
      toast.error(readError(error, "تعذر تنفيذ العملية"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-start">
          <DialogTitle>
            {mode === "service" ? "تسجيل صيانة منفّذة" : "تحديث قراءة العداد"}
          </DialogTitle>
          <DialogDescription>
            {equipment
              ? `${equipment.code} · ${equipment.name} — الوحدة ${unit}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {mode === "service" ? "قراءة العداد عند الصيانة" : "قراءة العداد الحالية"}
            </Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={equipment ? String(equipment.meterReading) : "0"}
            />
          </div>
          {mode === "meter" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">متوسط الاستهلاك اليومي</Label>
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                value={usage}
                onChange={(event) => setUsage(event.target.value)}
                placeholder={equipment ? String(equipment.avgDailyUsage) : "0"}
              />
            </div>
          )}
          {mode === "service" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ملاحظات الصيانة</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="ما تم تنفيذه من أعمال وقطع غيار"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mode === "service" ? "تسجيل الصيانة" : "تحديث القراءة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Forecast() {
  const access = useAccess();
  const { branches, branchId, setBranchId } = useBranch();
  const settings = useQuery(api.settings.get);
  const [historyDays, setHistoryDays] = useState(90);
  const [horizon, setHorizon] = useState(14);
  const today = useMemo(() => todayISO(), []);
  const capacityM3Day = settings?.plant.capacityM3Day ?? 0;

  const demand = useQuery(api.forecast.demand, {
    historyDays,
    horizon,
    today,
    branchId,
    capacityM3Day,
  });
  const maintenance = useQuery(api.forecast.maintenance, { today, branchId });
  const removeEquipment = useMutation(api.forecast.removeEquipment);

  const canView = access.can("viewForecast");
  const canManage = access.can("manageInventory");
  const canRemove = access.can("manageSettings");

  const [equipmentDialog, setEquipmentDialog] = useState<{
    open: boolean;
    equipment: FleetRow | null;
  }>({ open: false, equipment: null });
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    equipment: FleetRow | null;
    mode: "service" | "meter";
  }>({ open: false, equipment: null, mode: "service" });

  const chartData = useMemo(() => {
    if (!demand) return [];
    const history = demand.history.map((day) => ({
      date: day.date,
      actual: day.actual,
    }));
    const future = demand.forecast.map((day) => ({
      date: day.date,
      predicted: day.predicted,
      low: day.low,
      high: day.high,
    }));
    return [...history, ...future];
  }, [demand]);

  const fleet = (maintenance?.fleet ?? []) as FleetRow[];

  const handleDelete = async (row: FleetRow) => {
    try {
      await removeEquipment({ id: row._id });
      toast.success(`تم حذف المعدة «${row.name}»`);
    } catch (error) {
      toast.error(readError(error, "تعذر حذف المعدة"));
    }
  };

  return (
    <AppShell
      eyebrow="التخطيط والتنبؤ"
      title="تنبؤ الطلب وخطة الصيانة"
      description="توقّع الطلب للفترة القادمة من سجل الإنتاج نفسه مع إعلان نسبة الخطأ، وجدول صيانة مبني على عدادات المعدات ومواعيدها."
      actions={<BranchFilter branches={branches} value={branchId} onChange={setBranchId} />}
    >
      {!access.isReady || !canView ? (
        <RoleNotice
          icon={Lock}
          title="التنبؤ غير متاح لدورك الحالي"
          message="شاشة التخطيط متاحة للمالك والمدير والمراجع والمشغّل لعرض الأرقام دون تعديل أسعار المحطة."
        />
      ) : demand === undefined || maintenance === undefined ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <Tabs defaultValue="demand" className="gap-5">
          <TabsList>
            <TabsTrigger value="demand">تنبؤ الطلب</TabsTrigger>
            <TabsTrigger value="maintenance">الصيانة الوقائية</TabsTrigger>
          </TabsList>

          <TabsContent value="demand" className="space-y-4">
            {!demand.hasData || !demand.totals ? (
              <RoleNotice
                icon={TrendingUp}
                title="البيانات غير كافية لبناء تنبؤ"
                message={
                  demand.insight ||
                  "سجّل إنتاج عدة أيام على الأقل ليصبح التنبؤ ذا معنى."
                }
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <StatTile
                    label={`إجمالي الطلب المتوقع (${horizon} يومًا)`}
                    value={formatM3(demand.totals.forecastTotalM3)}
                    hint={`متوسط ${formatM3(demand.totals.forecastAvgM3)} يوميًا`}
                    icon={TrendingUp}
                    tone="primary"
                  />
                  <StatTile
                    label="يوم الذروة المتوقع"
                    value={formatM3(demand.totals.peakM3)}
                    hint={
                      demand.totals.peakDate
                        ? formatDayWithWeekday(demand.totals.peakDate)
                        : undefined
                    }
                    icon={Target}
                    tone="warning"
                  />
                  <StatTile
                    label="متوسط الطلب الفعلي"
                    value={formatM3(demand.totals.historyAvgM3)}
                    hint={`${formatNumber(demand.totals.activeDays)} يوم إنتاج خلال ${historyDays} يومًا`}
                    icon={Activity}
                    tone="default"
                  />
                  <StatTile
                    label="اتجاه الطلب على ٣٠ يومًا"
                    value={`${demand.totals.trendPer30Days > 0 ? "+" : ""}${formatNumber(
                      demand.totals.trendPer30Days,
                    )} م³`}
                    hint={
                      demand.totals.trendPer30Days > 0
                        ? "الطلب في صعود تدريجي"
                        : demand.totals.trendPer30Days < 0
                          ? "الطلب في تراجع تدريجي"
                          : "الطلب مستقر"
                    }
                    icon={TrendingUp}
                    tone={demand.totals.trendPer30Days >= 0 ? "success" : "destructive"}
                  />
                  <StatTile
                    label="دقة النموذج (MAPE)"
                    value={
                      demand.accuracy?.mape !== null && demand.accuracy?.mape !== undefined
                        ? formatPercent(demand.accuracy.mape)
                        : "—"
                    }
                    hint={
                      demand.accuracy
                        ? `اختبار على ${formatNumber(demand.accuracy.holdoutDays)} يومًا لم تدخل في التدريب`
                        : "لا توجد فترة كافية للاختبار"
                    }
                    icon={Sparkles}
                    tone={
                      demand.accuracy && (demand.accuracy.mape ?? 100) <= 15
                        ? "success"
                        : "warning"
                    }
                  />
                  {demand.capacity && (
                    <StatTile
                      label="التحميل المتوقع على طاقة المحطة"
                      value={formatPercent(demand.capacity.utilisationPct)}
                      hint={`${formatNumber(demand.capacity.daysAbove80Pct)} يومًا متوقع تجاوز ٨٠٪ من ${formatNumber(
                        demand.capacity.capacityM3Day,
                      )} م³/يوم`}
                      icon={Gauge}
                      tone={demand.capacity.utilisationPct > 85 ? "destructive" : "success"}
                    />
                  )}
                </div>

                <Panel
                  title="الطلب الفعلي مقابل المتوقع"
                  description="الخط المتصل هو الطلب المسجّل، والخط المتقطع هو التوقع، والإطار الرمادي هو نطاق الثقة المحسوب من تشتت النموذج."
                >
                  {chartData.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      لا توجد بيانات لعرضها.
                    </p>
                  ) : (
                    <ChartContainer config={demandConfig} className="aspect-auto h-[320px] w-full">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          minTickGap={32}
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
                              formatter={(value) => formatM3(Number(value), 0)}
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <ReferenceLine
                          x={today}
                          stroke="var(--color-predicted)"
                          strokeDasharray="4 4"
                        />
                        <Area
                          dataKey="actual"
                          type="monotone"
                          fill="var(--color-actual)"
                          fillOpacity={0.18}
                          stroke="var(--color-actual)"
                          strokeWidth={2}
                          connectNulls
                        />
                        <Line
                          dataKey="high"
                          type="monotone"
                          stroke="var(--color-high)"
                          strokeWidth={1}
                          strokeOpacity={0.6}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          dataKey="low"
                          type="monotone"
                          stroke="var(--color-low)"
                          strokeWidth={1}
                          strokeOpacity={0.6}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          dataKey="predicted"
                          type="monotone"
                          stroke="var(--color-predicted)"
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={false}
                          connectNulls
                        />
                      </ComposedChart>
                    </ChartContainer>
                  )}
                </Panel>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Panel
                    className="lg:col-span-2"
                    title="كيف حُسب التوقع؟"
                    description="نموذج شفّاف قابل للمراجعة، لا صندوق أسود."
                  >
                    <p className="text-sm leading-6 text-muted-foreground">
                      {demand.method}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                        <p className="text-[11px] text-muted-foreground">خطأ متوسط (MAE)</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">
                          {demand.accuracy ? formatM3(demand.accuracy.mae) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                        <p className="text-[11px] text-muted-foreground">أيام التدريب</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">
                          {demand.accuracy ? formatNumber(demand.accuracy.trainDays) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                        <p className="text-[11px] text-muted-foreground">أيام الاختبار</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">
                          {demand.accuracy ? formatNumber(demand.accuracy.holdoutDays) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHorizon(horizon === 14 ? 30 : 14)}
                      >
                        {horizon === 14 ? "اعرض ٣٠ يومًا" : "اعرض ١٤ يومًا"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryDays(historyDays === 90 ? 180 : 90)}
                      >
                        {historyDays === 90 ? "استخدم ١٨٠ يومًا" : "استخدم ٩٠ يومًا"}
                      </Button>
                    </div>
                    <p className="mt-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-xs leading-6">
                      {demand.insight}
                    </p>
                  </Panel>

                  <Panel
                    title="الطلب المتوقع حسب الخلطة"
                    description="لتخطيط توريد الأسمنت والركام قبل أسبوعين."
                  >
                    {demand.byMix.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        لا توجد بيانات خلطات.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {demand.byMix.map((mix) => (
                          <li key={mix.key} className="flex items-center justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{mix.key}</span>
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                {formatPercent(mix.sharePct, 0)} من الكميات
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                              {formatM3(mix.expectedM3)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            {!maintenance.hasData ? (
              <RoleNotice
                icon={Wrench}
                title="لا توجد معدات مسجّلة"
                message="أضف الخلاطات والعربات والمضخات مع عداداتها ليبني النظام جدول الصيانة تلقائيًا."
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile
                    label="معدات في الخدمة"
                    value={formatNumber(maintenance.totals.equipment)}
                    hint={`نسبة الجاهزية ${formatPercent(maintenance.totals.avgAvailabilityPct)}`}
                    icon={Truck}
                    tone="primary"
                  />
                  <StatTile
                    label="صيانة متأخرة"
                    value={formatNumber(maintenance.totals.overdue)}
                    hint="تجاوزت العداد أو التاريخ المستحق"
                    icon={Wrench}
                    tone={maintenance.totals.overdue > 0 ? "destructive" : "success"}
                  />
                  <StatTile
                    label="مستحقة خلال ٧ أيام"
                    value={formatNumber(maintenance.totals.dueSoon)}
                    hint="يُجدول لها موعد قبل ضغط التشغيل"
                    icon={CalendarClock}
                    tone={maintenance.totals.dueSoon > 0 ? "warning" : "success"}
                  />
                  <StatTile
                    label="مبرمجة خلال ٣٠ يومًا"
                    value={formatNumber(maintenance.totals.scheduled)}
                    hint="خطة وقائية معروفة مسبقًا"
                    icon={CalendarClock}
                    tone="default"
                  />
                </div>

                <Panel
                  title="جدول الصيانة الوقائية"
                  description="مرتب حسب الأقرب للاستحقاق: العداد المتبقي والأيام المتبقية والتاريخ المستحق."
                  action={
                    canManage ? (
                      <Button
                        size="sm"
                        onClick={() => setEquipmentDialog({ open: true, equipment: null })}
                      >
                        <Plus className="size-4" />
                        معدة جديدة
                      </Button>
                    ) : undefined
                  }
                >
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>المعدة</TableHead>
                          <TableHead>النوع</TableHead>
                          <TableHead className="text-end">العداد</TableHead>
                          <TableHead className="text-end">منذ آخر صيانة</TableHead>
                          <TableHead className="text-end">المتبقي</TableHead>
                          <TableHead className="text-end">أيام متبقية</TableHead>
                          <TableHead className="min-w-[10rem]">التقدم</TableHead>
                          <TableHead>الحالة</TableHead>
                          {(canManage || canRemove) && (
                            <TableHead className="text-end">إجراءات</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fleet.map((row) => (
                          <TableRow key={row._id}>
                            <TableCell>
                              <span className="block font-medium">{row.name}</span>
                              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                                {row.code}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {EQUIPMENT_KIND_LABELS[row.kind]}
                            </TableCell>
                            <TableCell className="text-end tabular-nums text-muted-foreground">
                              {formatNumber(row.meterReading)}{" "}
                              <span className="text-[11px]">
                                {METER_UNIT_LABELS[row.meterUnit]}
                              </span>
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {formatNumber(row.usedSinceService)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-end tabular-nums font-medium",
                                row.remainingMeter < 0 && "text-destructive",
                              )}
                            >
                              {formatNumber(row.remainingMeter)}
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {row.remainingDays === null ? (
                                "—"
                              ) : (
                                <span
                                  className={cn(
                                    "font-medium",
                                    row.remainingDays < 0 && "text-destructive",
                                  )}
                                >
                                  {formatNumber(row.remainingDays, 0)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    row.meterPct >= 100
                                      ? "bg-destructive"
                                      : row.meterPct >= 85
                                        ? "bg-warning"
                                        : "bg-primary",
                                  )}
                                  style={{
                                    width: `${Math.max(2, Math.min(100, row.meterPct))}%`,
                                  }}
                                />
                              </div>
                              <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                                {row.dateDue
                                  ? `استحقاق زمني ${formatDay(row.dateDue)}`
                                  : "بالمسافة/الساعات فقط"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_BADGE[row.status]}
                              >
                                {MAINTENANCE_STATUS_LABELS[row.status]}
                              </Badge>
                            </TableCell>
                            {(canManage || canRemove) && (
                              <TableCell className="text-end">
                                <div className="flex flex-wrap justify-end gap-1">
                                  {canManage && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setActionDialog({
                                            open: true,
                                            equipment: row,
                                            mode: "service",
                                          })
                                        }
                                      >
                                        صيانة
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setActionDialog({
                                            open: true,
                                            equipment: row,
                                            mode: "meter",
                                          })
                                        }
                                      >
                                        عداد
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="تعديل"
                                        onClick={() =>
                                          setEquipmentDialog({ open: true, equipment: row })
                                        }
                                      >
                                        <Pencil className="size-4" />
                                      </Button>
                                    </>
                                  )}
                                  {canRemove && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="حذف"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDelete(row)}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {!canManage && (
                    <div className="mt-4">
                      <RoleNotice
                        icon={Lock}
                        title="عرض فقط"
                        message="تسجيل الصيانة وتحديث العدادات متاح للمشغّل والمدير والمالك."
                      />
                    </div>
                  )}
                </Panel>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {equipmentDialog.open && (
        <EquipmentDialog
          open
          onOpenChange={(open) => setEquipmentDialog((prev) => ({ ...prev, open }))}
          equipment={equipmentDialog.equipment}
          branchId={branchId}
        />
      )}
      <FleetActionDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog((prev) => ({ ...prev, open }))}
        equipment={actionDialog.equipment}
        mode={actionDialog.mode}
      />
    </AppShell>
  );
}
