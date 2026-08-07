export type EmployeeRow = {
  employee_id: string;
  name: string;
};

// Full `employee` table row, plus the manager fields joined in by
// findByEmployeeId. Optional since not every query joins them.
export type EmployeeDetail = {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  photo_profile: string;
  job_position: string;
  organization_name: string;
  job_level: string;
  branch: string;
  status: string;
  manager_id: number | null;
  has_dashboard: boolean;
  is_active: boolean;
  is_admin: boolean;
  managerName?: string | null;
  managerEmployeeId?: string | null;
  managerPhotoProfile?: string | null;
};

export type StatusPeriodRow = {
  employee_id: string;
  status: string;
  start_date: Date | string;
  end_date: Date | string;
};

export type EmployeeUpsertInput = {
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  photoProfile: string;
  jobPosition: string;
  organizationName: string;
  jobLevel: string;
  branch: string;
  status: string;
  managerId?: string | null;
  hasDashboard?: boolean;
};

export interface IEmployeeRepository {
  findAll(): Promise<EmployeeRow[]>;
  upsertEmployee(data: EmployeeUpsertInput): Promise<void>;
  findByEmployeeId(employeeId: string): Promise<EmployeeDetail | null>;
  findByEmail(email: string): Promise<EmployeeDetail | null>;
  findAllEmployeeIds(): Promise<string[]>;
  updateActiveStatus(employeeId: string, isActive: boolean): Promise<void>;
  upsertStatusPeriod(
    employeeId: string,
    startDate: string,
    endDate: string,
    status: string,
  ): Promise<void>;
  findStatusByPeriod(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<string | null>;
  findStatusesByPeriodAndIds(
    employeeIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<StatusPeriodRow[]>;
  /**
   * Recursive-CTE lookup: the employee's own reporting chain (isSelf=true)
   * or their direct team (isSelf=false), filtered to has_dashboard rows.
   * An employee with no manager (top of the org) instead gets every
   * has_dashboard employee, matching the original dashboard's "see everyone"
   * rule for the top-level role.
   */
  findHierarchy(
    employeeId: string,
    search: string | undefined,
    isSelf: boolean,
    isActiveOnly: boolean,
  ): Promise<EmployeeDetail[]>;
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

  upsertEmployee(data: EmployeeUpsertInput): Promise<void>;
  upsertStatusPeriod(
    employeeId: string,
    startDate: string,
    endDate: string,
    status: string,
  ): Promise<void>;
  getAllEmployeeIds(): Promise<string[]>;
  deactivateEmployee(employeeId: string): Promise<void>;
  /** Employment status recorded for that exact commission period, or null if never crawled. */
  getStatusByPeriod(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<string | null>;
  getStatusesByPeriodAndIds(
    employeeIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<StatusPeriodRow[]>;
  findByEmployeeId(employeeId: string): Promise<EmployeeDetail | null>;
  findByEmail(email: string): Promise<EmployeeDetail | null>;
  getHierarchy(
    employeeId: string,
    search?: string,
    isSelf?: boolean,
    isActiveOnly?: boolean,
  ): Promise<EmployeeDetail[]>;
}
