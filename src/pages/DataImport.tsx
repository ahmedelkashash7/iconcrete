import { AppShell } from "@/components/AppShell";
import { BranchFilter } from "@/components/BranchFilter";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { useBranch } from "@/hooks/use-branch";
import { SHIFT_SHORT_LABELS, STATUS_LABELS } from "@/lib/concrete";
import type { LogStatus, Shift } from "@/lib/concrete";
import { errorMessage as readError } from "@/lib/errors";
import { formatDay, formatM3, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { ParsedLogRow, ParseResult } from "@/lib/xlsx";
import {
  buildTemplateWorkbook,
  downloadBlob,
  mapRows,
  readWorkbookRows,
} from "@/lib/xlsx";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Phase = "idle" | "parsing" | "ready" | "importing" | "done";

export default function DataImport() {
  const { t, pick } = useI18n();
  const { branches, branchId, setBranchId } = useBranch();
  const importProduction = useMutation(api.imports.importProduction);
  const status = useQuery(api.imports.importStatus);

  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => parsed?.rows.slice(0, 12) ?? [], [parsed]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setPhase("parsing");
    setResult(null);
    setFileName(file.name);
    try {
      const raw = await readWorkbookRows(file);
      const mapped = mapRows(raw);
      setParsed(mapped);
      setPhase("ready");
      if (mapped.rows.length === 0) {
        toast.error(
          pick(
            "لم يُعثر على سطور صالحة في الملف — راجع دليل الأعمدة.",
            "No valid rows found — check the column guide.",
          ),
        );
      } else {
        toast.success(
          pick(
            `تم تحليل ${formatNumber(mapped.rows.length)} سطرًا جاهزًا للاستيراد`,
            `Parsed ${formatNumber(mapped.rows.length)} rows ready to import`,
          ),
        );
      }
    } catch (error) {
      setPhase("idle");
      toast.error(readError(error, pick("تعذر قراءة الملف", "Could not read the file")));
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setPhase("importing");
    try {
      const response = await importProduction({
        rows: parsed.rows,
        branchId,
        filename: fileName ?? undefined,
      });
      setResult(response);
      setPhase("done");
      toast.success(
        pick(
          `تم رفع ${formatNumber(response.inserted)} قيدًا إلى الكلاود وظهرت على كل الشاشات لحظيًا`,
          `Uploaded ${formatNumber(response.inserted)} records to the cloud — live on every screen`,
        ),
      );
    } catch (error) {
      setPhase("ready");
      toast.error(readError(error, pick("تعذر استيراد الملف", "Import failed")));
    }
  };

  const reset = () => {
    setPhase("idle");
    setParsed(null);
    setResult(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadTemplate = () => {
    downloadBlob("iconcrete-import-template.xlsx", buildTemplateWorkbook(true));
    toast.success(pick("تم تنزيل نموذج الإدخال", "Template downloaded"));
  };

  const importable = (parsed?.rows.length ?? 0) > 0;
  const canImport = importable && phase !== "importing" && phase !== "parsing";

  return (
    <AppShell
      eyebrow={pick("الإدخال الأساسي", "Primary data entry")}
      title={pick("استيراد Excel إلى الكلاود", "Excel import to the cloud")}
      description={pick(
        "الموظف يُدخل كل البيانات في ملف Excel ثم يرفعه هنا — تتحوّل السطور إلى قيود إنتاج حقيقية على الكلاود، وتظهر فورًا في لوحة القيادة والجودة والمخازن والتنبؤ دون أي إدخال مزدوج.",
        "The employee fills every entry in Excel and uploads it here — the rows become real production records on the cloud, reflected instantly in the dashboard, quality, stores and forecasts with no double entry.",
      )}
      actions={
        <>
          <BranchFilter branches={branches} value={branchId} onChange={setBranchId} />
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" />
            {pick("تنزيل النموذج", "Download template")}
          </Button>
        </>
      }
    >
      {/* Live cloud strip — proves the numbers landed reactively */}
      <div className="grid gap-4 sm:grid-cols-3">
        <LiveTile
          icon={Cloud}
          label={pick("قيود الإنتاج على الكلاود", "Production records on the cloud")}
          value={status ? formatNumber(status.total) : "—"}
          hint={pick("تُحدَّث لحظيًا بعد كل رفع", "Updated live after every upload")}
        />
        <LiveTile
          icon={RefreshCw}
          label={pick("آخر يوم بيانات", "Latest data day")}
          value={status?.last ? formatDay(status.last) : "—"}
          hint={status?.first ? pick(`البداية ${formatDay(status.first)}`, `First ${formatDay(status.first)}`) : pick("لا بيانات بعد", "No data yet")}
        />
        <LiveTile
          icon={FileSpreadsheet}
          label={pick("قيود تجريبية", "Demo records")}
          value={status ? formatNumber(status.testData) : "—"}
          hint={pick("منسوبة لبيانات الاستعراض", "Marked as demo data")}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Upload zone */}
        <Panel
          className="lg:col-span-2"
          title={pick("١ · ارفع ملف Excel", "1 · Upload the Excel file")}
          description={pick(
            "يقبل ملفات .xlsx و .xls و .csv — نفس نموذج الإدخال بالضبط.",
            "Accepts .xlsx, .xls and .csv — the same import template.",
          )}
          action={
            parsed ? (
              <Button variant="ghost" size="sm" onClick={reset} className="cursor-pointer">
                {pick("إعادة الضبط", "Reset")}
              </Button>
            ) : undefined
          }
        >
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging
                ? "border-brand bg-brand/10"
                : "border-border/70 bg-muted/30 hover:border-brand/60 hover:bg-brand/5",
            )}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-brand/15 text-brand">
              {phase === "parsing" || phase === "importing" ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Upload className="size-6" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold">
                {fileName ??
                  pick("اسحب الملف هنا أو اضغط للاختيار", "Drop the file here or click to choose")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pick(
                  "بعد الرفع تُراجع السطور ثم تُثبَّت على الكلاود بضغطة واحدة.",
                  "After parsing you review the rows, then commit to the cloud in one click.",
                )}
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>

          {parsed && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className="gap-1.5 border-success/40 bg-success/10 text-success"
              >
                <CheckCircle2 className="size-3.5" />
                {pick(
                  `${formatNumber(parsed.rows.length)} سطرًا جاهزًا`,
                  `${formatNumber(parsed.rows.length)} rows ready`,
                )}
              </Badge>
              {parsed.issues.length > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-destructive/40 bg-destructive/10 text-destructive"
                >
                  <AlertTriangle className="size-3.5" />
                  {pick(
                    `${formatNumber(parsed.issues.length)} سطرًا سيُتخطّى`,
                    `${formatNumber(parsed.issues.length)} rows will be skipped`,
                  )}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {pick(
                  `من إجمالي ${formatNumber(parsed.total)} سطرًا في الملف`,
                  `of ${formatNumber(parsed.total)} rows in the file`,
                )}
              </span>
              <Button
                className="ms-auto"
                onClick={handleImport}
                disabled={!canImport}
              >
                {phase === "importing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Cloud className="size-4" />
                )}
                {pick("ثبّت على الكلاود الآن", "Commit to the cloud now")}
              </Button>
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-2xl border border-success/40 bg-success/10 p-4 text-xs">
              <p className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle2 className="size-4" />
                {pick(
                  `تم رفع ${formatNumber(result.inserted)} قيدًا بنجاح`,
                  `Uploaded ${formatNumber(result.inserted)} records successfully`,
                )}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-destructive">
                  {result.errors.map((issue) => (
                    <li key={issue.row}>
                      {pick(
                        `السطر ${issue.row}: ${issue.message}`,
                        `Row ${issue.row}: ${issue.message}`,
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        {/* Column guide */}
        <Panel
          title={pick("دليل الأعمدة", "Column guide")}
          description={pick(
            "الأعمدة المطلوبة أولًا، والباقي يُستكمل تلقائيًا من إعدادات المحطة.",
            "Required columns first; the rest are filled from plant settings.",
          )}
        >
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">
                {pick("مطلوبة", "Required")}:
              </span>{" "}
              التاريخ · نوع الخلطة · العميل · الكمية المنتجة
            </li>
            <li>
              <span className="font-semibold text-foreground">
                {pick("يُستكمل تلقائيًا", "Auto-filled")}:
              </span>{" "}
              {pick(
                "سعر وتكلفة المتر (من قائمة الأسعار المعتمدة) · عدد العربات · الحالة · في الموعد",
                "Price and cost per m³ (approved list) · trucks · status · on-time",
              )}
            </li>
            <li>
              <span className="font-semibold text-foreground">
                {pick("التنسيقات", "Formats")}:
              </span>{" "}
              {pick(
                "التاريخ YYYY-MM-DD أو تاريخ Excel · الوردية صباحي/مسائي/ليلي",
                "Date YYYY-MM-DD or an Excel date · shift morning/evening/night",
              )}
            </li>
          </ol>
          <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[11px] leading-5 text-muted-foreground">
            {pick(
              "كل رفع يُسجَّل في سجل التتبع باسم رافعه ووقته، ويمكن حذف القيود التجريبية فقط دون المساس بالبيانات الحقيقية.",
              "Every upload is written to the audit trail with its author and time; only demo records can be purged without touching real data.",
            )}
          </p>
        </Panel>
      </div>

      {/* Preview */}
      {parsed && parsed.rows.length > 0 && (
        <Panel
          className="mt-4 overflow-hidden"
          title={pick("٢ · مراجعة السطور قبل التثبيت", "2 · Review rows before commit")}
          description={pick(
            `أول ${formatNumber(preview.length)} سطرًا من ${formatNumber(parsed.rows.length)}.`,
            `First ${formatNumber(preview.length)} of ${formatNumber(parsed.rows.length)} rows.`,
          )}
          bodyClassName="px-0 pb-0 pt-2"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-5">{pick("التاريخ", "Date")}</TableHead>
                  <TableHead>{pick("الوردية", "Shift")}</TableHead>
                  <TableHead>{pick("الخلطة", "Mix")}</TableHead>
                  <TableHead>{pick("العميل", "Customer")}</TableHead>
                  <TableHead className="text-end">{pick("منتج (م³)", "Produced")}</TableHead>
                  <TableHead className="text-end">{pick("مسلّم (م³)", "Delivered")}</TableHead>
                  <TableHead className="text-end">{pick("العربات", "Trucks")}</TableHead>
                  <TableHead className="pe-5 text-end">{pick("الحالة", "Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row: ParsedLogRow, index) => (
                  <TableRow key={`${row.date}-${row.customer}-${index}`}>
                    <TableCell className="ps-5 tabular-nums">{formatDay(row.date)}</TableCell>
                    <TableCell>{SHIFT_SHORT_LABELS[row.shift as Shift]}</TableCell>
                    <TableCell className="font-medium">{row.mixDesign}</TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {row.customer}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatM3(row.quantityM3)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatM3(row.deliveredM3)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{row.truckCount}</TableCell>
                    <TableCell className="pe-5 text-end text-muted-foreground">
                      {STATUS_LABELS[row.status as LogStatus]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {parsed.issues.length > 0 && (
            <div className="border-t border-border/70 bg-destructive/5 px-5 py-3 text-[11px] text-destructive">
              <p className="font-semibold">
                {pick("سطور لن تُستورد:", "Rows that will not import:")}
              </p>
              <ul className="mt-1 space-y-0.5">
                {parsed.issues.slice(0, 8).map((issue) => (
                  <li key={issue.row}>
                    {pick(`السطر ${issue.row}: ${issue.message}`, `Row ${issue.row}: ${issue.message}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <FileSpreadsheet className="size-3.5" />
        {t("nav.import")} ·{" "}
        {pick(
          "الملف يُقرأ داخل المتصفح، ولا يُرسل إلا السطور الجاهزة إلى الكلاود.",
          "The file is parsed in the browser; only valid rows are sent to the cloud.",
        )}
      </p>
    </AppShell>
  );
}

function LiveTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Cloud;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="soft-card rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="size-4 text-brand" />
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
