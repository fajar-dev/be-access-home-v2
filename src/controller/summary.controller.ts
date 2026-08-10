import type { Context } from "hono";
import { successResponse } from "../helper/api-response.helper";
import { resolvePeriodFromQuery } from "../helper/period-query.helper";
import { getDateRangeForPeriod, toSqlDate } from "../helper/period.helper";
import type { CommissionService } from "../service/commission.service";
import type { IChurnService } from "../interface/churn.interface";

/** Admin-only cross-employee views: every Account Manager/Manager/invoice/churn row for a period. */
export class SummaryController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly churnService: IChurnService,
  ) {}

  async sales(c: Context) {
    const period = resolvePeriodFromQuery(c);
    const data = await this.commissionService.getSalesSummary(period);
    return c.json(successResponse("Sales summary retrieved successfully", data));
  }

  async manager(c: Context) {
    const period = resolvePeriodFromQuery(c);
    const data = await this.commissionService.getManagerSummary(period);
    return c.json(successResponse("Manager summary retrieved successfully", data));
  }

  async invoice(c: Context) {
    const period = resolvePeriodFromQuery(c);
    const data = await this.commissionService.getInvoiceSummary(period);
    return c.json(successResponse("Invoice summary retrieved successfully", data));
  }

  async approveInvoice(c: Context) {
    const aiInvoice = Number.parseInt(c.req.param("ai")!, 10);
    const body = await c.req.json();
    await this.commissionService.approveInvoice(aiInvoice, Boolean(body.isApproved));
    return c.json(successResponse("Invoice approval updated successfully"));
  }

  async updateInvoiceReferral(c: Context) {
    const aiInvoice = Number.parseInt(c.req.param("ai")!, 10);
    const body = await c.req.json();
    await this.commissionService.updateInvoiceReferral(
      aiInvoice,
      Number(body.referralFee) || 0,
      body.referralType ?? null,
    );
    return c.json(successResponse("Invoice referral updated successfully"));
  }

  async churn(c: Context) {
    const period = resolvePeriodFromQuery(c);
    const { start, end } = getDateRangeForPeriod(period);
    const search = c.req.query("search");
    const data = await this.churnService.getSummary(toSqlDate(start), toSqlDate(end), search);
    return c.json(successResponse("Churn summary retrieved successfully", data));
  }

  async approveChurn(c: Context) {
    const customerServiceId = c.req.param("id")!;
    const body = await c.req.json();
    await this.churnService.updateApproval(customerServiceId, Boolean(body.isApproved));
    return c.json(successResponse("Churn approval updated successfully"));
  }
}
