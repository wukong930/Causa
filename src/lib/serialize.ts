// Utility to serialize database records to domain types (Date -> ISO string, recursive)

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

export function serializeRecord<T>(record: Record<string, unknown>): T {
  return serializeValue(record) as T;
}

export function serializeRecords<T>(records: Record<string, unknown>[]): T[] {
  return records.map((r) => serializeRecord<T>(r));
}
