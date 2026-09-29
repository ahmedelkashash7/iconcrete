import { STANDARD_MIX_PRICES } from "@/convex/pricing";

/** Shared vocabulary of the ready-mix plant used by the v1 screens. */

export type Shift = "morning" | "evening" | "night";
export type LogStatus = "delivered" | "in_progress" | "cancelled";

export const SHIFT_ORDER: Shift[] = ["morning", "evening", "night"];

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: "الوردية الصباحية",
  evening: "الوردية المسائية",
  night: "الوردية الليلية",
};

export const SHIFT_SHORT_LABELS: Record<Shift, string> = {
  morning: "صباحي",
  evening: "مسائي",
  night: "ليلي",
};

export const STATUS_ORDER: LogStatus[] = ["delivered", "in_progress", "cancelled"];

export const STATUS_LABELS: Record<LogStatus, string> = {
  delivered: "مكتمل",
  in_progress: "قيد التنفيذ",
  cancelled: "ملغي",
};

/**
 * Standard grades with the plant's approved selling price and cost per m³
 * (EGP). The same table prices operator entries on the server, so the form and
 * the backend can never disagree about a grade's price.
 */
export { STANDARD_MIX_PRICES as MIX_PRESETS } from "@/convex/pricing";

export const MIX_NAMES = STANDARD_MIX_PRICES.map((mix) => mix.name);

/** Truck mixer drum capacity used to estimate the number of trips. */
export const TRUCK_CAPACITY_M3 = 9;
