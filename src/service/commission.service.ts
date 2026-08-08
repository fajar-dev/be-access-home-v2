import {
  applyLateMonthPenalty,
  calculateAchievement,
  calculateBonus,
  calculateCommission,
  calculateManagerPerformance,
  calculateNusaSelectaActivity,
  getCommissionBasis,
  getManagerNewCommissionRate,
  getManagerRecurringRate,
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
  ManagerCommissionResult,
  SalesCommissionResult,
} from "../interface/commission.interface";
import type { ChurnRow, IChurnService } from "../interface/churn.interface";
import type { IEmployeeService } from "../interface/employee.interface";
import { CRO_PLACEHOLDER } from "./employee.service";

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
   * Lightweight per-month totals for a whole year, reusing getManagerCommission
   * for each period.
   */
  async getManagerCommissionYear(managerId: string, year: number) {
    const periods = Array.from({ length: 12 }, (_, i) => `${year}${String(i + 1).padStart(2, "0")}`);
    const months = await Promise.all(
      periods.map((period) => this.getManagerCommission(managerId, period)),
    );

    return { year, managerId, months };
  }

  /**
   * Full commission picture for a Manager Area: team target/achievement
   * (KOMISI.md 6.A/6.B), overriding New/Recurring commission (6.C/6.D), and
   * the manager's own personal-sales commission (6.F), all NET of each
   * team member's own churn/penalties.
   */
  async getManagerCommission(managerId: string, period: string): Promise<ManagerCommissionResult> {
    const { start, end } = getDateRangeForPeriod(period);
    const startDate = toSqlDate(start);
    const endDate = toSqlDate(end);

    // Direct + recursive team, excluding the manager themselves — KOMISI.md
    // 6.F: personal sales must never feed back into team activity.
    const team = await this.employeeService.getHierarchy(managerId, undefined, false, false);
    const teamIds = team.map((e) => e.employee_id);

    const [statusRows, recurringRows] = await Promise.all([
      teamIds.length > 0
        ? this.employeeService.getStatusesByPeriodAndIds(teamIds, startDate, endDate)
        : Promise.resolve([]),
      this.snapshotRepository.findRecurringByManager(managerId, period),
    ]);

    // KOMISI.md 6.E: members without a status_period record for this period
    // are skipped entirely — no target contribution, no commission, no row.
    const statusByEmployeeId = new Map(statusRows.map((s) => [s.employee_id, s.status]));
    const coveredTeam = team.filter((e) => statusByEmployeeId.has(e.employee_id));

    const memberResults = await Promise.all(
      coveredTeam.map((e) => this.getSalesCommission(e.employee_id, period)),
    );

    const permanentCount = coveredTeam.filter(
      (e) => statusByEmployeeId.get(e.employee_id) === "Permanent",
    ).length;
    const teamActivity = memberResults.reduce((sum, r) => sum + r.activityCount, 0);

    const performance = calculateManagerPerformance(
      permanentCount,
      coveredTeam.length - permanentCount,
      teamActivity,
    );

    // 6.F: the manager's own sales use the TEAM's achieved status to gate
    // the recurring rate/performance penalty, not their personal activity.
    const personal = await this.getSalesCommission(
      managerId,
      period,
      performance.isTargetAchieved ? 12 : 0,
    );

    const teamTotals = {
      newCommission: 0,
      recurringCommission: 0,
      newSubscription: 0,
      newMrc: 0,
    };
    for (const r of memberResults) {
      teamTotals.newCommission += r.breakdown.new.commission;
      teamTotals.recurringCommission += r.breakdown.recurring.commission;
      teamTotals.newSubscription += r.breakdown.new.subscription;
      teamTotals.newMrc += r.breakdown.new.mrc;
    }

    const newCommissionRate = getManagerNewCommissionRate(performance.achievementPercentage);
    const overrideNewCommission = teamTotals.newCommission * (newCommissionRate / 100);

    // NET recurring subscription behind the override — same late-payment
    // treatment as an individual recurring row, summed across every row
    // credited to this manager (incl. Customer Relation Officer rows).
    let teamRecurringSubscriptionNet = 0;
    for (const row of recurringRows) {
      const basis = getCommissionBasis(
        toNumber(row.subscription),
        toNumber(row.referral_fee),
        row.referral_type,
      );
      teamRecurringSubscriptionNet += applyLateMonthPenalty(basis, row.late_month, row.is_approved);
    }

    const recurringCommissionRate = getManagerRecurringRate(performance.isTargetAchieved);
    const overrideRecurringCommission =
      teamRecurringSubscriptionNet * (recurringCommissionRate / 100);

    // KOMISI.md 6.D: Customer Relation Officer rows have no real salesperson,
    // so they never appear in any team member's own invoice list — surfaced
    // here instead, valued at the manager's own override rate since that's
    // the only commission stream they actually feed.
    const croRecurring = recurringRows
      .filter((row) => row.sales === CRO_PLACEHOLDER)
      .map((row) => this.valueManagerRecurringRow(row, recurringCommissionRate));

    const serviceGroups = ["Home", "Nusafiber", "NusaSelecta"] as const;
    const members = coveredTeam.map((e, i) => {
      const r = memberResults[i]!;
      const otherSubscription = r.breakdown.alat.subscription + r.breakdown.setup.subscription;
      const otherCommission = r.breakdown.alat.commission + r.breakdown.setup.commission;

      return {
        employeeId: e.employee_id,
        name: e.name,
        photoProfile: e.photo_profile,
        status: statusByEmployeeId.get(e.employee_id) ?? null,
        activityCount: r.activityCount,
        achievementStatus: r.achievementStatus,
        motivation: r.motivation,
        newSubscription: r.breakdown.new.subscription,
        newMrc: r.breakdown.new.mrc,
        newCommission: r.breakdown.new.commission,
        recurringSubscription: r.breakdown.recurring.subscription,
        recurringCommission: r.breakdown.recurring.commission,
        otherSubscription,
        otherCommission,
        bonus: r.bonus,
        totalCommission: r.total.commission + r.bonus,
        managerNewCommission: r.breakdown.new.commission * (newCommissionRate / 100),
        managerRecurringCommission: r.breakdown.recurring.subscription * (recurringCommissionRate / 100),
        newService: serviceGroups.map((name) => ({
          name,
          count: r.byServiceGroup[name]?.new.count ?? 0,
          mrc: r.byServiceGroup[name]?.new.mrc ?? 0,
          subscription: r.byServiceGroup[name]?.new.subscription ?? 0,
        })),
      };
    });

    return {
      period,
      startDate,
      endDate,
      managerId,
      team: {
        totalCount: coveredTeam.length,
        permanentCount,
        otherCount: coveredTeam.length - permanentCount,
        activity: teamActivity,
        baseTarget: performance.baseTarget,
        thresholdPercentage: performance.thresholdPercentage,
        finalTarget: performance.finalTarget,
        achievementPercentage: performance.achievementPercentage,
        isTargetAchieved: performance.isTargetAchieved,
      },
      override: {
        newCommissionRate,
        newCommission: overrideNewCommission,
        teamNewCommissionPot: teamTotals.newCommission,
        recurringCommissionRate,
        recurringCommission: overrideRecurringCommission,
        teamRecurringSubscriptionNet,
      },
      teamTotals,
      personal,
      croRecurring,
      totalCommission:
        personal.total.commission + personal.bonus + overrideNewCommission + overrideRecurringCommission,
      members,
    };
  }

  /**
   * Values a raw recurring snapshot row at a flat percentage instead of the
   * usual status/activity-gated rate — used for Customer Relation Officer
   * rows, which have no real employee to derive a rate from.
   */
  private valueManagerRecurringRow(row: CommissionSnapshotRow, ratePercentage: number): CommissionLineItem {
    const months = Math.max(toNumber(row.month) || 1, 1);
    const subscription = toNumber(row.subscription);
    const mrc = subscription / months;
    const basis = getCommissionBasis(subscription, toNumber(row.referral_fee), row.referral_type);
    const baseCommission = applyLateMonthPenalty(basis, row.late_month, row.is_approved);

    return {
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
      type: "recurring",
      month: months,
      lateMonth: toNumber(row.late_month),
      isApproved: Boolean(row.is_approved),
      paidDate: row.paid_date ? toSqlDate(new Date(row.paid_date)) : null,
      subscription,
      mrc,
      referralFee: toNumber(row.referral_fee),
      referralType: row.referral_type,
      baseCommission,
      commissionPercentage: ratePercentage,
      commission: baseCommission * (ratePercentage / 100),
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
    /**
     * Overrides the activity count fed into the recurring-rate and
     * performance-penalty checks (both gated on `< 12`), without touching
     * the real activityCount used for achievement/motivation/bonus display.
     * Used for a Manager's personal sales (KOMISI.md 6.F), where "target
     * achieved" comes from the manager's own team performance rather than
     * their personal New Achievement.
     */
    rateActivityCountOverride?: number,
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
    const rateActivityCount = rateActivityCountOverride ?? activityCount;

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
          activityCount: rateActivityCount,
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
