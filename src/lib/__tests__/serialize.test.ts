import { serializeRecord, serializeRecords } from "@/lib/serialize";

describe("serializeRecord", () => {
  it("converts Date to ISO string", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    const result = serializeRecord<{ createdAt: string }>({ createdAt: date });
    expect(result.createdAt).toBe("2024-01-15T10:30:00.000Z");
  });

  it("handles nested objects with Dates", () => {
    const date = new Date("2024-06-01T00:00:00.000Z");
    const result = serializeRecord<{ nested: { ts: string } }>({
      nested: { ts: date },
    });
    expect(result.nested.ts).toBe("2024-06-01T00:00:00.000Z");
  });

  it("passes through primitives unchanged", () => {
    const result = serializeRecord<{ a: number; b: string; c: boolean }>({
      a: 42, b: "hello", c: true,
    });
    expect(result).toEqual({ a: 42, b: "hello", c: true });
  });
});

describe("serializeRecords", () => {
  it("serializes arrays of records with Dates", () => {
    const d1 = new Date("2024-01-01T00:00:00.000Z");
    const d2 = new Date("2024-02-01T00:00:00.000Z");
    const results = serializeRecords<{ ts: string }>([
      { ts: d1 },
      { ts: d2 },
    ]);
    expect(results).toEqual([
      { ts: "2024-01-01T00:00:00.000Z" },
      { ts: "2024-02-01T00:00:00.000Z" },
    ]);
  });
});
