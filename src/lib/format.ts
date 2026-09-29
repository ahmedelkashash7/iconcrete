/**
 * Arabic (Egypt) formatting helpers. Digits are kept in Latin form
 * (`-u-nu-latn`) because plant operators read meter/litre figures that way,
 * while dates and labels stay fully Arabic.
 */

const LOCALE = "ar-EG-u-nu-latn";

/**
 * Inside an RTL paragraph a leading minus/plus would be re-ordered to the far
 * right of the number, so signed figures are prefixed with a LEFT-TO-RIGHT
 * MARK to keep «−50,000» reading correctly.
 */
const LRM = "\u200E";

const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

function digitsOnly(value: number, digits: number): string {
  const absolute = Math.abs(value);
  if (digits <= 0) return nf0.format(Math.round(absolute));
  if (digits === 1) return nf1.format(absolute);
  return nf2.format(absolute);
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  const body = digitsOnly(value, digits);
  return value < 0 ? `${LRM}-${body}` : body;
}

/** Cubic metres — the unit every quantity in the system uses. */
export function formatM3(value: number, digits = 0): string {
  return `${formatNumber(value, digits)} م³`;
}

export function formatEGP(value: number, digits = 0): string {
  return `${formatNumber(value, digits)} ج.م`;
}

/** Signed money for profit/loss numbers, e.g. «+42,500 ج.م». */
export function formatSignedEGP(value: number, digits = 0): string {
  const body = digitsOnly(value, digits);
  if (value > 0) return `${LRM}+${body} ج.م`;
  if (value < 0) return `${LRM}−${body} ج.م`;
  return `${body} ج.م`;
}

export function formatSigned(value: number, digits = 1): string {
  const body = digitsOnly(value, digits);
  if (value > 0) return `${LRM}+${body}`;
  if (value < 0) return `${LRM}−${body}`;
  return body;
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${formatNumber(value, digits)}٪`;
}

/** Compact axis labels: 1.2 مليون → «1.2م»، 850,000 → «850ألف». */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${nf1.format(value / 1_000_000)}م`;
  if (abs >= 1_000) return `${nf0.format(value / 1_000)}ألف`;
  return nf0.format(value);
}

/* ------------------------------- dates ------------------------------- */

const dayMonth = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayMonthWeekday = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const fullDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(iso: string): string {
  return dayMonth.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDayWithWeekday(iso: string): string {
  return dayMonthWeekday.format(new Date(`${iso}T00:00:00Z`));
}

export function formatFullDate(iso: string): string {
  return fullDate.format(new Date(`${iso}T00:00:00Z`));
}

const timeOfDay = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
});

/** Clock time of an epoch timestamp — used by the audit trail. */
export function formatTime(epochMs: number): string {
  return timeOfDay.format(new Date(epochMs));
}

/* ------------------------------ date math ---------------------------- */

const DAY_MS = 86_400_000;

/** Local calendar day as YYYY-MM-DD (never shifted by the browser timezone). */
export function todayISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive start date of a `days`-long window that ends today. */
export function windowStartISO(days: number, endISO = todayISO()): string {
  return addDaysISO(endISO, -(days - 1));
}

export function isWithin(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}
