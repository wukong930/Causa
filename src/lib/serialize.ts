// Utility to serialize database records to domain types (Date -> ISO string)
export function serializeRecord<T>(record: any): T {
  const serialized: any = {};

  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      serialized[key] = value.toISOString();
    } else {
      serialized[key] = value;
    }
  }

  return serialized as T;
}

export function serializeRecords<T>(records: any[]): T[] {
  return records.map(record => serializeRecord<T>(record));
}
