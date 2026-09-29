import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/Panel";
import { RoleNotice } from "@/components/RoleNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccess } from "@/hooks/use-access";
import { DAX_CALCULATED_COLUMNS, DAX_MEASURES } from "@/lib/excelPack/dax";
import {
  buildPackFiles,
  DEPLOYMENT_URL,
  EXPORT_TOKEN_PLACEHOLDER,
  type PackFile,
} from "@/lib/excelPack/files";
import {
  API_ENDPOINTS,
  AUTH_LAYER,
  DASHBOARDS,
  INTEGRATIONS,
  ML_MODELS,
  PROTECTION_CHECKLIST,
  RBAC_ROLES,
  RETENTION_POLICY,
  STANDARDS,
  WEBHOOK_EVENTS,
} from "@/lib/excelPack/layers";
import { DATA_MODEL_TABLES, MODEL_COLUMN_COUNT, moneyColumns } from "@/lib/excelPack/tables";
import { downloadText, downloadZip } from "@/lib/zip";
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clipboard,
  Cloud,
  Copy,
  Cpu,
  Database,
  Download,
  FileSpreadsheet,
  Gauge,
  LineChart,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Table2,
  Wifi,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function CopyButton({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            toast.success("تم النسخ إلى الحافظة");
            window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => toast.error("تعذّر النسخ — انسخ يدويًا"));
      }}
    >
      {copied ? <CheckCircle2 className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {label}
    </Button>
  );
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/40">
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
          <span className="font-mono text-[11px] text-muted-foreground">{title}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre
        dir="ltr"
        className="max-h-80 overflow-auto p-3 text-left text-[11px] leading-5 text-foreground/90"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Cloud; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExcelPack() {
  const access = useAccess();
  const canExport = access.can("viewExport");
  const files = useMemo<PackFile[]>(() => buildPackFiles(), []);
  const [query, setQuery] = useState("");
  const [token, setToken] = useState("");
  const [probe, setProbe] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>(
    { state: "idle", message: "" },
  );

  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter(
      (file) =>
        file.path.toLowerCase().includes(needle) || file.note.toLowerCase().includes(needle),
    );
  }, [files, query]);

  const liveTables = DATA_MODEL_TABLES.filter((table) => table.endpoint);
  const totalBytes = files.reduce((sum, file) => sum + file.content.length, 0);

  const probeLayer = async () => {
    setProbe({ state: "loading", message: "" });
    try {
      const url = `${DEPLOYMENT_URL}/api/v1/iconcrete/manifest.json${
        token ? `?token=${encodeURIComponent(token)}` : ""
      }`;
      const response = await fetch(url);
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        entities?: unknown[];
      };
      if (response.ok && body.ok) {
        setProbe({
          state: "ok",
          message: `الطبقة تعمل: ${body.entities?.length ?? 0} كيانًا متاحًا للتصدير.`,
        });
      } else {
        setProbe({
          state: "error",
          message: body.message ?? `رمز الحالة ${response.status}`,
        });
      }
    } catch (error) {
      setProbe({
        state: "error",
        message: error instanceof Error ? error.message : "تعذّر الوصول إلى طبقة التصدير",
      });
    }
  };

  return (
    <AppShell
      eyebrow="التكامل والتقارير"
      title="حزمة Excel / Power Platform"
      description="نموذج بيانات كامل، استعلامات Power Query، مكتبة مقاييس DAX، مخطط Azure SQL، قوائم SharePoint، نقاط API، حقول IoT، نماذج تعلّم آلي، ثماني لوحات قيادة، وسجل امتثال — تُنزَّل حزمة واحدة جاهزة للاستيراد."
      actions={
        <>
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <Table2 className="size-3.5" />
            {DATA_MODEL_TABLES.length} جدولاً · {MODEL_COLUMN_COUNT} عمودًا
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <Gauge className="size-3.5" />
            {DAX_MEASURES.length} مقياس DAX
          </Badge>
        </>
      }
    >
      {!canExport ? (
        <RoleNotice
          icon={Lock}
          title="عرض فقط"
          message="تنزيل حزمة التقارير وربط Excel / Power Platform متاح للمالك والمدير والمراجع."
        />
      ) : (
        <div className="space-y-5">
          <Panel
            title="التنزيل"
            description="الحزمة تُبنى لحظيًا من نموذج البيانات المنشور في المنظومة، فلا يمكن أن تختلف الأعمدة أو المقاييس عمّا يعمل فعلاً."
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const bytes = downloadZip(
                      "IConcrete_Excel_PowerPlatform_Pack.zip",
                      files.map((file) => ({ path: file.path, content: file.content })),
                    );
                    toast.success(`تم تنزيل الحزمة (${files.length} ملفًا · ${Math.round(bytes / 1024)} كيلوبايت)`);
                  }}
                >
                  <Download className="size-4" />
                  تنزيل الحزمة كاملة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const content = JSON.stringify(
                      { deployment: DEPLOYMENT_URL, files: files.map((file) => file.path) },
                      null,
                      2,
                    );
                    downloadText("IConcrete_Pack_Files.json", content, "application/json");
                    toast.success("تم تنزيل فهرس الحزمة");
                  }}
                >
                  <Clipboard className="size-4" />
                  فهرس الملفات
                </Button>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={FileSpreadsheet} label="ملفات الحزمة" value={String(files.length)} />
              <Stat
                icon={Database}
                label="حجم الحزمة"
                value={`${Math.round(totalBytes / 1024)} ك.ب`}
              />
              <Stat icon={LineChart} label="لوحات القيادة" value={String(DASHBOARDS.length)} />
              <Stat icon={Cpu} label="نماذج التعلّم الآلي" value={String(ML_MODELS.length)} />
            </div>

            <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="text-xs font-semibold">طبقة التصدير الموحّدة — اختبرها الآن</p>
              <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
                كل جداول Power Query المرتبطة تسحب بياناتها من هذه الطبقة، وهي محمية برمز واحد.
                الصق الرمز الذي أضفته في تبويب المفاتيح باسم{" "}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
                  ICONCRETE_EXPORT_TOKEN
                </code>{" "}
                للتحقق من الاتصال. الرمز لا يُخزَّن في هذه الصفحة.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1 space-y-1.5">
                  <Label className="text-[11px]">عنوان النشر</Label>
                  <Input dir="ltr" value={DEPLOYMENT_URL} readOnly className="font-mono text-[11px]" />
                </div>
                <div className="min-w-56 flex-1 space-y-1.5">
                  <Label className="text-[11px]">رمز التصدير (اختياري للاختبار)</Label>
                  <Input
                    dir="ltr"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder={EXPORT_TOKEN_PLACEHOLDER}
                    className="font-mono text-[11px]"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={probeLayer}
                  disabled={probe.state === "loading"}
                >
                  {probe.state === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wifi className="size-4" />
                  )}
                  اختبار الطبقة
                </Button>
              </div>
              {probe.state !== "idle" && probe.state !== "loading" && (
                <p
                  className={
                    probe.state === "ok"
                      ? "mt-3 flex items-center gap-1.5 text-[11px] text-success"
                      : "mt-3 flex items-center gap-1.5 text-[11px] text-destructive"
                  }
                >
                  {probe.state === "ok" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertTriangle className="size-3.5" />
                  )}
                  {probe.message}
                </p>
              )}
            </div>
          </Panel>

          <Tabs defaultValue="files" className="gap-5">
            <TabsList className="flex-wrap">
              <TabsTrigger value="files">ملفات الحزمة</TabsTrigger>
              <TabsTrigger value="model">نموذج البيانات</TabsTrigger>
              <TabsTrigger value="dax">مقاييس DAX</TabsTrigger>
              <TabsTrigger value="api">التكامل والواجهات</TabsTrigger>
              <TabsTrigger value="iot">IoT و SCADA</TabsTrigger>
              <TabsTrigger value="ml">التعلّم الآلي</TabsTrigger>
              <TabsTrigger value="dash">لوحات القيادة</TabsTrigger>
              <TabsTrigger value="gov">الامتثال والأمان</TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------ files */}
            <TabsContent value="files">
              <Panel
                title="كل ملفات الحزمة"
                description="نزّل أي ملف وحده أو انسخ محتواه مباشرة، مع شرح وظيفته في خط التركيب."
                action={
                  <div className="w-64">
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="ابحث باسم الملف أو وظيفته…"
                      className="h-9 text-xs"
                    />
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الملف</TableHead>
                        <TableHead>الوظيفة</TableHead>
                        <TableHead className="text-end">الحجم</TableHead>
                        <TableHead className="text-end">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleFiles.map((file) => (
                        <TableRow key={file.path}>
                          <TableCell className="font-mono text-[11px]" dir="ltr">
                            {file.path}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {file.note}
                          </TableCell>
                          <TableCell className="text-end text-[11px] tabular-nums text-muted-foreground">
                            {Math.max(1, Math.round(file.content.length / 1024))} ك.ب
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex justify-end gap-1">
                              <CopyButton text={file.content} label="" />
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="تنزيل الملف"
                                onClick={() => {
                                  downloadText(file.path.split("/").pop() ?? "file.txt", file.content);
                                  toast.success("تم تنزيل الملف");
                                }}
                              >
                                <Download className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Panel>
            </TabsContent>

            {/* ------------------------------------------------ model */}
            <TabsContent value="model">
              <Panel
                title="نموذج البيانات المنشور"
                description="كل جدول هنا هو ورقة في Excel وقائمة في SharePoint وجدول في Azure SQL بنفس الأعمدة والأنواع."
                action={
                  <CopyButton
                    text={files.find((file) => file.path === "01_DataModel/Schema.json")?.content ?? ""}
                    label="نسخ مخطط JSON"
                  />
                }
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      <Cloud className="size-3.5 text-brand" />
                      جداول موصولة بطبقة تصدير حيّة
                    </p>
                    <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                      هذه الجداول لا تُدخل يدويًا: تستعلم نفسها من المنظومة كل تحديث.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {liveTables.map((table) => (
                        <Badge key={table.name} variant="outline" className="font-mono text-[10px]">
                          {table.endpoint}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      <ShieldCheck className="size-3.5 text-brand" />
                      الحماية على مستوى الصف والعمود
                    </p>
                    <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                      كل جدول تشغيلي يحمل عمود <span className="font-mono">test_data_flag</span>{" "}
                      لاستبعاد البيانات التجريبية، والحقول المالية أو الشخصية معلَّمة{" "}
                      <span className="font-mono">sensitive</span> وتُعمَّى في أي تصدير.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      <Building2 className="size-3.5 text-brand" />
                      تعدد الفروع والعملات
                    </p>
                    <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                      كل حقيقة تحمل الفرع، والجدول <span className="font-mono">fact_ProductionDaily</span>{" "}
                      يُجمع للفروع، وجداول <span className="font-mono">dim_Currencies</span> و{" "}
                      <span className="font-mono">dim_Timezones</span> تضبط التحويل والتوقيت.
                    </p>
                  </div>
                </div>

                <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pe-1">
                  {DATA_MODEL_TABLES.map((table) => (
                    <details key={table.name} className="rounded-xl border border-border/70">
                      <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold">
                        <span className="font-mono text-[11px] text-brand" dir="ltr">
                          {table.name}
                        </span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        {table.label}
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {table.columns.length} عمودًا · {table.group}
                          {table.endpoint ? " · حيّ" : ""}
                        </span>
                      </summary>
                      <div className="border-t border-border/60 px-3 py-3">
                        <p className="text-[11px] leading-6 text-muted-foreground">
                          {table.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {moneyColumns(table).length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              حقول مالية: {moneyColumns(table).length}
                            </Badge>
                          )}
                          {table.testFlag && (
                            <Badge variant="outline" className="text-[10px]">
                              test_data_flag
                            </Badge>
                          )}
                          {table.audited && (
                            <Badge variant="outline" className="text-[10px]">
                              سجل تدقيق
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>العمود</TableHead>
                                <TableHead>العنوان العربي</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>SQL</TableHead>
                                <TableHead>ملاحظة</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {table.columns.map((column) => (
                                <TableRow key={column.name}>
                                  <TableCell className="font-mono text-[11px]" dir="ltr">
                                    {column.name}
                                  </TableCell>
                                  <TableCell className="text-xs">{column.label}</TableCell>
                                  <TableCell className="text-[11px] text-muted-foreground">
                                    {column.type}
                                  </TableCell>
                                  <TableCell
                                    className="font-mono text-[11px] text-muted-foreground"
                                    dir="ltr"
                                  >
                                    {column.type === "money"
                                      ? "decimal(18,2)"
                                      : column.type === "text"
                                        ? "nvarchar(200)"
                                        : column.type}
                                  </TableCell>
                                  <TableCell className="text-[11px]">
                                    {column.key && (
                                      <Badge variant="outline" className="text-[10px]">
                                        مفتاح
                                      </Badge>
                                    )}
                                    {column.sensitive && (
                                      <Badge
                                        variant="outline"
                                        className="ms-1 border-warning/40 bg-warning/10 text-warning text-[10px]"
                                      >
                                        حسّاس
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </Panel>
            </TabsContent>

            {/* -------------------------------------------------- dax */}
            <TabsContent value="dax">
              <Panel
                title="مكتبة مقاييس DAX"
                description="كل مقياس مكتوب على أعمدة النموذج المنشور نفسه، وله مجلد يطابق لوحته وتنسيق عرض جاهز."
                action={
                  <CopyButton
                    text={files.find((file) => file.path === "03_DAX/Measures_IConcrete.dax")?.content ?? ""}
                    label="نسخ كل المقاييس"
                  />
                }
              >
                <div className="space-y-4">
                  {[...new Set(DAX_MEASURES.map((measure) => measure.folder))].map((folder) => (
                    <div key={folder}>
                      <p className="mb-2 text-xs font-semibold text-brand">{folder}</p>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {DAX_MEASURES.filter((measure) => measure.folder === folder).map((measure) => (
                          <div
                            key={measure.name}
                            className="rounded-xl border border-border/70 bg-muted/25 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-mono text-[11px] font-semibold" dir="ltr">
                                  {measure.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {measure.description}
                                </p>
                              </div>
                              <CopyButton text={measure.expression} label="" />
                            </div>
                            <pre
                              dir="ltr"
                              className="mt-2 overflow-x-auto rounded-lg bg-background/80 p-2 text-left text-[10px] leading-5"
                            >
                              <code>{measure.expression}</code>
                            </pre>
                            <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                              {measure.format}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <p className="mb-2 text-xs font-semibold text-brand">أعمدة محسوبة</p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {DAX_CALCULATED_COLUMNS.map((column) => (
                        <CodeBlock
                          key={column.name}
                          title={`${column.table} · ${column.name}`}
                          code={column.expression}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            </TabsContent>

            {/* -------------------------------------------------- api */}
            <TabsContent value="api">
              <Panel
                title="نقاط التكامل والويب هوك"
                description="نقاط البيع والشراء والتسليم والقياسات، وكل حدث يخرج من المنظومة مع سياسة المحاولة والتصعيد."
              >
                <CodeBlock
                  title="أمثلة جاهزة"
                  code={[
                    `# فحص الجاهزية`,
                    `curl "${DEPLOYMENT_URL}/api/v1/iconcrete/health"`,
                    ``,
                    `# كشف الكيانات والأعمدة`,
                    `curl "${DEPLOYMENT_URL}/api/v1/iconcrete/manifest.json?token=ICONCRETE_EXPORT_TOKEN"`,
                    ``,
                    `# تصدير الطلبيات لنافذة زمنية`,
                    `curl -o orders.csv "${DEPLOYMENT_URL}/api/v1/iconcrete/orders.csv?token=ICONCRETE_EXPORT_TOKEN&from=2026-01-01&to=2026-12-31"`,
                    ``,
                    `# بدون الأعمدة المالية`,
                    `curl "${DEPLOYMENT_URL}/api/v1/iconcrete/production_daily.csv?token=…&money=0"`,
                  ].join("\n")}
                />
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفعل</TableHead>
                        <TableHead>المسار</TableHead>
                        <TableHead>الغرض</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {API_ENDPOINTS.map((endpoint) => (
                        <TableRow key={`${endpoint.method}-${endpoint.path}`}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                endpoint.status.startsWith("منفَّذ")
                                  ? "border-success/40 bg-success/10 text-success text-[10px]"
                                  : "text-[10px]"
                              }
                            >
                              {endpoint.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[11px]" dir="ltr">
                            {endpoint.path}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {endpoint.purpose}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {endpoint.status}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs font-semibold">أحداث الويب هوك</p>
                    <ul className="mt-2 space-y-2">
                      {WEBHOOK_EVENTS.map((event) => (
                        <li key={event.event} className="text-[11px] leading-6">
                          <span className="font-mono text-brand" dir="ltr">
                            {event.event}
                          </span>
                          <span className="text-muted-foreground"> — {event.trigger}</span>
                          <br />
                          <span className="text-muted-foreground">
                            المحاولة: {event.retry} · التصعيد: {event.escalation}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs font-semibold">المصادقة والتشفير</p>
                    <ul className="mt-2 space-y-2">
                      {AUTH_LAYER.map((row) => (
                        <li key={row.item} className="text-[11px] leading-6">
                          <span className="font-semibold">{row.item}</span>
                          <span className="text-muted-foreground"> — {row.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Panel>
            </TabsContent>

            {/* -------------------------------------------------- iot */}
            <TabsContent value="iot">
              <Panel
                title="جاهزية IoT و SCADA"
                description="شبكات وحقول بانتظار الأجهزة: عند توصيل جهاز التتبع أو متحكم الخلاطة تعمل اللوحات فورًا بنفس الأعمدة."
                action={
                  <CopyButton
                    text={
                      files.find((file) => file.path === "06_IoT/IoT_Field_Dictionary.csv")?.content ?? ""
                    }
                    label="نسخ قاموس الحقول"
                  />
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat icon={Wifi} label="قراءة GPS" value="كل 30 ثانية" />
                  <Stat icon={Cpu} label="قراءة SCADA" value="كل دفعة" />
                  <Stat icon={Gauge} label="نقاط قياس" value="28 حقلًا" />
                  <Stat icon={ShieldCheck} label="نطاق مسموح" value="مُتحقَّق منه" />
                </div>
                <div className="mt-4 space-y-3">
                  <CodeBlock
                    title="حمولة قراءة عربة (POST /api/v1/telemetry/gps)"
                    code={[
                      "{",
                      '  "truck_code": "TR-04",',
                      '  "latitude": 30.013055,',
                      '  "longitude": 31.208853,',
                      '  "speed_kmh": 46.5,',
                      '  "heading_deg": 218,',
                      '  "ignition": true,',
                      '  "fuel_level_pct": 63.5,',
                      '  "geofence_status": "inside",',
                      '  "eta_minutes": 12,',
                      '  "captured_at": "2026-09-29T09:14:00Z"',
                      "}",
                    ].join("\n")}
                  />
                  <CodeBlock
                    title="حمولة متحكم الخلاطة (POST /api/v1/telemetry/scada)"
                    code={[
                      "{",
                      '  "line_code": "LINE-1",',
                      '  "batch_controller_status": "batching",',
                      '  "target_batched_m3": 9.0,',
                      '  "actual_batched_m3": 8.86,',
                      '  "load_cell_reading_kg": 20840,',
                      '  "motor_temp_c": 72.4,',
                      '  "conveyor_speed_mps": 1.8,',
                      '  "silo_level_pct": 41,',
                      '  "pump_pressure_bar": 86.2,',
                      '  "captured_at": "2026-09-29T09:14:00Z"',
                      "}",
                    ].join("\n")}
                  />
                </div>
                <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
                  أي قراءة خارج النطاق (سرعة، حرارة، ضغط، مستوى صومعة) تُرفض في الطبقة الأولى
                  وتُسجَّل في <span className="font-mono">stg_ValidationErrors</span> برسالة عربية
                  ودليل حل، فلا تدخل قراءة شاذة إلى لوحات القيادة أبدًا.
                </p>
              </Panel>
            </TabsContent>

            {/* --------------------------------------------------- ml */}
            <TabsContent value="ml">
              <Panel
                title="نماذج التعلّم الآلي"
                description="ستة نماذج بمواصفات كاملة: الهدف والخصائص والخوارزمية والإيقاع وجدول المخرجات والضوابط الأخلاقية."
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {ML_MODELS.map((model) => (
                    <div key={model.name} className="rounded-xl border border-border/70 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-[11px] font-semibold text-brand" dir="ltr">
                          {model.name}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          {model.cadence}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-6">{model.goal}</p>
                      <dl className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                        <div>
                          <dt className="inline font-semibold text-foreground">الهدف: </dt>
                          <dd className="inline">{model.target}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-foreground">الخصائص: </dt>
                          <dd className="inline">{model.features}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-foreground">الخوارزمية: </dt>
                          <dd className="inline">{model.algorithm}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-foreground">المخرجات: </dt>
                          <dd className="inline font-mono">{model.output}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-foreground">الضوابط: </dt>
                          <dd className="inline">{model.guardrails}</dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-[10px] text-muted-foreground">{model.status}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </TabsContent>

            {/* ------------------------------------------------- dash */}
            <TabsContent value="dash">
              <Panel
                title="لوحات القيادة الثمانية"
                description="كل لوحة تجيب على سؤال واحد، بمؤشرات محددة ومقاطعات وتنقيب حتى الطلبية الواحدة."
                action={
                  <CopyButton
                    text={files.find((file) => file.path === "08_Dashboards/Dashboards_Guide.md")?.content ?? ""}
                    label="نسخ دليل البناء"
                  />
                }
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {DASHBOARDS.map((dashboard, index) => (
                    <div key={dashboard.name} className="rounded-xl border border-border/70 p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {index + 1}
                        </Badge>
                        <p className="text-xs font-semibold">{dashboard.name}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {dashboard.audience}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                        {dashboard.question}
                      </p>
                      <p className="mt-2 font-mono text-[10px] text-brand" dir="ltr">
                        {dashboard.kpis}
                      </p>
                      <dl className="mt-2 space-y-1 text-[11px]">
                        <div className="text-muted-foreground">
                          <dt className="inline font-semibold text-foreground">المقاطعات: </dt>
                          <dd className="inline">{dashboard.slicers}</dd>
                        </div>
                        <div className="text-muted-foreground">
                          <dt className="inline font-semibold text-foreground">التنقيب: </dt>
                          <dd className="inline">{dashboard.drill}</dd>
                        </div>
                        <div className="text-muted-foreground">
                          <dt className="inline font-semibold text-foreground">التنبيهات: </dt>
                          <dd className="inline">{dashboard.alerts}</dd>
                        </div>
                        <div className="text-muted-foreground">
                          <dt className="inline font-semibold text-foreground">التصدير: </dt>
                          <dd className="inline">{dashboard.export}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </Panel>
            </TabsContent>

            {/* --------------------------------------------------- gov */}
            <TabsContent value="gov">
              <div className="space-y-4">
                <Panel
                  title="الأدوار والصلاحيات"
                  description="ستة أدوار تشغيلية بمصفوفة واضحة، ومنها تُبنى الصلاحيات داخل المصنف نفسه."
                >
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الدور</TableHead>
                          <TableHead>النطاق</TableHead>
                          <TableHead>الاعتماد</TableHead>
                          <TableHead>ملاحظة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {RBAC_ROLES.map((role) => (
                          <TableRow key={role.code}>
                            <TableCell className="font-mono text-[11px]" dir="ltr">
                              {role.code}
                              <span className="ms-2 font-sans text-[11px] text-muted-foreground">
                                {role.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">{role.scope}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {role.approval}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{role.note}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Panel>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel
                    title="سياسة الاحتفاظ بالبيانات"
                    description="مدة الاحتفاظ والأساس القانوني والأرشفة والإتلاف لكل نطاق بيانات."
                  >
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>النطاق</TableHead>
                            <TableHead className="text-end">الاحتفاظ</TableHead>
                            <TableHead>الأساس</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {RETENTION_POLICY.map((row) => (
                            <TableRow key={row.domain}>
                              <TableCell className="text-xs">{row.domain}</TableCell>
                              <TableCell className="text-end text-xs tabular-nums">
                                {row.years}
                              </TableCell>
                              <TableCell className="text-[11px] text-muted-foreground">
                                {row.basis}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Panel>

                  <Panel
                    title="المواصفات الدولية"
                    description="ما يُطلب من الدليل، وأين يوجد داخل المنظومة."
                  >
                    <div className="space-y-2">
                      {STANDARDS.map((standard) => (
                        <div
                          key={standard.code}
                          className="rounded-lg border border-border/60 bg-muted/25 p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <BadgeCheck className="size-3.5 text-brand" />
                            <span className="font-mono text-[11px]" dir="ltr">
                              {standard.code}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {standard.title}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            {standard.evidence}
                          </p>
                          <p className="mt-0.5 text-[10px] text-brand">{standard.where}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel
                    title="التكاملات المحاسبية واللوجستية"
                    description="نقاط الربط الجاهزة مواصفتها مع الأنظمة الخارجية."
                  >
                    <div className="space-y-2">
                      {INTEGRATIONS.map((integration) => (
                        <div key={integration.name} className="text-[11px] leading-6">
                          <span className="font-semibold">{integration.name}</span>
                          <span className="text-muted-foreground"> — {integration.purpose}</span>
                          <br />
                          <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                            {integration.protocol} · {integration.objects}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel
                    title="قائمة الحماية قبل التسليم"
                    description="ضوابط الحماية والتتبع والوصول التي تُفحص قبل تسليم النظام."
                    action={<CopyButton text={JSON.stringify(PROTECTION_CHECKLIST, null, 2)} label="نسخ" />}
                  >
                    <ul className="space-y-2">
                      {PROTECTION_CHECKLIST.map((item) => (
                        <li key={item.item} className="flex gap-2 text-[11px] leading-6">
                          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand" />
                          <span>
                            <span className="font-semibold">{item.item}</span>
                            <span className="text-muted-foreground"> — {item.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>

                <Panel
                  title="النسخ الاحتياطي والتطبيق على الموبايل"
                  description="خطة الاستعادة، وإدارة الإصدارات، ومسار العمل من الميدان."
                >
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                      <Archive className="size-4 text-brand" />
                      <p className="mt-2 text-xs font-semibold">النسخ</p>
                      <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
                        يومية 23:30 (30 يومًا) · أسبوعية الجمعة (12 أسبوعًا) · شهرية (7 سنوات) ·
                        ولقطة قبل أي ترحيل. الاستعادة: RTO 4 ساعات · RPO 15 دقيقة.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                      <RefreshCw className="size-4 text-brand" />
                      <p className="mt-2 text-xs font-semibold">إدارة الإصدارات والاعتماد</p>
                      <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
                        النموذج واللوحات والمقاييس في مستودع واحد، ولا نشر على الإنتاج إلا بعد
                        اختبار واعتماد كتابي، وكل تغيير سعر أو حذف قيد يمر بطلب اعتماد.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                      <Smartphone className="size-4 text-brand" />
                      <p className="mt-2 text-xs font-semibold">الموبايل والعمل دون اتصال</p>
                      <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
                        واجهة تعمل باللمس، وقائمة مزامنة للعمل دون اتصال، وإشعارات فورية
                        للتنبيهات الحرجة، وتصوير التذاكر والعقود، وتوقيع ميداني يُحفظ مع التذكرة.
                      </p>
                    </div>
                  </div>
                </Panel>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}
