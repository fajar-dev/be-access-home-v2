import { withTransaction } from "../lib/app-db";

const SNAPSHOT_COLUMNS = `
  period, ai_invoice, ai_receipt, customer_id, customer_name, customer_company,
  customer_service_id, customer_service_account, service_name, category,
  sales, manager, vendor, subscription, line_rental, paid_date, month,
  late_month, type, referral_fee, referral_name, business_operation
`;

/**
 * Replaces every snapshots row for `period` whose `type` is in `types`
 * with `rows`, inside one transaction — so a re-run swaps that slice of
 * the period's data atomically (other queries never observe an empty
 * table in between, since MySQL hides uncommitted changes from other
 * sessions). Scoping the delete by `type` keeps this job's re-run from
 * wiping out rows a different job (e.g. old-customer vs new-customer)
 * wrote for the same period.
 */
export async function replaceSnapshotsForPeriod(
  period: string,
  rows: any[][],
  types: string[],
): Promise<void> {
  await withTransaction(async (txQuery) => {
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
