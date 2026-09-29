import { AppShell } from "@/components/AppShell";
import { BranchFilter } from "@/components/BranchFilter";
import { Panel } from "@/components/Panel";
import { ProductionFormDialog } from "@/components/ProductionFormDialog";
import { RoleNotice } from "@/components/RoleNotice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import { accumulate, emptyBucket, summarize } from "@/convex/measures";
import type { Bucket, EnrichedLog } from "@/convex/measures";
import { canEditLog } from "@/convex/permissions";
import { useAccess } from "@/hooks/use-access";
import { useBranch } from "@/hooks/use-branch";
import { downloadCsv } from "@/lib/csv";
import {
  MIX_NAMES,
  SHIFT_SHORT_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/concrete";
import type { LogStatus, Shift } from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import {
  addDaysISO,
  formatDayWithWeekday,
  formatEGP,
  formatM3,
  formatNumber,
  formatPercent,
  formatSignedEGP,
  todayISO,
  windowStartISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Download,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

const RANGES = [
  { key: "1", label: "اليوم" },
  { key: "7", label: "7 أيام" },
  { key: "30", label: "30 يومًا" },
  { key: "90", label: "90 يومًا" },
];

function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div className="soft-card rounded-2xl border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tracking-tight tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Production() {
  const today = useMemo(() => todayISO(), []);
  const access = useAccess();
  const financialsVisible = access.can("viewFinancials");
  const canCreate = access.can("createLog");
  const canDelete = access.can("deleteLog");

  const [rangeKey, setRangeKey] = useState("30");
  const [customFrom, setCustomFrom] = useState(addDaysISO(today, -29));
  const [customTo, setCustomTo] = useState(today);
  const [mixFilter, setMixFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedLog | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EnrichedLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { branches, branchId, setBranchId } = useBranch();

  const range =
    rangeKey === "custom"
      ? { from: customFrom, to: customTo }
      : { from: windowStartISO(Number(rangeKey), today), to: today };

  const ledger = useQuery(api.production.list, { ...range, branchId });
  const allRows = ledger?.rows;
  const removeLog = useMutation(api.production.remove);
  // Hold the skeleton until the role is resolved so restricted roles never
  // flash money columns they are not allowed to see.
  const isLoading = !access.isReady || allRows === undefined;

  // «تسجيل قيد إنتاج» on the dashboard deep-links to /production?new=1 — the
  // dialog state is derived from the URL instead of synced with an effect.
  const wantsNew = searchParams.get("new") === "1";

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (open) return;
    setEditing(null);
    if (!wantsNew) return;
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  };

  const mixOptions = useMemo(() => {
    const found = new Set(MIX_NAMES);
    for (const row of allRows ?? []) found.add(row.mixDesign);
    return [...found].sort();
  }, [allRows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (allRows ?? []).filter((row) => {
      if (mixFilter !== "all" && row.mixDesign !== mixFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!term) return true;
      return [row.customer, row.mixDesign, row.site, row.orderRef]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [allRows, mixFilter, statusFilter, search]);

  const { daily, totals } = useMemo(() => {
    const map = new Map<string, Bucket>();
    for (const row of filtered) {
      const bucket = map.get(row.date) ?? emptyBucket(row.date);
      map.set(row.date, accumulate(bucket, row));
    }
    const days = [...map.values()].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    return { daily: days, totals: summarize(days) };
  }, [filtered]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await removeLog({ id: pendingDelete._id });
      toast.success("تم حذف القيد من السجل");
    } catch (error) {
      toast.error(readError(error, "تعذر حذف القيد"));
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const handleExport = () => {
    downloadCsv(
      `iconcrete-production-${range.from}_${range.to}.csv`,
      filtered.map((row) => ({
        التاريخ: row.date,
        الوردية: SHIFT_SHORT_LABELS[row.shift as Shift],
        الخلطة: row.mixDesign,
        العميل: row.customer,
        الموقع: row.site ?? "",
        "رقم الطلبية": row.orderRef ?? "",
        "كمية منتجة (م³)": row.quantityM3,
        "كمية مسلّمة (م³)": row.deliveredM3,
        "كمية مرتجعة (م³)": row.returnedM3,
        "عدد العربات": row.truckCount,
        "التسليم في الموعد": row.onTime ? "نعم" : "لا",
        الحالة: STATUS_LABELS[row.status as LogStatus],
        ...(financialsVisible
          ? {
              "سعر المتر (ج.م)": row.pricePerM3,
              "تكلفة المتر (ج.م)": row.costPerM3,
              "الإيراد (ج.م)": row.revenue,
              "التكلفة (ج.م)": row.cost,
              "صافي الربح (ج.م)": row.profit,
              "هامش الربح (%)": row.marginPct,
            }
          : {}),
      })),
    );
  };

  const actions = (
    <>
      <BranchFilter branches={branches} value={branchId} onChange={setBranchId} />
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={filtered.length === 0}
      >
        <Download className="size-4" />
        تصدير CSV
      </Button>
      {canCreate && (
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          قيد إنتاج جديد
        </Button>
      )}
    </>
  );

  return (
    <AppShell
      eyebrow={
        financialsVisible ? "إدخال ومراجعة بيانات اليوم" : "إدخال بيانات اليوم"
      }
      title="الإنتاج والكميات اليومية"
      description="سجّل كميات الخرسانة لكل وردية وعميل، وراجع الإيراد والتكلفة وصافي الربح قبل إغلاق الوردية."
      actions={actions}
    >
      {!financialsVisible && (
        <RoleNotice
          className="mb-4 p-4"
          icon={Lock}
          title={`دورك الحالي: ${access.label}`}
          message="تُسجَّل الكميات والخلطات والمواعيد كما هي، ويُسعّر القيد تلقائيًا من قائمة الأسعار المعتمدة للمحطة."
          hint="الأرقام المالية (سعر المتر، التكلفة، الربح، الهامش) متاحة للمالك والمدير والمراجع. يمكن لمالك النظام ترقية دورك من شاشة الفريق والصلاحيات."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/team">الفريق والصلاحيات</Link>
            </Button>
          }
        />
      )}

      {/* Filters */}
      <div className="soft-card mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">الفترة</p>
          <ToggleGroup
            type="single"
            value={rangeKey}
            onValueChange={(value) => value && setRangeKey(value)}
            variant="outline"
            size="sm"
            spacing={1}
            className="gap-1 rounded-full bg-muted/50 p-0.5"
          >
            {RANGES.map((rangeItem) => (
              <ToggleGroupItem
                key={rangeItem.key}
                value={rangeItem.key}
                className="rounded-full px-3 text-xs"
              >
                {rangeItem.label}
              </ToggleGroupItem>
            ))}
            <ToggleGroupItem value="custom" className="rounded-full px-3 text-xs">
              مخصص
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {rangeKey === "custom" && (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">من</p>
              <Input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-9 w-[9.5rem]"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">إلى</p>
              <Input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-9 w-[9.5rem]"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">الخلطة</p>
          <Select value={mixFilter} onValueChange={setMixFilter}>
            <SelectTrigger className="h-9 w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الخلطات</SelectItem>
              {mixOptions.map((mix) => (
                <SelectItem key={mix} value={mix}>
                  {mix}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">الحالة</p>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">بحث</p>
          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="اسم العميل، الموقع، أو رقم الطلبية"
              className="h-9 pe-9"
            />
          </div>
        </div>
      </div>

      {/* Period totals */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="كمية منتجة"
          value={formatM3(totals.productionM3)}
          hint={`${formatNumber(totals.logs)} قيد · ${formatNumber(totals.cancelled)} ملغي`}
        />
        <StatTile
          label="كمية مسلّمة"
          value={formatM3(totals.deliveredM3)}
          hint={`مرتجع ${formatM3(totals.returnedM3)} · كفاءة ${formatPercent(
            totals.efficiencyPct,
          )}`}
        />
        <StatTile
          label="التسليم في الموعد"
          value={formatPercent(totals.onTimePct)}
          hint={`${formatNumber(totals.trucks)} عربة · ${formatNumber(
            totals.avgLoadPerTruck,
            1,
          )} م³/عربة`}
        />
        {financialsVisible ? (
          <>
            <StatTile
              label="الإيراد"
              value={formatEGP(totals.revenue)}
              hint={`متوسط السعر ${formatNumber(totals.pricePerM3, 1)} ج.م/م³`}
            />
            <StatTile
              label="التكلفة"
              value={formatEGP(totals.cost)}
              hint={`تكلفة المتر ${formatNumber(totals.costPerM3, 1)} ج.م`}
            />
            <StatTile
              label="صافي الربح"
              value={formatSignedEGP(totals.profit)}
              hint={`هامش ${formatPercent(totals.marginPct)}`}
              tone={totals.profit >= 0 ? "success" : "danger"}
            />
          </>
        ) : (
          <>
            <StatTile
              label="الكمية المرتجعة"
              value={formatM3(totals.returnedM3)}
              hint={`نسبة المرتجع ${formatPercent(totals.returnRatePct)}`}
            />
            <StatTile
              label="كفاءة الإنتاج"
              value={formatPercent(totals.efficiencyPct)}
              hint="الكمية المسلّمة من الكمية المنتجة"
            />
            <StatTile
              label="قيود الفترة"
              value={formatNumber(totals.logs)}
              hint={`${formatNumber(allRows?.length ?? 0)} قيد في النطاق الزمني`}
            />
          </>
        )}
      </div>

      {/* Daily summary */}
      <Panel
        className="mt-4 overflow-hidden"
        title="الملخص اليومي"
        description={
          financialsVisible
            ? "مجموع الكميات والأرباح لكل يوم في الفترة المحددة."
            : "مجموع الكميات لكل يوم في الفترة المحددة."
        }
        bodyClassName="px-0 pb-0 pt-2"
      >
        {isLoading ? (
          <div className="px-5 pb-5">
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : daily.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            لا توجد قيود في هذه الفترة.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-5">التاريخ</TableHead>
                <TableHead className="text-end">قيود</TableHead>
                <TableHead className="text-end">منتج (م³)</TableHead>
                <TableHead className="text-end">مسلّم (م³)</TableHead>
                <TableHead className="text-end">مرتجع (م³)</TableHead>
                {financialsVisible && (
                  <>
                    <TableHead className="text-end">الإيراد</TableHead>
                    <TableHead className="text-end">التكلفة</TableHead>
                    <TableHead className="text-end">صافي الربح</TableHead>
                    <TableHead className="pe-5 text-end">الهامش</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.map((day) => {
                const profit = day.revenue - day.cost;
                const margin = day.revenue > 0 ? (profit / day.revenue) * 100 : 0;
                return (
                  <TableRow key={day.date}>
                    <TableCell className="ps-5 font-medium">
                      {formatDayWithWeekday(day.date)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(day.logs)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(day.productionM3, 1)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(day.deliveredM3, 1)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums text-muted-foreground">
                      {formatNumber(day.returnedM3, 1)}
                    </TableCell>
                    {financialsVisible && (
                      <>
                        <TableCell className="text-end tabular-nums">
                          {formatEGP(day.revenue)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatEGP(day.cost)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-end font-medium tabular-nums",
                            profit >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {formatSignedEGP(profit)}
                        </TableCell>
                        <TableCell className="pe-5 text-end tabular-nums">
                          {formatPercent(margin)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {/* Ledger */}
      <Panel
        className="mt-4 overflow-hidden"
        title="قيود الإنتاج"
        description={`${formatNumber(filtered.length)} قيدًا مطابقًا للفلاتر الحالية.`}
        bodyClassName="px-0 pb-0 pt-2"
      >
        {isLoading ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 pb-6 pt-2 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Truck className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium">لا توجد قيود مطابقة</p>
            <p className="mt-1 text-xs text-muted-foreground">
              عدّل الفلاتر أو سجّل قيد إنتاج جديدًا لهذا اليوم.
            </p>
            {canCreate && (
              <Button
                className="mt-4"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                تسجيل قيد إنتاج
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-5">التاريخ</TableHead>
                <TableHead>الوردية</TableHead>
                <TableHead>الخلطة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead className="hidden lg:table-cell">الموقع</TableHead>
                <TableHead className="hidden xl:table-cell">رقم الطلبية</TableHead>
                <TableHead className="text-end">منتج</TableHead>
                <TableHead className="text-end">مسلّم</TableHead>
                <TableHead className="hidden text-end lg:table-cell">مرتجع</TableHead>
                {financialsVisible && (
                  <>
                    <TableHead className="text-end">سعر/م³</TableHead>
                    <TableHead className="hidden text-end lg:table-cell">
                      تكلفة/م³
                    </TableHead>
                    <TableHead className="text-end">الربح</TableHead>
                  </>
                )}
                <TableHead className="text-end">التوقيت</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="pe-5 text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const canEditRow = canEditLog(access.viewer, row, today);
                return (
                  <TableRow key={row._id}>
                    <TableCell className="ps-5 tabular-nums">
                      {formatDayWithWeekday(row.date)}
                    </TableCell>
                    <TableCell>{SHIFT_SHORT_LABELS[row.shift as Shift]}</TableCell>
                    <TableCell className="font-medium">{row.mixDesign}</TableCell>
                    <TableCell className="max-w-[14rem] truncate">
                      {row.customer}
                      {row.isTestData && (
                        <Badge
                          variant="outline"
                          className="ms-2 border-warning/40 bg-warning/10 text-[10px] text-warning-foreground"
                        >
                          تجريبي
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate text-muted-foreground lg:table-cell">
                      {row.site ?? "—"}
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground xl:table-cell">
                      {row.orderRef ?? "—"}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(row.quantityM3, 1)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(row.deliveredM3, 1)}
                    </TableCell>
                    <TableCell className="hidden text-end tabular-nums text-muted-foreground lg:table-cell">
                      {formatNumber(row.returnedM3, 1)}
                    </TableCell>
                    {financialsVisible && (
                      <>
                        <TableCell className="text-end tabular-nums">
                          {formatNumber(row.pricePerM3)}
                        </TableCell>
                        <TableCell className="hidden text-end tabular-nums lg:table-cell">
                          {formatNumber(row.costPerM3)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-end font-medium tabular-nums",
                            row.profit >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {formatSignedEGP(row.profit)}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-end">
                      <Badge
                        variant="outline"
                        className={cn(
                          row.onTime
                            ? "border-success/40 bg-success/10 text-success"
                            : "border-destructive/40 bg-destructive/10 text-destructive",
                        )}
                      >
                        {row.onTime ? "في الموعد" : "متأخر"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          row.status === "cancelled" &&
                            "border-destructive/40 bg-destructive/10 text-destructive",
                          row.status === "in_progress" &&
                            "border-warning/40 bg-warning/10 text-warning-foreground",
                          row.status === "delivered" && "text-muted-foreground",
                        )}
                      >
                        {STATUS_LABELS[row.status as LogStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="pe-5">
                      <div className="flex items-center justify-end gap-1">
                        {canEditRow ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="تعديل القيد"
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : (
                          <span
                            className="grid size-8 place-items-center text-muted-foreground/50"
                            title="تعديل هذا القيد خارج نطاق دورك"
                          >
                            <Lock className="size-3.5" />
                          </span>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="حذف القيد"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setPendingDelete(row)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="ps-5 font-semibold" colSpan={6}>
                  الإجمالي ({formatNumber(filtered.length)} قيد)
                </TableCell>
                <TableCell className="text-end font-semibold tabular-nums">
                  {formatNumber(totals.productionM3, 1)}
                </TableCell>
                <TableCell className="text-end font-semibold tabular-nums">
                  {formatNumber(totals.deliveredM3, 1)}
                </TableCell>
                <TableCell className="hidden text-end font-semibold tabular-nums lg:table-cell">
                  {formatNumber(totals.returnedM3, 1)}
                </TableCell>
                {financialsVisible ? (
                  <>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {formatNumber(totals.pricePerM3, 1)}
                    </TableCell>
                    <TableCell className="hidden text-end font-semibold tabular-nums lg:table-cell">
                      {formatNumber(totals.costPerM3, 1)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-end font-semibold tabular-nums",
                        totals.profit >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatSignedEGP(totals.profit)}
                    </TableCell>
                  </>
                ) : null}
                <TableCell
                  colSpan={3}
                  className="pe-5 text-end text-muted-foreground"
                >
                  {financialsVisible
                    ? `إيراد ${formatEGP(totals.revenue)}`
                    : `إجمالي مسلّم ${formatM3(totals.deliveredM3)}`}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Panel>

      <ProductionFormDialog
        open={dialogOpen || wantsNew}
        onOpenChange={closeDialog}
        log={dialogOpen ? editing : null}
        defaultDate={range.to}
        branches={branches}
        defaultBranchId={branchId}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle>حذف قيد الإنتاج؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف قيد {pendingDelete?.customer} بتاريخ{" "}
              {pendingDelete ? formatDayWithWeekday(pendingDelete.date) : ""} نهائيًا
              من السجل، وسيختفي أثره من المؤشرات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
