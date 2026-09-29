/**
 * IConcrete System — DAX library for the Power Pivot model.
 *
 * Every measure is written against the columns published in `model.ts`, so the
 * pack installs without a single broken reference. Folders map to the eight
 * dashboards, which makes the measure list navigable in Power BI.
 */

export type DaxMeasure = {
  name: string;
  folder: string;
  format: string;
  description: string;
  expression: string;
};

export const DAX_MEASURES: DaxMeasure[] = [
  {
    name: "Total_Revenue",
    folder: "01 المالية",
    format: "\"ج.م\" #,##0.00",
    description: "إجمالي الإيراد المعتمد: الكمية المسلّمة × سعر المتر لكل قيد.",
    expression: "Total_Revenue := SUMX ( fact_Orders, fact_Orders[revenue] )",
  },
  {
    name: "Total_Cost",
    folder: "01 المالية",
    format: "\"ج.م\" #,##0.00",
    description: "إجمالي تكلفة الإنتاج: المواد والعمالة والتشغيل لكل قيد.",
    expression: "Total_Cost := SUMX ( fact_Orders, fact_Orders[total_cost] )",
  },
  {
    name: "Gross_Profit",
    folder: "01 المالية",
    format: "\"ج.م\" #,##0.00",
    description: "الربح الإجمالي = الإيراد − التكلفة، ويظهر بالسالب في الأيام المتعثرة.",
    expression: "Gross_Profit := [Total_Revenue] - [Total_Cost]",
  },
  {
    name: "Margin_Pct",
    folder: "01 المالية",
    format: "0.0 %",
    description: "نسبة الهامش من الإيراد؛ الحد الأدنى المعتمد 8%.",
    expression: "Margin_Pct := DIVIDE ( [Gross_Profit], [Total_Revenue] )",
  },
  {
    name: "Cost_per_m3",
    folder: "01 المالية",
    format: "#,##0.00",
    description: "تكلفة المتر المكعب المسلّم — أساس المقارنة مع السعر المعتمد.",
    expression: "Cost_per_m3 := DIVIDE ( [Total_Cost], [Total_Delivered_M3] )",
  },
  {
    name: "Price_per_m3",
    folder: "01 المالية",
    format: "#,##0.00",
    description: "متوسط سعر البيع المرجّح بالكمية.",
    expression: "Price_per_m3 := DIVIDE ( [Total_Revenue], [Total_Delivered_M3] )",
  },
  {
    name: "Total_Delivered_M3",
    folder: "01 المالية",
    format: "#,##0.0",
    description: "الكمية المقبولة على الموقع لكل الطلبيات في السياق الحالي.",
    expression: "Total_Delivered_M3 := SUM ( fact_Orders[delivered_m3] )",
  },
  {
    name: "Total_Produced_M3",
    folder: "02 التشغيل",
    format: "#,##0.0",
    description: "الكمية المخلوطة فعلاً (المطلوبة) قبل خصم المرتجعات.",
    expression: "Total_Produced_M3 := SUM ( fact_Orders[quantity_m3] )",
  },
  {
    name: "Returned_M3",
    folder: "02 التشغيل",
    format: "#,##0.0",
    description: "الكمية المرتجعة أو المرفوضة — مؤشر مباشر على الفاقد التجاري.",
    expression: "Returned_M3 := SUM ( fact_Orders[returned_m3] )",
  },
  {
    name: "Production_Efficiency",
    folder: "02 التشغيل",
    format: "0.0 %",
    description:
      "كفاءة الإنتاج = الكمية المقبولة ÷ الكمية المخلوطة؛ الفرق هو الفاقد والمرتجعات.",
    expression:
      "Production_Efficiency :=\nDIVIDE ( [Total_Delivered_M3], [Total_Produced_M3] )",
  },
  {
    name: "On_Time_Percent",
    folder: "02 التشغيل",
    format: "0.0 %",
    description: "نسبة الطلبيات المسلّمة داخل نافذة الصب المتفق عليها (حد التحذير 85%).",
    expression:
      "On_Time_Percent :=\nDIVIDE (\n    CALCULATE ( COUNTROWS ( fact_Orders ), fact_Orders[on_time] = TRUE ),\n    COUNTROWS ( fact_Orders )\n)",
  },
  {
    name: "Orders_Count",
    folder: "02 التشغيل",
    format: "#,##0",
    description: "عدد الطلبيات في السياق، يُستخدم في المتوسطات وإحصاءات الأداء.",
    expression: "Orders_Count := COUNTROWS ( fact_Orders )",
  },
  {
    name: "Trips_Count",
    folder: "02 التشغيل",
    format: "#,##0",
    description: "عدد رحلات العربات المسجّلة، ويُقارن بعدد الطلبيات لكشف الرحلات المركّبة.",
    expression: "Trips_Count := COUNTROWS ( fact_Dispatch )",
  },
  {
    name: "Avg_Truck_Load_M3",
    folder: "02 التشغيل",
    format: "#,##0.0",
    description: "متوسط الحمولة الفعلية للعربة (السعة المعيارية 9 م³).",
    expression: "Avg_Truck_Load_M3 := AVERAGE ( fact_Dispatch[load_m3] )",
  },
  {
    name: "Utilization_Rate",
    folder: "02 التشغيل",
    format: "0.0 %",
    description:
      "نسبة استغلال الطاقة: الكمية المنتجة مقابل الطاقة المرخّصة للمحطة في نفس الفترة.",
    expression:
      "Utilization_Rate :=\nDIVIDE (\n    [Total_Produced_M3],\n    SUMX ( VALUES ( dim_Calendar[date] ), [Design_Capacity_M3] )\n)",
  },
  {
    name: "Design_Capacity_M3",
    folder: "02 التشغيل",
    format: "#,##0",
    description: "الطاقة اليومية المرخّصة للفروع المحددة في المصفّي.",
    expression: "Design_Capacity_M3 := SUM ( dim_Branches[capacity_m3_day] )",
  },
  {
    name: "Pass_Rate",
    folder: "03 الجودة",
    format: "0.0 %",
    description: "نسبة اختبارات الجودة المطابقة (مكعبات 7 و28 يومًا والركود).",
    expression:
      "Pass_Rate :=\nDIVIDE (\n    CALCULATE ( COUNTROWS ( fact_QualityTests ), fact_QualityTests[passed] = TRUE ),\n    COUNTROWS ( fact_QualityTests )\n)",
  },
  {
    name: "Cube28_Avg_MPa",
    folder: "03 الجودة",
    format: "#,##0.0",
    description: "متوسط مقاومة مكعبات 28 يومًا — دليل المطابقة أمام العميل والمراجع.",
    expression:
      "Cube28_Avg_MPa :=\nCALCULATE (\n    AVERAGE ( fact_QualityTests[actual_value] ),\n    fact_QualityTests[kind] = \"cube28\"\n)",
  },
  {
    name: "Strength_Ratio_Pct",
    folder: "03 الجودة",
    format: "0.0 %",
    description:
      "نسبة المقاومة المتحققة من المقاومة المميزة fck؛ أقل من 100% تعني خطر رفض الصبّة.",
    expression: "Strength_Ratio_Pct := AVERAGE ( fact_QualityTests[strength_ratio_pct] ) / 100",
  },
  {
    name: "Slump_In_Band_Pct",
    folder: "03 الجودة",
    format: "0.0 %",
    description: "نسبة اختبارات الركود داخل النطاق المسموح (±25 مم حول الهدف).",
    expression:
      "Slump_In_Band_Pct :=\nCALCULATE (\n    [Pass_Rate],\n    fact_QualityTests[kind] = \"slump\"\n)",
  },
  {
    name: "Open_NonConformities",
    folder: "03 الجودة",
    format: "#,##0",
    description: "حالات عدم المطابقة المفتوحة — مطلب ISO 9001 بند 8.7 و10.2.",
    expression:
      "Open_NonConformities :=\nCALCULATE (\n    COUNTROWS ( fact_NonConformity ),\n    fact_NonConformity[status] <> \"closed\"\n)",
  },
  {
    name: "Fleet_Availability_Pct",
    folder: "04 الأسطول",
    format: "0.0 %",
    description: "نسبة المعدات الجاهزة للعمل: كل ما ليس متأخرًا عن صيانته.",
    expression:
      "Fleet_Availability_Pct :=\nDIVIDE (\n    CALCULATE (\n        COUNTROWS ( dim_Equipment ),\n        dim_Equipment[maintenance_status] IN { \"ok\", \"scheduled\" }\n    ),\n    COUNTROWS ( dim_Equipment )\n)",
  },
  {
    name: "Equipment_Overdue",
    folder: "04 الأسطول",
    format: "#,##0",
    description: "عدد المعدات المتأخرة عن صيانتها الآن — أول ما يجب إيقافه عن العمل.",
    expression:
      "Equipment_Overdue :=\nCALCULATE (\n    COUNTROWS ( dim_Equipment ),\n    dim_Equipment[maintenance_status] = \"overdue\"\n)",
  },
  {
    name: "Avg_Waiting_Minutes",
    folder: "04 الأسطول",
    format: "#,##0",
    description: "متوسط زمن انتظار العربة في الموقع — أكبر مسبّب لتأخير الرحلات.",
    expression: "Avg_Waiting_Minutes := AVERAGE ( fact_Dispatch[waiting_minutes] )",
  },
  {
    name: "Fleet_Distance_Km",
    folder: "04 الأسطول",
    format: "#,##0.0",
    description: "إجمالي المسافة المقطوعة، أساس حساب تكلفة الكيلومتر والوقود.",
    expression: "Fleet_Distance_Km := SUM ( fact_Dispatch[distance_km] )",
  },
  {
    name: "Fuel_Litres",
    folder: "04 الأسطول",
    format: "#,##0.0",
    description: "إجمالي الوقود المستهلك في الفترة المحددة.",
    expression: "Fuel_Litres := SUM ( fact_FuelLog[litres] )",
  },
  {
    name: "Fuel_Cost_per_Km",
    folder: "04 الأسطول",
    format: "#,##0.00",
    description: "تكلفة الوقود لكل كيلومتر — مؤشر إدارة المسارات.",
    expression:
      "Fuel_Cost_per_Km :=\nDIVIDE ( SUM ( fact_FuelLog[total_cost] ), [Fleet_Distance_Km] )",
  },
  {
    name: "Geofence_Alerts",
    folder: "04 الأسطول",
    format: "#,##0",
    description: "عدد قراءات التتبع خارج النطاق المسموح — خروج غير مبرر أو سرقة مسار.",
    expression:
      "Geofence_Alerts :=\nCALCULATE (\n    COUNTROWS ( fact_Telemetry_GPS ),\n    fact_Telemetry_GPS[geofence_status] <> \"inside\"\n)",
  },
  {
    name: "Stock_Value",
    folder: "05 المخازن",
    format: "\"ج.م\" #,##0.00",
    description: "قيمة المخزون بالتكلفة المعيارية لكل مادة وكل فرع.",
    expression: "Stock_Value := SUMX ( dim_Materials, dim_Materials[stock_value] )",
  },
  {
    name: "Consumption_Value_30D",
    folder: "05 المخازن",
    format: "\"ج.م\" #,##0.00",
    description:
      "قيمة الصرف الفعلي للمواد في آخر 30 يومًا (نوع الحركة = issue) — مقام معدل الدوران.",
    expression:
      "Consumption_Value_30D :=\nCALCULATE (\n    SUMX ( fact_MaterialMovements, ABS ( fact_MaterialMovements[line_value] ) ),\n    fact_MaterialMovements[kind] = \"issue\",\n    DATESINPERIOD ( dim_Calendar[date], MAX ( dim_Calendar[date] ), -30, DAY )\n)",
  },
  {
    name: "Turnover_Days",
    folder: "05 المخازن",
    format: "#,##0.0",
    description:
      "أيام دوران المخزون = قيمة المخزون ÷ متوسط الصرف اليومي؛ رقم كبير يعني رأس مال مجمّد.",
    expression:
      "Turnover_Days :=\nDIVIDE ( [Stock_Value], DIVIDE ( [Consumption_Value_30D], 30 ) )",
  },
  {
    name: "Low_Stock_Count",
    folder: "05 المخازن",
    format: "#,##0",
    description: "عدد المواد التي وصلت أو تجاوزت حد إعادة الطلب.",
    expression:
      "Low_Stock_Count :=\nCALCULATE (\n    COUNTROWS ( dim_Materials ),\n    dim_Materials[balance_qty] <= dim_Materials[reorder_level]\n)",
  },
  {
    name: "Stock_Cover_Days",
    folder: "05 المخازن",
    format: "#,##0.0",
    description: "أيام التغطية بالرصيد الحالي على معدل الاستهلاك اليومي.",
    expression:
      "Stock_Cover_Days :=\nDIVIDE (\n    SUM ( dim_Materials[balance_qty] ),\n    SUM ( fact_MaterialMovements[quantity] ) / 30\n)",
  },
  {
    name: "Maintenance_Cost_Per_Unit",
    folder: "06 الصيانة",
    format: "#,##0.000",
    description:
      "تكلفة الصيانة لكل متر مكعب منتج — تربط أعطال الأسطول باقتصاديات الإنتاج.",
    expression:
      "Maintenance_Cost_Per_Unit :=\nDIVIDE (\n    SUM ( fact_MaintenanceOrders[parts_cost] ) + SUM ( fact_MaintenanceOrders[labour_cost] ),\n    [Total_Produced_M3]\n)",
  },
  {
    name: "Downtime_Hours",
    folder: "06 الصيانة",
    format: "#,##0.0",
    description: "ساعات توقف المعدات المسجّلة في أوامر الصيانة.",
    expression: "Downtime_Hours := SUM ( fact_MaintenanceOrders[downtime_hours] )",
  },
  {
    name: "MTBF_Days",
    folder: "06 الصيانة",
    format: "#,##0.0",
    description: "متوسط الزمن بين عطلين لكل معدة — أساس مقارنة أنماط الأعطال.",
    expression:
      "MTBF_Days :=\nDIVIDE (\n    COUNTROWS ( dim_Calendar ),\n    COUNTROWS ( fact_MaintenanceOrders )\n)",
  },
  {
    name: "Predicted_Failure_Date",
    folder: "07 التنبؤ",
    format: "yyyy-mm-dd",
    description:
      "أقرب تاريخ عطل متوقع لمعدة احتمال عطلها 60% أو أكثر، من نموذج الصيانة التوقعية.",
    expression:
      "Predicted_Failure_Date :=\nMINX (\n    FILTER (\n        ml_PredictiveMaintenance,\n        ml_PredictiveMaintenance[failure_probability_pct] >= 60\n    ),\n    ml_PredictiveMaintenance[predicted_failure_date]\n)",
  },
  {
    name: "Failure_Risk_Exposure",
    folder: "07 التنبؤ",
    format: "#,##0.0",
    description: "مجموع احتمالات الأعطال المرجّحة بالعمر المتبقي — مؤشر أولوية التدخل.",
    expression:
      "Failure_Risk_Exposure :=\nSUMX (\n    ml_PredictiveMaintenance,\n    ml_PredictiveMaintenance[failure_probability_pct]\n        / MAX ( ml_PredictiveMaintenance[remaining_useful_hours], 1 )\n)",
  },
  {
    name: "Forecast_M3_7D",
    folder: "07 التنبؤ",
    format: "#,##0.0",
    description: "الطلب المتوقع في الأيام السبعة القادمة لكل خلطة وفرع.",
    expression:
      "Forecast_M3_7D :=\nCALCULATE (\n    SUM ( ml_DemandForecast[predicted_m3] ),\n    DATESINPERIOD ( dim_Calendar[date], [Today], 7, DAY )\n)",
  },
  {
    name: "Forecast_MAPE",
    folder: "07 التنبؤ",
    format: "0.0 %",
    description:
      "متوسط نسبة خطأ النموذج المعلنة — تُقرأ دائمًا بجانب أي رقم متوقع ولا تُخفى.",
    expression: "Forecast_MAPE := AVERAGE ( ml_DemandForecast[mape_pct] ) / 100",
  },
  {
    name: "Credit_Risk_Exposure",
    folder: "07 التنبؤ",
    format: "\"ج.م\" #,##0.00",
    description: "التعرّض الائتماني للعملاء المصنّفين عالي الخطر أو الموقوفة طلبياتهم.",
    expression:
      "Credit_Risk_Exposure :=\nCALCULATE (\n    SUM ( ml_CreditRisk[overdue_amount] ),\n    ml_CreditRisk[risk_band] IN { \"high\", \"critical\" }\n)",
  },
  {
    name: "Churn_Risk_Customers",
    folder: "07 التنبؤ",
    format: "#,##0",
    description: "عدد العملاء الذين تجاوز احتمال فقدانهم 40% — قائمة زيارة المبيعات.",
    expression:
      "Churn_Risk_Customers :=\nCALCULATE (\n    COUNTROWS ( ml_ChurnPrediction ),\n    ml_ChurnPrediction[churn_probability_pct] >= 40\n)",
  },
  {
    name: "Price_Uplift_Opportunity",
    folder: "07 التنبؤ",
    format: "\"ج.م\" #,##0.00",
    description:
      "أثر رفع السعر المقترح على الطلبيات الحالية بنفس الكميات (تقدير، يحتاج اعتمادًا).",
    expression:
      "Price_Uplift_Opportunity :=\nSUMX (\n    ml_PriceOptimization,\n    ( ml_PriceOptimization[recommended_price] - ml_PriceOptimization[current_price] )\n        * [Total_Delivered_M3]\n)",
  },
  {
    name: "Revenue_MTD",
    folder: "08 الزمن",
    format: "\"ج.م\" #,##0.00",
    description: "إيراد الشهر حتى تاريخ اليوم.",
    expression:
      "Revenue_MTD :=\nTOTALMTD ( [Total_Revenue], dim_Calendar[date] )",
  },
  {
    name: "Revenue_YTD",
    folder: "08 الزمن",
    format: "\"ج.م\" #,##0.00",
    description: "إيراد السنة حتى تاريخ اليوم.",
    expression:
      "Revenue_YTD :=\nTOTALYTD ( [Total_Revenue], dim_Calendar[date] )",
  },
  {
    name: "Revenue_Previous_Year",
    folder: "08 الزمن",
    format: "\"ج.م\" #,##0.00",
    description: "إيراد نفس الفترة من العام الماضي — يعتمد على التقويم المتصل.",
    expression:
      "Revenue_Previous_Year :=\nCALCULATE ( [Total_Revenue], SAMEPERIODLASTYEAR ( dim_Calendar[date] ) )",
  },
  {
    name: "Revenue_Growth_Pct",
    folder: "08 الزمن",
    format: "+0.0 %;-0.0 %",
    description: "نمو الإيراد عن نفس الفترة من العام الماضي، بإشارة واضحة للزيادة والنقص.",
    expression:
      "Revenue_Growth_Pct :=\nDIVIDE ( [Total_Revenue] - [Revenue_Previous_Year], [Revenue_Previous_Year] )",
  },
  {
    name: "Revenue_MA_30D",
    folder: "08 الزمن",
    format: "\"ج.م\" #,##0.00",
    description: "متوسط متحرك 30 يومًا يقرأ الاتجاه بدون ضجيج الأيام الشاذة.",
    expression:
      "Revenue_MA_30D :=\nAVERAGEX (\n    DATESINPERIOD ( dim_Calendar[date], MAX ( dim_Calendar[date] ), -30, DAY ),\n    [Total_Revenue]\n)",
  },
  {
    name: "Today",
    folder: "09 الحماية",
    format: "yyyy-mm-dd",
    description: "تاريخ اليوم حسب توقيت التشغيل — يُستخدم في نوافذ الزمن.",
    expression: "Today := TODAY ()",
  },
  {
    name: "Test_Data_Rows",
    folder: "09 الحماية",
    format: "#,##0",
    description:
      "عدد الصفوف التجريبية التي تحمل Test_Data_Flag — تُستبعد في التقارير الرسمية.",
    expression:
      "Test_Data_Rows :=\nCALCULATE ( COUNTROWS ( fact_Orders ), fact_Orders[test_data_flag] = TRUE )",
  },
  {
    name: "Real_Data_Only",
    folder: "09 الحماية",
    format: "\"ج.م\" #,##0.00",
    description: "الإيراد الحقيقي فقط، بعد استبعاد كل صف تجريبي — أرقام يمكن تقديمها لمراجع.",
    expression:
      "Real_Data_Only :=\nCALCULATE ( [Total_Revenue], fact_Orders[test_data_flag] = FALSE )",
  },
  {
    name: "Unresolved_Validation_Errors",
    folder: "09 الحماية",
    format: "#,##0",
    description: "أخطاء التحقق غير المعالجة في مركز الأخطاء — تعني صفوفًا خارج التقارير.",
    expression:
      "Unresolved_Validation_Errors :=\nCALCULATE (\n    COUNTROWS ( stg_ValidationErrors ),\n    stg_ValidationErrors[resolved] = FALSE\n)",
  },
  {
    name: "Open_Approvals",
    folder: "09 الحماية",
    format: "#,##0",
    description: "طلبات الاعتماد المعلّقة التي لم تُبتّ داخل المهلة.",
    expression:
      "Open_Approvals :=\nCALCULATE (\n    COUNTROWS ( fact_Approvals ),\n    fact_Approvals[approval_state] = \"pending\"\n)",
  },
  {
    name: "Alert_Failures",
    folder: "09 الحماية",
    format: "#,##0",
    description: "تنبيهات لم تُسلَّم فعليًا — تُقرأ كنقطة تصعيد فورية.",
    expression:
      "Alert_Failures :=\nCALCULATE (\n    COUNTROWS ( fact_Alerts ),\n    fact_Alerts[status] = \"failed\"\n)",
  },
];

/** Calculated columns that make the model self-explaining in Power Pivot. */
export const DAX_CALCULATED_COLUMNS: Array<{
  table: string;
  name: string;
  description: string;
  expression: string;
}> = [
  {
    table: "dim_Calendar",
    name: "IsWorkDay",
    description: "تمييز أيام العمل عن الجمعة والعطلات الرسمية.",
    expression: "IsWorkDay := IF ( dim_Calendar[is_weekend] || dim_Calendar[is_holiday], \"عطلة\", \"عمل\" )",
  },
  {
    table: "fact_Orders",
    name: "MarginBand",
    description: "تصنيف كل طلبية إلى ربحيّة عالية أو مقبولة أو خاسرة.",
    expression:
      "MarginBand :=\nVAR _m = fact_Orders[margin_pct]\nRETURN\n    SWITCH ( TRUE (), _m >= 15, \"ربحية عالية\", _m >= 8, \"مقبولة\", _m >= 0, \"ضعيفة\", \"خاسرة\" )",
  },
  {
    table: "fact_QualityTests",
    name: "TestLabel",
    description: "وصف عربي لنوع الاختبار يُعرض في لوحات القيادة.",
    expression:
      "TestLabel :=\nSWITCH (\n    fact_QualityTests[kind],\n    \"cube7\", \"مكعب 7 أيام\",\n    \"cube28\", \"مكعب 28 يومًا\",\n    \"slump\", \"ركود\",\n    fact_QualityTests[kind]\n)",
  },
  {
    table: "dim_Equipment",
    name: "StatusLabel",
    description: "وصف حالة الصيانة بلغة التشغيل اليومية.",
    expression:
      "StatusLabel :=\nSWITCH (\n    dim_Equipment[maintenance_status],\n    \"overdue\", \"متأخرة\",\n    \"due_soon\", \"قريبة\",\n    \"scheduled\", \"مجدولة\",\n    \"ok\", \"سليمة\",\n    \"غير مجدولة\"\n)",
  },
];
