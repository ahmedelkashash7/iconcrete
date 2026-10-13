import { ConvexError } from "convex/values";

/**
 * IConcrete System — standard business error codes.
 *
 * Every business failure carries a stable machine code plus an Arabic message
 * written as a *resolution guide*: what happened, why, and the next action for
 * the operator. The code is what the interface branches on (to show the right
 * panel, badge or dialog); the message is what the operator reads.
 *
 * Keep the codes stable — they appear in logs, in the audit trail and in the
 * offline queue's `lastError`, and the offline queue retries based on them.
 */

/** Surfaces the Arabic validation message thrown by the Convex layer. */
export function errorMessage(error: unknown, fallback = "تعذر إتمام العملية"): string {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    return fallback;
  }
  if (error instanceof Error) {
    // Server errors arrive wrapped, strip the transport noise if present.
    const match = /Uncaught (?:Convex)?Error: (.+?)(?:\n|$)/.exec(error.message);
    return match?.[1]?.trim() || error.message || fallback;
  }
  return fallback;
}

type ErrorSpec = {
  /** Frozen code — appears in logs, the audit trail and the retry logic. */
  code: string;
  /** Short Arabic title for a badge or dialog heading. */
  title: string;
  /** What happened, why, and what to do next. */
  message: string;
  /**
   * `true` when retrying the same request could plausibly succeed (a transient
   * condition such as a version conflict); `false` when the input itself is
   * wrong and a retry would fail identically. The offline queue uses this to
   * decide between retry and "needs attention".
   */
  retryable: boolean;
};

export const BUSINESS_ERRORS = {
  NOT_SIGNED_IN: {
    code: "NOT_SIGNED_IN",
    title: "غير مسجّل الدخول",
    message: "سجّل الدخول للمتابعة، ثم أعد المحاولة.",
    retryable: false,
  },
  DEMO_DISABLED: {
    code: "DEMO_DISABLED",
    title: "الوصول كزائر معطّل",
    message: "النسخة الحالية ليست نسخة تجريبية. سجّل الدخول بحسابك للمتابعة.",
    retryable: false,
  },
  CAPABILITY_DENIED: {
    code: "CAPABILITY_DENIED",
    title: "صلاحية غير كافية",
    message: "دورك الحالي لا يسمح بهذا الإجراء. اطلب من المالك منحك الصلاحية من شاشة الفريق والصلاحيات.",
    retryable: false,
  },
  BRANCH_DENIED: {
    code: "BRANCH_DENIED",
    title: "فرع غير مصرّح",
    message:
      "هذا الفرع غير مُسند إليك. اطلب من المالك إسناد الفرع إليك بتاريخ سريان من شاشة الفريق والصلاحيات.",
    retryable: false,
  },
  BRANCH_IMMUTABLE: {
    code: "BRANCH_IMMUTABLE",
    title: "فرع السجل غير قابل للتغيير",
    message:
      "لا يمكن نقل سجل من فرع إلى آخر بعد حفظه. أنشئ سجلًا جديدًا على الفرع الصحيح، وألغِ القديم مع ذكر السبب.",
    retryable: false,
  },
  VERSION_CONFLICT: {
    code: "VERSION_CONFLICT",
    title: "تعارض في التعديل",
    message:
      "عُدّل السجل من جهاز آخر بعد فتحه عندك. حدّث الصفحة لمشاهدة أحدث نسخة، ثم أعد تطبيق تعديلك.",
    retryable: true,
  },
  UNKNOWN_MIX: {
    code: "UNKNOWN_MIX",
    title: "خلطة غير معتمدة",
    message:
      "هذه الخلطة ليست على قائمة الأسعار المعتمدة للمحطة، فلا يمكن تسعير القيد. أضف الخلطة وسعرها من إعدادات المحطة أولًا.",
    retryable: false,
  },
  TARGET_STRENGTH_MISSING: {
    code: "TARGET_STRENGTH_MISSING",
    title: "مقاومة المكعب المطلوبة غير محددة",
    message:
      "لا يمكن تقييم نتيجة مقاومة بدون مقاومة مكعب مطلوبة مكتوبة صراحةً. أدخل «مقاومة المكعب المطلوبة» في تصميم الخلطة.",
    retryable: false,
  },
  RULE_NOT_APPROVED: {
    code: "RULE_NOT_APPROVED",
    title: "لا توجد قاعدة معتمدة",
    message:
      "لا توجد قاعدة كود معتمدة وموثقة سارية على تاريخ الاختبار، لذلك تُعرض النتيجة كمؤشر فقط. اعتمد القاعدة من شاشة قواعد الجودة.",
    retryable: false,
  },
  RULE_PARAM_UNVERIFIED: {
    code: "RULE_PARAM_UNVERIFIED",
    title: "معامل قاعدة غير مُتحقق منه",
    message:
      "أحد معاملات القاعدة لم يتحقق منه مهندس أو غير مقروء في المصدر، فلا يمكن اعتمادها. راجع القاعدة من شاشة قواعد الجودة.",
    retryable: false,
  },
  NEGATIVE_STOCK: {
    code: "NEGATIVE_STOCK",
    title: "رصيد سالب",
    message:
      "العملية تجعل رصيد المادة سالبًا. سجّل استلامًا أولًا، أو اسمح بالرصيد السالب من إعدادات المحطة إن كان الجرد غير مكتمل.",
    retryable: false,
  },
  VARIANCE_REASON_REQUIRED: {
    code: "VARIANCE_REASON_REQUIRED",
    title: "سبب الفرق مطلوب",
    message:
      "الفرق بين الكمية الفعلية والنظرية أكبر من الحد المسموح، فكتابة السبب إلزامية قبل الحفظ.",
    retryable: false,
  },
  PAYMENT_EXCEEDS_BALANCE: {
    code: "PAYMENT_EXCEEDS_BALANCE",
    title: "الدفعة أكبر من الرصيد",
    message:
      "لا يمكن تسجيل دفعة أكبر من الرصيد المتبقي على الفاتورة. راجع مبلغ الدفعة أو سجّل الفرق على فاتورة أخرى.",
    retryable: false,
  },
  DUPLICATE_PAYMENT: {
    code: "DUPLICATE_PAYMENT",
    title: "دفعة مكررة",
    message:
      "هذه الدفعة مسجّلة بالفعل (نفس المرجع والمبلغ والتاريخ). تحقق من كشف الحساب قبل تكرارها.",
    retryable: false,
  },
  INVOICE_NOT_POSTED: {
    code: "INVOICE_NOT_POSTED",
    title: "الفاتورة غير مُرحّلة",
    message: "لا يمكن تسجيل دفعات على فاتورة مسودة. رحّل الفاتورة أولًا.",
    retryable: false,
  },
  INVOICE_IMMUTABLE: {
    code: "INVOICE_IMMUTABLE",
    title: "الفاتورة مرحّلة ولا تُعدّل",
    message:
      "الفواتير المرحّلة تُعدّل بإشعار دائن (credit note) لا بالتحرير المباشر، حفاظًا على سجل التتبع.",
    retryable: false,
  },
  APPROVAL_REQUIRED: {
    code: "APPROVAL_REQUIRED",
    title: "يحتاج اعتمادًا",
    message:
      "هذا الإجراء ضمن الإجراءات الحساسة، فيُنشئ طلب اعتماد. تابع الطلب من شاشة الاعتمادات.",
    retryable: false,
  },
  SELF_APPROVAL_FORBIDDEN: {
    code: "SELF_APPROVAL_FORBIDDEN",
    title: "لا يمكن اعتماد طلبك بنفسك",
    message:
      "النظام في وضع الاعتماد المزدوج: من أنشأ الطلب لا يعتمده. اطلب من عضو آخر معه صلاحية الاعتماد.",
    retryable: false,
  },
  APPROVAL_REASON_REQUIRED: {
    code: "APPROVAL_REASON_REQUIRED",
    title: "سبب الرفض مطلوب",
    message: "اكتب سبب رفض الطلب قبل تأكيد الرفض.",
    retryable: false,
  },
  PAYLOAD_TOO_LARGE: {
    code: "PAYLOAD_TOO_LARGE",
    title: "حجم البيانات أكبر من المسموح",
    message:
      "الطلب أكبر من الحد المسموح. قسّم البيانات إلى دفعات أصغر ثم أعد الإرسال.",
    retryable: false,
  },
  CLIENT_FIELD_IMMUTABLE: {
    code: "CLIENT_FIELD_IMMUTABLE",
    title: "حقل يُدار من الخادم",
    message:
      "أحد الحقول المرسلة يُدار من الخادم (منشئ السجل، التواريخ، رقم النسخة، علامة البيانات) ولا يقبلها النظام من العميل.",
    retryable: false,
  },
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    title: "بيانات غير صالحة",
    message: "راجع الحقول المطلوبة والقيم المدخلة، ثم أعد الحفظ.",
    retryable: false,
  },
  TEST_DATA_IN_LIVE_MODE: {
    code: "TEST_DATA_IN_LIVE_MODE",
    title: "بيانات تجريبية في نسخة حقيقية",
    message:
      "لا تُخلط البيانات التجريبية مع البيانات الحقيقية. استخدم نسخة تجريبية منفصلة لبيانات العرض.",
    retryable: false,
  },
  CREDIT_LIMIT_EXCEEDED: {
    code: "CREDIT_LIMIT_EXCEEDED",
    title: "تجاوز حد الائتمان",
    message:
      "قيمة الطلبية تتجاوز حد الائتمان المسموح لهذا العميل. اطلب من المدير اعتماد تجاوز الحد أو سجّل دفعة أولًا.",
    retryable: false,
  },
} as const satisfies Record<string, ErrorSpec>;

export type BusinessErrorCode = keyof typeof BUSINESS_ERRORS;

export function businessSpec(code: BusinessErrorCode): ErrorSpec {
  return BUSINESS_ERRORS[code];
}

export function businessTitle(code: BusinessErrorCode): string {
  return BUSINESS_ERRORS[code].title;
}

export function businessMessage(code: BusinessErrorCode): string {
  return BUSINESS_ERRORS[code].message;
}

export function isRetryable(code: BusinessErrorCode): boolean {
  return BUSINESS_ERRORS[code].retryable;
}

/** `"BRANCH_DENIED: …"` — a log/report line that carries the code. */
export function describeBusinessError(code: BusinessErrorCode): string {
  const spec = businessSpec(code);
  return `${spec.code}: ${spec.message}`;
}

/**
 * A Convex error carrying both the code and the Arabic message, so the client
 * can branch on `error.data.code` *and* show `error.data.message`.
 */
export function businessError(code: BusinessErrorCode, detail?: string): ConvexError<{
  code: BusinessErrorCode;
  title: string;
  message: string;
  retryable: boolean;
}> {
  const spec = businessSpec(code);
  return new ConvexError({
    code,
    title: spec.title,
    message: detail ? `${spec.message} (${detail})` : spec.message,
    retryable: spec.retryable,
  });
}

/** Reads the code back out of a thrown error, or null for a plain failure. */
export function errorCode(error: unknown): BusinessErrorCode | null {
  const data =
    error instanceof ConvexError
      ? error.data
      : error && typeof error === "object" && "data" in error
        ? (error as { data?: unknown }).data
        : null;
  if (data && typeof data === "object" && "code" in data) {
    const code = (data as { code?: unknown }).code;
    if (typeof code === "string" && code in BUSINESS_ERRORS) {
      return code as BusinessErrorCode;
    }
  }
  return null;
}
