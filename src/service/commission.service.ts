import {
  calculateAchievement,
  calculateBonus,
  calculateCommission,
  calculateNusaSelectaActivity,
  getCommissionBasis,
  getServiceGroupLabel,
  hasCommissionRate,
  isNusaBasicPrime,
  isNusaSelecta,
  isNusaUltra,
  toCommissionCategory,
  toNumber,
  type SnapshotType,
} from "../helper/commission.helper";
import { getDateRangeForPeriod, toSqlDate } from "../helper/period.helper";
import type {
  CommissionBreakdown,
  CommissionLineItem,
  CommissionSnapshotRow,
  CommissionStats,
  ISnapshotReadRepository,
  SalesCommissionResult,
} from "../interface/commission.interface";
import type { ChurnRow, IChurnService } from "../interface/churn.interface";
import type { IEmployeeService } from "../interface/employee.interface";

function emptyStats(): CommissionStats {
  return { count: 0, commission: 0, subscription: 0, mrc: 0 };
}

function emptyBreakdown(): CommissionBreakdown {
  return {
    new: emptyStats(),
    upgrade: emptyStats(),
    prorate: emptyStats(),
    recurring: emptyStats(),
    alat: emptyStats(),
    setup: emptyStats(),
  };
}

function addTo(target: CommissionStats, values: Partial<CommissionStats>): void {
  target.count += values.count ?? 0;
  target.commission += values.commission ?? 0;
  target.subscription += values.subscription ?? 0;
  target.mrc += values.mrc ?? 0;
}

/** The bucket a row falls into for display: Alat/Setup override the invoice's own type. */
function resolveBucket(row: CommissionSnapshotRow): SnapshotType | "alat" | "setup" {
  const category = toCommissionCategory(row.category);
  if (category === "alat") return "alat";
  if (category === "setup") return "setup";
  return row.type ?? "recurring";
}

/**
 * NusaSelecta packages earn nothing on recurring — only New/Upgrade/Prorate
 * (KOMISI.md 2.A). These rows are dropped outright rather than rated at 0%,
 * matching the legacy behaviour of filtering them in the query.
 *
 * Home-category New/Upgrade sales of a service with no configured rate are
 * dropped the same way: they earn no commission AND give no New Achievement
 * credit, rather than silently earning free target progress at 0%. Recurring
 * is unaffected — its rate never depends on the service's rate-table entry.
 */
function isExcludedFromCommission(row: CommissionSnapshotRow): boolean {
  const bucket = resolveBucket(row);
  if (bucket === "recurring" && isNusaSelecta(row.service_id)) return true;

  const category = toCommissionCategory(row.category);
  if (category === "home" && (bucket === "new" || bucket === "upgrade")) {
    return !hasCommissionRate(row.service_id);
  }

  return false;
}

export class CommissionService {
  constructor(
    private readonly snapshotRepository: ISnapshotReadRepository,
    private readonly churnService: IChurnService,
    private readonly employeeService: IEmployeeService,
  ) {}

  /**
   * Itemized churn rows for one salesperson in a period, each valued the
   * same way as the deduction it feeds into — what fed the deduction total.
   */
  async getSalesChurn(employeeId: string, period: string) {
    const { start, end } = getDateRangeForPeriod(period);
    const startDate = toSqlDate(start);
    const endDate = toSqlDate(end);

    const [rows, status] = await Promise.all([
      this.churnService.getByEmployeeId(employeeId, startDate, endDate),
      this.employeeService.getStatusByPeriod(employeeId, startDate, endDate),
    ]);

    return rows.map((churn) => {
      const { mrc, commission, commissionPercentage } = this.valueChurn(churn, status);
      return { ...churn, mrc, commission, commissionPercentage };
    });
  }

  /**
   * Lightweight per-month totals for a whole year, reusing getSalesCommission
   * for each period so the dashboard's yearly chart never drifts from the
   * single-period numbers it's built from.
   */
  async getSalesCommissionYear(employeeId: string, year: number) {
    const periods = Array.from({ length: 12 }, (_, i) => `${year}${String(i + 1).padStart(2, "0")}`);
    const months = await Promise.all(
      periods.map((period) => this.getSalesCommission(employeeId, period)),
    );

    const yearly = emptyStats();
    for (const month of months) {
      addTo(yearly, month.total);
    }

    return {
      year,
      employeeId,
      yearly,
      months: months.map(({ items, ...summary }) => summary),
    };
  }

  /**
   * Full commission picture for one salesperson in one period: the net
   * activity count that drives target-dependent rates, per-type and
   * per-service-group breakdowns, and the churn deduction.
   */
  async getSalesCommission(
    employeeId: string,
    period: string,
  ): Promise<SalesCommissionResult> {
    const { start, end } = getDateRangeForPeriod(period);
    const startDate = toSqlDate(start);
    const endDate = toSqlDate(end);

    const [allRows, churnRows, status] = await Promise.all([
      this.snapshotRepository.findBySales(employeeId, period),
      this.churnService.getByEmployeeId(employeeId, startDate, endDate),
      this.employeeService.getStatusByPeriod(employeeId, startDate, endDate),
    ]);

    const rows = allRows.filter((row) => !isExcludedFromCommission(row));

    const { activityCount, grossNusaSelectaActivity, customerHasSetup } =
      this.computeActivity(rows, churnRows);

    const total = emptyStats();
    const breakdown = emptyBreakdown();
    const byServiceGroup: Record<string, CommissionBreakdown> = {
      Home: emptyBreakdown(),
      Nusafiber: emptyBreakdown(),
      NusaSelecta: emptyBreakdown(),
    };
    const items: CommissionLineItem[] = [];

    for (const row of rows) {
      const category = toCommissionCategory(row.category);
      const bucket = resolveBucket(row);
      const type = (row.type ?? "recurring") as SnapshotType;
      const months = Math.max(toNumber(row.month) || 1, 1);

      const subscription = toNumber(row.subscription);
      const mrc = subscription / months;
      const basis = getCommissionBasis(
        subscription,
        toNumber(row.referral_fee),
        row.referral_type,
      );

      const { commission, commissionPercentage, baseCommission } = calculateCommission(
        basis,
        row.late_month,
        row.is_approved,
        {
          category,
          type,
          serviceId: row.service_id,
          months,
          status,
          activityCount,
          hasSetup: customerHasSetup.has(row.customer_id),
          businessOperation: row.business_operation,
        },
      );

      // NusaSelecta "new" units are counted as grouped achievements
      // instead of one-per-row, so they're excluded from the raw count
      // and added back in aggregate below.
      const countsIndividually = !(isNusaSelecta(row.service_id) && bucket === "new");
      const delta = {
        count: countsIndividually ? 1 : 0,
        commission,
        subscription,
        mrc,
      };

      addTo(total, delta);
      addTo(breakdown[bucket], delta);

      const group = getServiceGroupLabel(row.service_id);
      addTo(byServiceGroup[group]![bucket], delta);

      items.push({
        aiInvoice: row.ai_invoice,
        aiReceipt: row.ai_receipt,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerCompany: row.customer_company,
        customerServiceId: row.customer_service_id,
        customerServiceAccount: row.customer_service_account,
        serviceId: row.service_id,
        serviceName: row.service_name,
        category: row.category,
        businessOperation: row.business_operation,
        type: bucket,
        month: months,
        lateMonth: toNumber(row.late_month),
        isApproved: Boolean(row.is_approved),
        paidDate: row.paid_date ? toSqlDate(new Date(row.paid_date)) : null,
        subscription,
        mrc,
        referralFee: toNumber(row.referral_fee),
        referralType: row.referral_type,
        baseCommission,
        commissionPercentage,
        commission,
      });
    }

    // Grouped NusaSelecta achievements re-enter the displayed counts.
    total.count += grossNusaSelectaActivity;
    breakdown.new.count += grossNusaSelectaActivity;
    byServiceGroup.NusaSelecta!.new.count += grossNusaSelectaActivity;

    const deduction = this.applyChurnDeduction(
      churnRows,
      status,
      activityCount,
      total,
      breakdown,
      byServiceGroup,
    );

    const { achievementStatus, motivation } = calculateAchievement(status, activityCount);

    return {
      period,
      startDate,
      endDate,
      employeeId,
      status,
      activityCount,
      achievementStatus,
      motivation,
      bonus: calculateBonus(activityCount),
      total,
      breakdown,
      byServiceGroup,
      deduction,
      items,
    };
  }

  /**
   * New Achievement drives every target-dependent rate, so it's computed
   * first: standard services count 1:1, NusaSelecta is grouped, and
   * unapproved churn is subtracted before grouping.
   */
  private computeActivity(rows: CommissionSnapshotRow[], churnRows: ChurnRow[]) {
    let basicPrime = 0;
    let ultra = 0;
    let standard = 0;
    const customerHasSetup = new Set<string>();

    for (const row of rows) {
      const bucket = resolveBucket(row);
      if (bucket === "setup") customerHasSetup.add(row.customer_id);
      if (bucket !== "new") continue;

      if (isNusaBasicPrime(row.service_id)) basicPrime++;
      else if (isNusaUltra(row.service_id)) ultra++;
      else standard++;
    }

    const grossNusaSelectaActivity = calculateNusaSelectaActivity(basicPrime, ultra);

    let netBasicPrime = basicPrime;
    let netUltra = ultra;
    let netStandard = standard;

    for (const churn of churnRows) {
      if (churn.is_approved) continue;
      if (isNusaBasicPrime(churn.service_id)) netBasicPrime--;
      else if (isNusaUltra(churn.service_id)) netUltra--;
      else netStandard--;
    }

    const activityCount = Math.max(
      0,
      netStandard + calculateNusaSelectaActivity(netBasicPrime, netUltra),
    );

    return { activityCount, grossNusaSelectaActivity, customerHasSetup };
  }

  /**
   * What one unapproved churn is worth: valued at the New rate assuming
   * target was met, so the deduction itself isn't discounted by the
   * performance penalty.
   */
  private valueChurn(churn: ChurnRow, status: string | null) {
    const price = toNumber(churn.price);
    const months = Math.max(toNumber(churn.period) || 1, 1);
    const mrc = price / months;

    const { commission, commissionPercentage } = calculateCommission(price, 0, false, {
      category: "home",
      type: "new",
      serviceId: churn.service_id,
      months,
      status,
      activityCount: 12,
      hasSetup: false,
      businessOperation: null,
    });

    return { price, months, mrc, commission, commissionPercentage };
  }

  /**
   * Each unapproved churn reverses a "new" sale: it removes the count,
   * the subscription, the MRC, and the commission it would have earned.
   */
  private applyChurnDeduction(
    churnRows: ChurnRow[],
    status: string | null,
    activityCount: number,
    total: CommissionStats,
    breakdown: CommissionBreakdown,
    byServiceGroup: Record<string, CommissionBreakdown>,
  ) {
    const deduction = { count: 0, commission: 0, subscription: 0, mrc: 0 };

    for (const churn of churnRows) {
      if (churn.is_approved) continue;

      const { price, mrc, commission } = this.valueChurn(churn, status);

      deduction.count += 1;
      deduction.commission += commission;
      deduction.subscription += price;
      deduction.mrc += mrc;

      const negative = { count: -1, commission: -commission, subscription: -price, mrc: -mrc };
      addTo(total, negative);
      addTo(breakdown.new, negative);

      const group = getServiceGroupLabel(churn.service_id);
      addTo(byServiceGroup[group]!.new, negative);
    }

    return deduction;
  }
}
