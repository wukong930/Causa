export interface GDELTEvent {
  url: string;
  title: string;
  source: string;
  publishedAt: string;
  tone: number;
  themes: string[];
  locations: string[];
}

const GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc";

const COMMODITY_KEYWORDS = [
  "iron ore", "steel", "copper", "aluminum", "crude oil", "natural gas",
  "coal", "nickel", "zinc", "gold", "silver", "soybean", "corn", "wheat",
  "trade war", "tariff", "sanctions", "supply chain", "inventory",
  "铁矿", "钢铁", "铜", "铝", "原油", "天然气", "煤炭", "镍", "锌",
  "黄金", "白银", "大豆", "玉米", "小麦", "关税", "制裁", "供应链",
];

/**
 * Fetch commodity-relevant events from GDELT 2.0 API.
 */
export async function fetchGDELTEvents(
  query?: string,
  maxRecords: number = 20
): Promise<GDELTEvent[]> {
  const searchQuery = query || COMMODITY_KEYWORDS.slice(0, 10).join(" OR ");

  const params = new URLSearchParams({
    query: searchQuery,
    mode: "ArtList",
    maxrecords: String(maxRecords),
    format: "json",
    sort: "DateDesc",
    timespan: "7d",
  });

  try {
    const response = await fetch(`${GDELT_API}?${params}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`GDELT API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const articles = data.articles ?? [];

    return articles.map((a: Record<string, unknown>) => ({
      url: String(a.url ?? ""),
      title: String(a.title ?? ""),
      source: String(a.domain ?? a.source ?? ""),
      publishedAt: String(a.seendate ?? ""),
      tone: Number(a.tone ?? 0),
      themes: [],
      locations: [],
    }));
  } catch (err) {
    console.error("GDELT fetch failed:", err);
    return [];
  }
}
