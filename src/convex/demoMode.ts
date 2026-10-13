/**
 * IConcrete System — DEMO_MODE.
 *
 * The anonymous provider exists so a visitor can look around a *demo*
 * deployment. On a live plant it must grant nothing: before this module the
 * anonymous role was `manager`, which handed every visitor the financials, the
 * ability to edit production records, exports and the full audit log.
 *
 * `DEMO_MODE` is read from the Convex deployment environment and is **OFF
 * unless explicitly enabled** (truthy values: `true`, `1`, `yes`, `on`). Turn it
 * on *only* on a throwaway demo deployment:
 *
 *   npx convex env set DEMO_MODE true          # demo deployment only
 *   npx convex env remove DEMO_MODE            # back to locked down
 *
 * When it is off:
 *   - anonymous viewers are rejected by every query and mutation;
 *   - the guest button is hidden on the sign-in screen (see `access.demoConfig`).
 *
 * When it is on:
 *   - anonymous viewers are strictly **read-only** and see a reduced set of
 *     screens: they cannot export data, read the audit log, or write anything.
 */

const TRUTHY = new Set(["true", "1", "yes", "on"]);

/** True only when the deployment explicitly opted in to demo mode. */
export function demoModeEnabled(): boolean {
  const raw = process.env.DEMO_MODE;
  if (typeof raw !== "string") return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}
