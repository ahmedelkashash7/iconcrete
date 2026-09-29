import { api } from "@/convex/_generated/api";
import { can, normalizeRole, roleLabel } from "@/convex/permissions";
import type { Capability, Viewer } from "@/convex/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Reads the signed-in member's plant role and exposes the capability checks the
 * screens render against. A member without a role yet receives one on first load
 * (see `access.ensureProfile`), so screens can rely on `isReady`.
 */
export function useAccess() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const ensureProfile = useMutation(api.access.ensureProfile);
  const requested = useRef(false);

  useEffect(() => {
    if (!user || user.role || requested.current) return;
    requested.current = true;
    ensureProfile({}).catch((error) => {
      console.error("Role assignment failed:", error);
      requested.current = false;
    });
  }, [user, ensureProfile]);

  const role = normalizeRole(user?.role);
  const isAnonymous = user?.isAnonymous === true;

  const viewer: Viewer = useMemo(
    () => ({ userId: user?._id ?? null, role, isAnonymous }),
    [user?._id, role, isAnonymous],
  );

  const check = useCallback(
    (capability: Capability) => can(viewer, capability),
    [viewer],
  );

  return {
    viewer,
    role,
    isAnonymous,
    label: roleLabel({ role, isAnonymous }),
    /** Role is still being assigned — screens should hold a skeleton. */
    isLoading: isAuthLoading || (!!user && !role),
    isReady: !isAuthLoading && !!user && !!role,
    can: check,
  };
}

export type Access = ReturnType<typeof useAccess>;
