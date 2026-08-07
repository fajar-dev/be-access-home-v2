import type { SnapshotType } from "../helper/commission.helper";

/** A snapshots row as the commission engine consumes it. */
export type CommissionSnapshotRow = {
  period: string;
  ai_invoice: number;
  ai_receipt: number | null;
  customer_id: string;
  customer_name: string | null;
  customer_company: string | null;
  customer_service_id: number | null;
  customer_service_account: string | null;
  service_id: string | null;
  service_name: string | null;
  category: string | null;
  sales: string | null;
  manager: string | null;
  subscription: number | null;
  line_rental: number | null;
  paid_date: Date | string | null;
  month: number | null;
  late_month: number | null;
  type: SnapshotType | null;
  referral_fee: number | null;
  referral_type: string | null;
  referral_name: string | null;
  business_operation: string | null;
  is_approved: number | boolean;
};

export interface ISnapshotReadRepository {
  /** Snapshots for one salesperson in a period. Only rows whose `sales` resolves to a real employee. */
  findBySales(employeeId: string, period: string): Promise<CommissionSnapshotRow[]>;
  /** Same, for many salespeople at once. */
  findBySalesIds(employeeIds: string[], period: string): Promise<CommissionSnapshotRow[]>;
  /** Recurring rows credited to a manager via the `manager` column — includes rows with no real salesperson (e.g. Customer Relation Officer). */
  findRecurringByManager(managerId: string, period: string): Promise<CommissionSnapshotRow[]>;
}

export type CommissionStats = {
  count: number;
  commission: number;
  subscription: number;
  mrc: number;
};

export type CommissionBreakdown = Record<SnapshotType | "alat" | "setup", CommissionStats>;

export type CommissionLineItem = {
  aiInvoice: number;
  aiReceipt: number | null;
  customerId: string;
  customerName: string | null;
  customerCompany: string | null;
  customerServiceId: number | null;
  customerServiceAccount: string | null;
  serviceId: string | null;
  serviceName: string | null;
  category: string | null;
  businessOperation: string | null;
  type: string;
  month: number;
  lateMonth: number;
  isApproved: boolean;
  paidDate: string | null;
  subscription: number;
  mrc: number;
  referralFee: number;
  referralType: string | null;
  baseCommission: number;
  commissionPercentage: number;
  commission: number;
};

export type SalesCommissionResult = {
  period: string;
  startDate: string;
  endDate: string;
  employeeId: string;
  status: string | null;
  activityCount: number;
  achievementStatus: string;
  motivation: string;
  bonus: number;
  total: CommissionStats;
  breakdown: CommissionBreakdown;
  /** Same per-type breakdown as `breakdown`, scoped to each service group (Home/Nusafiber/NusaSelecta). */
  byServiceGroup: Record<string, CommissionBreakdown>;
  deduction: {
    count: number;
    commission: number;
    subscription: number;
    mrc: number;
  };
  items: CommissionLineItem[];
};

/** One team member's commission for the period, as shown in the manager dashboard's roster table. */
export type ManagerTeamMember = {
  employeeId: string;
  name: string;
  photoProfile: string;
  status: string | null;
  activityCount: number;
  achievementStatus: string;
  motivation: string;
  newSubscription: number;
  newMrc: number;
  newCommission: number;
  recurringSubscription: number;
  recurringCommission: number;
  otherSubscription: number;
  otherCommission: number;
  bonus: number;
  totalCommission: number;
  /**
   * This member's share of the manager's override, for the per-row display
   * column. Approximate: derived from the member's own totals at the
   * manager's flat rate, not from the authoritative override calculation
   * in `ManagerOverride` (which also covers non-team rows like CRO
   * placeholders) — don't expect these to sum exactly to `override`.
   */
  managerNewCommission: number;
  managerRecurringCommission: number;
  newService: { name: string; count: number; mrc: number; subscription: number }[];
};

/** KOMISI.md 6.A/6.B: team size, base/final target, and achieved status. */
export type ManagerTeamPerformance = {
  totalCount: number;
  permanentCount: number;
  otherCount: number;
  activity: number;
  baseTarget: number;
  thresholdPercentage: number;
  finalTarget: number;
  achievementPercentage: number;
  isTargetAchieved: boolean;
};

/** KOMISI.md 6.C/6.D: the manager's overriding commission on top of the team's production. */
export type ManagerOverride = {
  newCommissionRate: number;
  newCommission: number;
  teamNewCommissionPot: number;
  recurringCommissionRate: number;
  recurringCommission: number;
  /** NET recurring subscription behind the override, incl. CRO placeholder rows outside the team roster. */
  teamRecurringSubscriptionNet: number;
};

export type ManagerCommissionResult = {
  period: string;
  startDate: string;
  endDate: string;
  managerId: string;
  team: ManagerTeamPerformance;
  override: ManagerOverride;
  /** Team's raw production totals (the "pot" before the manager's override cut). */
  teamTotals: {
    newCommission: number;
    recurringCommission: number;
    newSubscription: number;
    newMrc: number;
  };
  /** The manager's own personal-sales commission (KOMISI.md 6.F) — same shape as a regular salesperson's. */
  personal: SalesCommissionResult;
  /** personal.total.commission + personal.bonus + override.newCommission + override.recurringCommission. */
  totalCommission: number;
  members: ManagerTeamMember[];
};
