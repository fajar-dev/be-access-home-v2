import { DEFAULT_SALES_TARGET, type ITargetRepository, type ITargetService } from "../interface/target.interface";

export class TargetService implements ITargetService {
  constructor(private readonly targetRepository: ITargetRepository) {}

  async getTarget(employeeId: string, period: string): Promise<number> {
    const rows = await this.targetRepository.findByEmployeeIdsAndPeriod([employeeId], period);
    return rows[0]?.target ?? DEFAULT_SALES_TARGET;
  }

  async getTargetsByEmployeeIds(employeeIds: string[], period: string): Promise<Map<string, number>> {
    const rows = await this.targetRepository.findByEmployeeIdsAndPeriod(employeeIds, period);
    const targets = new Map<string, number>(employeeIds.map((id) => [id, DEFAULT_SALES_TARGET]));
    for (const row of rows) targets.set(row.employee_id, row.target);
    return targets;
  }

  setTarget(employeeId: string, period: string, target: number): Promise<void> {
    return this.targetRepository.upsert(employeeId, period, target);
  }
}
