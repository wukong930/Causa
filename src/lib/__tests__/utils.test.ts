import {
  formatRelativeTime,
  formatPercent,
  formatNumber,
  formatConfidence,
  severityOrder,
  clsx,
  formatCurrency,
  getDataFreshness,
} from "@/lib/utils";

describe("formatRelativeTime", () => {
  it("returns — for null/undefined", () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime(undefined)).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(formatRelativeTime("not-a-date")).toBe("—");
  });

  it("returns 刚刚 for < 1 minute ago", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("刚刚");
  });

  it("returns minutes for < 60 min", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 分钟前");
  });

  it("returns hours for < 24 hours", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe("2 小时前");
  });

  it("returns days for >= 24 hours", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3 天前");
  });
});

describe("formatPercent", () => {
  it("formats positive with + sign", () => {
    expect(formatPercent(3.14)).toBe("+3.1%");
  });

  it("formats negative without extra sign", () => {
    expect(formatPercent(-2.5)).toBe("-2.5%");
  });

  it("returns — for NaN/Infinity", () => {
    expect(formatPercent(NaN)).toBe("—");
    expect(formatPercent(Infinity)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("adds thousands separator", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("returns — for NaN", () => {
    expect(formatNumber(NaN)).toBe("—");
  });
});

describe("formatConfidence", () => {
  it("converts 0-1 to percentage", () => {
    expect(formatConfidence(0.85)).toBe("85%");
  });

  it("returns — for NaN", () => {
    expect(formatConfidence(NaN)).toBe("—");
  });
});

describe("severityOrder", () => {
  it("maps severity to numeric order", () => {
    expect(severityOrder("critical")).toBe(0);
    expect(severityOrder("high")).toBe(1);
    expect(severityOrder("medium")).toBe(2);
    expect(severityOrder("low")).toBe(3);
  });
});

describe("clsx", () => {
  it("joins truthy strings and filters falsy", () => {
    expect(clsx("a", false, "b", null, undefined, "c")).toBe("a b c");
  });
});

describe("formatCurrency", () => {
  it("prepends ¥ with formatted number", () => {
    expect(formatCurrency(50000)).toBe("¥50,000");
  });
});

describe("getDataFreshness", () => {
  it("returns fresh for < 30 min", () => {
    const recent = new Date(Date.now() - 10 * 60_000).toISOString();
    expect(getDataFreshness(recent)).toBe("fresh");
  });

  it("returns stale for 30-120 min", () => {
    const stale = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(getDataFreshness(stale)).toBe("stale");
  });

  it("returns expired for > 120 min", () => {
    const old = new Date(Date.now() - 180 * 60_000).toISOString();
    expect(getDataFreshness(old)).toBe("expired");
  });
});
