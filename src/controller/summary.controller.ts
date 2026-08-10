import type { Context } from "hono";
import { BadRequestException } from "../exception/http.exception";
import { successResponse } from "../helper/api-response.helper";
import { resolvePeriodFromQuery } from "../helper/period-query.helper";
import { getDateRangeForPeriod, toSqlDate } from "../helper/period.helper";
import type { CommissionService } from "../service/commission.service";
import type { IChurnService } from "../interface/churn.interface";
import type { IEmployeeService } from "../interface/employee.interface";
import { DEFAULT_SALES_TARGET, type ITargetService, type SalesTargetItem } from "../interface/target.interface";

/** Admin-only cross-employee views: every Account Manager/Manager/invoice/churn row for a period. */
export class SummaryController {
  constructor(
    private readonly commissionService: CommissionService,
    private readonly churnService: IChurnService,
    private readonly employeeService: IEmployeeService,
    private readonly targetService: ITargetService,
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

  /** Every Account Manager's New Achievement target for a period — defaults to DEFAULT_SALES_TARGET when never overridden. */
  async target(c: Context) {
    const period = resolvePeriodFromQuery(c);
    const { start, end } = getDateRangeForPeriod(period);

    const employees = await this.employeeService.getAllSalesEmployees();
    const employeeIds = employees.map((e) => e.employee_id);

    const [targets, statuses] = await Promise.all([
      this.targetService.getTargetsByEmployeeIds(employeeIds, period),
      this.employeeService.getStatusesByPeriodAndIds(employeeIds, toSqlDate(start), toSqlDate(end)),
    ]);
    const statusByEmployeeId = new Map(statuses.map((s) => [s.employee_id, s.status]));

    const data: SalesTargetItem[] = employees.map((e) => ({
      employeeId: e.employee_id,
      name: e.name,
      photoProfile: e.photo_profile,
      status: statusByEmployeeId.get(e.employee_id) ?? null,
      target: targets.get(e.employee_id) ?? DEFAULT_SALES_TARGET,
    }));

    return c.json(successResponse("Sales target retrieved successfully", data));
  }

  /** Admin override of one Account Manager's New Achievement target for a period. */
  async updateTarget(c: Context) {
    const employeeId = c.req.param("id")!;
    const period = resolvePeriodFromQuery(c);
    const body = await c.req.json();

    const target = Number.parseInt(body.target, 10);
    if (Number.isNaN(target) || target < 0) {
      throw new BadRequestException("Parameter target must be a non-negative integer");
    }

    await this.targetService.setTarget(employeeId, period, target);
    return c.json(successResponse("Sales target updated successfully"));
  }
}
