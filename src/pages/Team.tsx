import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Panel";
import { RoleMatrix } from "@/components/RoleMatrix";
import { RoleNotice } from "@/components/RoleNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_ORDER,
} from "@/convex/permissions";
import type { PlantRole } from "@/convex/permissions";
import { useAccess } from "@/hooks/use-access";
import { errorMessage as readError } from "@/lib/errors";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

function roleTone(role: PlantRole | null) {
  switch (role) {
    case "owner":
      return "border-brand/40 bg-brand/10 text-brand-foreground dark:text-brand";
    case "manager":
      return "border-primary/30 bg-primary/10 text-primary";
    case "reviewer":
      return "border-success/40 bg-success/10 text-success";
    default:
      return "text-muted-foreground";
  }
}

export default function Team() {
  const access = useAccess();
  const canViewTeam = access.can("viewTeam");
  const canManageRoles = access.can("manageRoles");
  const members = useQuery(api.access.listMembers, canViewTeam ? {} : "skip");
  const setRole = useMutation(api.access.setRole);
  const [pendingMember, setPendingMember] = useState<string | null>(null);

  const handleRoleChange = async (
    userId: string,
    memberName: string,
    role: PlantRole,
  ) => {
    setPendingMember(userId);
    try {
      await setRole({ userId: userId as Id<"users">, role });
      toast.success(`تم تحديث دور ${memberName} إلى «${ROLE_LABELS[role]}»`);
    } catch (error) {
      toast.error(readError(error, "تعذر تحديث الدور"));
    } finally {
      setPendingMember(null);
    }
  };

  // Checked one by one so the list matches the guest sandbox rules too.
  const myCapabilities = CAPABILITIES.filter((capability) =>
    access.can(capability),
  );

  return (
    <AppShell
      eyebrow="الأدوار والصلاحيات"
      title="الفريق والصلاحيات"
      description="حدّد من يُدخل البيانات، ومن يراجعها، ومن يطّلع على الأرقام المالية — كل دور بصلاحيات محدودة على مستوى النظام نفسه، لا على الشاشة فقط."
      actions={
        <Button variant="outline" asChild>
          <Link to="/dashboard">
            لوحة القيادة
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      }
    >
      {/* my role */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="دورك الحالي"
          description={
            access.role ? ROLE_DESCRIPTIONS[access.role] : undefined
          }
          action={
            <Badge
              variant="outline"
              className={cn("gap-1.5", roleTone(access.role))}
            >
              <ShieldCheck className="size-3" />
              {access.label}
            </Badge>
          }
        >
          <ul className="space-y-2">
            {myCapabilities.map((capability) => (
              <li
                key={capability}
                className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"
              >
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                {CAPABILITY_LABELS[capability]}
              </li>
            ))}
            {myCapabilities.length === 0 && (
              <li className="text-[11px] text-muted-foreground">
                لا توجد صلاحيات ممنوحة لهذا الدور بعد.
              </li>
            )}
          </ul>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="كيف تُحدَّد الأدوار؟"
          description="قاعدة توزيع واضحة عند إنشاء الحسابات، وتعديل يدوي من مالك النظام بعدها."
        >
          <ol className="space-y-3 text-xs leading-6 text-muted-foreground">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                1
              </span>
              أول حساب حقيقي يُنشأ على النظام يصبح «مالك» — وهو من يوزّع الأدوار
              على بقية الفريق.
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                2
              </span>
              كل حساب جديد يبدأ بدور «مشغّل»: يُدخل بيانات ورديته ويعدّل قيود
              يومه، دون عرض الأرقام المالية ودون حذف.
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                3
              </span>
              المالك يرقّي من يحتاج صلاحيات أوسع إلى «مراجع» (مطالعة مالية وتصحيح)
              أو «مدير» (تشغيل كامل)، ويمكنه إرجاع أي دور في أي وقت.
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                4
              </span>
              دخول الزائر السريع يعمل بصلاحيات المدير للاستعراض والتجربة، لكنه
              لا يستطيع الحذف أو إدارة الأدوار ولا يظهر في قائمة الفريق.
            </li>
          </ol>
        </Panel>
      </div>

      {/* members */}
      <div className="mt-4">
        {canViewTeam ? (
          <Panel
            className="overflow-hidden"
            title="أعضاء الفريق"
            description={
              canManageRoles
                ? "غيّر دور أي عضو من القائمة — يُطبَّق فورًا على الشاشات والصلاحيات."
                : "عرض فقط: تغيير الأدوار متاح لمالك النظام."
            }
            bodyClassName="px-0 pb-0 pt-2"
          >
            {members === undefined ? (
              <div className="space-y-2 px-5 pb-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                لا يوجد أعضاء مسجّلون بعد.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-5">العضو</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>تاريخ الانضمام</TableHead>
                    <TableHead className="pe-5 text-end">الدور</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const isSelf = member._id === access.viewer.userId;
                    const memberName =
                      member.name ?? member.email ?? "عضو غير مُسمّى";
                    return (
                      <TableRow key={member._id}>
                        <TableCell className="ps-5 font-medium">
                          {memberName}
                          {isSelf && (
                            <span className="ms-2 text-[10px] text-muted-foreground">
                              (أنت)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.email ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatFullDate(
                            new Date(member.joinedAt).toISOString().slice(0, 10),
                          )}
                        </TableCell>
                        <TableCell className="pe-5">
                          <div className="flex items-center justify-end gap-2">
                            {canManageRoles && !isSelf ? (
                              <Select
                                value={member.role ?? undefined}
                                onValueChange={(value) =>
                                  handleRoleChange(
                                    member._id,
                                    memberName,
                                    value as PlantRole,
                                  )
                                }
                                disabled={pendingMember === member._id}
                              >
                                <SelectTrigger className="h-8 w-[8.5rem]">
                                  <SelectValue placeholder="بدون دور" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLE_ORDER.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {ROLE_LABELS[role]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn("gap-1.5", roleTone(member.role))}
                              >
                                {member.role ? ROLE_LABELS[member.role] : "بدون دور"}
                              </Badge>
                            )}
                            {pendingMember === member._id && (
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Panel>
        ) : (
          <RoleNotice
            title={`دورك الحالي: ${access.label}`}
            message="قائمة الفريق وأدواره متاحة للمالك والمدير فقط. يمكنك دائمًا الاطلاع على مصفوفة الصلاحيات الكاملة أدناه لمعرفة ما يملكه كل دور."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/production">
                  الإنتاج والكميات
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            }
          />
        )}
      </div>

      {/* matrix */}
      <Panel
        className="mt-4"
        title="مصفوفة الصلاحيات"
        description="ما يراه ويعدّله كل دور في المنظومة — تُنفَّذ على مستوى قاعدة البيانات، وليست إخفاءً في الواجهة."
      >
        <RoleMatrix highlightRole={access.role} />
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
          ملاحظة: المشغّل يسجّل قيود ورديته ويعدّل قيود اليوم نفسه فقط، وأي تعديل
          أو حذف يبقى أثر للمستخدم الذي نفّذه. دخول الزائر السريع لا يشمل الحذف
          ولا إدارة الأدوار.
        </p>
      </Panel>
    </AppShell>
  );
}
