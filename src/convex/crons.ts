import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Every morning at 05:00 UTC (07:00 Cairo) the plant's thresholds are scored
 * against the live ledger and the breaching rules are dispatched.
 *
 * The run is idempotent: a rule fires at most once per calendar day, and when no
 * delivery key is configured the events are still recorded as «تجريبي» so the
 * owner can see exactly what would have been sent.
 */
crons.daily(
  "plant-threshold-alerts",
  { hourUTC: 5, minuteUTC: 0 },
  internal.alerts.runScheduled,
  {},
);

export default crons;
