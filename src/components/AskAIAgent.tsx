import { useState } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Floating in-app helper.
 *
 * Honesty note (hardening v1): this is a **local keyword matcher**, not an AI
 * agent — it runs entirely in the browser with no model and no network call, so
 * it is labelled «مساعدة سريعة» (quick help), never "AI". It also reports a bug
 * to the plant's own WhatsApp number, which is the only outbound request it makes.
 *
 * Every entry points at a route that actually exists in `src/main.tsx`; the
 * previous version navigated to /invoices, /mixes, /clients and /reports, none of
 * which are registered, so the operator landed on the 404 page.
 */

const SUPPORT_WHATSAPP = "201226655905";

const HELP_TOPICS = [
  {
    keywords: ["انتاج", "إنتاج", "قيد", "production", "وردية", "صب"],
    answer:
      "تسجيل الإنتاج: من «الإنتاج والكميات» ← «قيد جديد» ← اختر التاريخ والوردية والخلطة والكميات، والنظام يحسب الإيراد والتكلفة والربح.",
    path: "/production",
  },
  {
    keywords: ["جودة", "مكعب", "ركود", "اختبار", "quality", "slump"],
    answer:
      "الجودة: من «الجودة والاختبارات» تسجّل نتائج المكعبات والركود، وتربطها بقيد الإنتاج لتظهر في شاشة التتبع.",
    path: "/quality",
  },
  {
    keywords: ["مخزون", "مخزن", "مواد", "اسمنت", "أسمنت", "stock", "inventory"],
    answer:
      "المخازن: من «المخازن والمواد» ترى الرصيد وحركة الاستلام والصرف لكل مادة وحد إعادة الطلب.",
    path: "/inventory",
  },
  {
    keywords: ["سعر", "أسعار", "خلطة", "خلطات", "mix", "تسعير"],
    answer:
      "الخلطات وأسعارها تُدار من «إعدادات المحطة». القيد لا يُسعَّر إلا بخلطة موجودة في القائمة المعتمدة.",
    path: "/settings",
  },
  {
    keywords: ["فرع", "فروع", "branch"],
    answer:
      "الفروع من «إعدادات المحطة» ← تبويب الفروع، وشريط الفروع أعلى الشاشة يفلتر كل الشاشات.",
    path: "/settings",
  },
  {
    keywords: ["تصدير", "استيراد", "اكسل", "إكسل", "excel", "csv"],
    answer:
      "استيراد ملف Excel من «استيراد Excel»، وتنزيل حزمة التقارير من «حزمة Excel / Power».",
    path: "/excel-pack",
  },
  {
    keywords: ["تنبيه", "تنبيهات", "alert", "حد"],
    answer: "التنبيهات وحدودها من «التنبيهات والحدود».",
    path: "/alerts",
  },
  {
    keywords: ["فريق", "صلاحية", "صلاحيات", "دور", "team", "role"],
    answer:
      "الفريق وأدواره من «الفريق والصلاحيات» (للمالك فقط). كل عملية تُسجَّل في «سجل التتبع».",
    path: "/team",
  },
  {
    keywords: ["مزامنة", "أوفلاين", "offline", "sync"],
    answer: "حالة المزامنة والعمليات المنتظرة في «مركز المزامنة».",
    path: "/sync",
  },
  {
    keywords: ["نسخة", "نسخ", "احتياطي", "backup"],
    answer:
      "النسخ الاحتياطي: من «مركز المزامنة» تنزّل نسخة من البيانات المحلية، وحزمة Excel من «حزمة Excel / Power».",
    path: "/sync",
  },
];

function findTopic(query: string) {
  const lower = query.trim().toLowerCase();
  if (!lower) return null;
  return (
    HELP_TOPICS.find((topic) =>
      topic.keywords.some((keyword) => lower.includes(keyword.toLowerCase())),
    ) ?? null
  );
}

export default function AskAIAgent() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"help" | "bug">("help");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ answer: string; path: string } | null>(null);
  const [bugMsg, setBugMsg] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const handleAsk = () => {
    if (!query.trim()) return;
    const found = findTopic(query);
    setResult(
      found ?? {
        answer:
          "لم أجد موضوعًا مطابقًا. جرّب كلمة أقصر (إنتاج، جودة، مخزون، فاتورة…) أو ابحث من القائمة الجانبية.",
        path: "",
      },
    );
  };

  const sendBugToWhatsApp = () => {
    if (!bugMsg.trim()) return;
    const text = `بلاغ IConcrete\nالصفحة: ${location.pathname}\nالمشكلة: ${bugMsg}\nالوقت: ${new Date().toLocaleString("ar-EG")}`;
    window.open(
      `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`,
      "_blank",
    );
    setBugMsg("");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground fixed bottom-6 end-6 z-[9999] flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition hover:opacity-90"
      >
        <span className="bg-success size-2 rounded-full" />
        مساعدة سريعة
      </button>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-end p-4">
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="bg-foreground/40 absolute inset-0 backdrop-blur-sm"
          />
          <div className="bg-card text-card-foreground border-border relative flex h-[520px] w-full flex-col overflow-hidden rounded-3xl border shadow-2xl sm:w-[400px]">
            <div className="bg-primary text-primary-foreground p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">مساعد IConcrete</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="إغلاق"
                  className="bg-primary-foreground/15 grid size-8 place-items-center rounded-full"
                >
                  ✕
                </button>
              </div>
              <div className="bg-primary-foreground/15 flex gap-1 rounded-full p-1">
                <button
                  type="button"
                  onClick={() => setTab("help")}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                    tab === "help"
                      ? "bg-card text-card-foreground"
                      : "text-primary-foreground/70"
                  }`}
                >
                  محتاج مساعدة؟
                </button>
                <button
                  type="button"
                  onClick={() => setTab("bug")}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                    tab === "bug"
                      ? "bg-card text-card-foreground"
                      : "text-primary-foreground/70"
                  }`}
                >
                  فيه مشكلة؟
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {tab === "help" ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-xs leading-5">
                    دليل داخلي يعمل بدون إنترنت: اكتب كلمة من العملية التي تريدها
                    (إنتاج، جودة، مخزون…) وسيوجهك إلى الشاشة الصحيحة.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && handleAsk()}
                      placeholder="مثال: إنتاج"
                      aria-label="اكتب سؤالك"
                      className="border-input bg-background flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                    <button
                      type="button"
                      onClick={handleAsk}
                      className="bg-primary text-primary-foreground rounded-xl px-5 font-semibold"
                    >
                      ابحث
                    </button>
                  </div>
                  {result && (
                    <div className="bg-muted border-border space-y-3 rounded-2xl border p-4">
                      <p className="text-sm leading-6">{result.answer}</p>
                      {result.path && (
                        <button
                          type="button"
                          onClick={() => {
                            navigate(result.path);
                            setOpen(false);
                          }}
                          className="bg-primary text-primary-foreground w-full rounded-xl py-2.5 text-sm font-semibold"
                        >
                          افتح الشاشة ← {result.path}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-muted text-muted-foreground rounded-xl p-3 text-xs">
                    أنت في صفحة:{" "}
                    <b className="text-foreground">{location.pathname}</b>
                  </div>
                  <textarea
                    value={bugMsg}
                    onChange={(event) => setBugMsg(event.target.value)}
                    placeholder="اشرح المشكلة…"
                    aria-label="وصف المشكلة"
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-36 w-full resize-none rounded-xl border p-4 text-sm outline-none focus-visible:ring-[3px]"
                  />
                  <button
                    type="button"
                    onClick={sendBugToWhatsApp}
                    className="bg-success text-success-foreground w-full rounded-xl py-3.5 font-semibold"
                  >
                    إرسال البلاغ على واتساب
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
