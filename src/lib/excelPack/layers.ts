/**
 * IConcrete System — the non-tabular layers of the pack: integration API,
 * IoT/SCADA telemetry, machine-learning contracts, the eight dashboards and the
 * compliance & security register. Rendered as tables and guides on the download
 * screen, and emitted as JSON/CSV inside the zip.
 */

export type ApiEndpoint = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  module: string;
  purpose: string;
  auth: string;
  request: string;
  response: string;
  status: string;
};

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/api/v1/iconcrete/orders.csv",
    module: "الطلبيات",
    purpose: "سحب الطلبيات والإنتاج التفصيلي إلى Excel أو Power BI.",
    auth: "OAuth 2.0 (client credentials) أو رمز التصدير في ?token=",
    request: "from, to, branch, limit, money",
    response: "CSV بالأعمدة المعلنة في fact_Orders (أو JSON بنفس المفاتيح)",
    status: "منفَّذ في هذه المنظومة",
  },
  {
    method: "GET",
    path: "/api/v1/iconcrete/manifest.json",
    module: "المنصة",
    purpose: "كشف الكيانات والأعمدة وعدد الصفوف وآخر تاريخ بيانات لبناء الاستعلامات تلقائيًا.",
    auth: "نفس الرمز",
    request: "—",
    response: "JSON: entities[] + columns[] + counts",
    status: "منفَّذ في هذه المنظومة",
  },
  {
    method: "GET",
    path: "/api/v1/iconcrete/quality.csv",
    module: "الجودة",
    purpose: "نتائج المكعبات والركود للتحليل ولوحة الجودة.",
    auth: "نفس الرمز",
    request: "from, to, branch",
    response: "CSV/JSON",
    status: "منفَّذ في هذه المنظومة",
  },
  {
    method: "POST",
    path: "/api/v1/orders",
    module: "الطلبيات",
    purpose: "استقبال طلبية من نظام مبيعات خارجي أو من موقع العميل.",
    auth: "OAuth 2.0 + توقيع الطلب (HMAC-SHA256)",
    request: "{ customer, site, mix_design, quantity_m3, pour_window, order_ref }",
    response: "{ order_id, status: accepted }",
    status: "مواصفة موثّقة — تُنشر عند ربط نظام خارجي",
  },
  {
    method: "POST",
    path: "/api/v1/batches",
    module: "التشغيل",
    purpose: "دفع دفعة خلاطة من متحكم الخلاطة إلى المنظومة لحظيًا.",
    auth: "مفتاح جهاز لكل خلاطة (Device Key) + IP allow-list",
    request: "{ batch_no, mix_design, target_m3, actual_m3, lines[], controller_status }",
    response: "{ batch_id, accepted: true }",
    status: "جهيز — ينتظر توصيل متحكم الخلاطة",
  },
  {
    method: "PUT",
    path: "/api/v1/tickets/{ticket_id}",
    module: "التسليم",
    purpose: "تحديث تذكرة تسليم موقّعة (كمية، زمن، توقيع، صورة).",
    auth: "OAuth 2.0 + دور Supervisor فأعلى",
    request: "{ quantity_m3, received_by, signature_ref, photo_ref }",
    response: "{ ticket_id, updated_at }",
    status: "مواصفة موثّقة",
  },
  {
    method: "DELETE",
    path: "/api/v1/exceptions/{error_id}",
    module: "الحماية",
    purpose: "إغلاق خطأ تحقق بعد معالجته مع تسجيل من أغلقه ومتى.",
    auth: "OAuth 2.0 + دور Admin فقط (يحتاج اعتمادًا)",
    request: "{ resolution_note, resolved_by }",
    response: "{ error_id, resolved: true }",
    status: "مواصفة موثّقة",
  },
  {
    method: "POST",
    path: "/api/v1/telemetry/gps",
    module: "الأسطول",
    purpose: "استقبال قراءات GPS من أجهزة التتبع كل 30 ثانية أثناء الرحلة.",
    auth: "Device Key + توقيع الحمولة",
    request: "{ truck_code, latitude, longitude, speed_kmh, heading_deg, fuel_level_pct, captured_at }",
    response: "202 Accepted",
    status: "جهيز",
  },
  {
    method: "POST",
    path: "/api/v1/telemetry/scada",
    module: "التشغيل",
    purpose: "استقبال قراءات SCADA/PLC: خلايا الوزن وحرارة المحرك وسرعة السير وضغط الطلمبة.",
    auth: "Gateway مخصص داخل شبكة المحطة (OPC UA → HTTPS)",
    request: "{ line_code, controller_status, load_cell_kg, motor_temp_c, conveyor_mps, pump_pressure_bar }",
    response: "202 Accepted",
    status: "جهيز",
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/subscribe",
    module: "المنصة",
    purpose: "تسجيل عنوان خارجي ليستقبل أحداث المنظومة (تنبيه، فاتورة، انتهاء صيانة).",
    auth: "OAuth 2.0 + سرّ التوقيع",
    request: "{ url, events[], secret }",
    response: "{ subscription_id }",
    status: "جهيز",
  },
];

export type WebhookEvent = {
  event: string;
  trigger: string;
  payload: string;
  retry: string;
  escalation: string;
};

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    event: "order.created",
    trigger: "إضافة طلبية جديدة من أي واجهة.",
    payload: "order_id, customer, mix_design, quantity_m3, branch",
    retry: "٣ محاولات: 10 ث ثم 60 ث ثم 300 ث",
    escalation: "بعد الفشل النهائي: تنبيه للمشرف + صف في stg_ValidationErrors",
  },
  {
    event: "batch.completed",
    trigger: "إغلاق دفعة خلاطة بكميات فعلية.",
    payload: "batch_id, actual_m3, deviation_pct, controller_status",
    retry: "٣ محاولات بنفس التدرّج",
    escalation: "تنبيه فوري لمشرف التشغيل عند أي انحراف يتجاوز 3%",
  },
  {
    event: "quality.failed",
    trigger: "نتيجة اختبار غير مطابقة (مكعب 28 يومًا أو ركود خارج النطاق).",
    payload: "test_id, mix_design, actual_value, target_value",
    retry: "محاولتان",
    escalation: "فتح حالة عدم مطابقة تلقائيًا + إشعار مدير الجودة",
  },
  {
    event: "maintenance.overdue",
    trigger: "تجاوز معدة موعد صيانتها بالعدّاد أو بالتاريخ.",
    payload: "asset_code, remaining_days, maintenance_status",
    retry: "٣ محاولات",
    escalation: "إشعار مدير الصيانة، ثم المالك عند تجاوز 7 أيام",
  },
  {
    event: "threshold.breached",
    trigger: "تجاوز أي مؤشر حدود cfg_KPIThresholds.",
    payload: "metric, value, threshold, window_days, recipients",
    retry: "محاولتان",
    escalation: "مسار التصعيد المكتوب في القاعدة (مشرف ← مدير ← مالك)",
  },
  {
    event: "invoice.overdue",
    trigger: "فاتورة تجاوزت تاريخ استحقاقها.",
    payload: "invoice_no, customer, total_amount, aging_days",
    retry: "يوميًا حتى التحصيل",
    escalation: "قائمة ائتمان + احتمال إيقاف الطلبيات عند تجاوز 60 يومًا",
  },
  {
    event: "inventory.low",
    trigger: "وصول أي مادة إلى حد إعادة الطلب.",
    payload: "material_name, balance_qty, reorder_level, cover_days",
    retry: "محاولتان",
    escalation: "إشعار المشتريات + تنبيه المالك عند نفاد المخزون",
  },
];

export const AUTH_LAYER = [
  {
    item: "OAuth 2.0",
    detail:
      "تدفّق client_credentials للأنظمة، وauthorization_code للمستخدمين، مع refresh token وتدوير المفاتيح كل 90 يومًا.",
  },
  {
    item: "نطاقات الصلاحية (Scopes)",
    detail: "orders.read · orders.write · quality.write · inventory.read · finance.read (مقيّد بالمالك).",
  },
  {
    item: "التحقق متعدد العوامل",
    detail: "إلزامي لأدوار Admin و Manager و Auditor في بيئة الإنتاج.",
  },
  {
    item: "التشفير أثناء النقل",
    detail: "TLS 1.2+ لكل نقطة اتصال، مع HSTS ومنع الاتصال غير المشفّر.",
  },
  {
    item: "التشفير في السكون",
    detail:
      "AES-256 لقاعدة البيانات والنسخ الاحتياطية؛ الحقول الحساسة (sensitive) تُعمَّى بالكامل ولا تُصدَّر.",
  },
  {
    item: "إدارة المفاتيح",
    detail: "مفاتيح في Azure Key Vault (أو Convex env vars) بتدوير كل 90 يومًا وفصل بيئات dev/prod.",
  },
  {
    item: "سجل الدخول",
    detail: "كل محاولة دخول ناجحة أو فاشلة تُسجَّل بالبريد و IP والجهاز والنتيجة.",
  },
];

export type MlModel = {
  name: string;
  goal: string;
  target: string;
  features: string;
  algorithm: string;
  cadence: string;
  output: string;
  guardrails: string;
  status: string;
};

export const ML_MODELS: MlModel[] = [
  {
    name: "Demand_Forecasting_7Days_Ahead",
    goal: "تخطيط الخلاطات والعربات والمواد قبل أسبوع.",
    target: "الكمية اليومية (م³) لكل خلطة وفرع.",
    features:
      "تاريخ الأسبوع، الموسم، اتجاه 90 يومًا، طلبيات مؤكدة، عطلات، أحوال الطقس، أسعار الخلطات",
    algorithm: "Seasonal ARIMA / Prophet، ثم Gradient Boosting للتصحيح على الأيام الشاذة",
    cadence: "تشغيل يومي 05:00 — إعادة تدريب أسبوعية",
    output: "ml_DemandForecast",
    guardrails: "الحد الأدنى 60 يومًا من البيانات، وإعلان MAPE، ومنع أي تنبؤ بدون نطاق ثقة.",
    status: "بيانات التدريب موجودة — النموذج يحتاج تشغيل أول بعد 60 يومًا من العمل الفعلي",
  },
  {
    name: "Price_Optimization_Recommendations",
    goal: "رفع الهامش دون فقدان العميل، وتوحيد التسعير بمنطق مرن.",
    target: "السعر المقترح لكل خلطة وشريحة عميل.",
    features: "التكلفة الفعلية، مرونة الطلب التاريخية، حجم العميل، المنافسة، تاريخ تغيّر الأسعار",
    algorithm: "انحدار مرونة + أمثلية مقيّدة (الهامش ≥ الحد الأدنى المعتمد)",
    cadence: "شهري، وكل تغيّر كبير في تكلفة الأسمنت",
    output: "ml_PriceOptimization",
    guardrails: "أي تغيير سعر يحتاج اعتمادًا (Approval Workflow) ولا يُطبَّق تلقائيًا.",
    status: "مواصفة جاهزة — تحتاج 6 أشهر من تاريخ الأسعار",
  },
  {
    name: "Predictive_Maintenance_Alerts",
    goal: "تحويل الصيانة من إصلاح بعد العطل إلى تدخّل قبل التوقف.",
    target: "احتمال العطل خلال 30 يومًا + تاريخه المتوقع.",
    features: "أنماط الأعطال السابقة، ساعات التشغيل، قراءات SCADA (حرارة/تيار/ضغط)، استهلاك الوقود، عمر القطع",
    algorithm: "Random Forest / Gradient Boosting مع مؤشرات إنذار مبكر من SCADA",
    cadence: "تشغيل يومي — إعادة تدريب شهري",
    output: "ml_PredictiveMaintenance",
    guardrails: "الحد الأدنى 3 أعطال مسجّلة للمعدة، والتوصية إرشادية لا تُوقف معدة تلقائيًا.",
    status: "بيانات الصيانة والعدادات جاهزة في النظام",
  },
  {
    name: "Route_Optimization_Minimum_Fuel",
    goal: "أقل استهلاك وقود وأقل زمن انتظار لأكبر عدد تسليمات.",
    target: "ترتيب التسليم لكل عربة.",
    features: "مواقع المواقع، نوافذ الصب، قراءات GPS، المسافات الفعلية، زمن الانتظار، حمولة العربة",
    algorithm: "Vehicle Routing Problem مع قيود نوافذ الوقت (OR-Tools / Google Maps Distance Matrix)",
    cadence: "كل ساعة، وإعادة تحسين فوري عند أي تأخير",
    output: "ml_RouteOptimization",
    guardrails: "لا يتجاوز نافذة الصب المتفق عليها، ويحترم سعة 9 م³ لكل عربة.",
    status: "يحتاج تشغيل جهاز تتبع GPS على العربات",
  },
  {
    name: "Customer_Churn_Prediction",
    goal: "التنبؤ بفقدان العميل قبل حدوثه وترتيب زيارات المبيعات.",
    target: "احتمال عدم وجود طلبيات في 60 يومًا القادمة.",
    features: "تكرار الطلبيات، اتجاه الكمية، عمر العلاقة، التأخيرات، أعمار الديون، شكاوى الجودة",
    algorithm: "Gradient Boosting مع تفسير SHAP لكل عميل",
    cadence: "أسبوعي",
    output: "ml_ChurnPrediction",
    guardrails: "لا قرار آلي: القائمة للتنفيذ البشري فقط، مع سبب واضح لكل تصنيف.",
    status: "جاهز بعد 4 أشهر من الطلبيات الفعلية",
  },
  {
    name: "Credit_Risk_Assessment",
    goal: "حماية التحصيل ووقف الطلبيات قبل تفاقم المتأخرات.",
    target: "درجة ائتمانية 0–100 + قرار إيقاف اختياري.",
    features: "التعرّض، المتأخرات، متوسط أيام السداد، سقف الائتمان، تاريخ الدفعات",
    algorithm: "Logistic Regression قابل للتفسير (قاعدة صارمة على القرارات المالية)",
    cadence: "يومي قبل إصدار أي طلبية",
    output: "ml_CreditRisk",
    guardrails: "قرار الإيقاف يحتاج اعتماد المدير المالي، وللمالك وحده تجاوزه.",
    status: "مواصفة جاهزة — تحتاج مربوطة بجدول الفواتير والتحصيل",
  },
];

export type DashboardSpec = {
  name: string;
  audience: string;
  question: string;
  kpis: string;
  slicers: string;
  drill: string;
  alerts: string;
  export: string;
};

export const DASHBOARDS: DashboardSpec[] = [
  {
    name: "الملخص التنفيذي",
    audience: "المالك والإدارة",
    question: "هل المحطة رابحة هذا الشهر، وأين تنزف؟",
    kpis: "Total_Revenue · Gross_Profit · Margin_Pct · Utilization_Rate · On_Time_Percent · Real_Data_Only",
    slicers: "الشهر · الفرع · الخلطة · الوردية · حقيقي/تجريبي",
    drill: "الملخص ← الشهر ← اليوم ← الطلبية الواحدة بأرقامها",
    alerts: "هامش أقل من 8% ثلاث أيام متصلة، أو شهر خاسر",
    export: "PDF للإدارة · PPT لاجتماع المالك · Excel للتفصيل",
  },
  {
    name: "كفاءة الإنتاج",
    audience: "مدير التشغيل",
    question: "هل ننتج بالكفاءة والطاقة المتاحتين؟",
    kpis: "Production_Efficiency · Utilization_Rate · Total_Produced_M3 · Returned_M3 · Avg_Truck_Load_M3",
    slicers: "الفرع · الوردية · الخلطة · الأسبوع",
    drill: "الشهر ← اليوم ← الوردية ← دفعة الخلاطة (fact_Batches)",
    alerts: "مرتجعات تتجاوز 5% أو طاقة مستغلّة أقل من 60%",
    export: "PDF للاجتماع الأسبوعي · Excel للتفصيل بالدفعات",
  },
  {
    name: "ضبط الجودة",
    audience: "مدير الجودة والمراجع",
    question: "هل الخرسانة مطابقة ودلائلها موثّقة؟",
    kpis: "Pass_Rate · Cube28_Avg_MPa · Strength_Ratio_Pct · Slump_In_Band_Pct · Open_NonConformities",
    slicers: "الخلطة · المعمل · الشهر · الفرع · نوع الاختبار",
    drill: "نسبة المطابقة ← الخلطة ← الصبّة ← نتيجة الاختبار والشهادة",
    alerts: "أي اختبار غير مطابق فورًا + فتح حالة عدم مطابقة",
    export: "PDF للمراجع الخارجي · Excel لسجل الاختبارات",
  },
  {
    name: "أداء الأسطول",
    audience: "مدير النقل",
    question: "أين العربات، ولماذا التأخير، وكم يكلّف الكيلومتر؟",
    kpis: "Fleet_Availability_Pct · Avg_Waiting_Minutes · Fuel_Cost_per_Km · Geofence_Alerts · Trips_Count",
    slicers: "العربة · السائق · الفترة · حالة النطاق الجغرافي",
    drill: "الأسطول ← العربة ← الرحلة ← قراءات GPS بالدقيقة",
    alerts: "خروج من النطاق الجغرافي، أو انتظار يتجاوز 45 دقيقة",
    export: "PDF لتقرير العطل · Excel لتحليل الرحلات",
  },
  {
    name: "الصحة المالية",
    audience: "المدير المالي والمالك",
    question: "الإيراد والتكلفة والتحصيل — وأين الضغط؟",
    kpis: "Total_Revenue · Cost_per_m3 · Margin_Pct · Revenue_MTD/YTD · Credit_Risk_Exposure",
    slicers: "الشهر · العميل · الفرع · الخلطة · حالة الفاتورة",
    drill: "الإيراد ← العميل ← الطلبية ← الفاتورة ← الدفعة",
    alerts: "عمر دين يتجاوز 60 يومًا أو استخدام سقف ائتمان فوق 90%",
    export: "PDF للإدارة المالية · Excel للتسوية المحاسبية",
  },
  {
    name: "لوحة الصيانة",
    audience: "مدير الصيانة",
    question: "ما المتأخر، وما المتوقع أن يتعطل، وبكم؟",
    kpis: "Equipment_Overdue · Predicted_Failure_Date · Failure_Risk_Exposure · Downtime_Hours · Maintenance_Cost_Per_Unit",
    slicers: "المعدة · الفرع · نوع الصيانة · حالة الاستحقاق",
    drill: "الأسطول ← المعدة ← أمر الصيانة ← القطع والتكلفة وزمن التوقف",
    alerts: "معدة متأخرة أكثر من 7 أيام، أو احتمال عطل 60%+ خلال الشهر",
    export: "PDF لخطة الأسبوع · Excel لسجل القطع",
  },
  {
    name: "تحسين المخزون",
    audience: "مدير المخازن والمشتريات",
    question: "هل الأرصدة كافية ولا يوجد رأس مال مجمّد؟",
    kpis: "Stock_Value · Turnover_Days · Low_Stock_Count · Stock_Cover_Days · Consumption_Value_30D",
    slicers: "المادة · الفئة · الفرع · المورد",
    drill: "الرصيد الكلي ← المادة ← آخر 30 حركة ← أمر التوريد",
    alerts: "مادة عند حد إعادة الطلب أو تغطية أقل من 3 أيام",
    export: "PDF لأمر التوريد · Excel للتسوية مع الجرد",
  },
  {
    name: "ربحية العملاء",
    audience: "المبيعات والتسويق",
    question: "من العميل الذي يستحق التركيز، ومن الذي يستهلك الربح؟",
    kpis: "الإيراد وربح كل عميل · Margin_Pct · Churn_Risk_Customers · Credit_Risk_Exposure · Price_Uplift_Opportunity",
    slicers: "العميل · الشريحة · المنطقة · الشهر",
    drill: "ترتيب العملاء ← العميل ← الطلبيات ← الشكاوى والتأخيرات",
    alerts: "عميل بربح سلبي أو احتمال فقدان يتجاوز 40%",
    export: "PDF لقائمة الزيارات · Excel لتحليل الربحية",
  },
];

export const RBAC_ROLES = [
  { code: "Admin", label: "مدير النظام", scope: "كل الفروع", approval: "لا يحتاج", note: "يُساوي «مالك» في المنظومة." },
  { code: "Manager", label: "مدير تشغيل", scope: "كل الفروع", approval: "لا يحتاج", note: "يُساوي «مدير»." },
  { code: "Supervisor", label: "مشرف وردية", scope: "فرعه فقط", approval: "يحتاج للأسعار والفروع", note: "يدخل ويعتمد عمل ورديته." },
  { code: "Operator", label: "مشغّل", scope: "ورديته", approval: "يحتاج لكل تعديل بعد 24 ساعة", note: "يُساوي «مشغّل»." },
  { code: "Viewer", label: "مطّلع", scope: "فرعه (قراءة)", approval: "—", note: "بلا أي صلاحية تعديل." },
  { code: "Auditor", label: "مراجع", scope: "كل الفروع (قراءة)", approval: "—", note: "يُساوي «مراجع» + سجل التتبع الكامل." },
];

export const RETENTION_POLICY = [
  { domain: "الطلبيات والإنتاج", years: "10", basis: "تجاري وضريبي", archive: "Azure SQL Archive", purge: "إتلاف بعد الاعتماد", owner: "المدير المالي" },
  { domain: "اختبارات الجودة", years: "10", basis: "ISO 9001 و ECP 203", archive: "SharePoint للسجلات", purge: "لا إتلاف قبل المراجعة", owner: "مدير الجودة" },
  { domain: "المخزون وحركته", years: "7", basis: "تدقيق مالي", archive: "Azure SQL Archive", purge: "تجميع سنوي", owner: "مدير المخازن" },
  { domain: "الفواتير والتحصيل", years: "10", basis: "قانوني وضريبي", archive: "Azure SQL Archive", purge: "إتلاف بعد التقادم", owner: "المدير المالي" },
  { domain: "سجل التتبع", years: "7", basis: "تدقيق و GDPR", archive: "Cold storage", purge: "إتلاف مع الاحتفاظ بالملخص", owner: "الأمن السيبراني" },
  { domain: "قراءات GPS و SCADA", years: "2", basis: "تشغيلي", archive: "ملفات مضغوطة", purge: "حذف آلي بعد سنتين", owner: "مدير التشغيل" },
  { domain: "بيانات العملاء الشخصية", years: "حتى إلغاء الموافقة", basis: "موافقة GDPR", archive: "مشفّر", purge: "إتلاف فوري عند الطلب", owner: "مسؤول حماية البيانات" },
];

export const STANDARDS = [
  { code: "ISO 9001:2015", title: "إدارة الجودة", evidence: "إجراءات الصب، سجل الاختبارات، حالات عدم المطابقة، التدقيق الداخلي، رضا العميل", where: "الجودة · التتبع · عدم المطابقة" },
  { code: "ISO 14001:2015", title: "الإدارة البيئية", evidence: "الغبار والمياه المهدورة والتخلص من المخلفات وتتبع الأثر البيئي", where: "المخازن · التشغيل" },
  { code: "ISO 45001 / OHSAS 18001", title: "السلامة والصحة المهنية", evidence: "بلاغات الحوادث، فحص المعدات، تدريب الفريق، معدات الوقاية", where: "الصيانة · الفريق" },
  { code: "ECP 203-2007", title: "الكود المصري للخرسانة", evidence: "الخلطات والمقاومة المميزة والركود وأخذ العينات", where: "الخلطات · الجودة" },
  { code: "ASTM C94", title: "الخرسانة الجاهزة", evidence: "تذكرة التسليم، زمن الخلط، الركود، درجة الحرارة، الاختبارات المعيارية", where: "التسليم · الجودة · الدفعات" },
  { code: "EN 206", title: "مواصفة الخرسانة الأوروبية", evidence: "فئات التعرّض، الحد الأدنى للأسمنت، نسبة الماء/الأسمنت، المقاومة", where: "الخلطات · الجودة" },
  { code: "GDPR", title: "حماية البيانات", evidence: "الأساس القانوني، مدة الاحتفاظ، حق الوصول والإتلاف، سجل التتبع", where: "الحماية · سياسة الاحتفاظ" },
  { code: "ISO 27001", title: "أمن المعلومات", evidence: "مصفوفة الصلاحيات، إدارة المفاتيح، النسخ الاحتياطي، خطة الاستعادة", where: "الحماية · النسخ" },
];

export const INTEGRATIONS = [
  { name: "QuickBooks Online", purpose: "ترحيل الفواتير والمصروفات والتحصيل", protocol: "REST + OAuth 2.0", objects: "Invoice · Payment · Bill · Customer" },
  { name: "Xero", purpose: "مزامنة القيود المحاسبية للفروع", protocol: "REST + OAuth 2.0", objects: "Invoices · Contacts · Journals" },
  { name: "Oracle ERP", purpose: "عملاء المؤسسات الكبيرة وأوامر الشراء", protocol: "REST/CSV staging", objects: "AR Invoices · Purchase Orders" },
  { name: "SAP S/4HANA", purpose: "المجموعة الأم ومراكز التكلفة", protocol: "OData v4", objects: "Billing · Cost Center · Vendor" },
  { name: "Google Maps Platform", purpose: "المسافات وترتيب الرحلات ووقت الوصول المتوقع", protocol: "REST + API Key", objects: "Distance Matrix · Geocoding" },
  { name: "Twilio", purpose: "رسائل SMS للتنبيهات الحرجة والسائقين", protocol: "REST + API Key", objects: "Messages · Verify" },
  { name: "SendGrid", purpose: "بريد التقارير والتنبيهات والفواتير", protocol: "REST + API Key", objects: "Mail Send · Templates" },
  { name: "FedEx / DHL", purpose: "تتبع شحنات قطع الغيار والمستندات", protocol: "REST + OAuth 2.0", objects: "Tracking · Shipment" },
];

export const PROTECTION_CHECKLIST = [
  { item: "Test_Data_Flag", detail: "العمود موجود في كل جدول تشغيلي، ويستبعد أي صف تجريبي من التقارير الرسمية بضغطة واحدة." },
  { item: "تعمية الحقول الحساسة", detail: "كل حقل مالي أو شخصي معلَّم (sensitive) يُعمَّى في أي تصدير غير مصرّح به، ولا يخرج من النظام بلا صلاحية." },
  { item: "حماية أوراق العمل", detail: "كل ورقة محمية بكلمة مرور: الصفوف المحسوبة مغلقة، والمدخلات مفتوحة داخل نطاقات التحقق فقط." },
  { item: "التوقيع الرقمي للماكرو", detail: "أي ماكرو VBA يُوقَّع بشهادة من جهة موثوقة، ولا يعمل إلا بعد اعتماد قائمة الثقة في المؤسسة." },
  { item: "Undo/Redo", detail: "كل إجراء إدخال في المنظومة قابل للتراجع، وكل تراجع يُسجَّل في سجل التتبع كعملية مستقلة." },
  { item: "Approval Workflow", detail: "تغيير الأسعار وحذف القيود وإيقاف طلبيات العميل تمر بطلب اعتماد له مهلة وتصعيد." },
  { item: "قواعد تحقق على كل ارتباط", detail: "لا يمكن تسجيل طلبية بعميل غير معروف، ولا دفعة بخلطة غير معتمدة، ولا صرف بلا رصيد." },
  { item: "منع الخطأ عند الإدخال", detail: "قوائم منسدلة من الجداول المرجعية، ونطاقات رقمية، ومنع القيم السالبة في الكميات." },
  { item: "سجل تدقيق لكل عملية", detail: "من، وماذا، ومتى، ومن أي IP، والقيمة القديمة والجديدة لكل حقل تغيّر." },
  { item: "مسار تصعيد لكل تنبيه", detail: "لكل حد مسار مكتوب: مشرف ← مدير ← مالك، مع مهلة زمنية لكل مستوى." },
  { item: "تحليل اتجاه لكل مؤشر", detail: "لا رقم بلا خط اتجاه ومقارنة بالفترة السابقة والمتوسط المتحرك." },
  { item: "ربط السبب الجذري", detail: "كل انحراف يفتح تحليل سبب جذري (5 Whys) وإجراء تصحيح يُتابَع حتى الإغلاق." },
  { item: "دليل حل لكل خطأ", detail: "مركز الأخطاء يشرح الخطأ وسببه وخطوة الحل المقترحة، مع من عالجه ومتى." },
];
