# تقارير المراحل — IConcrete hardening v1

كل تقرير يذكر: ما تغيّر، الملفات، الاختبارات المضافة، **خرج الأوامر الحقيقي**، وما تبقّى.
الخرج الكامل في `docs/VERIFICATION.md`، والحالات لكل بند في `REQUIREMENTS.md`.

---

## المرحلة ٠ — نص الصفحة الرئيسية والخلفية

**ما تغيّر**
- استُبدل مدخل الصفحة الرئيسية بالجملة المطلوبة حرفيًا (عربي/إنجليزي)، وأُزيلت العبارات التسويقية غير المُثبتة.
- أُزيل من عنوان الواجهة `" من الألف إلى الياء"` وقلّصت قائمة الوعود إلى ثلاثة بنود قابلة للتحقق.
- لوحة ألوان جديدة عبر متغيّرات التصميم: الخلفية `#e9eef2`، البطاقات `#f7f9fb`، النص `#1b2430`، مع الإبقاء على لون العلامة الكهرماني.
- طبقة طباعة/PDF بيضاء بنص داكن، و`theme-color` (الوضعان الفاتح والداكن) و`manifest` محدَّثان.
- إزالة الخلفيات البيضاء المكتوبة يدويًا: `AskAIAgent.tsx` (أُعيد كتابتها بخطوط تصميم + مواضيع مساعدة تشير إلى مسارات موجودة فعلًا، إذ كانت تشير إلى `/invoices` و`/mixes` و`/clients` و`/reports` غير المسجّلة)، و`ui/slider.tsx`، و`instrumentation.tsx`.
- إزالة وصف «AI Agent» من المساعد: هو مطابق كلمات محلي لا يستدعي أي نموذج.

**الملفات**: `src/pages/Landing.tsx`، `src/lib/i18n.tsx`، `src/index.css`، `index.html`، `public/manifest.webmanifest`، `src/components/AskAIAgent.tsx`، `src/components/ui/slider.tsx`، `src/instrumentation.tsx`، `scripts/contrast-check.mjs`، `docs/CONTRAST.md`

**اختبارات مضافة**: `scripts/contrast-check.mjs` — 63 زوجًا (60 منها إلزامي)، قابل للتشغيل في CI.

**خرج حقيقي**
```
$ node scripts/contrast-check.mjs
62/62 required pairs meet their WCAG AA target.
exit=0

$ bun run typecheck   →  exit=0
$ bun run build       →  ✓ built in 12.06s, exit=0
$ bun run lint        →  0 errors, 18 warnings, exit=0
```

**المتبقّي**: التحقق البصري بلقطات شاشة عند عرض الجوال والحاسب **لم يُنفَّذ** (لا متصفح آلي على هذا الخادم). نسب التباين مُقاسة رقميًا فقط. انظر `docs/KNOWN_LIMITATIONS.md` §11.

---

## المرحلة ١ — الحواجز الأمنية

**ما تغيّر**
- **1.1 منع الزوار**: أُضيف `DEMO_MODE` (مغلق افتراضيًا). الزائر لا يحصل على أي صلاحية، و`requireViewer` يرفضه في كل استعلام ودالة، وزر الزائر مخفي من شاشة الدخول عبر `access.demoConfig`. وعند تشغيل الوضع التجريبي يصبح الزائر **قراءة فقط** على نطاق محدود: بلا `viewFinancials` وبلا `viewExport` وبلا `viewAudit` وبلا أي كتابة. تغيّر دور الزائر الافتراضي من «مدير» إلى «مشغّل».
- **1.2 الأسرار**: فاحص أسرار بدون أي تبعيات (`scripts/secret-scan.mjs`) بـ13 عائلة قواعد ووضع `--self-test` يثبت أن القواعد تعمل فعلًا؛ مدمج في CI وبوابة الدفع. `.gitignore` يتجاهل `.env.*` بالفعل و`.env.keys` غير موجود في مجلد العمل. المفاتيح الواجب تدويرها مذكورة للمالك.
- **1.3 واجهة التصدير**: الرمز من ترويسة `x-iconcrete-token` **فقط** (رُفض معامِل الرابط)، مقارنة ثابتة الزمن، قائمة أصول مسموحة من `ICONCRETE_CORS_ORIGINS` بلا `*`، حد صفوف، نطاق فروع من `ICONCRETE_EXPORT_BRANCHES` مع 403، وتنقية خلايا CSV ضد حقن الصيغ، مع الإبقاء على 503 عند عدم ضبط الرمز.
- **1.4/1.5**: أُضيف جدول `userBranches` وفهارسه، وأُضيفت أدوار الرسائل القياسية. **التطبيق الفعلي لعزل الفروع ومحدّدات الحجم لم يُنجز** — مُعلَّم بوضوح.

**الملفات**: `src/convex/demoMode.ts` (جديد)، `src/convex/permissions.ts`، `src/convex/access.ts`، `src/convex/http.ts`، `src/hooks/use-access.ts`، `src/pages/Auth.tsx`، `src/convex/schema.ts`، `scripts/secret-scan.mjs`، `.github/workflows/ci.yml`

**اختبارات مضافة**: `--self-test` للفاحص (11 نموذجًا يجب رصده + 5 نماذج يجب ألا تُرصد).

**خرج حقيقي**
```
$ node scripts/secret-scan.mjs --self-test
Secret-scan self-test: 11 must-flag + 5 must-pass samples all correct.   exit=0

$ node scripts/secret-scan.mjs
Secret scan: no committed credentials found.  (187 text files)           exit=0

$ bun run typecheck / typecheck:convex / build                           exit=0
```

**المتبقّي**: اختبار تعداد كل الاستعلامات والدوال يرفض الزائر **لم يُكتب** (يحتاج `convex-test`). `git rm --cached .env.keys` وفحص تاريخ Git **محجوبان** (أمر git غير متاح على هذا الخادم). عزل الفروع **غير مطبَّق**.

---

## المرحلة ٢ — صحة الهندسة الخرسانية

**ما تغيّر**
- **2.2 محرّك القواعد** (الجوهر): `src/lib/quality/ecp203.ts` — لا يُحكم على نتيجة إلا بقاعدة **معتمدة + موثّقة من مهندس + سارية على تاريخ الاختبار + كل معاملاتها موجودة ومتحقق منها فرديًا**، وإلا فالشارة «بدون كود معتمد – مؤشر فقط» ولا يظهر مطابق/غير مطابق. الحالات: `meets | does_not_meet | refer_to_consultant | indicator_only | insufficient_data`. القواعد R-CS/R-PRE/R-FIN/R-SLUMP/R-CORE/R-EARLY وR-SAMP موجودة **كمسودة غير متحقق منها**، ومعامل الشرط (ب) في R-PRE (`confidence: low`) وتسامح الركود ≥٨٠ مم (`unreadable`, `value: null`) غير مؤكَّدين بشكل خاص.
- **حساب دقيق**: `src/lib/exact.ts` — حساب `bigint` بمقياس 10⁻⁶ وقراءة الأرقام من نصها العشري، فلا يدخل خطأ الفاصلة العائمة في أي مقارنة حدّية. «٢٢٫٥ مقبولة تمامًا» و«٧٠٫٠٪ مقبولة تمامًا» و«٥٫٠٪ مقبولة تمامًا» مُختبرة.
- **الجدولة**: `src/lib/quality/sampling.ts` — خطة أخذ العينات (٦ مكعبات لأول ٥٠ m³ ثم ٦ لكل ١٠٠ m³، نصفها ٧ أيام ونصفها ٢٨ يومًا) مع مجدول تواريخ وتنبيهات عدم الاستيفاء.
- **2.1 أساس المكعبات**: أُضيف `targetCubeMpa` و`specimenType` إلى `qualityTests`؛ هدف المكعب يُكتب صراحةً ويُرفض الاختبار بدونه (`TARGET_STRENGTH_MISSING`)؛ الأسطوانة تُحفظ ولا تُقارن؛ وأُزيل من المسار الحقيقي `strengthFromName`/`cubeTargetValue`/`testTargetValue` التي كانت تقرأ مقاومة الأسطوانة من اسم الخلطة.
- **2.3 السعر الصامت**: `standardPricing` لم يعد يُرجع C30/37 للخلطة المجهولة بل يرفع خطأ `UNKNOWN_MIX` صراحةً، ويسري على النموذج والاستيراد وإعادة تشغيل المزامنة والطابور. أسعار العرض التجريبي موسومة `isTestData`. نموذج الإنتاج يقرأ قائمة المحطة المعتمدة فعلًا ويعرض تحذيرًا لخلطة غير معتمدة.
- **4.6 أكواد الأخطاء** (مجّانًا ضمن نفس العمل): ٢١ رمزًا مع عنوان ورسالة إرشاد عربية وسمة `retryable`.

**الملفات**: `src/lib/quality/ecp203.ts`، `src/lib/quality/sampling.ts`، `src/lib/quality/ecp203.test.ts`، `src/lib/exact.ts`، `src/lib/errors.ts`، `src/convex/pricing.ts`، `src/convex/quality.ts`، `src/convex/schema.ts`، `src/lib/concrete.ts`، `src/components/ProductionFormDialog.tsx`، `src/pages/Production.tsx`، `src/pages/Quality.tsx`، `vitest.config.ts`

**اختبارات مضافة**: ٣٩ اختبارًا — V1…V9 كلها، بوابة القواعد، أسطوانة مقابل مكعب، الحدود الدقيقة، خطة أخذ العينات والمجدول، واقتراح الهدف.

**خرج حقيقي**
```
$ bun run test
Tests  39 passed (39)                     exit=0

$ bunx convex dev --once
✔ Added table indexes: qualityRules.by_ruleKey, qualityRules.by_testType,
  userBranches.by_branch, userBranches.by_user
✔ Convex functions ready! (6.72s)         exit=0

$ bun run typecheck / typecheck:convex / lint / build   →  exit=0
```

**عيوب حقيقية اكتشفها الاختبار وأُصلحت** (التفاصيل في `docs/VERIFICATION.md`): خلط وحدات في مقارنة نسبة R-FIN كان يجعل **٧٫٥٪ تُقرأ كأنها داخل حد ٥٪**؛ ومعامل واحد غير مقروء كان يمنع تقييم نطاق الركود السليم بالكامل؛ وخطأ مقياس في التقويم الأولي. كلها أُصلحت وأُعيد تشغيل الاختبارات.

**المتبقّي**: **واجهة إدخال القواعد والاعتماد لم تُبنَ**، ولا شيء يكتب في جدول `qualityRules`، لذلك لا تُصدر الشاشات حكمًا من الكود اليوم (وهذا الاتجاه الآمن). و٢.٤–٢.٨ (تصميم الخلطات، الربط بالمخزون، سلامة المخزون، التتبع، الرطوبة) **لم تُنفَّذ**.

---

## المرحلة ٥ (جزئي) — الاختبارات وCI

**ما تغيّر**: أُضيف `vitest@3.2.7` و`vitest.config.ts`، وسكربتات `test` و`check:contrast` و`check:secrets`، وسير عمل CI بثماني خطوات إلزامية بلا `continue-on-error`. وأُصلحت **٣ أخطاء eslint موجودة مسبقًا** (بإصلاح أسبابها لا بكتمها) حتى يصبح بوّابة CI قادرة على الفشل فعلًا.

**خرج حقيقي**: `bun run lint` → `18 problems (0 errors, 18 warnings)`، `exit=0` (قبل الإصلاح: 3 errors، exit=1).

**المتبقّي**: لا `convex-test`، لا سيناريو شامل، لا قياس تغطية — ولذلك **لا يُعلن أي رقم تغطية**.

---

## المرحلة ٦ — الوثائق

**ما تغيّر**: `docs/OWNER_GUIDE_AR.md` (دليل المالك بالعربية بنسخ احتياطي ودور وقواعد واعتماد)، و`docs/KNOWN_LIMITATIONS.md` (ما لم يُنفَّذ وما لم يُتحقق منه)، و`README.md` و`docs/ARCHITECTURE.md` محدَّثان، وهذا التقرير و`docs/VERIFICATION.md`.

**المتبقّي**: شاشات جديدة ثنائية اللغة — لا توجد شاشات جديدة لتُترجم. ومعايير الوصول غير المتباينة (لوحة المفاتيح، قارئ الشاشة، تقليل الحركة) **لم تُقس**.

---

## الخلاصة الصريحة

| ما يمكن الاعتماد عليه اليوم | ما لا يمكن |
|---|---|
| الدخول بالأدوار، ومنع الزوار (إلا بـ`DEMO_MODE`) | عزل الفروع (ما زال فلتر واجهة) |
| تسعير القيود من قائمة المحطة فقط، ورفض الخلطة المجهولة | الفواتير والضريبة والدفعات (غير موجودة) |
| سجل تتبع كامل قبل/بعد | الربط التلقائي بين الإنتاج والمخزون |
| استيراد/تصدير Excel وCSV مع حماية حقن الصيغ | الاعتماد المزدوج والحذف المنطقي والتزامن بالإصدارات |
| محرّك قواعد ECP 203 بحساب دقيق ومختبر | شاشة إدخال القواعد واعتمادها |
| فاحص أسرار + فحص تباين + فحصا أنواع + اختبارات + بناء في CI | النسخة المكتبية (.exe/.msi) — لم تُبنَ |
