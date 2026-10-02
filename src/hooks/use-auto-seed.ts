import { api } from "@/convex/_generated/api";
import { useAccess } from "@/hooks/use-access";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

/** Module-level guard so the bootstrap runs at most once per browser session. */
let attempted = false;

/**
 * Fills the demo estate (production ledger, quality samples, stores, fleet and
 * alert rules) the first time somebody opens the system on an empty deployment.
 * Runs at most once per session and only when the plant is genuinely empty, so
 * real data is never touched.
 */
export function useAutoSeed() {
  const access = useAccess();
  const status = useQuery(api.production.demoStatus);
  const seed = useMutation(api.production.seedDemoData);

  useEffect(() => {
    if (attempted || !access.isReady || !access.can("manageTestData")) return;
    if (!status || !status.isEmpty) return;
    attempted = true;
    seed({}).catch((error) => {
      console.error("Demo auto-seed failed:", error);
      attempted = false;
    });
  }, [access, status, seed]);
}
