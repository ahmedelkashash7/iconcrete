
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const MY_WHATSAPP = "201226655905"; // رقمك انت 01226655905

// قاعدة معرفة ببلاش - من غير AI بفلوس
const KNOWLEDGE_BASE = [
  {
    keywords: ["فاتورة", "invoice", "فاتوره", "بيع"],
    answer: "عشان تعمل فاتورة: من القائمة الجانبية دوس (الفواتير / Invoices) -> + فاتورة جديدة -> اختار العميل -> اختار الخلطة -> دوس حفظ وطباعة.",
    path: "/invoices"
  },
  {
    keywords: ["خلطة", "mix", "تصميم", "خرسانة"],
    answer: "الخلطات موجودة في (إدارة الخلطات / Mix Designs). تقدر تضيف خلطة جديدة وتحدد نسب الاسمنت والرمل والزلط.",
    path: "/mixes"
  },
  {
    keywords: ["عميل", "client", "customer", "زبون"],
    answer: "العملاء في صفحة (العملاء / Clients). دوس + عميل جديد وسجل الاسم ورقم التليفون - مهم جدا عشان يظهر في الفواتير.",
    path: "/clients"
  },
  {
    keywords: ["مخزون", "stock", "مواد", "اسمنت"],
    answer: "المخزون في صفحة (المخزون / Inventory). هناك هتشوف الكميات اللي باقية واللي خلصت.",
    path: "/inventory"
  },
  {
    keywords: ["تقرير", "report", "حساب", "مبيعات"],
    answer: "التقارير في صفحة (التقارير / Reports). هتلاقي تقرير يومي وشهري لكل المبيعات.",
    path: "/reports"
  },
  {
    keywords: ["طباعة", "print", "pdf"],
    answer: "الطباعة بتشتغل من جوه الفاتورة نفسها، بعد ما تحفظ الفاتورة دوس زرار (طباعة / Print). لو مش شغالة تأكد ان الطابعة متوصلة.",
    path: ""
  },
  {
    keywords: ["تسجيل", "دخول", "حساب", "ايميل"],
    answer: "التسجيل اول مرة بيطلب ايميل وباسورد ورقم تليفون الموظف - الرقم ده مهم عشان لو فيه مشكلة نقدر نكلمك.",
    path: ""
  },
];

function getLocalAnswer(query: string) {
  const q = query.toLowerCase();
  for (const item of KNOWLEDGE_BASE) {
    if (item.keywords.some(k => q.includes(k.toLowerCase()))) {
      return item;
    }
  }
  return null;
}

export default function AskAIAgent() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"help" | "bug">("help");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{answer: string, path: string} | null>(null);
  const [bugMsg, setBugMsg] = useState("");
  
  const location = useLocation();
  const navigate = useNavigate();

  const handleAsk = () => {
    if (!query.trim()) return;
    const found = getLocalAnswer(query);
    if (found) {
      setResult(found);
    } else {
      setResult({
        answer: "مش لاقي إجابة دقيقة، بس جرب تدور في القائمة الجانبية، أو دوس (تواصل واتساب) وانا هرد عليك فورا.",
        path: ""
      });
    }
  };

  const sendBugToWhatsApp = () => {
    if (!bugMsg.trim()) return;
    const text = `🚨 بلاغ مشكلة تقنية - iConcrete
-------------------------
📍 الصفحة: ${location.pathname}
👤 الموظف: (هيتسجل تلقائي بعد ما نضيف رقم التليفون في الداتا بيز)
🐛 المشكلة: ${bugMsg}
🕒 الوقت: ${new Date().toLocaleString("ar-EG")}
-------------------------
رقم الموظف لازم يكون في الداتا بيز من اول تسجيل دخول`;

    const url = `https://wa.me/${MY_WHATSAPP}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setBugMsg("");
    setOpen(false);
  };

  return (
    <>
      {/* الزرار الثابت في كل الصفحات */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] bg-black text-white rounded-full px-6 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all font-bold flex items-center gap-2"
      >
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        Ask AI Agent
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-end p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          
          <div className="relative bg-white w-full sm:w-[400px] h-[520px] rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="bg-black text-white p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-[17px]">مساعد iConcrete</h3>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">✕</button>
              </div>
              <div className="flex bg-white/10 rounded-full p-1 gap-1">
                <button onClick={() => setTab("help")} className={`flex-1 py-2 rounded-full text-sm font-bold transition ${tab === 'help' ? 'bg-white text-black' : 'text-white/60'}`}>تايه؟ اسألني</button>
                <button onClick={() => setTab("bug")} className={`flex-1 py-2 rounded-full text-sm font-bold transition ${tab === 'bug' ? 'bg-white text-black' : 'text-white/60'}`}>مشكلة؟ واتساب</button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 overflow-y-auto">
              {tab === "help" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">ده مساعد محلي ببلاش 100% - هيوديك للمكان الصح من غير ما تدفع جنيه.</p>
                  
                  <div className="flex gap-2">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                      placeholder="مثال: ازاي اعمل فاتورة؟"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <button onClick={handleAsk} className="bg-black text-white px-5 rounded-xl font-bold">اسأل</button>
                  </div>

                  {result && (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                      <p className="text-sm leading-6 text-gray-800">{result.answer}</p>
                      {result.path && (
                        <button onClick={() => { navigate(result.path); setOpen(false); }} className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-bold">
                          وديني هناك ← {result.path}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <p className="text-xs text-gray-400 mb-2">جرب تكتب:</p>
                    <div className="flex flex-wrap gap-2">
                      {["ازاي اعمل فاتورة", "فين الخلطات", "اضيف عميل", "التقارير فين"].map(q => (
                        <button key={q} onClick={() => { setQuery(q); setTimeout(handleAsk, 100); }} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-black hover:text-white transition">{q}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
                    لو السيستم فيه Bug او مش بيطبع او بيهنج، ابعتلي هنا وهيجيلي واتساب فورا على رقمي {MY_WHATSAPP}
                  </div>
                  <div className="bg-gray-100 rounded-xl p-3 text-xs text-gray-600">
                    انت في صفحة: <b className="text-black">{location.pathname}</b>
                  </div>
                  <textarea
                    value={bugMsg}
                    onChange={(e) => setBugMsg(e.target.value)}
                    placeholder="اشرح المشكلة... مثلا: البرنامج مش بيطبع الفاتورة"
                    className="w-full h-36 border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  />
                  <button onClick={sendBugToWhatsApp} className="w-full bg-[#25D366] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                    💬 ابعت مشكلتي واتساب 
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-3 bg-gray-50 text-[10px] text-center text-gray-400 border-t">صفر تكلفة - شغال Offline + WhatsApp</div>
          </div>
        </div>
      )}
    </>
  );
}
