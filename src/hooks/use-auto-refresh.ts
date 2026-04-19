"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type RefreshInterval = 0 | 30 | 60 | 300; // 0 = off

export function useAutoRefresh(fetchFn: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [interval, setInterval_] = useState<RefreshInterval>(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchFn();
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (interval > 0) {
      timerRef.current = setInterval(() => { refresh(); }, interval * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [interval, refresh]);

  return { refresh, isRefreshing, interval, setInterval: setInterval_, lastRefreshed };
}
