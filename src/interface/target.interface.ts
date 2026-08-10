/** Minimum monthly New Achievement expected from one Permanent sales, unless overridden per employee/period. */
export const DEFAULT_SALES_TARGET = 12;

export type SalesTargetRow = {
  employee_id: string;
  period: string;
  target: number;
};

export interface ITargetRepository {
  /** Explicit target overrides for the given employees in a period — missing rows mean "use the default". */
  findByEmployeeIdsAndPeriod(employeeIds: string[], period: string): Promise<SalesTargetRow[]>;
  upsert(employeeId: string, period: string, target: number): Promise<void>;
}

export interface ITargetService {
  /** One employee's target for a period, defaulting to DEFAULT_SALES_TARGET when unset. */
  getTarget(employeeId: string, period: string): Promise<number>;
  /** Many employees' targets for a period, as a Map with the default already applied for anyone missing a row. */
  getTargetsByEmployeeIds(employeeIds: string[], period: string): Promise<Map<string, number>>;
  setTarget(employeeId: string, period: string, target: number): Promise<void>;
}

/** One row of the admin "manage sales target" table. */
export type SalesTargetItem = {
  employeeId: string;
  name: string;
  photoProfile: string;
  status: string | null;
  target: number;
};
