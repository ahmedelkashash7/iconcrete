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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { EnrichedLog } from "@/convex/measures";
import {
  MIX_NAMES,
  MIX_PRESETS,
  SHIFT_LABELS,
  SHIFT_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  TRUCK_CAPACITY_M3,
} from "@/lib/concrete";
import type { LogStatus, Shift } from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import { formatEGP, formatM3, formatSignedEGP, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

type FormState = {
  date: string;
  shift: Shift;
  mixDesign: string;
  customer: string;
  site: string;
  orderRef: string;
  quantityM3: string;
  deliveredM3: string;
  returnedM3: string;
  pricePerM3: string;
  costPerM3: string;
  truckCount: string;
  onTime: boolean;
  status: LogStatus;
  notes: string;
};

const toNumber = (value: string) => {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

function buildInitialState(
  log: EnrichedLog | null | undefined,
  defaultDate: string,
): FormState {
  if (log) {
    return {
      date: log.date,
      shift: log.shift as Shift,
      mixDesign: log.mixDesign,
      customer: log.customer,
      site: log.site ?? "",
      orderRef: log.orderRef ?? "",
      quantityM3: String(log.quantityM3),
      deliveredM3: String(log.deliveredM3),
      returnedM3: String(log.returnedM3),
      pricePerM3: String(log.pricePerM3),
      costPerM3: String(log.costPerM3),
      truckCount: String(log.truckCount),
      onTime: log.onTime,
      status: log.status as LogStatus,
      notes: log.notes ?? "",
    };
  }

  const preset = MIX_PRESETS[0];
  return {
    date: defaultDate,
    shift: "morning",
    mixDesign: preset.name,
    customer: "",
    site: "",
    orderRef: "",
    quantityM3: "",
    deliveredM3: "",
    returnedM3: "0",
    pricePerM3: String(preset.price),
    costPerM3: String(preset.cost),
    truckCount: "",
    onTime: true,
    status: "delivered",
    notes: "",
  };
}

function FormRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ProductionForm({
  log,
  defaultDate,
  onDone,
}: {
  log?: EnrichedLog | null;
  defaultDate: string;
  onDone: () => void;
}) {
  const createLog = useMutation(api.production.create);
  const updateLog = useMutation(api.production.update);
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(log, defaultDate),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const quantity = toNumber(form.quantityM3);
  const delivered = toNumber(form.deliveredM3);
  const returnQty = toNumber(form.returnedM3);
  const price = toNumber(form.pricePerM3);
  const cost = toNumber(form.costPerM3);
  const projectedRevenue = delivered * price;
  const projectedCost = delivered * cost;
  const projectedProfit = projectedRevenue - projectedCost;

  const handleQuantity = (value: string) => {
    const qty = toNumber(value);
    setForm((prev) => ({
      ...prev,
      quantityM3: value,
      deliveredM3: value,
      returnedM3: "0",
      truckCount: qty > 0 ? String(Math.max(1, Math.round(qty / TRUCK_CAPACITY_M3))) : "",
    }));
  };

  const handleDelivered = (value: string) => {
    const next = toNumber(value);
    setForm((prev) => ({
      ...prev,
      deliveredM3: value,
      returnedM3: String(Math.max(0, Math.round((quantity - next) * 100) / 100)),
    }));
  };

  const handleMix = (value: string) => {
    const preset = MIX_PRESETS.find((mix) => mix.name === value);
    setForm((prev) => ({
      ...prev,
      mixDesign: value,
      pricePerM3: preset ? String(preset.price) : prev.pricePerM3,
      costPerM3: preset ? String(preset.cost) : prev.costPerM3,
    }));
  };

  const validate = (): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return "اختر تاريخًا صحيحًا";
    if (!form.customer.trim()) return "اسم العميل مطلوب";
    if (!form.mixDesign.trim()) return "نوع الخلطة مطلوب";
    if (quantity <= 0) return "الكمية المنتجة يجب أن تكون أكبر من صفر";
    if (delivered < 0 || returnQty < 0) return "الكميات لا يمكن أن تكون بالسالب";
    if (delivered + returnQty > quantity + 0.01) {
      return "الكمية المسلّمة + المرتجعة لا يمكن أن تتجاوز الكمية المنتجة";
    }
    if (price <= 0) return "سعر البيع للمتر يجب أن يكون أكبر من صفر";
    if (cost < 0) return "تكلفة المتر لا يمكن أن تكون بالسالب";
    if (toNumber(form.truckCount) < 0) return "عدد العربات لا يمكن أن يكون بالسالب";
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        shift: form.shift,
        mixDesign: form.mixDesign.trim(),
        customer: form.customer.trim(),
        site: form.site.trim() || undefined,
        orderRef: form.orderRef.trim() || undefined,
        quantityM3: quantity,
        deliveredM3: delivered,
        returnedM3: returnQty,
        pricePerM3: price,
        costPerM3: cost,
        truckCount: Math.round(toNumber(form.truckCount)),
        onTime: form.onTime,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      if (log) {
        await updateLog({ id: log._id, ...payload });
        toast.success("تم تحديث قيد الإنتاج");
      } else {
        await createLog(payload);
        toast.success("تم تسجيل قيد الإنتاج");
      }
      onDone();
    } catch (submitError) {
      const message = readError(submitError, "تعذر حفظ قيد الإنتاج");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="التاريخ">
          <Input
            type="date"
            value={form.date}
            onChange={(event) => set("date", event.target.value)}
            required
          />
        </FormRow>

        <FormRow label="الوردية">
          <Select
            value={form.shift}
            onValueChange={(value) => set("shift", value as Shift)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFT_ORDER.map((shift) => (
                <SelectItem key={shift} value={shift}>
                  {SHIFT_LABELS[shift]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>

        <FormRow
          label="نوع الخلطة"
          hint="اختيار خلطة قياسية يعبّئ السعر والتكلفة المرجعية تلقائيًا."
        >
          <>
            <Input
              list="mix-designs"
              value={form.mixDesign}
              onChange={(event) => handleMix(event.target.value)}
              placeholder="C30/37"
              required
            />
            <datalist id="mix-designs">
              {MIX_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
        </FormRow>

        <FormRow label="العميل">
          <Input
            value={form.customer}
            onChange={(event) => set("customer", event.target.value)}
            placeholder="اسم الشركة أو المقاول"
            required
          />
        </FormRow>

        <FormRow label="الموقع / المشروع">
          <Input
            value={form.site}
            onChange={(event) => set("site", event.target.value)}
            placeholder="مثال: العاصمة الإدارية - حي R7"
          />
        </FormRow>

        <FormRow label="رقم الطلبية">
          <Input
            value={form.orderRef}
            onChange={(event) => set("orderRef", event.target.value)}
            placeholder="IC-260929-01"
          />
        </FormRow>

        <FormRow
          label="الكمية المنتجة (م³)"
          hint="إدخال الكمية يعبّئ المسلّم وعدد العربات، ويمكنك تعديلها."
        >
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.quantityM3}
            onChange={(event) => handleQuantity(event.target.value)}
            placeholder="0"
            required
          />
        </FormRow>

        <FormRow label="الكمية المسلّمة (م³)">
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.deliveredM3}
            onChange={(event) => handleDelivered(event.target.value)}
            placeholder="0"
          />
        </FormRow>

        <FormRow
          label="الكمية المرتجعة (م³)"
          hint="تُحسب تلقائيًا من الفرق بين المنتج والمسلّم."
        >
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.returnedM3}
            onChange={(event) => set("returnedM3", event.target.value)}
            placeholder="0"
          />
        </FormRow>

        <FormRow label="عدد العربات">
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.truckCount}
            onChange={(event) => set("truckCount", event.target.value)}
            placeholder="1"
          />
        </FormRow>

        <FormRow label="سعر البيع للمتر (ج.م)">
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.pricePerM3}
            onChange={(event) => set("pricePerM3", event.target.value)}
            required
          />
        </FormRow>

        <FormRow label="تكلفة المتر (ج.م)">
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={form.costPerM3}
            onChange={(event) => set("costPerM3", event.target.value)}
            required
          />
        </FormRow>

        <FormRow label="حالة القيد">
          <Select
            value={form.status}
            onValueChange={(value) => set("status", value as LogStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>

        <FormRow label="التسليم في الوقت المتفق عليه">
          <div className="flex h-9 items-center gap-3 rounded-md border border-input bg-transparent px-3">
            <Switch checked={form.onTime} onCheckedChange={(v) => set("onTime", v)} />
            <span className="text-xs text-muted-foreground">
              {form.onTime ? "تم التسليم في الموعد" : "تأخير عن موعد الصب"}
            </span>
          </div>
        </FormRow>

        <FormRow label="ملاحظات" className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
            placeholder="أي ملاحظات فنية أو تشغيلية على القيد"
            rows={2}
          />
        </FormRow>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/40 p-4 sm:grid-cols-4">
        <div>
          <p className="text-[11px] text-muted-foreground">الكمية المسلّمة</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {formatM3(delivered, 1)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">الإيراد المتوقع</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {formatEGP(projectedRevenue)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">التكلفة المتوقعة</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {formatEGP(projectedCost)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">الربح المتوقع</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold tabular-nums",
              projectedProfit >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {formatSignedEGP(projectedProfit)}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={saving}
        >
          إلغاء
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {log ? "حفظ التعديلات" : "تسجيل القيد"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProductionFormDialog({
  open,
  onOpenChange,
  log,
  defaultDate = todayISO(),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log?: EnrichedLog | null;
  defaultDate?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-start">
          <DialogTitle>
            {log ? "تعديل قيد إنتاج" : "تسجيل قيد إنتاج جديد"}
          </DialogTitle>
          <DialogDescription>
            كل قيد يمثل طلبية واحدة: الكميات بالمتر المكعب، والقيم بالجنيه المصري.
          </DialogDescription>
        </DialogHeader>
        <ProductionForm
          log={log}
          defaultDate={defaultDate}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
