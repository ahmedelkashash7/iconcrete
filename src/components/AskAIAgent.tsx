import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const MY_WHATSAPP = "201226655905"; // رقمك 01226655905

const KNOWLEDGE_BASE = [
  { keywords: ["فاتورة", "invoice", "بيع"], answer: "عشان تعمل فاتورة: من القائمة الجانبية دوس (الفواتير) -> + فاتورة جديدة -> اختار العميل والخلطة -> حفظ وطباعة.", path: "/invoices" },
  { keywords: ["خلطة", "mix", "خرسانة"], answer: "الخلطات في (إدارة الخلطات / Mix Designs). تقدر تضيف خلطة جديدة وتحدد نسب الاسمنت والرمل والزلط.", path: "/mixes" },
  { keywords: ["عميل", "client", "زبون"], answer: "العملاء في (العملاء). دوس + عميل جديد وسجل الاسم ورقم التليفون.", path: "/clients" },
  { keywords: ["مخزون", "stock", "اسمنت"], answer: "المخزون في (المخزون). هتشوف الكميات اللي باقية.", path: "/inventory" },
  { keywords: ["تقرير", "report"], answer: "التقارير في (التقارير). هتلاقي تقرير يومي وشهري.", path: "/reports" },
  { keywords: ["طباعة", "print"], answer: "الطباعة من جوه الفاتورة بعد الحفظ دوس طباعة.", path: "" },
];

function getLocalAnswer(q: string) {
  const lower = q.toLowerCase();
  for (const item of KNOWLEDGE_BASE) {
    if (item.keywords.some(k => lower.includes(k.toLowerCase()))) return item;
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
    setResult(found ? found : { answer: "مش لاقي إجابة دقيقة، جرب تدور في القائمة الجانبية أو دوس تواصل واتساب.", path: "" });
  };

  const sendBugToWhatsApp = () => {
    if (!bugMsg.trim()) return;
    const text = `🚨 بلاغ iConcrete\n📍 الصفحة: ${location.pathname}\n🐛 المشكلة: ${bugMsg}\n🕒 ${new Date().toLocaleString("ar-EG")}`;
    window.open(`https://wa.me/${MY_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank");
    setBugMsg(""); setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[9999] bg-black text-white rounded-full px-6 py-3.5 shadow-xl hover:scale-105 transition-all font-bold flex items-center gap-2">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Ask AI Agent
      </button>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-end p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full sm:w-[400px] h-[520px] rounded-[24px] shadow-2xl overflow-hidden flex flex-col">
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
            <div className="flex-1 p-4 overflow-y-auto">
              {tab === "help" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">مساعد محلي ببلاش 100% - هيوديك للمكان الصح.</p>
                  <div className="flex gap-2">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAsk()} placeholder="ازاي اعمل فاتورة؟" className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    <button onClick={handleAsk} className="bg-black text-white px-5 rounded-xl font-bold">اسأل</button>
                  </div>
                  {result && (
                    <div className="bg-gray-50 border rounded-2xl p-4 space-y-3">
                      <p className="text-sm leading-6 text-gray-800">{result.answer}</p>
                      {result.path && <button onClick={() => { navigate(result.path); setOpen(false); }} className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-bold">وديني هناك ← {result.path}</button>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-100 rounded-xl p-3 text-xs text-gray-600">انت في صفحة: <b className="text-black">{location.pathname}</b></div>
                  <textarea value={bugMsg} onChange={(e) => setBugMsg(e.target.value)} placeholder="اشرح المشكلة..." className="w-full h-36 border rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
                  <button onClick={sendBugToWhatsApp} className="w-full bg-[#25D366] text-white font-bold py-3.5 rounded-xl">💬 ابعت واتساب ببلاش</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
