import { query } from "./db";

type EmployeeRow = {
  employee_id: string;
  name: string;
};

// Stray internal spaces (e.g. "M. Syafi' i" vs "M. Syafi'i") are a known
// data-entry issue in the employee table, so matching ignores all
// whitespace rather than just leading/trailing.
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

export async function getEmployeeIdByName(): Promise<Map<string, string>> {
  const rows = await query<EmployeeRow[]>(
    "SELECT employee_id, name FROM employee",
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(normalizeName(row.name), row.employee_id);
  }
  return map;
}

export function resolveEmployee(
  rawName: string | null | undefined,
  employeeMap: Map<string, string>,
): string | null {
  const trimmed = rawName?.trim();
  if (!trimmed) return null;

  const employeeId = employeeMap.get(normalizeName(trimmed));
  return employeeId ?? trimmed;
}

const SALES_UNMATCHED_ALLOWED = new Set(["Customer Relation Officer"]);

/**
 * Same lookup as resolveEmployee, but signals when the row should be
 * dropped: an unmatched Sales name is only kept raw for the
 * "Customer Relation Officer" placeholder, everything else is skipped.
 */
export function resolveSales(
  rawName: string | null | undefined,
  employeeMap: Map<string, string>,
): { value: string | null; skip: boolean } {
  const trimmed = rawName?.trim();
  if (!trimmed) return { value: null, skip: true };

  const employeeId = employeeMap.get(normalizeName(trimmed));
  if (employeeId) return { value: employeeId, skip: false };

  if (SALES_UNMATCHED_ALLOWED.has(trimmed)) {
    return { value: trimmed, skip: false };
  }

  return { value: null, skip: true };
}
