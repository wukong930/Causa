import {
  severityFromZScore,
  calculateMA,
  calculateVolumeChange,
  buildTriggerStep,
} from "../base";

describe("severityFromZScore", () => {
  it("returns critical for |z| > 3.0", () => {
    expect(severityFromZScore(3.5)).toBe("critical");
  });

  it("returns critical for negative z with |z| > 3.0", () => {
    expect(severityFromZScore(-3.5)).toBe("critical");
  });

  it("returns high for |z| > 2.5", () => {
    expect(severityFromZScore(2.7)).toBe("high");
  });

  it("returns medium for |z| > 2.0", () => {
    expect(severityFromZScore(2.1)).toBe("medium");
  });

  it("returns low for |z| <= 2.0", () => {
    expect(severityFromZScore(1.5)).toBe("low");
  });
});

describe("calculateMA", () => {
  it("computes simple moving average correctly", () => {
    const result = calculateMA([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBe(2);
    expect(result[3]).toBe(3);
    expect(result[4]).toBe(4);
  });

  it("returns all NaN when window > data length", () => {
    const result = calculateMA([1, 2], 5);
    result.forEach((v) => expect(v).toBeNaN());
  });
});

describe("calculateVolumeChange", () => {
  it("computes percentage change", () => {
    expect(calculateVolumeChange(150, 100)).toBe(50);
  });

  it("returns -100 for current=0", () => {
    expect(calculateVolumeChange(0, 100)).toBe(-100);
  });

  it("returns 0 when previous is 0", () => {
    expect(calculateVolumeChange(100, 0)).toBe(0);
  });
});

describe("buildTriggerStep", () => {
  it("returns correct fields with ISO timestamp", () => {
    const step = buildTriggerStep(1, "Test", "Description", 0.9);
    expect(step.step).toBe(1);
    expect(step.label).toBe("Test");
    expect(step.description).toBe("Description");
    expect(step.confidence).toBe(0.9);
    expect(() => new Date(step.timestamp).toISOString()).not.toThrow();
  });
});
