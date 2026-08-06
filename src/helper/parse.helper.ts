import type { Scalar } from "../interface/snapshot.interface";

export function parseNumber(value: Scalar): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (value instanceof Date) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseIntOrNull(value: Scalar): number | null {
  const num = parseNumber(value);
  return num === null ? null : Math.trunc(num);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseDate(value: Scalar): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}
