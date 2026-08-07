import type { AppDatabase } from "../lib/app-database";
import type { ISnapshotRepository } from "../interface/snapshot.interface";
import type {
  CommissionSnapshotRow,
  ISnapshotReadRepository,
} from "../interface/commission.interface";

const SNAPSHOT_COLUMNS = `
  period, ai_invoice, ai_receipt, customer_id, customer_name, customer_company,
  customer_service_id, customer_service_account, service_id, service_name, category,
  sales, manager, vendor, subscription, line_rental, paid_date, month,
  late_month, type, referral_fee, referral_name, business_operation
`;

export class SnapshotRepository implements ISnapshotRepository, ISnapshotReadRepository {
  constructor(private readonly db: AppDatabase) {}

  /**
   * Joining `employee` is what enforces the "only real salespeople earn
   * commission" rule: rows whose `sales` holds an unresolved raw name
   * (or the Customer Relation Officer placeholder) simply don't match.
   */
  findBySales(employeeId: string, period: string): Promise<CommissionSnapshotRow[]> {
    return this.db.query<CommissionSnapshotRow[]>(
      `SELECT s.* FROM snapshots s
       JOIN employee e ON e.employee_id = s.sales
       WHERE s.sales = ? AND s.period = ?`,
      [employeeId, period],
    );
  }

  findBySalesIds(employeeIds: string[], period: string): Promise<CommissionSnapshotRow[]> {
    if (employeeIds.length === 0) return Promise.resolve([]);
    return this.db.query<CommissionSnapshotRow[]>(
      `SELECT s.* FROM snapshots s
       JOIN employee e ON e.employee_id = s.sales
       WHERE s.sales IN (?) AND s.period = ?`,
      [employeeIds, period],
    );
  }

  /**
   * Recurring rows credited to a manager directly via the `manager`
   * column. Unlike findBySales this deliberately does NOT require a real
   * salesperson — that's what lets Customer Relation Officer invoices
   * still count toward the manager's recurring pool (KOMISI.md 6.D).
   */
  findRecurringByManager(managerId: string, period: string): Promise<CommissionSnapshotRow[]> {
    return this.db.query<CommissionSnapshotRow[]>(
      `SELECT * FROM snapshots
       WHERE manager = ? AND period = ? AND type = 'recurring'`,
      [managerId, period],
    );
  }

  /**
   * Replaces every snapshots row for `period` whose `type` is in `types`
   * with `rows`, inside one transaction — so a re-run swaps that slice of
   * the period's data atomically (other queries never observe an empty
   * table in between, since MySQL hides uncommitted changes from other
   * sessions). Scoping the delete by `type` keeps this job's re-run from
   * wiping out rows a different job (e.g. old-customer vs new-customer)
   * wrote for the same period.
   */
  async replaceForPeriod(
    period: string,
    rows: any[][],
    types: string[],
  ): Promise<void> {
    await this.db.withTransaction(async (txQuery) => {
      await txQuery("DELETE FROM snapshots WHERE period = ? AND type IN (?)", [
        period,
        types,
      ]);

      if (rows.length > 0) {
        await txQuery(
          `INSERT INTO snapshots (${SNAPSHOT_COLUMNS}) VALUES ?`,
          [rows],
        );
      }
    });
  }
}
