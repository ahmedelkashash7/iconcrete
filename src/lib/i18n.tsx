import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * IConcrete System — language layer.
 *
 * The system is Arabic-first, but every screen can be switched to English.
 * Direction is driven from a single place: switching the language flips
 * `<html dir>` so every logical Tailwind utility (`ps-*`, `pe-*`, `start-*`,
 * `border-e`) mirrors automatically, without duplicating layouts.
 */

export type Lang = "ar" | "en";
export type Dir = "rtl" | "ltr";

const STORAGE_KEY = "iconcrete.lang";

/** Shared chrome labels used across the shell and dialogs. */
const DICT: Record<string, { ar: string; en: string }> = {
  "app.name": { ar: "آي كونكريت", en: "IConcrete System" },
  "app.tagline": {
    ar: "نظام متكامل لمحطات الخرسانة الجاهزة",
    en: "An integrated ready-mix concrete platform",
  },
  "nav.section.operations": { ar: "التشغيل اليومي", en: "Daily operations" },
  "nav.section.modules": { ar: "منظومة الوحدات", en: "Module map" },
  "nav.dashboard": { ar: "لوحة القيادة", en: "Dashboard" },
  "nav.production": { ar: "الإنتاج والكميات", en: "Production" },
  "nav.quality": { ar: "الجودة والاختبارات", en: "Quality" },
  "nav.inventory": { ar: "المخازن والمواد", en: "Inventory" },
  "nav.forecast": { ar: "التنبؤ والصيانة", en: "Forecast & maintenance" },
  "nav.alerts": { ar: "التنبيهات والحدود", en: "Alerts & thresholds" },
  "nav.settings": { ar: "إعدادات المحطة", en: "Plant settings" },
  "nav.import": { ar: "استيراد Excel", en: "Excel import" },
  "nav.excelPack": { ar: "حزمة Excel / Power", en: "Excel / Power pack" },
  "nav.team": { ar: "الفريق والصلاحيات", en: "Team & roles" },
  "nav.audit": { ar: "سجل التتبع", en: "Audit trail" },
  "nav.systemMap": { ar: "خريطة النظام الكاملة", en: "Full system map" },
  "nav.available": { ar: "متاح", en: "live" },
  "nav.soon": { ar: "قريبًا", en: "soon" },
  "shell.coverage.title": { ar: "التغطية الحالية", en: "Current coverage" },
  "shell.coverage.body": {
    ar: "الفروع وأسعار الخلطات والجودة والمخازن والتنبيهات والتنبؤ تعمل فوق نفس سجل الإنتاج، والوحدات القادمة تُبنى عليه دون إدخال مزدوج.",
    en: "Branches, mix prices, quality, stores, alerts and forecasting all run on the same production ledger — and future modules build on it with no double entry.",
  },
  "shell.user.account": { ar: "حساب المستخدم", en: "User account" },
  "shell.role": { ar: "الدور", en: "Role" },
  "shell.guest": { ar: "حساب زائر", en: "Guest account" },
  "shell.signOut": { ar: "تسجيل الخروج", en: "Sign out" },
  "shell.determining": { ar: "جارٍ التحديد…", en: "Determining…" },
  "shell.menu": { ar: "القائمة", en: "Menu" },
  "common.loading": { ar: "جارٍ التحميل…", en: "Loading…" },
  "lang.switch": { ar: "تغيير اللغة", en: "Switch language" },
  "lang.arabic": { ar: "العربية", en: "Arabic" },
  "lang.english": { ar: "English", en: "English" },
};

type I18nContextValue = {
  lang: Lang;
  dir: Dir;
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  /** Dictionary lookup by key (falls back to the key itself). */
  t: (key: string) => string;
  /** Inline bilingual pick — the simplest way to translate page copy. */
  pick: (ar: string, en: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "ar";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "ar" ? stored : "ar";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);
  const dir: Dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggle = useCallback(
    () => setLangState((prev) => (prev === "ar" ? "en" : "ar")),
    [],
  );
  const t = useCallback(
    (key: string) => DICT[key]?.[lang] ?? DICT[key]?.ar ?? key,
    [lang],
  );
  const pick = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir, isRTL: dir === "rtl", setLang, toggle, t, pick }),
    [lang, dir, setLang, toggle, t, pick],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside <LanguageProvider>");
  }
  return context;
}
