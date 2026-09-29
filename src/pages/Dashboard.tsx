import { AppShell } from "@/components/AppShell";
import { BranchFilter } from "@/components/BranchFilter";
import { KpiCard } from "@/components/KpiCard";
import { Panel } from "@/components/Panel";
import { RoleNotice } from "@/components/RoleNotice";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { useAccess } from "@/hooks/use-access";
import { useBranch } from "@/hooks/use-branch";
import { downloadCsv } from "@/lib/csv";
import {
  SHIFT_SHORT_LABELS,
  STATUS_LABELS,
  TRUCK_CAPACITY_M3,
} from "@/lib/concrete";
import type { LogStatus, Shift } from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import {
  formatCompact,
  formatDay,
  formatDayWithWeekday,
  formatEGP,
  formatM3,
  formatNumber,
  formatPercent,
  formatSignedEGP,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  ClipboardList,
  Download,
  Gauge,
  Layers,
  Loader2,
  Lock,
  Percent,
  Plus,
  Receipt,
  RotateCcw,
  Timer,
  Truck,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

const RANGES = [
  { days: 7, label: "7 أيام" },
  { days: 30, label: "30 يومًا" },
  { days: 90, label: "90 يومًا" },
];

const MIX_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const financialConfig = {
  revenue: { label: "الإيرادات", color: "var(--chart-1)" },
  cost: { label: "التكاليف", color: "var(--chart-3)" },
  profit: { label: "صافي الربح", color: "var(--chart-2)" },
} satisfies ChartConfig;

const productionConfig = {
  deliveredM3: { label: "كمية مسلّمة", color: "var(--chart-2)" },
  productionM3: { label: "كمية منتجة", color: "var(--chart-1)" },
} satisfies ChartConfig;

const customerFinancialConfig = {
  revenue: { label: "الإيراد", color: "var(--chart-1)" },
  profit: { label: "الربح", color: "var(--chart-2)" },
} satisfies ChartConfig;

const customerVolumeConfig = {
  m3: { label: "كمية مسلّمة", color: "var(--chart-2)" },
} satisfies ChartConfig;

function MetricBar({
  label,
  percentage,
  detail,
  tone = "primary",
}: {
  label: string;
  percentage: number;
  detail: string;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[tone];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{detail}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", toneClass)}
          style={{ width: `${Math.max(2, Math.min(100, percentage))}%` }}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const today = useMemo(() => todayISO(), []);
  const access = useAccess();
  const financialsVisible = access.can("viewFinancials");
  const canManageTestData = access.can("manageTestData");
  const { branches, branchId, setBranchId } = useBranch();
  const data = useQuery(api.analytics.overview, { days, today, branchId });
  const seedDemoData = useMutation(api.production.seedDemoData);
  const clearTestData = useMutation(api.production.clearTestData);
  const navigate = useNavigate();

  const mixData = useMemo(
    () =>
      (data?.byMix ?? []).map((mix, index) => ({
        name: mix.key,
        value: mix.m3,
        fill: MIX_COLORS[index % MIX_COLORS.length],
      })),
    [data?.byMix],
  );

  const customerData = useMemo(
    () =>
      (data?.byCustomer ?? []).map((customer) => ({
        ...customer,
        short:
          customer.key.length > 18
            ? `${customer.key.slice(0, 17)}…`
            : customer.key,
      })),
    [data?.byCustomer],
  );

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const result = await seedDemoData({ today });
      const added = result.quality + result.movements + result.equipment;
      toast.success(
        result.inserted > 0
          ? `تم تحميل ${formatNumber(result.inserted)} قيد إنتاج تجريبي مع بيانات الجودة والمخازن والصيانة`
          : added > 0
            ? `تم استكمال البيانات التجريبية: ${formatNumber(result.quality)} اختبار جودة و${formatNumber(result.movements)} حركة مخزون`
            : "توجد بيانات تجريبية كاملة بالفعل على المحطة",
      );
    } catch (error) {
      toast.error(readError(error, "تعذر تحميل البيانات التجريبية"));
    } finally {
      setIsSeeding(false);
    }
  };

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const removed = await clearTestData({});
      toast.success(`تم حذف ${formatNumber(removed)} قيدًا تجريبيًا`);
    } catch (error) {
      toast.error(readError(error, "تعذر حذف البيانات التجريبية"));
    } finally {
      setIsPurging(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      `iconcrete-daily-summary-${days}d.csv`,
      data.trend.map((day) => ({
        التاريخ: day.date,
        "كمية منتجة (م³)": day.productionM3,
        "كمية مسلّمة (م³)": day.deliveredM3,
        "كمية مرتجعة (م³)": day.returnedM3,
        "عدد القيود": day.logs,
        ...(financialsVisible
          ? {
              "الإيراد (ج.م)": day.revenue,
              "التكلفة (ج.م)": day.cost,
              "صافي الربح (ج.م)": day.profit,
              "هامش الربح (%)": day.marginPct,
              "تكلفة المتر (ج.م)": day.costPerM3,
            }
          : {}),
        "التوصيل في الوقت (%)": day.onTimePct,
      })),
    );
  };

  const rangeToggle = (
    <ToggleGroup
      type="single"
      value={String(days)}
      onValueChange={(value) => value && setDays(Number(value))}
      variant="outline"
      size="sm"
      spacing={1}
      className="gap-1 rounded-full bg-card p-0.5"
    >
      {RANGES.map((range) => (
        <ToggleGroupItem
          key={range.days}
          value={String(range.days)}
          className="rounded-full px-3 text-xs"
        >
          {range.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  const actions = (
    <>
      {rangeToggle}
      <Button variant="outline" onClick={handleExport} disabled={!data?.hasData}>
        <Download className="size-4" />
        تصدير CSV
      </Button>
      {access.can("createLog") && (
        <Button onClick={() => navigate("/production?new=1")}>
          <Plus className="size-4" />
          تسجيل قيد إنتاج
        </Button>
      )}
    </>
  );

  if (!data || !access.isReady) {
    return (
      <AppShell
        eyebrow={financialsVisible ? "نظرة الإدارة والمالك" : "نظرة التشغيل"}
        title="لوحة القيادة"
        description="ملخص تنفيذي لأرباح المحطة وأداء التشغيل."
        actions={actions}
      >
        <DashboardSkeleton />
      </AppShell>
    );
  }

  const { totals, deltas, trend, byShift, today: todaySummary } = data;
  const maxShiftM3 = Math.max(...byShift.map((shift) => shift.m3), 1);

  /* ---------------------------- panels ---------------------------- */

  const roleRestrictionNotice = (
    <RoleNotice
      className="h-full justify-center"
      icon={Lock}
      title={`دورك الحالي: ${access.label}`}
      message="الأرقام المالية — الإيراد والتكلفة وصافي الربح والهامش — معروضة للمالك والمدير والمراجع فقط، وأنت ترى الكميات ومؤشرات التشغيل كاملة."
      hint="يُسجَّل كل قيد بمبالغه الصحيحة داخل النظام حتى لو لم تظهر لك، ويمكن لمالك النظام ترقية دورك من شاشة الفريق والصلاحيات."
      action={
        <Button variant="outline" size="sm" asChild>
          <Link to="/team">
            الفريق والصلاحيات
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
    />
  );

  const financialPanel = (
    <Panel
      className="lg:col-span-2"
      title="الأرباح والخسائر"
      description="الإيرادات مقابل التكاليف يوميًا، والخط يمثل صافي الربح."
      action={
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            totals.profit >= 0
              ? "border-success/40 bg-success/10 text-success"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {totals.profit >= 0 ? "المحطة رابحة" : "المحطة خاسرة"}
        </Badge>
      }
    >
      <ChartContainer
        config={financialConfig}
        className="aspect-auto h-[320px] w-full"
      >
        <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            width={56}
            tickFormatter={(value: number) => formatCompact(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) => formatDayWithWeekday(String(label))}
                formatter={(value) => formatEGP(Number(value))}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar
            dataKey="revenue"
            fill="var(--color-revenue)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="cost"
            fill="var(--color-cost)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Line
            dataKey="profit"
            type="monotone"
            stroke="var(--color-profit)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartContainer>
    </Panel>
  );

  const productionPanel = (
    <Panel
      className="lg:col-span-2"
      title="الإنتاج اليومي (م³)"
      description="الكمية المنتجة من الخلاطة مقابل الكمية المسلّمة للعميل."
    >
      <ChartContainer
        config={productionConfig}
        className="aspect-auto h-[300px] w-full"
      >
        <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                formatter={(value) => formatM3(Number(value), 1)}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="productionM3"
            fill="var(--color-productionM3)"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
          <Bar
            dataKey="deliveredM3"
            fill="var(--color-deliveredM3)"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
        </BarChart>
      </ChartContainer>
    </Panel>
  );

  const mixPanel = (
    <Panel
      title="توزيع الكميات حسب الخلطة"
      description={`إجمالي ${formatM3(totals.deliveredM3)} مسلّمة للعملاء.`}
    >
      {mixData.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          لا توجد كميات في هذه الفترة.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full">
            <ChartContainer
              config={{}}
              className="aspect-auto mx-auto h-[190px] w-full"
            >
              <PieChart>
                <Pie
                  data={mixData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {mixData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      nameKey="name"
                      formatter={(value) => formatM3(Number(value), 1)}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[11px] text-muted-foreground">أعلى خلطة</p>
                <p className="text-sm font-semibold">{mixData[0]?.name ?? "—"}</p>
              </div>
            </div>
          </div>

          <ul className="w-full space-y-2">
            {mixData.slice(0, 5).map((mix) => {
              const share =
                totals.deliveredM3 > 0
                  ? (mix.value / totals.deliveredM3) * 100
                  : 0;
              return (
                <li
                  key={mix.name}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: mix.fill }}
                    />
                    <span className="truncate font-medium">{mix.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatM3(mix.value)} · {formatPercent(share, 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );

  const customerPanel = (
    <Panel
      title={
        financialsVisible ? "أفضل العملاء بالإيراد" : "أعلى العملاء بالكميات"
      }
      description={
        financialsVisible
          ? "أعلى ٦ عملاء في الفترة مع صافي الربح لكل عميل."
          : "أعلى ٦ عملاء بالكميات المسلّمة في الفترة."
      }
    >
      {customerData.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          لا توجد بيانات عملاء.
        </p>
      ) : (
        <ChartContainer
          config={financialsVisible ? customerFinancialConfig : customerVolumeConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <BarChart
            data={customerData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
            barGap={2}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                financialsVisible ? formatCompact(value) : formatNumber(value)
              }
            />
            <YAxis
              type="category"
              dataKey="short"
              tickLine={false}
              axisLine={false}
              width={104}
              tickMargin={6}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    financialsVisible
                      ? formatEGP(Number(value))
                      : formatM3(Number(value), 1)
                  }
                />
              }
            />
            {financialsVisible ? (
              <>
                <Bar
                  dataKey="revenue"
                  fill="var(--color-revenue)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={12}
                />
                <Bar
                  dataKey="profit"
                  fill="var(--color-profit)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={12}
                />
              </>
            ) : (
              <Bar
                dataKey="m3"
                fill="var(--color-m3)"
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
              />
            )}
          </BarChart>
        </ChartContainer>
      )}
    </Panel>
  );

  return (
    <AppShell
      eyebrow={
        financialsVisible ? "نظرة الإدارة والمالك" : "نظرة التشغيل اليومي"
      }
      title="لوحة القيادة"
      description={`أداء المحطة خلال آخر ${formatNumber(
        data.range.days,
      )} يومًا (${formatDay(data.range.start)} — ${formatDay(
        data.range.end,
      )})، محسوب من قيود الإنتاج. دورك الحالي: ${access.label}.`}
      actions={
        <>
          <BranchFilter branches={branches} value={branchId} onChange={setBranchId} />
          {actions}
        </>
      }
    >
      {data.testDataCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="flex items-center gap-2 text-xs">
            <AlertTriangle className="size-4 text-warning-foreground" />
            يوجد {formatNumber(data.testDataCount)} قيدًا موسومًا كبيانات تجريبية
            (Test Data) للاستعراض فقط، ولا يمثل تشغيلًا فعليًا للمحطة.
          </p>
          {canManageTestData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePurge}
              disabled={isPurging}
              className="bg-card"
            >
              {isPurging ? <Loader2 className="size-4 animate-spin" /> : null}
              حذف البيانات التجريبية
            </Button>
          )}
        </div>
      )}

      {!data.hasData ? (
        <Panel className="py-10">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Layers className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              لا توجد قيود إنتاج مسجّلة بعد
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              سجّل أول طلبية من شاشة الإنتاج والكميات، وستظهر هنا مؤشرات الأرباح
              والخسائر والهوامش وأداء الورديات. أو حمّل بيانات تجريبية لاستعراض
              المنظومة قبل التشغيل الفعلي.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {access.can("createLog") && (
                <Button onClick={() => navigate("/production?new=1")}>
                  <Plus className="size-4" />
                  تسجيل أول قيد
                </Button>
              )}
              {canManageTestData && (
                <Button
                  variant="outline"
                  onClick={handleSeed}
                  disabled={isSeeding}
                >
                  {isSeeding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  تحميل بيانات تجريبية (90 يومًا)
                </Button>
              )}
            </div>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* KPI strip — money figures only for roles allowed to see them */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="إجمالي الكميات المنتجة"
              value={formatM3(totals.productionM3)}
              icon={Layers}
              delta={deltas.productionM3}
              hint={`${formatNumber(totals.logs)} قيد إنتاج`}
            />
            <KpiCard
              label="الكميات المسلّمة للعملاء"
              value={formatM3(totals.deliveredM3)}
              icon={Truck}
              delta={deltas.deliveredM3}
              hint={`متوسط الحمولة ${formatNumber(totals.avgLoadPerTruck, 1)} م³/عربة`}
            />
            {financialsVisible ? (
              <>
                <KpiCard
                  label="إجمالي الإيرادات"
                  value={formatEGP(totals.revenue)}
                  icon={Wallet}
                  delta={deltas.revenue}
                  hint={`متوسط السعر ${formatNumber(totals.pricePerM3, 1)} ج.م/م³`}
                />
                <KpiCard
                  label="إجمالي التكاليف"
                  value={formatEGP(totals.cost)}
                  icon={Receipt}
                  delta={deltas.cost}
                  goodDirection="down"
                  hint={`تكلفة المتر ${formatNumber(totals.costPerM3, 1)} ج.م`}
                />
                <KpiCard
                  label="صافي الربح"
                  value={formatSignedEGP(totals.profit)}
                  icon={Banknote}
                  delta={deltas.profit}
                  hint={`هامش الربح ${formatPercent(totals.marginPct)}`}
                />
                <KpiCard
                  label="هامش الربح"
                  value={formatPercent(totals.marginPct)}
                  icon={Percent}
                  delta={deltas.marginPct}
                  deltaMode="points"
                  hint={`الفترة السابقة ${formatPercent(data.previous.marginPct)}`}
                />
              </>
            ) : (
              <>
                <KpiCard
                  label="الكميات المرتجعة"
                  value={formatM3(totals.returnedM3)}
                  icon={RotateCcw}
                  hint={`نسبة المرتجع ${formatPercent(totals.returnRatePct)}`}
                />
                <KpiCard
                  label="التسليم في الموعد"
                  value={formatPercent(totals.onTimePct)}
                  icon={Timer}
                  delta={deltas.onTimePct}
                  deltaMode="points"
                  hint={`${formatNumber(totals.trucks)} عربة مسجّلة`}
                />
                <KpiCard
                  label="معدل استخدام العربة"
                  value={formatM3(totals.avgLoadPerTruck, 1)}
                  icon={Gauge}
                  hint={`من ${TRUCK_CAPACITY_M3} م³ حمولة قصوى`}
                />
                <KpiCard
                  label="قيود الفترة"
                  value={formatNumber(totals.logs)}
                  icon={ClipboardList}
                  hint={`${formatNumber(totals.cancelled)} ملغي · كفاءة ${formatPercent(
                    totals.efficiencyPct,
                  )}`}
                />
              </>
            )}
          </div>

          {/* Money view first for finance roles, operations view for the floor */}
          <div className="grid gap-4 lg:grid-cols-3">
            {financialsVisible ? financialPanel : productionPanel}
            {mixPanel}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {financialsVisible ? productionPanel : roleRestrictionNotice}
            {customerPanel}
          </div>

          {/* Operations, shifts, today */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="مؤشرات التشغيل"
              description="كفاءة الإنتاج وجودة التسليم ومعدل الاستهلاك."
            >
              <div className="space-y-4">
                <MetricBar
                  label="كفاءة الإنتاج (مسلّم / منتج)"
                  percentage={totals.efficiencyPct}
                  detail={formatPercent(totals.efficiencyPct)}
                  tone="success"
                />
                <MetricBar
                  label="التسليم في الموعد المتفق عليه"
                  percentage={totals.onTimePct}
                  detail={formatPercent(totals.onTimePct)}
                  tone="primary"
                />
                <MetricBar
                  label="نسبة الكميات المرتجعة"
                  percentage={Math.min(100, totals.returnRatePct * 6)}
                  detail={formatPercent(totals.returnRatePct)}
                  tone={totals.returnRatePct > 4 ? "destructive" : "warning"}
                />
                <MetricBar
                  label={`معدل استخدام العربة (من ${TRUCK_CAPACITY_M3} م³)`}
                  percentage={(totals.avgLoadPerTruck / TRUCK_CAPACITY_M3) * 100}
                  detail={`${formatNumber(totals.avgLoadPerTruck, 1)} م³`}
                  tone="primary"
                />
                <div className="rounded-xl bg-muted/50 p-3 text-[11px] leading-5 text-muted-foreground">
                  عدد العربات المسجّلة في الفترة:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatNumber(totals.trucks)}
                  </span>{" "}
                  عربة · القيود الملغاة:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatNumber(totals.cancelled)}
                  </span>
                </div>
              </div>
            </Panel>

            <Panel
              title="أداء الورديات"
              description={
                financialsVisible
                  ? "توزيع الكميات والإيراد على ورديات التشغيل."
                  : "توزيع الكميات على ورديات التشغيل."
              }
            >
              <ul className="space-y-4">
                {byShift.map((shift) => (
                  <li key={shift.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {SHIFT_SHORT_LABELS[shift.key as Shift]}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatM3(shift.m3)}
                        {financialsVisible ? ` · ${formatEGP(shift.revenue)}` : ""}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.max(2, (shift.m3 / maxShiftM3) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              title="ملخص اليوم"
              description={formatDayWithWeekday(todaySummary.date)}
              action={
                access.can("createLog") ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/production?new=1")}
                  >
                    <Plus className="size-4" />
                    قيد جديد
                  </Button>
                ) : undefined
              }
            >
              <dl className="grid grid-cols-2 gap-4">
                {(financialsVisible
                  ? [
                      { label: "كمية منتجة", value: formatM3(todaySummary.productionM3) },
                      { label: "كمية مسلّمة", value: formatM3(todaySummary.deliveredM3) },
                      { label: "الإيراد", value: formatEGP(todaySummary.revenue) },
                      { label: "التكلفة", value: formatEGP(todaySummary.cost) },
                    ]
                  : [
                      { label: "كمية منتجة", value: formatM3(todaySummary.productionM3) },
                      { label: "كمية مسلّمة", value: formatM3(todaySummary.deliveredM3) },
                      { label: "كمية مرتجعة", value: formatM3(todaySummary.returnedM3) },
                      { label: "قيود اليوم", value: formatNumber(todaySummary.logs) },
                    ]
                ).map((item) => (
                  <div key={item.label}>
                    <dt className="text-[11px] text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div
                className={cn(
                  "mt-4 rounded-xl px-3 py-2.5 text-xs font-medium",
                  financialsVisible
                    ? todaySummary.profit >= 0
                      ? "bg-success/15 text-success"
                      : "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
                )}
              >
                {financialsVisible
                  ? `صافي ربح اليوم: ${formatSignedEGP(todaySummary.profit)}`
                  : `كفاءة اليوم: ${formatPercent(todaySummary.efficiencyPct)}`}
                {todaySummary.logs > 0 && (
                  <span className="ms-2 font-normal text-muted-foreground">
                    من {formatNumber(todaySummary.logs)} قيد
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Timer className="size-3.5" />
                نسبة التسليم في الموعد اليوم:{" "}
                {formatPercent(todaySummary.onTimePct)}
              </div>
            </Panel>
          </div>

          {/* Recent entries */}
          <Panel
            className="overflow-hidden"
            title="أحدث قيود الإنتاج"
            description="آخر 10 قيود مسجّلة على المحطة."
            bodyClassName="px-0 pb-0 pt-2"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/production">
                  كل القيود
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-5">التاريخ</TableHead>
                  <TableHead>الوردية</TableHead>
                  <TableHead>الخلطة</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead className="text-end">مسلّم (م³)</TableHead>
                  {financialsVisible && (
                    <>
                      <TableHead className="text-end">الإيراد</TableHead>
                      <TableHead className="text-end">الربح</TableHead>
                    </>
                  )}
                  <TableHead className="pe-5 text-end">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="ps-5 tabular-nums">
                      {formatDay(log.date)}
                    </TableCell>
                    <TableCell>{SHIFT_SHORT_LABELS[log.shift as Shift]}</TableCell>
                    <TableCell className="font-medium">{log.mixDesign}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {log.customer}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(log.deliveredM3, 1)}
                    </TableCell>
                    {financialsVisible && (
                      <>
                        <TableCell className="text-end tabular-nums">
                          {formatEGP(log.revenue)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-end font-medium tabular-nums",
                            log.profit >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {formatSignedEGP(log.profit)}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="pe-5 text-end">
                      <Badge
                        variant="outline"
                        className={cn(
                          log.status === "cancelled" &&
                            "border-destructive/40 bg-destructive/10 text-destructive",
                          log.status === "in_progress" &&
                            "border-warning/40 bg-warning/10 text-warning-foreground",
                          log.status === "delivered" && "text-muted-foreground",
                        )}
                      >
                        {STATUS_LABELS[log.status as LogStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
