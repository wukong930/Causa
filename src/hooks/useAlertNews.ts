"use client";

import { useState, useEffect } from "react";
import { COMMODITY_NAME_MAP } from "@/lib/constants";
import type { GDELTEvent } from "@/lib/context/gdelt";

interface UseAlertNewsResult {
  news: GDELTEvent[];
  loading: boolean;
}

/** Normalize GDELT seendate "20260420T120000Z" → ISO "2026-04-20T12:00:00Z" */
function normalizeDate(raw: string): string {
  if (!raw || raw.includes("-")) return raw;
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  return raw;
}

export function useAlertNews(relatedAssets: string[]): UseAlertNewsResult {
  const [news, setNews] = useState<GDELTEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const assetsKey = relatedAssets.slice().sort().join(",");

  useEffect(() => {
    if (!relatedAssets.length) return;

    const keywords = relatedAssets
      .map((sym) => COMMODITY_NAME_MAP[sym.replace(/\d+/, "").toUpperCase()])
      .filter(Boolean);

    if (!keywords.length) return;

    const query = keywords.join(" OR ");
    setLoading(true);

    fetch(`/api/context/gdelt?query=${encodeURIComponent(query)}&limit=5`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        const items = (json.data ?? []).map((e: GDELTEvent) => ({
          ...e,
          publishedAt: normalizeDate(e.publishedAt),
        }));
        setNews(items);
      })
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [assetsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { news, loading };
}
