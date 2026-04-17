/**
 * Fetch China 10-year government bond yield from chinabond.com.cn public API.
 * Free, no API key required.
 */
export async function fetchCN10YYield(): Promise<number | null> {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const url = "https://yield.chinabond.com.cn/cbweb-cbrc-web/cbrc/queryGjqxInfo";

    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: `workTime=${today}&locale=cn_ZH`,
    });

    if (!res.ok) return null;

    const data = await res.json();
    // Response contains an array of term/yield pairs
    // Look for the 10-year entry (term key varies: "10年" or similar)
    const records = Array.isArray(data) ? data : data?.records ?? data?.data ?? [];
    for (const record of records) {
      const term = String(record?.ztbm ?? record?.term ?? record?.qx ?? "");
      if (term.includes("10") || term.includes("十")) {
        const value = parseFloat(record?.qjbjjz ?? record?.yield ?? record?.value ?? "");
        if (!isNaN(value) && isFinite(value)) {
          return value;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
