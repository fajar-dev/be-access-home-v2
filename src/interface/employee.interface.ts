export type EmployeeRow = {
  employee_id: string;
  name: string;
};

export interface IEmployeeRepository {
  findAll(): Promise<EmployeeRow[]>;
}

export type SalesResolution = { value: string | null; skip: boolean };

export interface IEmployeeService {
  getEmployeeIdByName(): Promise<Map<string, string>>;
  resolveEmployee(
    rawName: string | null | undefined,
    employeeMap: Map<string, string>,
  ): string | null;
  /**
   * Same lookup as resolveEmployee, but signals when the row should be
   * dropped: an unmatched Sales name is only kept raw for the
   * "Customer Relation Officer" placeholder, everything else is skipped.
   */
  resolveSales(
    rawName: string | null | undefined,
    employeeMap: Map<string, string>,
  ): SalesResolution;
}
