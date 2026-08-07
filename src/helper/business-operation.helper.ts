export type BusinessOperation = "Internal" | "Resell";

/**
 * Normalizes the billing DB's `Services.BusinessOperation` enum
 * ('undefined' | 'internal' | 'resell' | 'access' | 'setup' | 'other')
 * down to the only two values commission rules care about. Anything else
 * returns null, which callers treat as "unclassified".
 */
export function normalizeBusinessOperation(
  value: string | null | undefined,
): BusinessOperation | null {
  if (value === "internal") return "Internal";
  if (value === "resell") return "Resell";
  return null;
}
