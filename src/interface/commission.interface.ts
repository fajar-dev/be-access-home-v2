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
  byServiceGroup: Record<string, CommissionStats>;
  deduction: {
    count: number;
    commission: number;
    subscription: number;
    mrc: number;
  };
  items: CommissionLineItem[];
};
