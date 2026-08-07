import type { Context } from "hono";
import { BadRequestException } from "../exception/http.exception";
import { successResponse } from "../helper/api-response.helper";
import type { CommissionService } from "../service/commission.service";

/** Accepts either ?period=YYYYMM or ?month=M&year=YYYY. */
function resolvePeriodFromQuery(c: Context): string {
  const period = c.req.query("period");
  if (period) {
    if (!/^\d{6}$/.test(period)) {
      throw new BadRequestException("Format period harus YYYYMM, contoh: 202608");
    }
    return period;
  }

  const month = c.req.query("month");
  const year = c.req.query("year");
  if (!month || !year) {
    throw new BadRequestException("Parameter period (YYYYMM) atau month & year wajib diisi");
  }

  const monthInt = Number.parseInt(month, 10);
  const yearInt = Number.parseInt(year, 10);
  if (Number.isNaN(monthInt) || Number.isNaN(yearInt) || monthInt < 1 || monthInt > 12) {
    throw new BadRequestException("Parameter month atau year tidak valid");
  }

  return `${yearInt}${String(monthInt).padStart(2, "0")}`;
}

export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  /** Commission summary for one salesperson: totals, breakdown, achievement, bonus. */
  async salesCommission(c: Context) {
    const employeeId = c.req.param("id")!;
    const period = resolvePeriodFromQuery(c);

    const result = await this.commissionService.getSalesCommission(employeeId, period);
    const { items, ...summary } = result;

    return c.json(successResponse("Commission retrieved successfully", summary));
  }

  /** Per-month totals for a whole year, for the dashboard's yearly chart. */
  async salesCommissionYear(c: Context) {
    const employeeId = c.req.param("id")!;
    const yearParam = c.req.query("year");
    const year = Number.parseInt(yearParam ?? "", 10);
    if (!yearParam || Number.isNaN(year)) {
      throw new BadRequestException("Parameter year wajib diisi");
    }

    const result = await this.commissionService.getSalesCommissionYear(employeeId, year);
    return c.json(successResponse("Yearly commission retrieved successfully", result));
  }

  /** The underlying billing invoice list, each row with its own commission. */
  async salesInvoice(c: Context) {
    const employeeId = c.req.param("id")!;
    const period = resolvePeriodFromQuery(c);

    const result = await this.commissionService.getSalesCommission(employeeId, period);

    return c.json(
      successResponse("Invoice retrieved successfully", {
        period: result.period,
        startDate: result.startDate,
        endDate: result.endDate,
        count: result.items.length,
        data: result.items,
      }),
    );
  }
}
