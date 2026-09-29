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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/hooks/use-access";
import { useBranch } from "@/hooks/use-branch";
import { downloadCsv } from "@/lib/csv";
import {
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_CATEGORY_ORDER,
  MATERIAL_UNIT_LABELS,
  MATERIAL_UNIT_ORDER,
  MOVEMENT_KIND_LABELS,
  MOVEMENT_KIND_ORDER,
  STOCK_STATUS_LABELS,
} from "@/lib/concrete";
import type {
  MaterialCategory,
  MaterialUnit,
  MovementKind,
  StockStatus,
} from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import { formatDay, formatEGP, formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Coins,
  Download,
  Loader2,
  Lock,
  Package,
  Pencil,
  Plus,
  Save,
  Scale,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const RANGES = [
  { days: 7, label: "7 أيام" },
  { days: 30, label: "30 يومًا" },
  { days: 90, label: "90 يومًا" },
];

const STATUS_TONE: Record<StockStatus, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  low: "border-warning/40 bg-warning/15 text-warning",
  negative: "border-destructive/40 bg-destructive/10 text-destructive",
  idle: "border-border bg-muted text-muted-foreground",
};

type MaterialForm = {
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  openingQty: string;
  reorderLevel: string;
  standardCost: string;
  supplier: string;
  isActive: boolean;
};

const emptyMaterial: MaterialForm = {
  name: "",
  category: "cement",
  unit: "ton",
  openingQty: "0",
  reorderLevel: "0",
  standardCost: "0",
  supplier: "",
  isActive: true,
};

type MaterialOption = {
  _id: Id<"materials">;
  name: string;
  unit: MaterialUnit;
  category: MaterialCategory;
  supplier: string | null;
  openingQty: number;
  reorderLevel: number;
  standardCost: number;
};

function MaterialDialog({
  open,
  onOpenChange,
  material,
  branchId,
  financialsVisible,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: MaterialOption | null;
  branchId: Id<"branches"> | undefined;
  financialsVisible: boolean;
}) {
  const create = useMutation(api.inventory.createMaterial);
  const update = useMutation(api.inventory.updateMaterial);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MaterialForm>(emptyMaterial);

  useEffect(() => {
    if (!open) return;
    setForm(
      material
        ? {
            name: material.name,
            category: material.category,
            unit: material.unit,
            openingQty: String(material.openingQty),
            reorderLevel: String(material.reorderLevel),
            standardCost: String(material.standardCost),
            supplier: material.supplier ?? "",
            isActive: material.isActive,
          }
        : emptyMaterial,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material]);

  const set = <K extends keyof MaterialForm>(key: K, value: MaterialForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        branchId,
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        openingQty: Number(form.openingQty) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        standardCost: Number(form.standardCost) || 0,
        supplier: form.supplier.trim() || undefined,
        isActive: form.isActive,
      };
      if (material) {
        await update({ id: material._id, ...payload });
        toast.success("تم تحديث بيانات المادة");
      } else {
        await create(payload);
        toast.success("تمت إضافة المادة");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(readError(error, "تعذر حفظ المادة"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-start">
          <DialogTitle>{material ? "تعديل مادة" : "إضافة مادة"}</DialogTitle>
          <DialogDescription>
            الرصيد دائمًا محسوب من الحركات: الرصيد الافتتاحي + الاستلام − الصرف ±
            تسويات الجرد.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">اسم المادة</Label>
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="أسمنت بورتلاندي CEM I 42.5"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">التصنيف</Label>
            <Select
              value={form.category}
              onValueChange={(value) => set("category", value as MaterialCategory)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_CATEGORY_ORDER.map((category) => (
                  <SelectItem key={category} value={category}>
                    {MATERIAL_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">وحدة القياس</Label>
            <Select
              value={form.unit}
              onValueChange={(value) => set("unit", value as MaterialUnit)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_UNIT_ORDER.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {MATERIAL_UNIT_LABELS[unit]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الرصيد الافتتاحي</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.openingQty}
              onChange={(event) => set("openingQty", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">حد إعادة الطلب</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.reorderLevel}
              onChange={(event) => set("reorderLevel", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">التكلفة المعيارية للوحدة</Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.standardCost}
              onChange={(event) => set("standardCost", event.target.value)}
              disabled={!financialsVisible}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">المورد</Label>
            <Input
              value={form.supplier}
              onChange={(event) => set("supplier", event.target.value)}
              placeholder="اسم المورد"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 sm:col-span-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(value) => set("isActive", value)}
            />
            <span className="text-xs text-muted-foreground">
              {form.isActive ? "المادة مفعّلة في المخزن" : "المادة موقوفة"}
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

function MovementDialog({
  open,
  onOpenChange,
  materials,
  branchId,
  financialsVisible,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materials: MaterialOption[];
  branchId: Id<"branches"> | undefined;
  financialsVisible: boolean;
}) {
  const record = useMutation(api.inventory.recordMovement);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    kind: "receipt" as MovementKind,
    materialId: "",
    quantity: "",
    unitCost: "",
    supplier: "",
    reference: "",
    note: "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selected = materials.find((material) => material._id === form.materialId);

  const submit = async () => {
    setSaving(true);
    try {
      await record({
        branchId,
        date: form.date,
        kind: form.kind,
        materialId: form.materialId as Id<"materials">,
        quantity: Number(form.quantity) || 0,
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        supplier: form.supplier.trim() || undefined,
        reference: form.reference.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      toast.success("تم تسجيل حركة المخزن");
      onOpenChange(false);
      setForm((prev) => ({ ...prev, quantity: "", unitCost: "", reference: "", note: "" }));
    } catch (error) {
      toast.error(readError(error, "تعذر تسجيل الحركة"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-start">
          <DialogTitle>تسجيل حركة مخزن</DialogTitle>
          <DialogDescription>
            كل حركة تُكتب في سجل التتبع باسم من سجّلها ووقت التسجيل، وتُعاد بها حساب
            الأرصدة فورًا.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">نوع الحركة</Label>
            <Select
              value={form.kind}
              onValueChange={(value) => set("kind", value as MovementKind)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_KIND_ORDER.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {MOVEMENT_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">التاريخ</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(event) => set("date", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">المادة</Label>
            <Select
              value={form.materialId}
              onValueChange={(value) => set("materialId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر المادة" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material._id} value={material._id}>
                    {material.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              الكمية {selected ? `(${MATERIAL_UNIT_LABELS[selected.unit]})` : ""}
            </Label>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.quantity}
              onChange={(event) => set("quantity", event.target.value)}
              placeholder="0"
            />
            {form.kind === "adjustment" && (
              <p className="text-[11px] text-muted-foreground">
                التسوية تقبل قيمة سالبة عند وجود عجز في الجرد.
              </p>
            )}
          </div>
          {financialsVisible ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">تكلفة الوحدة (ج.م)</Label>
              <Input
                type="number"
                step="any"
                inputMode="decimal"
                value={form.unitCost}
                onChange={(event) => set("unitCost", event.target.value)}
                placeholder={selected ? String(selected.standardCost) : "0"}
              />
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-[11px] leading-5 text-muted-foreground">
                دورك لا يشمل إدخال التكاليف — تُسجَّل الكميات فقط.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">المورد</Label>
            <Input
              value={form.supplier}
              onChange={(event) => set("supplier", event.target.value)}
              placeholder={selected?.supplier ?? "اسم المورد"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">المرجع</Label>
            <Input
              value={form.reference}
              onChange={(event) => set("reference", event.target.value)}
              placeholder="رقم الإذن أو أمر الشراء"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">ملاحظة</Label>
            <Textarea
              rows={2}
              value={form.note}
              onChange={(event) => set("note", event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !form.materialId || !Number(form.quantity)}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            تسجيل الحركة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const access = useAccess();
  const { branches, branchId, setBranchId } = useBranch();
  const [days, setDays] = useState(30);
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [materialDialog, setMaterialDialog] = useState<{
    open: boolean;
    material: MaterialOption | null;
  }>({ open: false, material: null });
  const [movementOpen, setMovementOpen] = useState(false);
  const today = useMemo(() => todayISO(), []);
  const data = useQuery(api.inventory.overview, { days, today, branchId });
  const removeMaterial = useMutation(api.inventory.removeMaterial);
  const removeMovement = useMutation(api.inventory.removeMovement);

  const canManage = access.can("manageInventory");
  const financialsVisible = data?.financialsVisible ?? false;

  const materials = useMemo<MaterialOption[]>(
    () =>
      (data?.materials ?? []).map((row) => ({
        _id: row._id,
        name: row.name,
        unit: row.unit as MaterialUnit,
        category: row.category as MaterialCategory,
        supplier: row.supplier,
        openingQty: row.openingQty,
        reorderLevel: row.reorderLevel,
        standardCost: row.standardCost,
        isActive: row.isActive,
      })),
    [data],
  );

  const ledger = useMemo(() => {
    const rows = data?.ledger ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (!needle) return true;
      return [row.materialName, row.supplier, row.reference, row.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, kindFilter, search]);

  const handleDeleteMaterial = async (row: MaterialOption) => {
    try {
      await removeMaterial({ id: row._id });
      toast.success(`تم حذف المادة «${row.name}»`);
    } catch (error) {
      toast.error(readError(error, "تعذر حذف المادة"));
    }
  };

  const handleDeleteMovement = async (id: Id<"materialMovements">) => {
    try {
      await removeMovement({ id });
      toast.success("تم حذف الحركة");
    } catch (error) {
      toast.error(readError(error, "تعذر حذف الحركة"));
    }
  };

  const exportBalances = () => {
    downloadCsv(
      `stock-balances-${today}.csv`,
      materials.map((material) => {
        const row = data?.materials.find((item) => item._id === material._id);
        return {
          "المادة": material.name,
          "التصنيف": MATERIAL_CATEGORY_LABELS[material.category],
          "الوحدة": MATERIAL_UNIT_LABELS[material.unit],
          "الرصيد": row?.balance ?? 0,
          "حد إعادة الطلب": material.reorderLevel,
          ...(financialsVisible
            ? { "قيمة المخزون": row?.value ?? 0 }
            : {}),
        };
      }),
    );
  };

  return (
    <AppShell
      eyebrow="المخازن والمواد"
      title="أرصدة المواد وحركتها اليومية"
      description="الأسمنت والركام والرمل والإضافات: استلام وصرف للخلاطة وتسويات جرد، مع رصيد محسوب لحظيًا وتنبيه عند النقص."
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
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMaterialDialog({ open: true, material: null })}
              >
                <Plus className="size-4" />
                مادة
              </Button>
              <Button size="sm" onClick={() => setMovementOpen(true)}>
                <Plus className="size-4" />
                حركة مخزن
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
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="مواد مسجّلة"
              value={formatNumber(data.totals.materials)}
              hint={`${formatNumber(data.totals.monthReceipts)} استلامة في آخر ٣٠ يومًا`}
              icon={Boxes}
              tone="primary"
            />
            <StatTile
              label="مواد تحت حد إعادة الطلب"
              value={formatNumber(data.totals.lowStock)}
              hint={
                data.totals.lowStock > 0
                  ? "راجع أمر التوريد قبل التأثير على الإنتاج"
                  : "كل الأرصدة أعلى من الحدود المحددة"
              }
              icon={TriangleAlert}
              tone={data.totals.lowStock > 0 ? "destructive" : "success"}
            />
            <StatTile
              label="قيمة المخزون"
              value={financialsVisible ? formatEGP(data.totals.stockValue) : "محجوب"}
              hint={
                financialsVisible
                  ? "الرصيد الحالي × التكلفة المعيارية"
                  : "الأسعار متاحة للمالك والمدير والمراجع"
              }
              icon={Coins}
              tone="default"
            />
            <StatTile
              label="مشتريات آخر ٣٠ يومًا"
              value={financialsVisible ? formatEGP(data.totals.purchaseValue) : "محجوب"}
              hint={`${formatNumber(data.totals.monthIssues)} صرف للخلاطة في نفس الفترة`}
              icon={Package}
              tone="default"
            />
          </div>

          {data.lowStock.length > 0 && (
            <Panel
              title="تنبيه نقص المخزون"
              description="مواد وصل رصيدها إلى حد إعادة الطلب أو أقل — تُدرج تلقائيًا في تنبيهات المحطة اليومية."
              action={
                <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">
                  {formatNumber(data.lowStock.length)} مادة
                </Badge>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.lowStock.map((item) => (
                  <div
                    key={item._id}
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      item.status === "negative"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-warning/40 bg-warning/10",
                    )}
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      الرصيد {formatNumber(item.balance, 1)}{" "}
                      {MATERIAL_UNIT_LABELS[item.unit as MaterialUnit]} · الحد{" "}
                      {formatNumber(item.reorderLevel, 1)}
                    </p>
                    <p className="mt-1 text-[11px] font-medium">
                      {item.coveredDays > 0
                        ? `يكفي نحو ${formatNumber(item.coveredDays, 1)} يوم`
                        : STOCK_STATUS_LABELS[item.status as StockStatus]}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel
            title="أرصدة المواد"
            description={`رصيد كل مادة محسوب من الحركات، مع معدل الاستهلاك اليومي والتغطية المتوقعة (${days} يومًا).`}
            action={
              <Button variant="outline" size="sm" onClick={exportBalances} disabled={materials.length === 0}>
                <Download className="size-4" />
                تصدير CSV
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المادة</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead className="text-end">افتتاحي</TableHead>
                    <TableHead className="text-end">استلام</TableHead>
                    <TableHead className="text-end">صرف</TableHead>
                    <TableHead className="text-end">تسويات</TableHead>
                    <TableHead className="text-end">الرصيد</TableHead>
                    <TableHead className="text-end">حد الطلب</TableHead>
                    <TableHead className="text-end">تغطية (يوم)</TableHead>
                    {financialsVisible && <TableHead className="text-end">القيمة</TableHead>}
                    <TableHead>الحالة</TableHead>
                    {canManage && <TableHead className="text-end">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.materials.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className="font-medium">
                        {row.name}
                        <span className="ms-1 text-[11px] text-muted-foreground">
                          ({MATERIAL_UNIT_LABELS[row.unit as MaterialUnit]})
                        </span>
                        {!row.isActive && (
                          <Badge variant="outline" className="ms-2 text-muted-foreground">
                            موقوفة
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {MATERIAL_CATEGORY_LABELS[row.category as MaterialCategory]}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">
                        {formatNumber(row.openingQty, 1)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        <span className="text-success">{formatNumber(row.received, 1)}</span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        <span className="text-muted-foreground">
                          {formatNumber(row.issued, 1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">
                        {formatNumber(row.adjusted, 1)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums font-semibold">
                        {formatNumber(row.balance, 1)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">
                        {formatNumber(row.reorderLevel, 1)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {row.dailyUsage > 0 ? formatNumber(row.coveredDays, 1) : "—"}
                      </TableCell>
                      {financialsVisible && (
                        <TableCell className="text-end tabular-nums">
                          {formatEGP(row.value)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_TONE[row.status as StockStatus]}
                        >
                          {STOCK_STATUS_LABELS[row.status as StockStatus]}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="تعديل"
                              onClick={() =>
                                setMaterialDialog({
                                  open: true,
                                  material: materials.find((m) => m._id === row._id) ?? null,
                                })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="حذف"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                const material = materials.find((m) => m._id === row._id);
                                if (material) handleDeleteMaterial(material);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {data.materials.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 12 : 11}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        لا توجد مواد مسجّلة بعد — ابدأ بإضافة الأسمنت والركام.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Panel>

          {!financialsVisible && (
            <RoleNotice
              icon={Lock}
              title="التكاليف وقيمة المخزون محجوبة عن دورك"
              message="يمكنك تسجيل الكميات ومتابعة الأرصدة والنقص، بينما تظهر القيم المالية للمالك والمدير والمراجع."
            />
          )}

          <Panel
            title="سجل الحركات"
            description={`آخر ${formatNumber(ledger.length)} حركة داخل الفترة المحددة.`}
          >
            <div className="flex flex-wrap gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث بالمادة أو المورد أو المرجع"
                className="max-w-xs"
              />
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger className="w-[12rem]">
                  <SelectValue placeholder="كل الحركات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحركات</SelectItem>
                  {MOVEMENT_KIND_ORDER.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {MOVEMENT_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المادة</TableHead>
                    <TableHead>الحركة</TableHead>
                    <TableHead className="text-end">الكمية</TableHead>
                    {financialsVisible && (
                      <>
                        <TableHead className="text-end">تكلفة الوحدة</TableHead>
                        <TableHead className="text-end">الإجمالي</TableHead>
                      </>
                    )}
                    <TableHead>المورد / المرجع</TableHead>
                    {canManage && <TableHead className="text-end">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDay(row.date)}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate font-medium">
                        {row.materialName}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          {row.kind === "receipt" ? (
                            <ArrowDownToLine className="size-3.5 text-success" />
                          ) : row.kind === "issue" ? (
                            <ArrowUpFromLine className="size-3.5 text-muted-foreground" />
                          ) : (
                            <Scale className="size-3.5 text-warning" />
                          )}
                          {MOVEMENT_KIND_LABELS[row.kind as MovementKind]}
                        </span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        <span
                          className={cn(
                            "font-medium",
                            row.kind === "receipt" && "text-success",
                            row.kind === "adjustment" && "text-warning",
                          )}
                        >
                          {formatNumber(row.quantity, 1)}{" "}
                          {MATERIAL_UNIT_LABELS[row.unit as MaterialUnit]}
                        </span>
                      </TableCell>
                      {financialsVisible && (
                        <>
                          <TableCell className="text-end tabular-nums text-muted-foreground">
                            {row.unitCost ? formatEGP(row.unitCost) : "—"}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {row.total ? formatEGP(row.total) : "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                        {[row.supplier, row.reference].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="حذف"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteMovement(row._id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {ledger.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={financialsVisible ? (canManage ? 8 : 7) : canManage ? 6 : 5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        لا توجد حركات مطابقة للفلاتر الحالية.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </div>
      )}

      <MaterialDialog
        open={materialDialog.open}
        onOpenChange={(open) => setMaterialDialog((prev) => ({ ...prev, open }))}
        material={materialDialog.material}
        branchId={branchId}
        financialsVisible={financialsVisible}
      />
      <MovementDialog
        open={movementOpen}
        onOpenChange={setMovementOpen}
        materials={materials}
        branchId={branchId}
        financialsVisible={financialsVisible}
      />
    </AppShell>
  );
}
