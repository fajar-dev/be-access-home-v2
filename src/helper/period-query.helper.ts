import type { Context } from "hono";
import { BadRequestException } from "../exception/http.exception";

/** Accepts either ?period=YYYYMM or ?month=M&year=YYYY. */
export function resolvePeriodFromQuery(c: Context): string {
  const period = c.req.query("period");
  if (period) {
    if (!/^\d{6}$/.test(period)) {
      throw new BadRequestException("Period format must be YYYYMM, e.g. 202608");
    }
    return period;
  }

  const month = c.req.query("month");
  const year = c.req.query("year");
  if (!month || !year) {
    throw new BadRequestException("Parameter period (YYYYMM) or month & year is required");
  }

  const monthInt = Number.parseInt(month, 10);
  const yearInt = Number.parseInt(year, 10);
  if (Number.isNaN(monthInt) || Number.isNaN(yearInt) || monthInt < 1 || monthInt > 12) {
    throw new BadRequestException("Parameter month or year is invalid");
  }

  return `${yearInt}${String(monthInt).padStart(2, "0")}`;
}

export function resolveYearFromQuery(c: Context): number {
  const yearParam = c.req.query("year");
  const year = Number.parseInt(yearParam ?? "", 10);
  if (!yearParam || Number.isNaN(year)) {
    throw new BadRequestException("Parameter year is required");
  }
  return year;
}
