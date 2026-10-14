# النشر — IConcrete (Vercel + Convex + GitHub)

آخر تحديث: 2026-10-13. كل رقم أو معرّف في هذا الملف مقتبس من مخرجات أوامر حقيقية أو من واجهة GitHub العامة.
راجع القسم ١٢ «ما لم أتحقق منه» قبل الاعتماد على أي شيء هنا.

---

## 1. الخلاصة

النظام له نصفان يجب أن يسافرا معًا:

- **الواجهة** (Vite) تُبنى على **Vercel**.
- **الدوال والمخطط** (Convex) تُدفع بأمر `convex deploy` — ولا تدفعها Vercel تلقائيًا.

القاعدة المفروضة الآن في `scripts/vercel-build.sh`:

| `VERCEL_ENV` | ما يحدث |
| --- | --- |
| `production` | دفع دوال Convex أولًا، ثم بناء الواجهة مقابل نفس النشر الذي دُفع للتو. يحتاج `CONVEX_DEPLOY_KEY` في نطاق **Production فقط**. |
| `preview` / أي شيء آخر | **لا دفع لـ Convex إطلاقًا.** بناء الواجهة فقط، مقابل نشر تطوير/تجريبي يأتي من `VITE_CONVEX_URL` في نطاق **Preview**. |

هذا هو البديل المجاني لنشر المعاينات في Convex: نشر معاينة Convex يحتاج مفتاح نشر خاص به (preview deploy key) وما زال ميزة **تجريبية (beta)**، فنحن نعيد استخدام نشر واحد للتجريب بدل إنشاء نشر لكل فرع. (في التوثيق: نشر المعاينة يُنظَّف بعد 5 أيام في الخطة المجانية و14 يومًا في المدفوعة — أي أنني **لم أستطع تأكيد** أن نشر المعاينة مقصور على الخطط المدفوعة، لكننا لا نحتاجه أصلًا في هذا التصميم.)

---

## 2. جدول البيئات

| البيئة | من يبني الواجهة | دوال Convex على | نطاق متغيرات Vercel | هل يمكن أن تلمس بيانات حقيقية؟ |
| --- | --- | --- | --- | --- |
| **محلي (Local)** | `bun run dev` (Vite) | نشر التطوير `dev/vly-dev-service-account` (يظهر كـ `https://famous-owl-975.convex.cloud`) | `.env.local` | لا (نشر تطوير) |
| **معاينة (Preview / staging)** | Vercel Preview → `bash scripts/vercel-build.sh` → `bun run build` | **نفس** نشر التطوير/التجريب المشار إليه في `VITE_CONVEX_URL` | Preview | لا، لأنه لا يوجد مفتاح نشر في هذا النطاق أصلًا |
| **إنتاج (Production)** | merge إلى `main` → Vercel Production → `npx convex deploy --cmd ...` | **نشر الإنتاج** في مشروع Convex | Production | نعم — هنا البيانات الحقيقية |

> **ملاحظة مهمة:** النطاق Preview و Production يشتركان في نفس المستودع ونفس ملف `vercel.json`. الفرق الوحيد الذي يفصل «تجريبي» عن «إنتاج» هو **نطاق المتغيرات**: وجود مفتاح نشر الإنتاج من عدمه. لا يوجد أي شرط في الكود يمنع Preview من النشر لو أُضيف المفتاح بالخطأ إلى نطاق Preview — لذلك: **لا تضع `CONVEX_DEPLOY_KEY` في نطاق Preview أبدًا.**

---

## 3. الوضع الحالي المُتحقَّق منه (2026-10-13)

| البند | القيمة | كيف تحققت |
| --- | --- | --- |
| المستودع | `https://github.com/ahmedelkashash7/iconcrete` (عام/public) | واجهة GitHub API |
| الفرع الافتراضي | `main` = `184ae02f9311f920d436b4419c81959f6e238e90` | GitHub API |
| فروع GitHub الموجودة | `main`، و`Dev->-create` = `b6cc9191` | GitHub API |
| فرع `hardening-v1` | **غير موجود محليًا ولا على GitHub** | `refs/` على القرص + GitHub API |
| آخر commit | `184ae02f` — «Freebuff: ROLE» — 2026-10-13T01:34:36Z | GitHub API |
| من دفعه | `freebuff-web[bot]` | GitHub API |
| حجمه | 4980 إضافة / 370 حذف | GitHub API |
| حالة CI على هذا الـ commit | **نجح** — Run #1، 01:34:44Z → 01:35:22Z | GitHub API |
| حالة شجرة العمل | نظيفة تمامًا مقابل `184ae02f` (لا تعديل، لا ملف جديد غير متتبَّع عدا `.env.local` و`*.tsbuildinfo` وهما مُتجاهَلان) | قارنت بصمات الملفات بـ SHA-1 بنمط git |
| `vercel.json` | لم يكن موجودًا قبل هذه الجولة؛ أُضيف الآن ببند واحد `buildCommand` | `ls` |
| نشر Convex المستخدم في التطوير | `freebuff:e7b49ee3-4c85-4bd8-9222-bbbcf4062dd2:dev/vly-dev-service-account` → `https://famous-owl-975.convex.cloud` | `bunx convex dev --once` → `exit=0` |
| أوامر git على هذا الجهاز | **مرفوضة**: «Git and GitHub commands are blocked; Vly manages version control.» | تنفيذ فعلي |

**الخلاصة الصادمة:** كل عمل التقوية (hardening) موجود **بالفعل على فرع `main` على GitHub**، وليس على فرع `hardening-v1`. السبب أن بيئة Freebuff/المنصة تُنشئ الـ commit وتدفع إلى `main` تلقائيًا (بدون بوابة مراجعة) في نهاية كل جولة عمل. آخر دفعة تحققت بتاريخ 2026-10-13T01:34:44Z من حساب `freebuff-web[bot]`.

---

## 4. إعدادات Vercel المطلوبة

> لم أدخل لوحة Vercel ولا أملك وصولًا إليها، لذلك هذا هو **الوضع المطلوب**، وليس وصفًا للوضع الحالي. أول بناء معاينة بعد هذه الجولة هو فرصة التأكد.

| الإعداد | القيمة المطلوبة | ملاحظة |
| --- | --- | --- |
| Framework Preset | **Vite** | الإعداد الافتراضي للمشروع |
| Build Command | تُترك فارغة (يقرأها Vercel من `vercel.json`) | `vercel.json` يفرض `bash scripts/vercel-build.sh` |
| Install Command | تُترك فارغة | `bun.lock` موجود، وVercel يكتشف bun تلقائيًا |
| Output Directory | `dist` | لم أغيّره: `vercel.json` لا يذكر `outputDirectory` عن قصد حتى لا أغيّر مخرجات البناء الحالية |
| Root Directory | الجذر | |
| Node.js Version | 20 أو 22 | Convex CLI 1.42.1 يعمل على 18+ |
| Git Repository | `ahmedelkashash7/iconcrete` | غير مُتحقَّق منه من جهتي |

`vercel.json` المُضاف بسيط عن قصد:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "bash scripts/vercel-build.sh"
}
```

لم أضع `framework` ولا `outputDirectory` ولا `rewrites` لأن أي منها قد يغيّر سلوك البناء الحالي، والطلب كان تحديد نقطة البناء لا إعادة تعريف المشروع.

---

## 5. المتغيرات حسب النطاق (أسماء فقط — لا تضع قيمًا هنا أبدًا)

### أ) على Vercel

| الاسم | النطاق | إلزامي | الغرض |
| --- | --- | --- | --- |
| `VITE_CONVEX_URL` | Preview + Production | نعم | يُدمج في الواجهة عند البناء. في Preview يجب أن يشير إلى نشر التطوير/التجريب. |
| `CONVEX_DEPLOY_KEY` | **Production فقط** | نعم للإنتاج | مفتاح نشر **إنتاج** من لوحة Convex. غيابه = فشل البناء عن قصد (لا بناء صامت على النشر الخطأ). |
| `VITE_VLY_APP_ID` / `VITE_VLY_MONITORING_URL` / `VLY_CONVEX_AUTH_ISSUER` | اختياري | لا | معرّف تطبيق VLY ونقطة المراقبة ومُصدِر المصادقة. |

### ب) على نشر Convex (عبر لوحة Convex أو `npx convex env set`)

| الاسم | إلزامي | الغرض |
| --- | --- | --- |
| `CONVEX_SITE_URL` | نعم | عنوان الموقع العام لمصادقة Convex. |
| `JWT_PRIVATE_KEY` / `JWKS` / `SITE_URL` | نعم (مصادقة) | مفاتيح توقيع Convex Auth. |
| `DEMO_MODE` | لا | `true` على نشر تجريبي فقط. **اتركه غير مضبوط على محطة حقيقية.** |
| `ICONCRETE_EXPORT_TOKEN` | لا | رمز نقطة تصدير CSV/JSON (يُرسل في ترويسة `x-iconcrete-token` فقط). عند غيابه تُرجع النقطة `503`. |
| `ICONCRETE_CORS_ORIGINS` | لا | قائمة أصول مسموحة للتصدير. **غير مضبوط = لا وصول عبر الأصول إطلاقًا.** |
| `ICONCRETE_EXPORT_BRANCHES` | لا | أكواد الفروع التي قد يقرأها رمز التصدير. |
| `KNOCK_API_KEY` / `KNOCK_ALERT_WORKFLOW` / `KNOCK_API_BASE` | لا | تنبيهات Knock. |
| `VLY_INTEGRATION_KEY` | لا | بوابة تكاملات VLY. |

`.env.example` في المستودع يذكر ثلاثة متغيرات فقط: `VITE_CONVEX_URL` و`CONVEX_SITE_URL` و`CONVEX_DEPLOYMENT`.

> **قاعدة:** لا تُضاف أسرار إلى `.env.local` أو أي ملف `.env*` داخل المستودع. الإدارة عبر تبويب المفاتيح في بيئة الاستضافة أو عبر `npx convex env set`.

---

## 6. كيف تنشر دوال Convex إلى التجريبي (staging)

النشر التجريبي هو نفس نشر التطوير الذي تديره المنصة. لدفع دوالك إليه من أي نسخة من المستودع:

```bash
bun install
bunx convex dev --once     # يدفع الدوال والمخطط إلى dev/vly-dev-service-account
```

مخرج حقيقي من هذا الجهاز:

```
▌ [Development] freebuff:e7b49ee3-...:dev/vly-dev-service-account (dev)
▌ └─ https://famous-owl-975.convex.cloud
✔ Convex functions ready! (6.73s)
(exit=0)
```

**إلى الإنتاج:** لا تفعل ذلك يدويًا. دفعة الإنتاج تحدث فقط عند merge على `main`، حين ينفّذ `scripts/vercel-build.sh` الأمر:

```bash
npx convex deploy --typecheck enable --cmd "bun run build" --cmd-url-env-var-name VITE_CONVEX_URL
```

`--cmd-url-env-var-name` يجعل مفتاح `--cmd` يستلم عنوان النشر الذي دُفع للتو، فلا يمكن أن تُبنى الواجهة على عنوان نشر مختلف عن الدوال. (`convex deploy --help`، الإصدار 1.42.1.)

---

## 7. قائمة الإصدار (كل بند قابل للتحقق)

1. **نسخة احتياطية من بيانات الإنتاج** (إلزامية قبل أي تغيير مخطط):
   ```bash
   npx convex export --prod --path "./backups/iconcrete-$(date +%F).zip"
   ```
   احفظ الملف **خارج** المستودع. ملاحظة: النسخة تحتوي بيانات حقيقية — لا ترفعها إلى GitHub ولا إلى أي خدمة مجانية.
2. **فرع + Pull Request** — راجع القسم 9.
3. **CI أخضر** على الـ PR. لا يوجد `continue-on-error` في `.github/workflows/ci.yml`، فالخطوة تفشل عند أول خطأ حقيقي.
4. **افحص المعاينة:**
   - افتح رابط Vercel Preview، لا سيرفر التطوير المحلي.
   - جرّب تسجيل الدخول، والشاشات التي لمسها التغيير، بالعربي والإنجليزي، على مقاس الهاتف والحاسب.
   - اضغط على زر «تعديل» و«حذف» و«تصدير» للتأكد من الصلاحيات.
   - تأكد أن البيانات المعروضة **ليست** بيانات الإنتاج.
5. **دمج (merge)** — لا force-push، ولا دفع مباشر إلى `main`.
6. **اختبار دخان على الإنتاج** بعد الانتهاء من البناء:
   - الشاشة الأولى تظهر وتعمل.
   - تسجيل الدخول يعمل (Convex Auth).
   - إنشاء سجل إنتاج واحد وإغلاقه.
   - التحقق من أن `DEMO_MODE` غير مضبوط (زر الضيف يجب أن يكون **مخفيًا**).

---

## 8. التراجع (Rollback)

| الطبقة | الطريقة | ملاحظات |
| --- | --- | --- |
| الواجهة | Vercel → Deployments → اختر النشر السابق → **Promote to Production** (أو Instant Rollback) | فوري، لا يعيد البناء |
| الكود | `git revert <sha>` على `main` (commit عكسي جديد) ثم PR | لا force-push، ولا `reset` على فرع مشترك |
| دوال Convex | أعد الدفع من الـ commit السابق: `npx convex deploy` من شجرة نظيفة | **رجوع الواجهة لا يرجّع الدوال، والعكس صحيح** |
| البيانات | `npx convex import --prod <zip>` | خطر: قد يستبدل بيانات أُدخلت بعد النسخة. لا تفعله إلا بقرار صريح من المالك |

**قاعدة المخطط الرجعي:** سبب اشتراط أن تكون الحقول الجديدة **اختيارية** هو أن الدوال الجديدة والواجهة القديمة قد تعملان معًا لدقائق أثناء النشر، وكذلك بعد التراجع. لا تُعِد تسمية حقل أو تغيّر نوعه أو تحذفه في PR واحد.

---

## 9. إنشاء فرع `hardening-v1` وفتح PR (خطوات يدوية للمالك)

أوامر git **مرفوضة على هذا الجهاز**، فلا أستطيع إنشاء الفرع ولا دفعه. وبما أن عمل التقوية **موجود أصلًا على `main`**، أمامك اختياران:

### الخيار أ — الأسهل (تسجيل فقط)
1. افتح: `https://github.com/ahmedelkashash7/iconcrete/branches`
2. **New branch** باسم `hardening-v1` من الفرع `main` (سيشير إلى `184ae02f`).
3. لا يوجد PR، لأن محتوى الفرع مطابق لـ `main`. الفائدة: نقطة مرجعية يمكن الرجوع إليها، وبوابة المراجعة تبدأ من التغيير التالي.

### الخيار ب — إعادة فرض بوابة المراجعة فعليًا
يتطلّب أن ترجع `main` خطوة للخلف، وهذا **force-push** على الفرع الافتراضي — قرارك أنت وحدك، وبعد أخذ نسخة احتياطية:
1. أنشئ `hardening-v1` من `main` (كما في الخيار أ).
2. في مستودع محلي: `git switch main && git reset --hard 3811820d` ثم `git push --force-with-lease origin main`
   > النتيجة: `main` يعود إلى ما قبل التقوية، و`hardening-v1` يحمل 4980 سطرًا من العمل الجديد.
3. افتح PR من `hardening-v1` إلى `main`:
   **https://github.com/ahmedelkashash7/iconcrete/compare/main...hardening-v1**
4. راجع، افحص المعاينة، ثم ادمج.

**تحذير مهم:** تفعيل **Branch protection** على `main` (اشتراط PR قبل الدمج) سيوقف مزامنة المنصة، لأن `freebuff-web[bot]` يدفع مباشرة إلى `main` بدون PR. إن أردت حماية `main` فعليك أن تتحقق أولًا من سلوك المنصة عند رفض الدفعة، أو أن تعمل من نسخة محلية مرآة للمستودع. هذه ليست نصيحة — هي تحذير مبني على أن آخر دفعتين جاءتا من بوت مباشرة.

---

## 10. ما على المالك فعله يدويًا

- [ ] إنشاء فرع `hardening-v1` (القسم 9) — وقرر إن كنت ستستخدم الخيار «ب».
- [ ] التأكد من أن Vercel متصل بالمستودع، وأن الفرع الإنتاجي هو `main`.
- [ ] ضبط **Build Command** على `bash scripts/vercel-build.sh` في لوحة Vercel (أو الاعتماد على `vercel.json` المُضاف، والأفضل تثبيتها من اللوحة لتجنب الالتباس).
- [ ] توليد **مفتاح نشر إنتاج** من لوحة Convex وإضافته إلى نطاق **Production فقط** باسم `CONVEX_DEPLOY_KEY`.
- [ ] ضبط `VITE_CONVEX_URL` في نطاق **Preview** على نشر التطوير/التجريب، وفي نطاق **Production** يُضبط تلقائيًا عند البناء (لكن اتركه مضبوطًا على عنوان الإنتاج للاحتياط).
- [ ] ضبط `ICONCRETE_EXPORT_TOKEN` و`ICONCRETE_CORS_ORIGINS` على نشر الإنتاج.
- [ ] **عدم** ضبط `DEMO_MODE` على نشر الإنتاج.
- [ ] أخذ نسخة احتياطية من بيانات الإنتاج قبل أول نشر.
- [ ] إسناد المستخدمين إلى الفروع (`userBranches`) — راجع `docs/KNOWN_LIMITATIONS.md` (لا توجد شاشة إسناد بعد).
- [ ] تدوير المفاتيح المكشوفة سابقًا: ملف `.env.keys` (مفتاح dotenvx الخاص) أُزيل من الشجرة في commit `3811820d`، لكنه **ما زال موجودًا في تاريخ git** — أي مفتاح كان بداخله يجب اعتباره مكشوفًا ويُدوَّر الآن.

---

## 11. English summary

- **Repo:** `github.com/ahmedelkashash7/iconcrete` (public). Default branch `main` = `184ae02f` ("Freebuff: ROLE"), committed and pushed by the `freebuff-web[bot]` GitHub App; CI run #1 on that commit **succeeded**. No `hardening-v1` branch exists locally or remotely — the platform commits straight to `main`.
- **Vercel:** no `vercel.json` existed before this change. Added a minimal one (`buildCommand: bash scripts/vercel-build.sh`); the script deploys Convex functions **only** when `VERCEL_ENV=production`, and in every other environment it only builds the frontend against the staging/dev Convex deployment named by `VITE_CONVEX_URL` (Preview scope). No deploy key is placed in Preview, so a preview branch cannot touch real data. Both paths fail loudly rather than building against the wrong backend.
- **Convex:** only the dev deployment (`dev/vly-dev-service-account` → `https://famous-owl-975.convex.cloud`) has received the hardening functions. No production deployment was touched, and `convex deploy` was never run.
- **Gap between preview and main:** there is none in code terms — the platform pushed everything to `main` already, so "preview vs main" is currently a *process* gap (no review gate), not a difference in content.
- **PR link format:** `https://github.com/ahmedelkashash7/iconcrete/compare/main...hardening-v1`
- **Not verified:** the Vercel project and its settings, whether a Convex production deployment exists, and the git history secret scan (git CLI refused). See §12.

---

## 12. ما لم أتحقق منه (بصراحة)

1. **لوحة Vercel بالكامل:** لا أستطيع الوصول إليها. لم أتأكد من وجود المشروع، ولا من اتصاله بالمستودع، ولا من إعداداته الحالية، ولا من متغيراته.
2. **وجود نشر إنتاج على Convex:** لا وصول للوحة Convex. كل ما أعرفه هو وجود نشر تطوير واحد.
3. **هل Vercel ينشر فعليًا من `main`:** استنتاج من الإعداد المعتاد، لا دليل عندي.
4. **حالة سير عمل بناء ملف EXE** (`.github/workflows/build-exe.yml`، يعمل على Windows عند الدفع إلى `main`): لم أفحص نتيجته.
5. **فحص تاريخ git بحثًا عن أسرار:** مستحيل هنا (أوامر git مرفوضة). المفحوص فعليًا هو الشجرة الحالية عبر `bun run check:secrets`، وملاحظة أن `.env.keys` أُزيل في `3811820d` لكنه باقٍ في التاريخ.
6. **ملفات `.env`:** وصولها محجوب على هذا الجهاز، فلم أقرأ أي قيمة. أسماء المتغيرات مأخوذة من `README.md` و`.env.example` ومن التوثيق.
7. **تنفيذ `scripts/vercel-build.sh` فعليًا:** اختبرت صحته النحوية (`bash -n` → OK) ومخرجات مسارات فشله، لكنني **لم أشغّل مسار الإنتاج فيه** لأنه ينفّذ `convex deploy`، والطلب كان صريحًا بعدم فعل ذلك.
