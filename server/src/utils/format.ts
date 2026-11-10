export function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function toCamel<T>(value: T): T {
  if (Array.isArray(value)) return value.map(toCamel) as T;
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [camelKey(key), toCamel(entry)])) as T;
  }
  return value;
}
