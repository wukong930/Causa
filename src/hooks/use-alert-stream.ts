"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Alert } from "@/types/domain";

interface AlertStreamEvent {
  type: "connected" | "alerts" | "heartbeat" | "error";
  timestamp?: string;
  alerts?: Alert[];
  count?: number;
  message?: string;
}

interface UseAlertStreamOptions {
  onAlerts?: (alerts: Alert[]) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
  since?: Date;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time alert updates via SSE
 */
export function useAlertStream({
  onAlerts,
  onConnect,
  onDisconnect,
  onError,
  since,
  enabled = true,
}: UseAlertStreamOptions) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sinceRef = useRef<Date | undefined>(since);

  const connect = useCallback(() => {
    if (!enabled) return;

    const url = sinceRef.current
      ? `/api/alerts/stream?since=${sinceRef.current.toISOString()}`
      : "/api/alerts/stream";

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      onConnect?.();
    };

    es.onmessage = (event) => {
      try {
        const data: AlertStreamEvent = JSON.parse(event.data);

        switch (data.type) {
          case "connected":
            break;
          case "alerts":
            if (data.alerts && data.alerts.length > 0) {
              // Update since timestamp to avoid re-fetching
              if (data.alerts[0]) {
                sinceRef.current = new Date(data.alerts[0].triggeredAt);
              }
              onAlerts?.(data.alerts);
            }
            break;
          case "heartbeat":
            break;
          case "error":
            onError?.(data.message || "Unknown error");
            break;
        }
      } catch (err) {
        console.error("Failed to parse SSE message:", err);
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      onDisconnect?.();

      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, 5000);
    };
  }, [enabled, onAlerts, onConnect, onDisconnect, onError]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect]);
}
