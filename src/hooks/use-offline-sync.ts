import { getLocalDb, isTauri } from "@/lib/offline/db";
import {
  isOnline,
  lastSyncAt,
  pendingCount,
  probeCloud,
  syncAll,
} from "@/lib/offline/syncService";
import type { SyncReport } from "@/lib/offline/syncService";
import { useConvex } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type OfflineSyncState = {
  /** navigator.onLine */
  online: boolean;
  /** The cloud actually answered the last probe. */
  cloudReachable: boolean;
  /** Local writes waiting to be pushed. */
  pending: number;
  /** Epoch ms of the last successful sync. */
  lastSync: number | null;
  syncing: boolean;
  lastReport: SyncReport | null;
  /** "sqlite" on the desktop build, "memory" in the browser build. */
  engine: "sqlite" | "memory";
  runSync: () => Promise<SyncReport | null>;
  refresh: () => Promise<void>;
};

const PENDING_POLL_MS = 4_000;
const PROBE_MS = 30_000;

/**
 * Single source of truth for the offline/online surface: the status indicator,
 * the «مزامنة آخر اليوم» button and the sync centre all read from here.
 */
export function useOfflineSync(): OfflineSyncState {
  const client = useConvex();
  const [online, setOnline] = useState(() => isOnline());
  const [cloudReachable, setCloudReachable] = useState(true);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const [queue, stamp] = await Promise.all([pendingCount(), lastSyncAt()]);
    if (!mounted.current) return;
    setPending(queue);
    setLastSync(stamp);
  }, []);

  useEffect(() => {
    mounted.current = true;
    // The queue is plain local data, so it is polled like any other external
    // system rather than pushed into React state during the effect body.
    const tick = () => {
      void getLocalDb()
        .ready()
        .then(refresh);
    };
    const first = window.setTimeout(tick, 0);
    const poll = window.setInterval(tick, PENDING_POLL_MS);
    return () => {
      mounted.current = false;
      window.clearTimeout(first);
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => {
      setOnline(false);
      setCloudReachable(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!online) {
      const offlineTimer = window.setTimeout(() => setCloudReachable(false), 0);
      return () => window.clearTimeout(offlineTimer);
    }
    let cancelled = false;
    const check = async () => {
      const reachable = await probeCloud(client);
      if (!cancelled && mounted.current) setCloudReachable(reachable);
    };
    void check();
    const timer = window.setInterval(() => void check(), PROBE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, online]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const report = await syncAll(client);
      if (!mounted.current) return report;
      setLastReport(report);
      setLastSync(report.pulledAt);
      setCloudReachable(true);
      await refresh();
      return report;
    } catch (error) {
      if (mounted.current) setCloudReachable(false);
      throw error;
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }, [client, refresh]);

  return {
    online,
    cloudReachable,
    pending,
    lastSync,
    syncing,
    lastReport,
    engine: isTauri() ? "sqlite" : "memory",
    runSync,
    refresh,
  };
}
