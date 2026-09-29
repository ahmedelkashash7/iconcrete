import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Panel";
import { RoleNotice } from "@/components/RoleNotice";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/hooks/use-access";
import { useBranch } from "@/hooks/use-branch";
import { errorMessage as readError } from "@/lib/errors";
import { formatEGP, formatFullDate, formatNumber, formatPercent } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  FlaskConical,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Branch dialog                                                       */
/* ------------------------------------------------------------------ */

type BranchForm = {
  code: string;
  name: string;
  city: string;
  address: string;
  managerName: string;
  phone: string;
  capacityM3Day: string;
  isActive: boolean;
  notes: string;
};

const emptyBranch: BranchForm = {
  code: "",
  name: "",
  city: "",
  address: "",
  managerName: "",
  phone: "",
  capacityM3Day: "1200",
  isActive: true,
  notes: "",
};

function BranchDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: {
    _id: Id<"branches">;
    code: string;
    name: string;
    city: string | null;
    address: string | null;
    managerName: string | null;
    phone: string | null;
    capacityM3Day: number;
    isActive: boolean;
    notes: string | null;
  } | null;
}) {
  const create = useMutation(api.branches.create);
  const update = useMutation(api.branches.update);
  const [form, setForm] = useState<BranchForm>(() =>
    branch
      ? {
          code: branch.code,
          name: branch.name,
          city: branch.city ?? "",
          address: branch.address ?? "",
          managerName: branch.managerName ?? "",
          phone: branch.phone ?? "",
          capacityM3Day: String(branch.capacityM3Day),
          isActive: branch.isActive,
          notes: branch.notes ?? "",
        }
      : emptyBranch,
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof BranchForm>(key: K, value: BranchForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        city: form.city.trim() || undefined,
        address: form.address.trim() || undefined,
        managerName: form.managerName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        capacityM3Day: Number(form.capacityM3Day) || 0,
        isActive: form.isActive,
        notes: form.notes.trim() || undefined,
      };
      if (branch) {
        await update({ id: branch._id, ...payload });
        toast.success("تم تحديث بيانات الفرع");
      } else {
        await create(payload);
        toast.success("تمت إضافة الفرع");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(readError(error, "تعذر حفظ الفرع"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-start">
          <DialogTitle>{branch ? "تعديل فرع" : "إضافة فرع جديد"}</DialogTitle>
          <DialogDescription>
            كل قيد إنتاج واختبار جودة وحركة مخزون ترتبط بفرع، فتظهر تقارير كل محطة
            على حدة أو مجمعة للمجموعة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">كود الفرع</Label>
            <Input
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              placeholder="ALX-02"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">اسم الفرع</Label>
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="محطة الإسكندرية"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">المدينة</Label>
            <Input
              value={form.city}
              onChange={(event) => set("city", event.target.value)}
              placeholder="الإسكندرية"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">مدير الفرع</Label>
            <Input
              value={form.managerName}
              onChange={(event) => set("managerName", event.target.value)}
              placeholder="اسم المسؤول"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الهاتف</Label>
            <Input
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="+20 100 000 0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الطاقة الإنتاجية (م³/يوم)</Label>
            <Input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.capacityM3Day}
              onChange={(event) => set("capacityM3Day", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">العنوان</Label>
            <Input
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
              placeholder="المنطقة الصناعية - الطريق الدائري"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">ملاحظات</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="أي ملاحظات تشغيلية على الفرع"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 sm:col-span-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(value) => set("isActive", value)}
            />
            <span className="text-xs text-muted-foreground">
              {form.isActive
                ? "الفرع يعمل ويظهر في قوائم الإدخال"
                : "الفرع موقوف — يبقى في التقارير التاريخية فقط"}
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

/* ------------------------------------------------------------------ */
/* Mix price dialog                                                    */
/* ------------------------------------------------------------------ */

type MixForm = {
  name: string;
  price: string;
  cost: string;
  strengthMpa: string;
  cementKgPerM3: string;
  notes: string;
  isActive: boolean;
};

const emptyMix: MixForm = {
  name: "",
  price: "",
  cost: "",
  strengthMpa: "",
  cementKgPerM3: "",
  notes: "",
  isActive: true,
};

function MixDialog({
  open,
  onOpenChange,
  mix,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mix?: {
    _id: Id<"mixPrices">;
    name: string;
    strengthMpa: number;
    cementKgPerM3: number | null;
    notes: string | null;
    isActive: boolean;
    price: number;
    cost: number;
  } | null;
}) {
  const upsert = useMutation(api.settings.upsertMix);
  const [form, setForm] = useState<MixForm>(() =>
    mix
      ? {
          name: mix.name,
          price: String(mix.price),
          cost: String(mix.cost),
          strengthMpa: String(mix.strengthMpa),
          cementKgPerM3: mix.cementKgPerM3 ? String(mix.cementKgPerM3) : "",
          notes: mix.notes ?? "",
          isActive: mix.isActive,
        }
      : emptyMix,
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MixForm>(key: K, value: MixForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const price = Number(form.price) || 0;
  const cost = Number(form.cost) || 0;
  const margin = price - cost;

  const submit = async () => {
    setSaving(true);
    try {
      await upsert({
        id: mix?._id,
        name: form.name.trim(),
        price,
        cost,
        strengthMpa: form.strengthMpa ? Number(form.strengthMpa) : undefined,
        cementKgPerM3: form.cementKgPerM3 ? Number(form.cementKgPerM3) : undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      });
      toast.success(mix ? "تم تحديث الخلطة" : "تمت إضافة الخلطة");
      onOpenChange(false);
    } catch (error) {
      toast.error(readError(error, "تعذر حفظ الخلطة"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-start">
          <DialogTitle>{mix ? "تعديل خلطة معتمدة" : "إضافة خلطة معتمدة"}</DialogTitle>
          <DialogDescription>
            هذه القائمة تُسعّر قيود المشغّلين تلقائيًا على الخادم، وتحدد المقاومة
            المميزة التي تُقارن بها نتائج مكعبات الجودة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">اسم الخلطة</Label>
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="C30/37"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">المقاومة المميزة (MPa)</Label>
            <Input
              type="number"
              min="1"
              inputMode="decimal"
              value={form.strengthMpa}
              onChange={(event) => set("strengthMpa", event.target.value)}
              placeholder="30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">سعر البيع للمتر (ج.م)</Label>
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => set("price", event.target.value)}
              placeholder="1530"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">تكلفة المتر (ج.م)</Label>
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={form.cost}
              onChange={(event) => set("cost", event.target.value)}
              placeholder="1205"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">أسمنت لكل م³ (كجم)</Label>
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={form.cementKgPerM3}
              onChange={(event) => set("cementKgPerM3", event.target.value)}
              placeholder="380"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">هامش المتر المتوقع</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {formatEGP(margin, 1)}
                <span className="ms-1 text-[11px] font-normal text-muted-foreground">
                  ({formatPercent(price > 0 ? (margin / price) * 100 : 0)})
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">ملاحظات</Label>
            <Input
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="مثال: معتمدة لأعمال الأساسات المسلحة"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 sm:col-span-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(value) => set("isActive", value)}
            />
            <span className="text-xs text-muted-foreground">
              {form.isActive
                ? "متاحة للتسعير التلقائي والإدخال"
                : "معطّلة — تبقى في سجل القيود التاريخية"}
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

type PlantRecord = {
  plantName: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
  capacityM3Day: number;
  alertEmail: string | null;
  alertPhone: string | null;
  updatedAt: number | null;
};

/**
 * Plant identity form. Mounted once per server revision (keyed by `updatedAt`),
 * so the draft is seeded exactly once and follows saved values afterwards.
 */
function PlantPanel({ plant, canManage }: { plant: PlantRecord; canManage: boolean }) {
  const updatePlant = useMutation(api.settings.updatePlant);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    plantName: plant.plantName,
    legalName: plant.legalName ?? "",
    taxId: plant.taxId ?? "",
    phone: plant.phone ?? "",
    email: plant.email ?? "",
    address: plant.address ?? "",
    currency: plant.currency,
    capacityM3Day: String(plant.capacityM3Day),
    alertEmail: plant.alertEmail ?? "",
    alertPhone: plant.alertPhone ?? "",
  }));

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    setSaving(true);
    try {
      await updatePlant({
        plantName: form.plantName.trim(),
        legalName: form.legalName.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        currency: form.currency.trim() || "EGP",
        capacityM3Day: Number(form.capacityM3Day) || 0,
        alertEmail: form.alertEmail.trim() || undefined,
        alertPhone: form.alertPhone.trim() || undefined,
      });
      toast.success("تم حفظ بيانات المحطة");
    } catch (error) {
      toast.error(readError(error, "تعذر حفظ بيانات المحطة"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="بيانات المحطة"
      description="تُستخدم في التقارير المطبوعة وفي تحديد مستلمي التنبيهات وطاقة المحطة اليومية."
      action={
        canManage ? (
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ البيانات
          </Button>
        ) : undefined
      }
    >
      {!canManage ? (
        <RoleNotice
          icon={Lock}
          title="عرض فقط"
          message="تعديل بيانات المحطة وأسعار الخلطات متاح للمالك والمدير."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">اسم المحطة</Label>
            <Input
              value={form.plantName}
              onChange={(event) => set({ plantName: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الاسم القانوني</Label>
            <Input
              value={form.legalName}
              onChange={(event) => set({ legalName: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الرقم الضريبي</Label>
            <Input value={form.taxId} onChange={(event) => set({ taxId: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الهاتف</Label>
            <Input value={form.phone} onChange={(event) => set({ phone: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">البريد الإلكتروني</Label>
            <Input value={form.email} onChange={(event) => set({ email: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">العنوان</Label>
            <Input value={form.address} onChange={(event) => set({ address: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">العملة</Label>
            <Input value={form.currency} onChange={(event) => set({ currency: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">الطاقة الإنتاجية (م³/يوم)</Label>
            <Input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.capacityM3Day}
              onChange={(event) => set({ capacityM3Day: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">بريد مستلمي التنبيهات</Label>
            <Input
              value={form.alertEmail}
              onChange={(event) => set({ alertEmail: event.target.value })}
              placeholder="owner@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">جوال التنبيهات</Label>
            <Input
              value={form.alertPhone}
              onChange={(event) => set({ alertPhone: event.target.value })}
              placeholder="+201000000000"
            />
          </div>
          {plant.updatedAt && (
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              <Settings2 className="me-1 inline size-3" />
              آخر تحديث: {formatFullDate(new Date(plant.updatedAt).toISOString().slice(0, 10))}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const access = useAccess();
  const { branches } = useBranch();
  const data = useQuery(api.settings.get);
  const removeBranch = useMutation(api.branches.remove);
  const removeMix = useMutation(api.settings.removeMix);

  const canManageSettings = access.can("manageSettings");
  const canManageBranches = access.can("manageBranches");

  const [branchDialog, setBranchDialog] = useState<{
    open: boolean;
    branch: (typeof branches)[number] | null;
  }>({ open: false, branch: null });
  const [mixDialog, setMixDialog] = useState<{
    open: boolean;
    mix: NonNullable<typeof data>["mixes"][number] | null;
  }>({ open: false, mix: null });

  const mixes = useMemo(() => data?.mixes ?? [], [data]);

  const activeMixCount = mixes.filter((mix) => mix.isActive).length;

  const handleDeleteBranch = async (id: Id<"branches">, name: string) => {
    try {
      await removeBranch({ id });
      toast.success(`تم حذف الفرع «${name}»`);
    } catch (error) {
      toast.error(readError(error, "تعذر حذف الفرع"));
    }
  };

  const handleDeleteMix = async (id: Id<"mixPrices">, name: string) => {
    try {
      await removeMix({ id });
      toast.success(`تم حذف الخلطة «${name}»`);
    } catch (error) {
      toast.error(readError(error, "تعذر حذف الخلطة"));
    }
  };

  return (
    <AppShell
      eyebrow="الإعداد والتحكم"
      title="إعدادات المحطة والفروع"
      description="من هنا تُدار الفروع وقائمة الخلطات المعتمدة بأسعارها وتكاليفها، وبيانات المحطة التي تُبنى عليها كل الأرقام والتقارير."
      actions={
        <>
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <Building2 className="size-3.5" />
            {formatNumber(branches.length)} فرع
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <FlaskConical className="size-3.5" />
            {formatNumber(activeMixCount)} خلطة معتمدة
          </Badge>
        </>
      }
    >
      {!access.isReady || data === undefined ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <Tabs defaultValue="branches" className="gap-5">
          <TabsList>
            <TabsTrigger value="branches">الفروع</TabsTrigger>
            <TabsTrigger value="prices">أسعار الخلطات</TabsTrigger>
            <TabsTrigger value="plant">بيانات المحطة</TabsTrigger>
          </TabsList>

          <TabsContent value="branches">
            <Panel
              title="فروع المحطة"
              description="كل فرع مستقل في الإنتاج والمخازن والصيانة، ويمكن قراءة أرقام المجموعة مجمّعة من لوحة القيادة."
              action={
                canManageBranches ? (
                  <Button
                    size="sm"
                    onClick={() => setBranchDialog({ open: true, branch: null })}
                  >
                    <Plus className="size-4" />
                    فرع جديد
                  </Button>
                ) : undefined
              }
            >
              {!canManageBranches && (
                <RoleNotice
                  className="mb-4"
                  title="عرض فقط"
                  message="إضافة الفروع وتعديلها متاحة للمالك فقط، لأنها تغيّر نطاق كل التقارير."
                />
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الكود</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>المدينة</TableHead>
                      <TableHead>المدير</TableHead>
                      <TableHead className="text-end">الطاقة (م³/يوم)</TableHead>
                      <TableHead>الحالة</TableHead>
                      {canManageBranches && <TableHead className="text-end">إجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch._id}>
                        <TableCell className="font-mono text-xs">{branch.code}</TableCell>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {branch.city ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {branch.managerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatNumber(branch.capacityM3Day)}
                        </TableCell>
                        <TableCell>
                          {branch.isActive ? (
                            <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                              يعمل
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              موقوف
                            </Badge>
                          )}
                        </TableCell>
                        {canManageBranches && (
                          <TableCell className="text-end">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="تعديل"
                                onClick={() => setBranchDialog({ open: true, branch })}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="حذف"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteBranch(branch._id, branch.name)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="prices">
            <Panel
              title="قائمة الخلطات المعتمدة"
              description="التسعير يُطبَّق على الخادم: المشغّل لا يكتب الأسعار، بل تُسعَّر قيوده من هذه القائمة لحظة الحفظ."
              action={
                canManageSettings ? (
                  <Button size="sm" onClick={() => setMixDialog({ open: true, mix: null })}>
                    <Plus className="size-4" />
                    خلطة جديدة
                  </Button>
                ) : undefined
              }
            >
              {!data.financialsVisible ? (
                <RoleNotice
                  icon={Lock}
                  title="الأسعار محجوبة عن دورك الحالي"
                  message="قائمة الأسعار والتكاليف تظهر للمالك والمدير والمراجع فقط، بينما تبقى أسماء الخلطات ومقاوماتها متاحة للإدخال."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الخلطة</TableHead>
                        <TableHead className="text-end">المقاومة</TableHead>
                        <TableHead className="text-end">أسمنت/م³</TableHead>
                        <TableHead className="text-end">سعر البيع</TableHead>
                        <TableHead className="text-end">التكلفة</TableHead>
                        <TableHead className="text-end">هامش المتر</TableHead>
                        <TableHead>الحالة</TableHead>
                        {canManageSettings && <TableHead className="text-end">إجراءات</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mixes.map((mix) => (
                        <TableRow key={mix._id}>
                          <TableCell className="font-medium">{mix.name}</TableCell>
                          <TableCell className="text-end tabular-nums">
                            {formatNumber(mix.strengthMpa)} MPa
                          </TableCell>
                          <TableCell className="text-end tabular-nums text-muted-foreground">
                            {mix.cementKgPerM3 ? formatNumber(mix.cementKgPerM3) : "—"}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {formatEGP(mix.price)}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {formatEGP(mix.cost)}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            <span className="font-medium">{formatEGP(mix.margin, 1)}</span>
                            <span className="ms-1 text-[11px] text-muted-foreground">
                              ({formatPercent(mix.marginPct)})
                            </span>
                          </TableCell>
                          <TableCell>
                            {mix.isActive ? (
                              <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                                معتمدة
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                معطّلة
                              </Badge>
                            )}
                          </TableCell>
                          {canManageSettings && (
                            <TableCell className="text-end">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="تعديل"
                                  onClick={() => setMixDialog({ open: true, mix })}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="حذف"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteMix(mix._id, mix.name)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {mixes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                            لا توجد خلطات معتمدة بعد.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          </TabsContent>

          <TabsContent value="plant">
            <PlantPanel
              key={data.plant.updatedAt ?? "plant"}
              plant={data.plant}
              canManage={canManageSettings}
            />
          </TabsContent>
        </Tabs>
      )}

      <BranchDialog
        open={branchDialog.open}
        onOpenChange={(open) => setBranchDialog((prev) => ({ ...prev, open }))}
        branch={branchDialog.branch}
      />
      <MixDialog
        open={mixDialog.open}
        onOpenChange={(open) => setMixDialog((prev) => ({ ...prev, open }))}
        mix={mixDialog.mix}
      />
    </AppShell>
  );
}
