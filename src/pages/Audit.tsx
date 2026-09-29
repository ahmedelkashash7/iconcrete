import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Panel";
import { RoleNotice } from "@/components/RoleNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { normalizeRole, ROLE_LABELS } from "@/convex/permissions";
import { useAccess } from "@/hooks/use-access";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_ORDER,
  auditActionTone,
  auditEntityLabel,
  auditFieldLabel,
  formatAuditValue,
} from "@/lib/auditDisplay";
import { downloadCsv } from "@/lib/csv";
import { formatDay, formatNumber, formatTime, todayISO, windowStartISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Download,
  FileClock,
  Lock,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

type AuditRecord = Doc<"auditLogs">;

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
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof FileClock;
}) {
  return (
    <div className="soft-card rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function actorRoleLabel(record: AuditRecord) {
  if (record.isAnonymous) return "زائر (استعراض)";
  const role = normalizeRole(record.actorRole);
  return role ? ROLE_LABELS[role] : "بدون دور";
}

export default function Audit() {
  const access = useAccess();
  const canView = access.can("viewAudit");
  const today = useMemo(() => todayISO(), []);
  const [rangeKey, setRangeKey] = useState("30");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditRecord | null>(null);

  const range = { from: windowStartISO(Number(rangeKey), today), to: today };
  const rows = useQuery(api.audit.list, canView ? range : "skip");
  const isLoading = !access.isReady || (canView && rows === undefined);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((record) => {
      if (actionFilter !== "all" && record.action !== actionFilter) return false;
      if (!term) return true;
      return [record.actorName, record.actorEmail, record.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [rows, actionFilter, search]);

  const counts = useMemo(
    () => ({
      total: filtered.length,
      updates: filtered.filter((r) => r.action === "update").length,
      deletions: filtered.filter(
        (r) => r.action === "delete" || r.action === "purge",
      ).length,
      roleChanges: filtered.filter((r) => r.action === "role_change").length,
      guestActions: filtered.filter((r) => r.isAnonymous).length,
    }),
    [filtered],
  );

  const handleExport = () => {
    downloadCsv(
      `iconcrete-audit-${range.from}_${range.to}.csv`,
      filtered.map((record) => ({
        الوقت: `${record.date} ${formatTime(record.at)}`,
        العضو: record.actorName,
        "البريد الإلكتروني": record.actorEmail ?? "",
        الدور: actorRoleLabel(record),
        الإجراء: AUDIT_ACTION_LABELS[record.action],
        السجل: auditEntityLabel(record.entity),
        المرجع: record.label ?? record.entityId ?? "",
        "عدد الحقول المتغيرة": record.changes.length,
        التغييرات: record.changes
          .map(
            (change) =>
              `${auditFieldLabel(change.field)}: ${
                change.before ? formatAuditValue(change.field, change.before) : "—"
              } ← ${change.after ? formatAuditValue(change.field, change.after) : "—"}`,
          )
          .join(" | "),
      })),
    );
  };

  if (!canView) {
    return (
      <AppShell
        eyebrow="التتبّع والامتثال"
        title="سجل التتبع والتدقيق"
        description="كل عملية على النظام موثّقة باسم صاحبتها ووقتها وبالقيم قبل وبعد."
      >
        <RoleNotice
          title={`دورك الحالي: ${access.label}`}
          message="سجل التتبع متاح للمالك والمدير والمراجع، لأن التفاصيل تحتوي على القيم المالية السابقة لكل قيد."
          hint="كل عملياتك أنت مسجّلة أيضًا في هذا السجل — يمكن لمالك النظام فتحه لك من شاشة الفريق والصلاحيات."
          action={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/production">
                  الإنتاج والكميات
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="التتبّع والامتثال"
      title="سجل التتبع والتدقيق"
      description="من أنشأ أو عدّل أو حذف أي قيد، ومتى، ومن أي حساب، وبأي قيمة سابقة — سجل غير قابل للتعديل من الواجهة، وهو أساس التوثيق الذي تطلبه ISO 9001 وتتبّع مطابقة ECP 203 لكل صبّة."
      actions={
        <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
          <Download className="size-4" />
          تصدير CSV
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="إجمالي الحركات"
          value={formatNumber(counts.total)}
          hint={`${formatNumber(counts.guestActions)} حركة من دخول الزائر`}
          icon={FileClock}
        />
        <StatTile
          label="تعديلات"
          value={formatNumber(counts.updates)}
          hint="تتضمن القيم قبل وبعد لكل حقل متغيّر"
          icon={ShieldCheck}
        />
        <StatTile
          label="حذف"
          value={formatNumber(counts.deletions)}
          hint="حذف قيد أو تنظيف بيانات تجريبية"
          icon={Lock}
        />
        <StatTile
          label="تغييرات الأدوار"
          value={formatNumber(counts.roleChanges)}
          hint="من مالك النظام فقط"
          icon={UserCog}
        />
      </div>

      {/* Filters */}
      <div className="soft-card mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card p-4">
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
            {RANGES.map((item) => (
              <ToggleGroupItem
                key={item.key}
                value={item.key}
                className="rounded-full px-3 text-xs"
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">الإجراء</p>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الإجراءات</SelectItem>
              {AUDIT_ACTION_ORDER.map((action) => (
                <SelectItem key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action]}
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
              placeholder="اسم العضو أو بريده أو مرجع القيد"
              className="h-9 pe-9"
            />
          </div>
        </div>
      </div>

      <Panel
        className="mt-4 overflow-hidden"
        title="الحركات المسجّلة"
        description={`${formatNumber(filtered.length)} حركة في الفترة المحددة (الأحدث أولًا).`}
        bodyClassName="px-0 pb-0 pt-2"
      >
        {isLoading ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 pb-8 pt-2 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <FileClock className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium">لا توجد حركات مطابقة</p>
            <p className="mt-1 text-xs text-muted-foreground">
              وسّع الفترة أو أزل الفلاتر لعرض حركات أقدم.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-5">الوقت</TableHead>
                <TableHead>العضو</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>السجل</TableHead>
                <TableHead className="text-end">الحقول المتغيّرة</TableHead>
                <TableHead className="pe-5 text-end">التفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow key={record._id}>
                  <TableCell className="ps-5 whitespace-nowrap">
                    <span className="block text-sm tabular-nums">
                      {formatTime(record.at)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDay(record.date)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-sm font-medium">
                      {record.actorName}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {actorRoleLabel(record)}
                      {record.actorEmail ? ` · ${record.actorEmail}` : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(auditActionTone(record.action))}
                    >
                      {AUDIT_ACTION_LABELS[record.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[18rem]">
                    <span className="block text-[11px] text-muted-foreground">
                      {auditEntityLabel(record.entity)}
                    </span>
                    <span className="block truncate text-sm">
                      {record.label ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {record.changes.length || "—"}
                  </TableCell>
                  <TableCell className="pe-5 text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={record.changes.length === 0}
                      onClick={() => setSelected(record)}
                    >
                      عرض
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel
        className="mt-4"
        title="لماذا هذا السجل مهم؟"
        description="التتبّع ليس خيارًا في أنظمة الجودة والتشغيل."
      >
        <ul className="grid gap-3 text-xs leading-6 text-muted-foreground sm:grid-cols-2">
          <li className="rounded-xl bg-muted/50 p-4">
            <span className="block font-medium text-foreground">
              مطابقة ECP 203 وتوثيق الصبّات
            </span>
            كل قيد إنتاج يحفظ نسخة من قيمه السابقة عند أي تعديل، فيمكن إثبات ما
            تم صبّه فعلًا وفي أي وقت.
          </li>
          <li className="rounded-xl bg-muted/50 p-4">
            <span className="block font-medium text-foreground">
              توثيق المعلومات في ISO 9001
            </span>
            كل عملية لها صاحب واضح ووقت محدد ومرجع للقيد، وهذا هو جوهر ضبط
            المعلومات المُوثّقة.
          </li>
          <li className="rounded-xl bg-muted/50 p-4">
            <span className="block font-medium text-foreground">
              مسؤولية صلاحيات حقيقية
            </span>
            دور المشغّل يعدّل قيود يومه، والمراجع يصحّح، والمالك يقرّر — والسجل
            يُظهر من فعل ماذا بلا استثناءات.
          </li>
          <li className="rounded-xl bg-muted/50 p-4">
            <span className="block font-medium text-foreground">
              جاهز للتدقيق الخارجي
            </span>
            يمكن تصدير الحركات إلى CSV ومراجعتها أو إرفاقها بتقرير رسمي وقت
            الحاجة.
          </li>
        </ul>
      </Panel>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="text-start">
            <DialogTitle>
              تفاصيل الحركة ·{" "}
              {selected ? AUDIT_ACTION_LABELS[selected.action] : ""}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${auditEntityLabel(selected.entity)} — ${
                    selected.label ?? "بدون مرجع"
                  } · ${formatDay(selected.date)} ${formatTime(selected.at)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">
                  {selected.actorName}
                </span>
                <span>{actorRoleLabel(selected)}</span>
                {selected.actorEmail && <span>{selected.actorEmail}</span>}
                {selected.isAnonymous && (
                  <Badge
                    variant="outline"
                    className="border-warning/40 bg-warning/10 text-warning-foreground"
                  >
                    دخول زائر
                  </Badge>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="ps-4">الحقل</TableHead>
                      <TableHead>القيمة السابقة</TableHead>
                      <TableHead className="pe-4">القيمة الجديدة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.changes.map((change) => (
                      <TableRow key={change.field}>
                        <TableCell className="ps-4 text-[11px] text-muted-foreground">
                          {auditFieldLabel(change.field)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground line-through">
                          {change.before
                            ? formatAuditValue(change.field, change.before)
                            : "—"}
                        </TableCell>
                        <TableCell className="pe-4 text-sm font-medium">
                          {change.after
                            ? formatAuditValue(change.field, change.after)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
