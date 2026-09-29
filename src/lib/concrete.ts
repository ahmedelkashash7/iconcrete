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
 * Standard grades with a reference selling price and cost per m³ (EGP).
 * Used to prefill the daily entry form — the operator can always override.
 */
export const MIX_PRESETS = [
  { name: "C20/25", price: 1290, cost: 1045 },
  { name: "C25/30", price: 1405, cost: 1118 },
  { name: "C30/37", price: 1530, cost: 1205 },
  { name: "C35/45", price: 1665, cost: 1312 },
  { name: "C40/50", price: 1820, cost: 1438 },
];

export const MIX_NAMES = MIX_PRESETS.map((mix) => mix.name);

/** Truck mixer drum capacity used to estimate the number of trips. */
export const TRUCK_CAPACITY_M3 = 9;
