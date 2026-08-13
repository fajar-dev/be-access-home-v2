import type { AppDatabase } from "../lib/app-database";
import type {
  ConsistencyBonusRow,
  IConsistencyBonusRepository,
} from "../interface/consistency-bonus.interface";

export class ConsistencyBonusRepository implements IConsistencyBonusRepository {
  constructor(private readonly db: AppDatabase) {}

  findByEmployeeIdsAndPeriod(employeeIds: string[], period: string): Promise<ConsistencyBonusRow[]> {
    if (employeeIds.length === 0) return Promise.resolve([]);
    return this.db.query<ConsistencyBonusRow[]>(
      `SELECT employee_id, period, amount, note, granted_by, created_at
       FROM consistency_bonus WHERE employee_id IN (?) AND period = ?`,
      [employeeIds, period],
    );
  }

  async upsert(employeeId: string, period: string, note: string, grantedBy: string): Promise<void> {
    await this.db.query(
      `INSERT INTO consistency_bonus (employee_id, period, note, granted_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note = VALUES(note), granted_by = VALUES(granted_by)`,
      [employeeId, period, note, grantedBy],
    );
  }

  async remove(employeeId: string, period: string): Promise<void> {
    await this.db.query(`DELETE FROM consistency_bonus WHERE employee_id = ? AND period = ?`, [
      employeeId,
      period,
    ]);
  }
}
