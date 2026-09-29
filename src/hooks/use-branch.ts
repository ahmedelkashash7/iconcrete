import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BRANCH_UNASSIGNED_LABEL } from "@/lib/concrete";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "iconcrete.branch";

/** Module-level so the bootstrap mutation runs once per browser session. */
let bootstrapped = false;

export type BranchOption = {
  _id: Id<"branches">;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  managerName: string | null;
  phone: string | null;
  capacityM3Day: number;
  isActive: boolean;
  notes: string | null;
};

/**
 * The selected station, shared by every operational screen.
 *
 * The plant's first station and its approved price list are created on demand
 * (and legacy rows are attached to the station), and the choice is remembered in
 * `localStorage` so the owner can stay inside one branch while walking the whole
 * system.
 */
export function useBranch() {
  const ensureDefault = useMutation(api.branches.ensureDefault);
  const ensureSettings = useMutation(api.settings.ensureDefaults);
  const queried = useQuery(api.branches.list);
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY),
  );

  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    Promise.all([ensureDefault({}), ensureSettings({})]).catch((error) => {
      console.error("Station bootstrap failed:", error);
      bootstrapped = false;
    });
  }, [ensureDefault, ensureSettings]);

  const branches = useMemo<BranchOption[]>(
    () => (queried ?? []) as BranchOption[],
    [queried],
  );

  const branchId = useMemo<Id<"branches"> | undefined>(() => {
    if (!selected) return undefined;
    return branches.find((branch) => branch._id === selected)?._id;
  }, [selected, branches]);

  const setBranchId = useCallback((value: Id<"branches"> | null) => {
    setSelected(value);
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(STORAGE_KEY, value);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const current = branches.find((branch) => branch._id === branchId);

  return {
    branches,
    activeBranches: branches.filter((branch) => branch.isActive),
    branchId,
    setBranchId,
    label: current?.name ?? (branchId ? BRANCH_UNASSIGNED_LABEL : "كل الفروع"),
    isLoading: queried === undefined,
  };
}

export type BranchState = ReturnType<typeof useBranch>;
