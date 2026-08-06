import type {
  EmployeeDetail,
  EmployeeUpsertInput,
  IEmployeeRepository,
  IEmployeeService,
  SalesResolution,
} from "../interface/employee.interface";

const SALES_UNMATCHED_ALLOWED = new Set(["Customer Relation Officer"]);

export class EmployeeService implements IEmployeeService {
  constructor(private readonly employeeRepository: IEmployeeRepository) {}

  // Stray internal spaces (e.g. "M. Syafi' i" vs "M. Syafi'i") are a known
  // data-entry issue in the employee table, so matching ignores all
  // whitespace rather than just leading/trailing.
  private normalizeName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "");
  }

  async getEmployeeIdByName(): Promise<Map<string, string>> {
    const rows = await this.employeeRepository.findAll();

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(this.normalizeName(row.name), row.employee_id);
    }
    return map;
  }

  resolveEmployee(
    rawName: string | null | undefined,
    employeeMap: Map<string, string>,
  ): string | null {
    const trimmed = rawName?.trim();
    if (!trimmed) return null;

    const employeeId = employeeMap.get(this.normalizeName(trimmed));
    return employeeId ?? trimmed;
  }

  resolveSales(
    rawName: string | null | undefined,
    employeeMap: Map<string, string>,
  ): SalesResolution {
    const trimmed = rawName?.trim();
    if (!trimmed) return { value: null, skip: true };

    const employeeId = employeeMap.get(this.normalizeName(trimmed));
    if (employeeId) return { value: employeeId, skip: false };

    if (SALES_UNMATCHED_ALLOWED.has(trimmed)) {
      return { value: trimmed, skip: false };
    }

    return { value: null, skip: true };
  }

  upsertEmployee(data: EmployeeUpsertInput): Promise<void> {
    return this.employeeRepository.upsertEmployee(data);
  }

  upsertStatusPeriod(
    employeeId: string,
    startDate: string,
    endDate: string,
    status: string,
  ): Promise<void> {
    return this.employeeRepository.upsertStatusPeriod(employeeId, startDate, endDate, status);
  }

  getAllEmployeeIds(): Promise<string[]> {
    return this.employeeRepository.findAllEmployeeIds();
  }

  deactivateEmployee(employeeId: string): Promise<void> {
    return this.employeeRepository.updateActiveStatus(employeeId, false);
  }

  findByEmployeeId(employeeId: string): Promise<EmployeeDetail | null> {
    return this.employeeRepository.findByEmployeeId(employeeId);
  }

  findByEmail(email: string): Promise<EmployeeDetail | null> {
    return this.employeeRepository.findByEmail(email);
  }

  getHierarchy(
    employeeId: string,
    search?: string,
    isSelf: boolean = true,
    isActiveOnly: boolean = true,
  ): Promise<EmployeeDetail[]> {
    return this.employeeRepository.findHierarchy(employeeId, search, isSelf, isActiveOnly);
  }
}
