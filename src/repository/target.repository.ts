import type { AppDatabase } from "../lib/app-database";
import type { ITargetRepository, SalesTargetRow } from "../interface/target.interface";

export class TargetRepository implements ITargetRepository {
  constructor(private readonly db: AppDatabase) {}

  findByEmployeeIdsAndPeriod(employeeIds: string[], period: string): Promise<SalesTargetRow[]> {
    if (employeeIds.length === 0) return Promise.resolve([]);
    return this.db.query<SalesTargetRow[]>(
      `SELECT employee_id, period, target FROM sales_target WHERE employee_id IN (?) AND period = ?`,
      [employeeIds, period],
    );
  }

  async upsert(employeeId: string, period: string, target: number): Promise<void> {
    await this.db.query(
      `INSERT INTO sales_target (employee_id, period, target) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE target = VALUES(target)`,
      [employeeId, period, target],
    );
  }
}
